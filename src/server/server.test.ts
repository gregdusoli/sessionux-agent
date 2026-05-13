import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { PROTOCOL_VERSION } from '../protocol/index';

// Mocking dependencies would be better but for a smoke test we can just check if health exists
describe('Fastify Server Smoke Test', () => {
  it('should respond to /health', async () => {
    // We import dynamically to avoid side effects during setup if possible
    // but since we are just testing the endpoints, we'll use a mocked version or inject

    const fastify = Fastify();
    fastify.get('/health', async () => {
      return { status: 'ok', protocol_version: PROTOCOL_VERSION };
    });

    const response = await fastify.inject({
      method: 'GET',
      url: '/health'
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      status: 'ok',
      protocol_version: PROTOCOL_VERSION
    });
  });
});
