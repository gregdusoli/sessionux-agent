import { DiscoveryService } from './discovery';

const mocks = vi.hoisted(() => ({
  publish: vi.fn(),
  destroy: vi.fn(),
  stop: vi.fn(),
  on: vi.fn(),
  exec: vi.fn(),
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
  exec: mocks.exec,
}));

describe('DiscoveryService', () => {
  let discovery: DiscoveryService;

  beforeEach(() => {
    discovery = new DiscoveryService();
    vi.clearAllMocks();
    mocks.exec.mockImplementation((_cmd, cb) => cb(null, { stdout: 'active', stderr: '' }));
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

  it('should warn when Avahi is inactive', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocks.exec.mockImplementation((_cmd, cb) => cb(null, { stdout: 'inactive', stderr: '' }));

    await discovery.start(3000);

    expect(warn).toHaveBeenCalledWith(
      'Avahi daemon is not active. mDNS discovery might be limited on Linux.'
    );
  });

  it('should retry publication after mDNS errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    mocks.on.mockImplementation((event, callback) => {
      if (event === 'error') {
        callback(new Error('publish failed'));
      }
    });

    await discovery.start(3000);

    expect(mocks.publish).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5000);
    expect(mocks.publish).toHaveBeenCalledTimes(2);
  });
});
