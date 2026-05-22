import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { appConfig, ensureRuntimeDirectories } from './config.js';
import { initLogger, log } from './logger.js';
import { startCloudflaredTunnel } from './tunnel/cloudflared.js';

await ensureRuntimeDirectories();
const logPath = initLogger();

const app = createApp();
let tunnel = null;

serve(
  {
    fetch: app.fetch,
    port: appConfig.port,
  },
  (info) => {
    log('info', 'server_started', {
      url: `http://localhost:${info.port}`,
      uploadDir: appConfig.uploadDir,
      logPath,
    });

    if (appConfig.cloudflared.enabled) {
      tunnel = startCloudflaredTunnel({
        bin: appConfig.cloudflared.bin,
        port: info.port,
        log,
      });
    }
  },
);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    tunnel?.stop();
    process.kill(process.pid, signal);
  });
}

process.once('exit', () => {
  tunnel?.stop();
});
