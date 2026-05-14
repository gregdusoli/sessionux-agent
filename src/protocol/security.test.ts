import { FailureCooldown, isBruteForce, SecurityConfig } from './security';

describe('Security Logic', () => {
  it('should detect brute force when requests exceed limit', () => {
    // 4 requests in 1000ms should be brute force (limit is 3)
    expect(isBruteForce(4, 1000)).toBe(true);
    
    // 3 requests in 1000ms should not be brute force
    expect(isBruteForce(3, 1000)).toBe(false);
  });

  it('should have correct body limit', () => {
    expect(SecurityConfig.bodyLimit).toBe(64 * 1024);
  });

  it('should have correct request timeout', () => {
    expect(SecurityConfig.requestTimeout).toBe(5000);
  });

  it('should apply progressive cooldown after repeated failures', () => {
    const cooldown = new FailureCooldown(2, 100, 1000);

    expect(cooldown.isBlocked('ip:device')).toBe(false);
    expect(cooldown.recordFailure('ip:device')).toBe(0);
    expect(cooldown.recordFailure('ip:device')).toBe(100);
    expect(cooldown.isBlocked('ip:device')).toBe(true);
  });

  it('should clear cooldown state after a successful unlock', () => {
    const cooldown = new FailureCooldown(1, 100, 1000);

    cooldown.recordFailure('ip:device');
    expect(cooldown.isBlocked('ip:device')).toBe(true);

    cooldown.recordSuccess('ip:device');
    expect(cooldown.isBlocked('ip:device')).toBe(false);
  });
});
