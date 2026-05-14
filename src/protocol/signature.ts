import { generateKeyPairSync, sign, verify } from 'node:crypto';
import * as ed25519 from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';
import { serializeForSigning } from './serialization';
import { base64UrlToBytes, bytesToBase64Url } from './encoding';

ed25519.hashes.sha512 = sha512;

export interface KeyPairProvider {
  generateKeyPair(): { publicKey: string; privateKey: string };
}

export class SignatureService {
  /**
   * Generates a new Ed25519 key pair.
   * Returns base64url encoded keys.
   */
  static generateKeyPair() {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    return {
      publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    };
  }

  static generateRawKeyPair() {
    const privateKey = ed25519.utils.randomSecretKey();
    const publicKey = ed25519.getPublicKey(privateKey);

    return {
      publicKey: bytesToBase64Url(publicKey),
      privateKey: bytesToBase64Url(privateKey),
    };
  }

  /**
   * Signs a payload using a private key.
   * Private key should be in PEM format.
   */
  static signPayload(payload: any, privateKeyPem: string): string {
    const data = serializeForSigning(payload);
    const signature = sign(null, Buffer.from(data), privateKeyPem);
    return signature.toString('base64url');
  }

  static signPayloadRaw(payload: any, privateKeyBase64Url: string): string {
    const data = new TextEncoder().encode(serializeForSigning(payload));
    const signature = ed25519.sign(data, base64UrlToBytes(privateKeyBase64Url));
    return bytesToBase64Url(signature);
  }

  /**
   * Verifies a signature using a public key.
   * Public key should be in PEM format.
   */
  static verifySignature(payload: any, signatureBase64: string, publicKey: string): boolean {
    try {
      const data = serializeForSigning(payload);

      if (publicKey.includes('BEGIN PUBLIC KEY')) {
        return verify(null, Buffer.from(data), publicKey, Buffer.from(signatureBase64, 'base64url'));
      }

      return ed25519.verify(
        base64UrlToBytes(signatureBase64),
        new TextEncoder().encode(data),
        base64UrlToBytes(publicKey)
      );
    } catch (err) {
      console.error('Signature verification failed:', err);
      return false;
    }
  }
}
