import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface Device {
  id: string;
  publicKey: string;
  name: string;
  lastUsedAt?: string;
}

export class DeviceService {
  private readonly configDir: string;
  private readonly devicesPath: string;
  private devices: Map<string, Device> = new Map();

  constructor(configDir?: string) {
    this.configDir = configDir || path.join(process.env.HOME || '', '.config', 'sessionux');
    this.devicesPath = path.join(this.configDir, 'devices.json');
    this.loadDevices();
  }

  private loadDevices() {
    if (!fs.existsSync(this.devicesPath)) {
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true, mode: 0o700 });
      }
      this.saveDevices();
      return;
    }

    try {
      const data = fs.readFileSync(this.devicesPath, 'utf-8');
      const list: Device[] = JSON.parse(data);
      list.forEach(d => this.devices.set(d.id, d));
    } catch (error) {
      console.error('Failed to load devices:', error);
    }
  }

  private saveDevices() {
    const list = Array.from(this.devices.values());
    fs.writeFileSync(this.devicesPath, JSON.stringify(list, null, 2), { mode: 0o600 });
  }

  generateDeviceId(): string {
    return randomUUID();
  }

  addDevice(device: Device) {
    this.devices.set(device.id, device);
    this.saveDevices();
  }

  getDevice(id: string): Device | undefined {
    return this.devices.get(id);
  }

  listDevices(): Device[] {
    return Array.from(this.devices.values());
  }

  removeDevice(id: string) {
    this.devices.delete(id);
    this.saveDevices();
  }
}
