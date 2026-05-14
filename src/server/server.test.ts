import { createAgentServer, type AgentStorage } from './app';
import { PROTOCOL_VERSION, type UnlockPayload } from '../protocol';
import { SetupTokenService } from '../protocol/pairing';
import { SignatureService } from '../protocol/signature';
import { FailureCooldown } from '../protocol/security';

const pcId = '86903260-2646-46c5-844c-9f826359049c';
const deviceId = 'f01d8b76-e5fa-45f1-a512-7d7039d305b6';

function createStorage(publicKey: string): AgentStorage {
  const devices = [
    {
      id: deviceId,
      name: 'phone',
      publicKey,
      addedAt: new Date().toISOString(),
    },
  ];

  return {
    getPcId: () => pcId,
    addDevice: vi.fn((device) => devices.push(device)),
    getTrustedDevices: () => devices,
    updateLastUnlock: vi.fn(),
    removeDevice: vi.fn(),
  };
}

function createPayload(nonce: string = crypto.randomUUID()): UnlockPayload {
  return {
    protocol_version: PROTOCOL_VERSION,
    command: 'unlock',
    pc_id: pcId,
    device_id: deviceId,
    timestamp: new Date().toISOString(),
    nonce,
  };
}

describe('Agent Fastify server', () => {
  it('responds to /health with a request id', async () => {
    const keys = SignatureService.generateRawKeyPair();
    const server = await createAgentServer({
      storage: createStorage(keys.publicKey),
      unlocker: { performUnlock: vi.fn() },
    });

    const response = await server.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-request-id']).toBeTruthy();
    expect(JSON.parse(response.payload)).toEqual({
      status: 'ok',
      protocol_version: PROTOCOL_VERSION,
    });
  });

  it('completes pairing with a valid one-time setup token', async () => {
    const keys = SignatureService.generateRawKeyPair();
    const storage = createStorage(keys.publicKey);
    const pairingService = new SetupTokenService();
    const { token } = pairingService.generateToken(pcId);
    const server = await createAgentServer({
      storage,
      unlocker: { performUnlock: vi.fn() },
      pairingService,
    });

    const response = await server.inject({
      method: 'POST',
      url: '/pairing/complete',
      payload: {
        protocol_version: PROTOCOL_VERSION,
        pc_id: pcId,
        setup_token: token,
        device_id: crypto.randomUUID(),
        public_key: keys.publicKey,
        device_name: 'phone',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(storage.addDevice).toHaveBeenCalledOnce();
  });

  it('rejects a setup token issued for another pc_id', async () => {
    const keys = SignatureService.generateRawKeyPair();
    const pairingService = new SetupTokenService();
    const { token } = pairingService.generateToken(crypto.randomUUID());
    const server = await createAgentServer({
      storage: createStorage(keys.publicKey),
      unlocker: { performUnlock: vi.fn() },
      pairingService,
    });

    const response = await server.inject({
      method: 'POST',
      url: '/pairing/complete',
      payload: {
        protocol_version: PROTOCOL_VERSION,
        pc_id: pcId,
        setup_token: token,
        device_id: crypto.randomUUID(),
        public_key: keys.publicKey,
        device_name: 'phone',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('unlocks with a trusted device and valid signature', async () => {
    const keys = SignatureService.generateRawKeyPair();
    const unlocker = { performUnlock: vi.fn(async () => ({ success: true })) };
    const storage = createStorage(keys.publicKey);
    const server = await createAgentServer({ storage, unlocker });
    const payload = createPayload();
    const signature = SignatureService.signPayloadRaw(payload, keys.privateKey);

    const response = await server.inject({
      method: 'POST',
      url: '/unlock',
      payload: { payload, signature },
    });

    expect(response.statusCode).toBe(200);
    expect(unlocker.performUnlock).toHaveBeenCalledOnce();
    expect(storage.updateLastUnlock).toHaveBeenCalledWith(deviceId);
  });

  it('rejects unlock from an unknown public key', async () => {
    const trusted = SignatureService.generateRawKeyPair();
    const attacker = SignatureService.generateRawKeyPair();
    const server = await createAgentServer({
      storage: createStorage(trusted.publicKey),
      unlocker: { performUnlock: vi.fn() },
    });
    const payload = createPayload();
    const signature = SignatureService.signPayloadRaw(payload, attacker.privateKey);

    const response = await server.inject({
      method: 'POST',
      url: '/unlock',
      payload: { payload, signature },
    });

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.payload).error_code).toBe('INVALID_SIGNATURE');
  });

  it('rejects repeated nonces', async () => {
    const keys = SignatureService.generateRawKeyPair();
    const server = await createAgentServer({
      storage: createStorage(keys.publicKey),
      unlocker: { performUnlock: vi.fn(async () => ({ success: true })) },
    });
    const payload = createPayload('same-nonce');
    const signature = SignatureService.signPayloadRaw(payload, keys.privateKey);

    await server.inject({ method: 'POST', url: '/unlock', payload: { payload, signature } });
    const replay = await server.inject({
      method: 'POST',
      url: '/unlock',
      payload: { payload, signature },
    });

    expect(replay.statusCode).toBe(403);
    expect(JSON.parse(replay.payload).error_code).toBe('INVALID_NONCE');
  });

  it('returns server_time on clock skew', async () => {
    const keys = SignatureService.generateRawKeyPair();
    const server = await createAgentServer({
      storage: createStorage(keys.publicKey),
      unlocker: { performUnlock: vi.fn() },
    });
    const payload = {
      ...createPayload(),
      timestamp: new Date(Date.now() - 60_000).toISOString(),
    };
    const signature = SignatureService.signPayloadRaw(payload, keys.privateKey);

    const response = await server.inject({
      method: 'POST',
      url: '/unlock',
      payload: { payload, signature },
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.payload).server_time).toBeTruthy();
  });

  it('rejects malformed unlock requests', async () => {
    const keys = SignatureService.generateRawKeyPair();
    const server = await createAgentServer({
      storage: createStorage(keys.publicKey),
      unlocker: { performUnlock: vi.fn() },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/unlock',
      payload: { payload: { protocol_version: PROTOCOL_VERSION } },
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.payload).error_code).toBe('INVALID_REQUEST');
  });

  it('rejects malformed pairing requests', async () => {
    const keys = SignatureService.generateRawKeyPair();
    const server = await createAgentServer({
      storage: createStorage(keys.publicKey),
      unlocker: { performUnlock: vi.fn() },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/pairing/complete',
      payload: { protocol_version: PROTOCOL_VERSION },
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.payload).message).toBe('Invalid pairing request');
  });

  it('rejects unlock requests for another pc_id', async () => {
    const keys = SignatureService.generateRawKeyPair();
    const server = await createAgentServer({
      storage: createStorage(keys.publicKey),
      unlocker: { performUnlock: vi.fn() },
    });
    const payload = { ...createPayload(), pc_id: crypto.randomUUID() };
    const signature = SignatureService.signPayloadRaw(payload, keys.privateKey);

    const response = await server.inject({
      method: 'POST',
      url: '/unlock',
      payload: { payload, signature },
    });

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.payload).error_code).toBe('WRONG_PC');
  });

  it('rejects unlock requests from unpaired devices', async () => {
    const keys = SignatureService.generateRawKeyPair();
    const storage = createStorage(keys.publicKey);
    vi.spyOn(storage, 'getTrustedDevices').mockReturnValue([]);
    const server = await createAgentServer({
      storage,
      unlocker: { performUnlock: vi.fn() },
    });
    const payload = createPayload();
    const signature = SignatureService.signPayloadRaw(payload, keys.privateKey);

    const response = await server.inject({
      method: 'POST',
      url: '/unlock',
      payload: { payload, signature },
    });

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.payload).error_code).toBe('DEVICE_UNTRUSTED');
  });

  it('returns server error when the session unlocker fails', async () => {
    const keys = SignatureService.generateRawKeyPair();
    const server = await createAgentServer({
      storage: createStorage(keys.publicKey),
      unlocker: { performUnlock: vi.fn(async () => ({ success: false, error: 'loginctl failed' })) },
    });
    const payload = createPayload();
    const signature = SignatureService.signPayloadRaw(payload, keys.privateKey);

    const response = await server.inject({
      method: 'POST',
      url: '/unlock',
      payload: { payload, signature },
    });

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.payload).message).toBe('loginctl failed');
  });

  it('blocks unlock requests while cooldown is active', async () => {
    const keys = SignatureService.generateRawKeyPair();
    const cooldown = new FailureCooldown();
    vi.spyOn(cooldown, 'isBlocked').mockReturnValue(true);
    const server = await createAgentServer({
      storage: createStorage(keys.publicKey),
      unlocker: { performUnlock: vi.fn() },
      cooldown,
    });
    const payload = createPayload();
    const signature = SignatureService.signPayloadRaw(payload, keys.privateKey);

    const response = await server.inject({
      method: 'POST',
      url: '/unlock',
      payload: { payload, signature },
    });

    expect(response.statusCode).toBe(429);
    expect(JSON.parse(response.payload).error_code).toBe('TOO_MANY_FAILURES');
  });

  it('lists and removes devices', async () => {
    const keys = SignatureService.generateRawKeyPair();
    const storage = createStorage(keys.publicKey);
    const server = await createAgentServer({
      storage,
      unlocker: { performUnlock: vi.fn() },
    });

    const list = await server.inject({ method: 'GET', url: '/devices' });
    const remove = await server.inject({
      method: 'DELETE',
      url: `/devices/${deviceId}`,
    });

    expect(list.statusCode).toBe(200);
    expect(JSON.parse(list.payload)[0].id).toBe(deviceId);
    expect(remove.statusCode).toBe(200);
    expect(storage.removeDevice).toHaveBeenCalledWith(deviceId);
  });

  it('rejects bodies over the configured limit', async () => {
    const keys = SignatureService.generateRawKeyPair();
    const server = await createAgentServer({
      storage: createStorage(keys.publicKey),
      unlocker: { performUnlock: vi.fn() },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/unlock',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ value: 'x'.repeat(70 * 1024) }),
    });

    expect(response.statusCode).toBe(413);
  });

  it('rate limits excessive requests by IP', async () => {
    const keys = SignatureService.generateRawKeyPair();
    const server = await createAgentServer({
      storage: createStorage(keys.publicKey),
      unlocker: { performUnlock: vi.fn() },
    });

    await server.inject({ method: 'GET', url: '/health' });
    await server.inject({ method: 'GET', url: '/health' });
    await server.inject({ method: 'GET', url: '/health' });
    const response = await server.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(429);
  });
});
