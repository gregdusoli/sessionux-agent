import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { randomUUID } from 'node:crypto';
import {
  PROTOCOL_VERSION,
  PairingRequestSchema,
  SignedUnlockRequestSchema,
  type ErrorResponse,
  type UnlockResponse,
  type PairingResponse,
} from '../protocol/index';
import { SetupTokenService } from '../protocol/pairing';
import { SignatureService } from '../protocol/signature';
import { NonceStore, ClockService } from '../protocol/anti-replay';
import { SecurityConfig, FailureCooldown } from '../protocol/security';
import type { Device, StorageService } from './storage';
import type { SessionUnlocker } from './unlocker';
import { registerZodValidation } from './validation';

export type AgentStorage = Pick<
  StorageService,
  | 'getPcId'
  | 'addDevice'
  | 'getTrustedDevices'
  | 'updateLastUnlock'
  | 'removeDevice'
>;

export type AgentUnlocker = Pick<SessionUnlocker, 'performUnlock'>;

export interface AgentServerDependencies {
  storage: AgentStorage;
  unlocker: AgentUnlocker;
  pairingService?: SetupTokenService;
  nonceStore?: NonceStore;
  cooldown?: FailureCooldown;
}

function redact(value: string | undefined): string | undefined {
  if (!value) return value;
  return value.length <= 8 ? '<redacted>' : `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function remoteKey(requestIp: string | undefined, deviceId: string | undefined): string {
  return `${requestIp ?? 'unknown'}:${deviceId ?? 'unknown'}`;
}

function auditFailure(
  fastify: { log: { warn: (obj: unknown) => void } },
  reason: string,
  requestId: string,
  deviceId?: string
): void {
  fastify.log.warn({ event: 'security_failure', reason, requestId, deviceId: redact(deviceId) });
}

export async function createAgentServer({
  storage,
  unlocker,
  pairingService = new SetupTokenService(),
  nonceStore = new NonceStore(),
  cooldown = new FailureCooldown(),
}: AgentServerDependencies) {
  const logger =
    process.env.NODE_ENV === 'test'
      ? { redact: ['req.headers.authorization', 'payload.signature', '*.public_key', '*.setup_token'] }
      : {
        redact: ['req.headers.authorization', 'payload.signature', '*.public_key', '*.setup_token'],
        transport: {
          target: 'pino-pretty',
        },
      };

  const fastify = Fastify({
    bodyLimit: SecurityConfig.bodyLimit,
    requestTimeout: SecurityConfig.requestTimeout,
    genReqId: () => randomUUID(),
    logger,
  });

  await fastify.register(cors, {
    origin: false,
  });
  await fastify.register(rateLimit, {
    max: SecurityConfig.rateLimit.max,
    timeWindow: SecurityConfig.rateLimit.timeWindow,
  });
  registerZodValidation(fastify);

  fastify.get('/health', async (_request, reply) => {
    reply.header('x-request-id', _request.id);
    return { status: 'ok', protocol_version: PROTOCOL_VERSION };
  });

  fastify.post('/pairing/complete', async (request, reply) => {
    reply.header('x-request-id', request.id);

    const parsed = fastify.parseZodBody(PairingRequestSchema, request.body);
    if (!parsed.success) {
      auditFailure(fastify, 'invalid_pairing_request', request.id);
      return reply.code(400).send({
        protocol_version: PROTOCOL_VERSION,
        status: 'error',
        message: 'Invalid pairing request',
      } as PairingResponse);
    }

    const body = parsed.data;
    const tokenPcId = pairingService.consume(body.setup_token);
    if (!tokenPcId || tokenPcId !== body.pc_id || body.pc_id !== storage.getPcId()) {
      auditFailure(fastify, 'invalid_setup_token', request.id, body.device_id);
      return reply.code(400).send({
        protocol_version: PROTOCOL_VERSION,
        status: 'error',
        message: 'Invalid or expired setup token',
      } as PairingResponse);
    }

    storage.addDevice({
      id: body.device_id,
      name: body.device_name,
      publicKey: body.public_key,
      addedAt: new Date().toISOString(),
    });

    process.send?.({ type: 'pairing-success', deviceId: body.device_id });

    return {
      protocol_version: PROTOCOL_VERSION,
      status: 'success',
    } as PairingResponse;
  });

  fastify.post('/unlock', async (request, reply) => {
    reply.header('x-request-id', request.id);

    const parsed = fastify.parseZodBody(SignedUnlockRequestSchema, request.body);
    if (!parsed.success) {
      auditFailure(fastify, 'malformed_unlock_request', request.id);
      return reply.code(400).send({
        protocol_version: PROTOCOL_VERSION,
        error_code: 'INVALID_REQUEST',
        message: 'Malformed unlock request',
      } as ErrorResponse);
    }

    const { payload, signature } = parsed.data;
    const abuseKey = remoteKey(request.ip, payload.device_id);
    if (cooldown.isBlocked(abuseKey)) {
      auditFailure(fastify, 'cooldown_active', request.id, payload.device_id);
      return reply.code(429).send({
        protocol_version: PROTOCOL_VERSION,
        error_code: 'TOO_MANY_FAILURES',
        message: 'Too many failed unlock attempts',
      } as ErrorResponse);
    }

    const fail = (statusCode: number, reason: string, error: ErrorResponse) => {
      cooldown.recordFailure(abuseKey);
      auditFailure(fastify, reason, request.id, payload.device_id);
      return reply.code(statusCode).send(error);
    };

    if (payload.pc_id !== storage.getPcId()) {
      return fail(403, 'wrong_pc', {
        protocol_version: PROTOCOL_VERSION,
        error_code: 'WRONG_PC',
        message: 'Request intended for another PC',
      });
    }

    const devices: Device[] = storage.getTrustedDevices();
    const device = devices.find((d) => d.id === payload.device_id);
    if (!device) {
      return fail(403, 'device_untrusted', {
        protocol_version: PROTOCOL_VERSION,
        error_code: 'DEVICE_UNTRUSTED',
        message: 'Device not paired',
      });
    }

    if (!nonceStore.isValid(payload.nonce)) {
      return fail(403, 'invalid_nonce', {
        protocol_version: PROTOCOL_VERSION,
        error_code: 'INVALID_NONCE',
        message: 'Nonce already used or expired',
      });
    }

    if (!ClockService.isWithinWindow(payload.timestamp)) {
      cooldown.recordFailure(abuseKey);
      auditFailure(fastify, 'clock_skew', request.id, payload.device_id);
      return reply.code(400).send({
        protocol_version: PROTOCOL_VERSION,
        status: 'clock_skew',
        server_time: ClockService.getServerTime(),
        message: 'Clock drift detected',
      } as UnlockResponse);
    }

    const isValid = SignatureService.verifySignature(payload, signature, device.publicKey);
    if (!isValid) {
      return fail(401, 'invalid_signature', {
        protocol_version: PROTOCOL_VERSION,
        error_code: 'INVALID_SIGNATURE',
        message: 'Signature verification failed',
      });
    }

    const result = await unlocker.performUnlock();
    if (!result.success) {
      fastify.log.warn({
        event: 'unlock_failed',
        requestId: request.id,
        deviceId: redact(payload.device_id),
      });
      return reply.code(500).send({
        protocol_version: PROTOCOL_VERSION,
        status: 'error',
        message: result.error || 'Failed to unlock session',
      } as UnlockResponse);
    }

    cooldown.recordSuccess(abuseKey);
    storage.updateLastUnlock(payload.device_id);
    fastify.log.info({
      event: 'unlock_success',
      requestId: request.id,
      deviceId: redact(payload.device_id),
    });
    process.send?.({ type: 'unlock-success', deviceId: payload.device_id });
    return {
      protocol_version: PROTOCOL_VERSION,
      status: 'success',
    } as UnlockResponse;
  });

  fastify.get('/devices', async () => storage.getTrustedDevices());

  fastify.delete('/devices/:deviceId', async (request) => {
    const { deviceId } = request.params as { deviceId: string };
    storage.removeDevice(deviceId);
    return { success: true };
  });

  return fastify;
}
