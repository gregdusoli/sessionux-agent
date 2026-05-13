import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionUnlocker } from './unlocker';
import { spawn, exec } from 'node:child_process';
import { EventEmitter } from 'node:events';

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual('node:child_process');
  return {
    ...actual,
    spawn: vi.fn(),
    exec: vi.fn(),
  };
});

describe('SessionUnlocker', () => {
  let unlocker: SessionUnlocker;

  beforeEach(() => {
    unlocker = new SessionUnlocker();
    vi.clearAllMocks();
  });

  it('should unlock successfully via loginctl', async () => {
    const mockProc = new EventEmitter() as any;
    mockProc.stderr = new EventEmitter();

    vi.mocked(spawn).mockReturnValue(mockProc);

    const promise = unlocker.unlock();

    // Simulate process closing with code 0
    mockProc.emit('close', 0);

    const result = await promise;
    expect(result.success).toBe(true);
    expect(spawn).toHaveBeenCalledWith('loginctl', ['unlock-session'], { shell: false });
  });

  it('should return error if loginctl fails', async () => {
    const mockProc = new EventEmitter() as any;
    mockProc.stderr = new EventEmitter();

    vi.mocked(spawn).mockReturnValue(mockProc);

    const promise = unlocker.unlock();

    // Simulate stderr data
    mockProc.stderr.emit('data', Buffer.from('Access denied'));
    // Simulate process closing with code 1
    mockProc.emit('close', 1);

    const result = await promise;
    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied');
  });

  it('should try fallback if loginctl fails in performUnlock', async () => {
    // Mock loginctl failure
    const mockProc = new EventEmitter() as any;
    mockProc.stderr = new EventEmitter();
    vi.mocked(spawn).mockReturnValue(mockProc);

    // Mock successful fallback (exec call)
    vi.mocked(exec).mockImplementation((cmd, cb: any) => {
      cb(null, { stdout: '', stderr: '' });
      return {} as any;
    });

    const promise = unlocker.performUnlock();

    mockProc.emit('close', 1);

    const result = await promise;
    expect(result.success).toBe(true);
    expect(exec).toHaveBeenCalled();
  });

  it('should return error if both loginctl and fallback fail', async () => {
    // Mock loginctl failure
    const mockProc = new EventEmitter() as any;
    mockProc.stderr = new EventEmitter();
    vi.mocked(spawn).mockReturnValue(mockProc);

    // Mock fallback failure
    vi.mocked(exec).mockImplementation((cmd, cb: any) => {
      cb(new Error('D-Bus error'), { stdout: '', stderr: '' });
      return {} as any;
    });

    const promise = unlocker.performUnlock();

    mockProc.emit('close', 1);

    const result = await promise;
    expect(result.success).toBe(false);
    expect(result.error).toContain('All unlock methods failed');
  });
});
