import { isBruteForce, SecurityConfig } from './security';

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
});
