/**
 * Security configurations for the Agent server.
 */
export const SecurityConfig = {
  rateLimit: {
    max: 3,
    timeWindow: '1 second',
  },
  cooldown: {
    threshold: 3,
    baseMs: 1000,
    maxMs: 30_000,
  },
  bodyLimit: 1024 * 64, // 64kb - enough for cryptographic payloads, safe from DoS
  requestTimeout: 5000, // 5 seconds
};

/**
 * A simple brute force test simulation logic.
 * In a real scenario, this would be handled by the rate limiter plugin.
 */
export function isBruteForce(requestCount: number, timeWindowMs: number): boolean {
  const threshold = SecurityConfig.rateLimit.max;
  const window = 1000; // 1 second
  return (requestCount / (timeWindowMs / window)) > threshold;
}

export class FailureCooldown {
  private failures = new Map<string, { count: number; blockedUntil: number }>();

  constructor(
    private readonly threshold = SecurityConfig.cooldown.threshold,
    private readonly baseMs = SecurityConfig.cooldown.baseMs,
    private readonly maxMs = SecurityConfig.cooldown.maxMs
  ) {}

  isBlocked(key: string, now = Date.now()): boolean {
    const state = this.failures.get(key);
    return Boolean(state && state.blockedUntil > now);
  }

  recordFailure(key: string, now = Date.now()): number {
    const current = this.failures.get(key) ?? { count: 0, blockedUntil: 0 };
    const count = current.count + 1;
    const penalty =
      count >= this.threshold
        ? Math.min(this.baseMs * 2 ** (count - this.threshold), this.maxMs)
        : 0;

    this.failures.set(key, {
      count,
      blockedUntil: penalty > 0 ? now + penalty : 0,
    });

    return penalty;
  }

  recordSuccess(key: string): void {
    this.failures.delete(key);
  }
}
