import { generateKeyPairSync, sign, verify } from 'node:crypto';
import { serializeForSigning } from './serialization';

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

  /**
   * Signs a payload using a private key.
   * Private key should be in PEM format.
   */
  static signPayload(payload: any, privateKeyPem: string): string {
    const data = serializeForSigning(payload);
    const signature = sign(null, Buffer.from(data), privateKeyPem);
    return signature.toString('base64url');
  }

  /**
   * Verifies a signature using a public key.
   * Public key should be in PEM format.
   */
  static verifySignature(payload: any, signatureBase64: string, publicKeyPem: string): boolean {
    try {
      const data = serializeForSigning(payload);
      return verify(null, Buffer.from(data), publicKeyPem, Buffer.from(signatureBase64, 'base64url'));
    } catch (err) {
      console.error('Signature verification failed:', err);
      return false;
    }
  }
}
