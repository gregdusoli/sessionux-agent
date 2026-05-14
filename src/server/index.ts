import { StorageService } from './storage';
import { SessionUnlocker } from './unlocker';
import { SetupTokenService } from '../protocol/pairing';
import { DiscoveryService } from './discovery';
import { createAgentServer } from './app';

const storage = new StorageService();
storage.init();

const unlocker = new SessionUnlocker();
const pairingService = new SetupTokenService();
const discovery = new DiscoveryService();

const fastify = await createAgentServer({
  storage,
  unlocker,
  pairingService,
});

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3000;
    await fastify.listen({ port, host: '0.0.0.0' });
    fastify.log.info({ event: 'server_listening', port });

    await discovery.start(port);

    process.on('message', (msg: any) => {
      if (msg.type === 'generate-pairing-token') {
        const { token, payload } = pairingService.generateQrPayload(
          storage.getPcId(),
          msg.ip,
          port
        );
        process.send?.({ type: 'pairing-token-generated', token, payload });
      }

      if (msg.type === 'cancel-pairing-token') {
        pairingService.invalidate(msg.token);
      }
    });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

await start();
