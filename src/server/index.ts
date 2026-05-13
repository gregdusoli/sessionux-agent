import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { StorageService } from './storage';
import { SessionUnlocker } from './unlocker';
import {
  PROTOCOL_VERSION,
  PairingRequestSchema,
  SignedUnlockRequestSchema,
  ErrorResponse,
  UnlockResponse,
  PairingResponse
} from '../protocol/index.js';
import { SetupTokenService } from '../protocol/pairing.js';
import { SignatureService } from '../protocol/signature.js';
import { NonceStore, ClockService } from '../protocol/anti-replay.js';
import { DiscoveryService } from './discovery.js';
import { SecurityConfig } from '../protocol/security.js';

const storage = new StorageService();
storage.init();

const unlocker = new SessionUnlocker();
const pairingService = new SetupTokenService();
const nonceStore = new NonceStore();
const discovery = new DiscoveryService();

const fastify = Fastify({
  bodyLimit: SecurityConfig.bodyLimit,
  requestTimeout: SecurityConfig.requestTimeout,
  logger: {
    transport: {
      target: 'pino-pretty'
    }
  }
});

await fastify.register(cors, {
  origin: false,
});
await fastify.register(rateLimit, {
  max: SecurityConfig.rateLimit.max,
  timeWindow: SecurityConfig.rateLimit.timeWindow
});

// Health check
fastify.get('/health', async () => {
  return { status: 'ok', protocol_version: PROTOCOL_VERSION };
});

// Pairing
fastify.post('/pairing/complete', async (request, reply) => {
  try {
    const body = PairingRequestSchema.parse(request.body);

    const tokenPcId = pairingService.consume(body.setup_token);
    if (!tokenPcId || tokenPcId !== body.pc_id || body.pc_id !== storage.getPcId()) {
      return reply.code(400).send({
        protocol_version: PROTOCOL_VERSION,
        status: 'error',
        message: 'Invalid or expired setup token'
      } as PairingResponse);
    }

    // Persist device
    storage.addDevice({
      id: body.device_id,
      name: body.device_name,
      publicKey: body.public_key,
      addedAt: new Date().toISOString()
    });

    // Notify Main process (will be handled by stdout/ipc in child process)
    process.send?.({ type: 'pairing-success', deviceId: body.device_id });

    return {
      protocol_version: PROTOCOL_VERSION,
      status: 'success'
    } as PairingResponse;

  } catch (error) {
    fastify.log.error(error);
    return reply.code(400).send({
      protocol_version: PROTOCOL_VERSION,
      status: 'error',
      message: 'Invalid pairing request'
    });
  }
});

// Unlock
fastify.post('/unlock', async (request, reply) => {
  try {
    const body = SignedUnlockRequestSchema.parse(request.body);
    const { payload, signature } = body;

    // 1. Verify PC ID
    if (payload.pc_id !== storage.getPcId()) {
      return reply.code(403).send({
        protocol_version: PROTOCOL_VERSION,
        error_code: 'WRONG_PC',
        message: 'Request intended for another PC'
      } as ErrorResponse);
    }

    // 2. Verify Device
    const devices = storage.getTrustedDevices();
    const device = devices.find(d => d.id === payload.device_id);
    if (!device) {
      return reply.code(403).send({
        protocol_version: PROTOCOL_VERSION,
        error_code: 'DEVICE_UNTRUSTED',
        message: 'Device not paired'
      } as ErrorResponse);
    }

    // 3. Verify Anti-replay (Nonce)
    if (!nonceStore.isValid(payload.nonce)) {
      return reply.code(403).send({
        protocol_version: PROTOCOL_VERSION,
        error_code: 'INVALID_NONCE',
        message: 'Nonce already used or expired'
      } as ErrorResponse);
    }

    // 4. Verify Clock Window
    if (!ClockService.isWithinWindow(payload.timestamp)) {
      return reply.code(400).send({
        protocol_version: PROTOCOL_VERSION,
        status: 'clock_skew',
        server_time: ClockService.getServerTime(),
        message: 'Clock drift detected'
      } as UnlockResponse);
    }

    // 5. Verify Signature
    const isValid = SignatureService.verifySignature(payload, signature, device.publicKey);
    if (!isValid) {
      return reply.code(401).send({
        protocol_version: PROTOCOL_VERSION,
        error_code: 'INVALID_SIGNATURE',
        message: 'Signature verification failed'
      } as ErrorResponse);
    }

    // 6. Perform Unlock
    const result = await unlocker.performUnlock();
    if (result.success) {
      storage.updateLastUnlock(payload.device_id);
      process.send?.({ type: 'unlock-success', deviceId: payload.device_id });
      return {
        protocol_version: PROTOCOL_VERSION,
        status: 'success'
      } as UnlockResponse;
    } else {
      return reply.code(500).send({
        protocol_version: PROTOCOL_VERSION,
        status: 'error',
        message: result.error || 'Failed to unlock session'
      } as UnlockResponse);
    }

  } catch (error) {
    fastify.log.error(error);
    return reply.code(400).send({
      protocol_version: PROTOCOL_VERSION,
      error_code: 'INVALID_REQUEST',
      message: 'Malformed unlock request'
    });
  }
});

// Devices management (internal-ish, for the UI)
fastify.get('/devices', async () => {
  return storage.getTrustedDevices();
});

fastify.delete('/devices/:deviceId', async (request, _reply) => {
  const { deviceId } = request.params as { deviceId: string };
  storage.removeDevice(deviceId);
  return { success: true };
});

// Start server
const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3000;
    await fastify.listen({ port, host: '0.0.0.0' });
    fastify.log.info(`Server listening on ${port}`);

    // Start mDNS discovery
    discovery.start(port);

    // Inicia o pairing service se solicitado pelo main
    process.on('message', (msg: any) => {
    if (msg.type === 'generate-pairing-token') {
        const { token, payload } = pairingService.generateQrPayload(
          storage.getPcId(),
          msg.ip,
          port
        );
        process.send?.({ type: 'pairing-token-generated', token, payload });
      }
      if (msg.type === 'cancel-pairing-token') {
        pairingService.invalidate(msg.token);
      }
    });

  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
