import { spawn } from 'node:child_process';
import { serializeError } from '../logger.js';

const QUICK_TUNNEL_URL_PATTERN = /https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/i;

export function startCloudflaredTunnel({ bin, port, log }) {
  let publicUrl = null;
  let stoppedByApp = false;
  const args = ['tunnel', '--url', `http://localhost:${port}`];
  const child = spawn(bin, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  log('info', 'cloudflared_starting', {
    command: `${bin} ${args.join(' ')}`,
  });

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');

  child.stdout.on('data', (data) => {
    handleOutput(data);
  });

  child.stderr.on('data', (data) => {
    handleOutput(data);
  });

  child.on('error', (error) => {
    log('error', 'cloudflared_failed', {
      error: serializeError(error),
    });
  });

  child.on('exit', (code, signal) => {
    const level = stoppedByApp || code === 0 ? 'info' : 'warn';

    log(level, 'cloudflared_exited', {
      code,
      signal,
      url: publicUrl,
    });
  });

  function handleOutput(data) {
    const text = String(data);
    const nextUrl = text.match(QUICK_TUNNEL_URL_PATTERN)?.[0];

    if (nextUrl && nextUrl !== publicUrl) {
      publicUrl = nextUrl;
      log('info', 'cloudflared_ready', {
        url: publicUrl,
      });
    }
  }

  return {
    stop() {
      if (child.exitCode !== null || child.killed) {
        return;
      }

      stoppedByApp = true;
      child.kill('SIGTERM');
    },
  };
}
