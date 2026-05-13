import { Bonjour, Service } from 'bonjour-service';
import os from 'node:os';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export class DiscoveryService {
  private bonjour: Bonjour | null = null;
  private service: Service | null = null;
  private retryTimeout: NodeJS.Timeout | null = null;
  private isRunning = false;
  private port = 0;

  public async start(port: number) {
    this.port = port;
    this.isRunning = true;
    await this.checkAvahi();
    this.publish();
  }

  private async checkAvahi() {
    if (os.platform() !== 'linux') return;

    try {
      const { stdout } = await execAsync('systemctl is-active avahi-daemon');
      if (stdout.trim() !== 'active') {
        console.warn('Avahi daemon is not active. mDNS discovery might be limited on Linux.');
      } else {
        console.log('Avahi daemon is active.');
      }
    } catch (err) {
      console.warn('Could not check Avahi daemon status. Ensure systemd is available.');
    }
  }

  private publish() {
    if (!this.isRunning) return;

    const existingBonjour = this.bonjour;
    if (existingBonjour) {
      existingBonjour.destroy();
    }

    const bonjour = new Bonjour();
    this.bonjour = bonjour;

    const hostname = os.hostname();

    const service = bonjour.publish({
      name: `Sessionux Agent (${hostname})`,
      type: 'sessionux',
      protocol: 'tcp',
      port: this.port,
      txt: {
        v: '1.0',
      }
    });
    this.service = service;

    service.on('up', () => {
      console.log(`mDNS service published: _sessionux._tcp on ${this.port}`);
    });

    service.on('error', (err: any) => {
      console.error('mDNS error:', err);
      this.handleRetry();
    });
  }

  private handleRetry() {
    if (!this.isRunning) return;

    console.log('Scheduling mDNS republication in 5 seconds...');
    if (this.retryTimeout) clearTimeout(this.retryTimeout);

    this.retryTimeout = setTimeout(() => {
      this.publish();
    }, 5000);
  }

  public stop() {
    this.isRunning = false;
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }

    const service = this.service;
    if (service) {
      if (typeof service.stop === 'function') {
        service.stop();
      }
      this.service = null;
    }

    const bonjour = this.bonjour;
    if (bonjour) {
      if (typeof bonjour.destroy === 'function') {
        bonjour.destroy();
      }
      this.bonjour = null;
    }
  }
}
