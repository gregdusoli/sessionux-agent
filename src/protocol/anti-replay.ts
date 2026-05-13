/**
 * In the context of software development, nonce means "number used once".
 * It is a random or pseudo-random value generated to ensure that a
 * specific operation occurs only once, preventing replay attacks
 * (where a hacker intercepts a legitimate request and resends it to the server).
 */
export class NonceStore {
  private usedNonces = new Map<string, number>();
  private readonly ttl: number;

  constructor(ttlMs = 5 * 60 * 1000) { // Default 5 minutes
    this.ttl = ttlMs;
  }

  /**
   * Checks if a nonce is valid (not used and within window).
   * Automatically cleans up expired nonces.
   */
  isValid(nonce: string): boolean {
    this.cleanup();

    if (this.usedNonces.has(nonce)) {
      return false;
    }

    this.usedNonces.set(nonce, Date.now());
    return true;
  }

  private cleanup() {
    const now = Date.now();
    for (const [nonce, timestamp] of this.usedNonces.entries()) {
      if (now - timestamp > this.ttl) {
        this.usedNonces.delete(nonce);
      }
    }
  }
}

export class ClockService {
  private static readonly SKEW_WINDOW_MS = 30 * 1000; // ±30 seconds

  /**
   * Checks if a timestamp is within the acceptable drift window.
   */
  static isWithinWindow(timestamp: string | Date): boolean {
    const now = Date.now();
    const ts = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp.getTime();

    if (isNaN(ts)) return false;

    return Math.abs(now - ts) <= ClockService.SKEW_WINDOW_MS;
  }

  static getServerTime(): string {
    return new Date().toISOString();
  }

  /**
   * Calculates time drift relative to server time.
   * Drift = ServerTime - LocalTime
   */
  static calculateDrift(serverTime: string): number {
    return new Date(serverTime).getTime() - Date.now();
  }
}
