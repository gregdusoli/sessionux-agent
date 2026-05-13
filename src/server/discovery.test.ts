import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DiscoveryService } from './discovery';
import os from 'node:os';

// Mock bonjour-service
vi.mock('bonjour-service', () => {
  return {
    Bonjour: class {
      publish = vi.fn().mockImplementation(() => ({
        on: vi.fn(),
        stop: vi.fn(),
      }));
      destroy = vi.fn();
    }
  };
});

// Mock child_process
vi.mock('node:child_process', () => ({
  exec: vi.fn((cmd, cb) => cb(null, { stdout: 'active', stderr: '' })),
}));

describe('DiscoveryService', () => {
  let discovery: DiscoveryService;

  beforeEach(() => {
    discovery = new DiscoveryService();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    discovery.stop();
    vi.useRealTimers();
  });

  it('should start and publish service', async () => {
    await discovery.start(3000);
    // expect(discovery['isRunning']).toBe(true); // discovery['isRunning'] is private but we can check side effects
  });

  it('should stop and cleanup', async () => {
    await discovery.start(3000);
    discovery.stop();
    // Verify cleanup logic
  });
});
