import { SignatureService } from './signature';
import { NonceStore, ClockService } from './anti-replay';
import { SetupTokenService } from './pairing';
import { serializeForSigning } from './serialization';

import { PairingRequestSchema, PROTOCOL_VERSION } from './index';

describe('Sessionux Protocol', () => {
  describe('Zod Validation', () => {
    it('should reject invalid protocol version', () => {
      const payload = {
        protocol_version: '0.9', // Incompatible
        pc_id: '86903260-2646-46c5-844c-9f826359049c',
        setup_token: '86903260-2646-46c5-844c-9f826359049c',
        device_id: '86903260-2646-46c5-844c-9f826359049c',
        public_key: 'key',
        device_name: 'phone'
      };
      
      const result = PairingRequestSchema.safeParse(payload);
      expect(result.success).toBe(false); // Should fail now with .literal()
    });

    it('should fail if required fields are missing', () => {
      const payload = { protocol_version: PROTOCOL_VERSION };
      const result = PairingRequestSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('Serialization', () => {
    it('should sort keys alphabetically', () => {
      const obj1 = { b: 2, a: 1 };
      const obj2 = { a: 1, b: 2 };
      expect(serializeForSigning(obj1)).toBe(serializeForSigning(obj2));
      expect(serializeForSigning(obj1)).toBe('{"a":1,"b":2}');
    });

    it('should handle nested objects', () => {
      const obj = { z: 1, a: { y: 2, b: 3 } };
      expect(serializeForSigning(obj)).toBe('{"a":{"b":3,"y":2},"z":1}');
    });
  });

  describe('SignatureService', () => {
    it('should sign and verify a payload correctly', () => {
      const { publicKey, privateKey } = SignatureService.generateKeyPair();
      const payload = { command: 'unlock', nonce: '123' };
      
      const signature = SignatureService.signPayload(payload, privateKey);
      const isValid = SignatureService.verifySignature(payload, signature, publicKey);
      
      expect(isValid).toBe(true);
    });

    it('should fail verification if payload is altered', () => {
      const { publicKey, privateKey } = SignatureService.generateKeyPair();
      const payload = { command: 'unlock', nonce: '123' };
      
      const signature = SignatureService.signPayload(payload, privateKey);
      const alteredPayload = { command: 'unlock', nonce: '124' };
      
      const isValid = SignatureService.verifySignature(alteredPayload, signature, publicKey);
      expect(isValid).toBe(false);
    });

    it('should verify raw Base64URL Ed25519 signatures used by Mobile', () => {
      const { publicKey, privateKey } = SignatureService.generateRawKeyPair();
      const payload = { command: 'unlock', nonce: '123' };

      const signature = SignatureService.signPayloadRaw(payload, privateKey);

      expect(SignatureService.verifySignature(payload, signature, publicKey)).toBe(true);
    });
  });

  describe('NonceStore', () => {
    it('should only allow a nonce once', () => {
      const store = new NonceStore();
      expect(store.isValid('nonce1')).toBe(true);
      expect(store.isValid('nonce1')).toBe(false);
    });

    it('should allow nonces again after TTL', () => {
      vi.useFakeTimers();
      const store = new NonceStore(100); // 100ms TTL
      
      expect(store.isValid('nonce1')).toBe(true);
      vi.advanceTimersByTime(150);
      expect(store.isValid('nonce1')).toBe(true);
      
      vi.useRealTimers();
    });
  });

  describe('ClockService', () => {
    it('should accept timestamps within window', () => {
      const now = new Date().toISOString();
      expect(ClockService.isWithinWindow(now)).toBe(true);
    });

    it('should reject old timestamps', () => {
      const old = new Date(Date.now() - 60000).toISOString(); // 1 minute ago
      expect(ClockService.isWithinWindow(old)).toBe(false);
    });

    it('should reject future timestamps', () => {
      const future = new Date(Date.now() + 60000).toISOString();
      expect(ClockService.isWithinWindow(future)).toBe(false);
    });
  });

  describe('SetupTokenService', () => {
    it('should generate and consume valid tokens', () => {
      const service = new SetupTokenService();
      const pcId = 'pc-123';
      const { token } = service.generateToken(pcId);
      
      expect(service.consume(token)).toBe(pcId);
      expect(service.consume(token)).toBe(null); // Consumed once
    });

    it('should reject expired tokens', () => {
      vi.useFakeTimers();
      const service = new SetupTokenService(100);
      const { token } = service.generateToken('pc-123');
      
      vi.advanceTimersByTime(150);
      expect(service.consume(token)).toBe(null);
      
      vi.useRealTimers();
    });
  });
});
