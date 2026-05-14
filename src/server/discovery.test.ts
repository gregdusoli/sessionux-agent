import { DiscoveryService } from './discovery';

const mocks = vi.hoisted(() => ({
  publish: vi.fn(),
  destroy: vi.fn(),
  stop: vi.fn(),
  on: vi.fn(),
}));

// Mock bonjour-service
vi.mock('bonjour-service', () => {
  return {
    Bonjour: class {
      publish = mocks.publish.mockImplementation(() => ({
        on: mocks.on,
        stop: mocks.stop,
      }));
      destroy = mocks.destroy;
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

    expect(mocks.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'sessionux',
        protocol: 'tcp',
        port: 3000,
        txt: { v: '1.0' },
      })
    );
  });

  it('should stop and cleanup', async () => {
    await discovery.start(3000);
    discovery.stop();

    expect(mocks.stop).toHaveBeenCalledOnce();
    expect(mocks.destroy).toHaveBeenCalledOnce();
  });
});
