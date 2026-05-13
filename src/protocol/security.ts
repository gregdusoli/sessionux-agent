/**
 * Security configurations for the Agent server.
 */
export const SecurityConfig = {
  rateLimit: {
    max: 3,
    timeWindow: '1 second',
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
