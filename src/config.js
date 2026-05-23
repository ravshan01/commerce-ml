import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = dirname(fileURLToPath(import.meta.url));
export const serviceRoot = resolve(srcDir, '..');

loadDotenv({ path: resolve(serviceRoot, '.env'), quiet: true });

function requiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required in ${resolve(serviceRoot, '.env')}`);
  }

  return value;
}

function resolveServicePath(value) {
  if (isAbsolute(value)) {
    return value;
  }

  return resolve(serviceRoot, value);
}

function optionalBooleanEnv(name, defaultValue = false) {
  const value = process.env[name]?.trim().toLowerCase();

  if (!value) {
    return defaultValue;
  }

  if (['1', 'true', 'yes', 'on'].includes(value)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(value)) {
    return false;
  }

  throw new Error(`${name} must be one of: true, false, 1, 0, yes, no, on, off`);
}

export const appConfig = {
  login: requiredEnv('COMMERCE_LOGIN'),
  password: requiredEnv('COMMERCE_PASSWORD'),
  port: Number.parseInt(process.env.PORT ?? '3010', 10),
  uploadDir: resolveServicePath(process.env.UPLOAD_DIR?.trim() || 'uploads'),
  logDir: resolveServicePath(process.env.LOG_DIR?.trim() || 'logs'),
  sessionCookieName: process.env.SESSION_COOKIE_NAME?.trim() || 'commerce_ml_session',
  commerceFileLimitBytes: Number.parseInt(process.env.COMMERCE_FILE_LIMIT_BYTES ?? '10485760', 10),
  commerceZipEnabled: optionalBooleanEnv('COMMERCE_ZIP_ENABLED'),
  cloudflared: {
    enabled: optionalBooleanEnv('CLOUDFLARED_TUNNEL_ENABLED'),
    bin: process.env.CLOUDFLARED_BIN?.trim() || 'cloudflared',
  },
};

if (!Number.isInteger(appConfig.port) || appConfig.port < 1 || appConfig.port > 65535) {
  throw new Error('PORT must be a valid TCP port');
}

if (!Number.isInteger(appConfig.commerceFileLimitBytes) || appConfig.commerceFileLimitBytes < 1) {
  throw new Error('COMMERCE_FILE_LIMIT_BYTES must be a positive integer');
}

export async function ensureRuntimeDirectories() {
  if (!existsSync(appConfig.uploadDir)) {
    await mkdir(appConfig.uploadDir, { recursive: true });
  }

  if (!existsSync(appConfig.logDir)) {
    await mkdir(appConfig.logDir, { recursive: true });
  }
}
