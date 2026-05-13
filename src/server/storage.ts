import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';

const DeviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  publicKey: z.string(),
  lastUnlock: z.string().optional(),
  addedAt: z.string(),
});

const ConfigSchema = z.object({
  version: z.number(),
  pc_id: z.string(),
  trusted_devices: z.array(DeviceSchema),
});

const CURRENT_CONFIG_VERSION = 1;

export type Device = z.infer<typeof DeviceSchema>;
export type Config = z.infer<typeof ConfigSchema>;

export class StorageService {
  private configDir: string;
  private configFile: string;
  private config: Config | null = null;

  constructor() {
    this.configDir = path.join(os.homedir(), '.config', 'sessionux');
    this.configFile = path.join(this.configDir, 'config.json');
  }

  public init() {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true, mode: 0o700 });
    } else {
      fs.chmodSync(this.configDir, 0o700);
    }

    if (!fs.existsSync(this.configFile)) {
      this.config = {
        version: CURRENT_CONFIG_VERSION,
        pc_id: randomUUID(),
        trusted_devices: [],
      };
      this.save();
    } else {
      this.load();
      fs.chmodSync(this.configFile, 0o600);
    }
  }

  private load() {
    try {
      const data = fs.readFileSync(this.configFile, 'utf-8');
      const parsed = JSON.parse(data);
      this.config = this.migrate(ConfigSchema.parse(parsed));
    } catch (error) {
      console.error('Failed to load config:', error);
      // If corruption, we might want to backup and start fresh or throw
      throw new Error('Config corruption', { cause: error });
    }
  }

  private migrate(config: Config): Config {
    if (config.version === CURRENT_CONFIG_VERSION) {
      return config;
    }

    const backupFile = `${this.configFile}.v${config.version}.bak`;
    fs.copyFileSync(this.configFile, backupFile);

    const migrated = {
      ...config,
      version: CURRENT_CONFIG_VERSION,
    };

    this.config = migrated;
    this.save();
    return migrated;
  }

  private save() {
    if (!this.config) return;

    const tempFile = `${this.configFile}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(this.config, null, 2), {
      mode: 0o600,
    });
    fs.renameSync(tempFile, this.configFile);
  }

  public getConfig(): Config {
    if (!this.config) this.init();
    return this.config!;
  }

  public getPcId(): string {
    return this.getConfig().pc_id;
  }

  public getTrustedDevices(): Device[] {
    return this.getConfig().trusted_devices;
  }

  public addDevice(device: Device) {
    const config = this.getConfig();
    const exists = config.trusted_devices.find((d) => d.id === device.id);
    if (exists) {
      config.trusted_devices = config.trusted_devices.map((d) =>
        d.id === device.id ? device : d
      );
    } else {
      config.trusted_devices.push(device);
    }
    this.save();
  }

  public removeDevice(deviceId: string) {
    const config = this.getConfig();
    config.trusted_devices = config.trusted_devices.filter(
      (d) => d.id !== deviceId
    );
    this.save();
  }

  public updateLastUnlock(deviceId: string) {
    const config = this.getConfig();
    const device = config.trusted_devices.find((d) => d.id === deviceId);
    if (device) {
      device.lastUnlock = new Date().toISOString();
      this.save();
    }
  }
}
