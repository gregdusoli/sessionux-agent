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
});
