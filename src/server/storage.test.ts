import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { StorageService } from './storage';

describe('StorageService', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sessionux-storage-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('creates config directory and file with restricted permissions', () => {
    const service = new StorageService(dir);

    service.init();

    expect(fs.statSync(dir).mode & 0o777).toBe(0o700);
    expect(fs.statSync(path.join(dir, 'config.json')).mode & 0o777).toBe(0o600);
  });

  it('corrects unsafe permissions on existing config', () => {
    fs.writeFileSync(
      path.join(dir, 'config.json'),
      JSON.stringify({
        version: 1,
        pc_id: crypto.randomUUID(),
        trusted_devices: [],
      })
    );
    fs.chmodSync(dir, 0o755);
    fs.chmodSync(path.join(dir, 'config.json'), 0o644);

    const service = new StorageService(dir);
    service.init();

    expect(fs.statSync(dir).mode & 0o777).toBe(0o700);
    expect(fs.statSync(path.join(dir, 'config.json')).mode & 0o777).toBe(0o600);
  });

  it('persists and updates trusted devices', () => {
    const service = new StorageService(dir);
    service.init();
    const device = {
      id: crypto.randomUUID(),
      name: 'phone',
      publicKey: 'public-key',
      addedAt: new Date().toISOString(),
    };

    service.addDevice(device);
    service.updateLastUnlock(device.id);

    const saved = service.getTrustedDevices()[0]!;
    expect(saved.id).toBe(device.id);
    expect(saved.lastUnlock).toBeTruthy();
  });

  it('replaces an existing trusted device with the same id', () => {
    const service = new StorageService(dir);
    service.init();
    const id = crypto.randomUUID();

    service.addDevice({
      id,
      name: 'old',
      publicKey: 'old-key',
      addedAt: new Date().toISOString(),
    });
    service.addDevice({
      id,
      name: 'new',
      publicKey: 'new-key',
      addedAt: new Date().toISOString(),
    });

    expect(service.getTrustedDevices()).toHaveLength(1);
    expect(service.getTrustedDevices()[0]!.name).toBe('new');
  });

  it('removes trusted devices', () => {
    const service = new StorageService(dir);
    service.init();
    const id = crypto.randomUUID();

    service.addDevice({
      id,
      name: 'phone',
      publicKey: 'public-key',
      addedAt: new Date().toISOString(),
    });
    service.removeDevice(id);

    expect(service.getTrustedDevices()).toEqual([]);
  });

  it('creates a migration backup for older config versions', () => {
    const configFile = path.join(dir, 'config.json');
    fs.writeFileSync(
      configFile,
      JSON.stringify({
        version: 0,
        pc_id: crypto.randomUUID(),
        trusted_devices: [],
      })
    );

    const service = new StorageService(dir);
    service.init();

    expect(service.getConfig().version).toBe(1);
    expect(fs.existsSync(`${configFile}.v0.bak`)).toBe(true);
  });

  it('throws on corrupted config', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fs.writeFileSync(path.join(dir, 'config.json'), '{broken');

    const service = new StorageService(dir);

    expect(() => service.init()).toThrow('Config corruption');
  });
});
