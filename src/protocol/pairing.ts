import { randomUUID } from 'node:crypto';

export interface SetupToken {
  token: string;
  pcId: string;
  expiresAt: number;
}

export class SetupTokenService {
  private activeTokens = new Map<string, SetupToken>();
  private readonly ttl: number;

  constructor(ttlMs = 2 * 60 * 1000) { // Default 2 minutes
    this.ttl = ttlMs;
  }

  /**
   * Generates a new setup token for a PC.
   */
  generateToken(pcId: string): SetupToken {
    const token = randomUUID();
    const setupToken: SetupToken = {
      token,
      pcId,
      expiresAt: Date.now() + this.ttl,
    };
    this.activeTokens.set(token, setupToken);
    return setupToken;
  }

  /**
   * Validates and consumes a token.
   * Returns pcId if valid, null otherwise.
   */
  consume(token: string): string | null {
    const activeToken = this.activeTokens.get(token);
    
    if (!activeToken) return null;

    this.activeTokens.delete(token); // One-time use

    if (Date.now() > activeToken.expiresAt) {
      return null;
    }

    return activeToken.pcId;
  }

  /**
   * Explicitly invalidates a token (e.g. on window close).
   */
  invalidate(token: string) {
    this.activeTokens.delete(token);
  }

  /**
   * Generates a QR payload for pairing.
   */
  generateQrPayload(pcId: string, ip: string, port: number): { token: string; payload: any } {
    const { token, expiresAt } = this.generateToken(pcId);
    return {
      token,
      payload: {
        protocol_version: '1.0',
        setup_token: token,
        pc_id: pcId,
        ip,
        port,
        expires_at: new Date(expiresAt).toISOString(),
      }
    };
  }
}
