import { createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { appConfig } from './config.js';

let logStream = null;

const colorEnabled = process.env.NO_COLOR !== '1' && process.env.LOG_COLORS !== 'false';
const ansi = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

const levelColors = {
  info: ansi.green,
  warn: ansi.yellow,
  error: ansi.red,
};

const eventColors = {
  request_started: ansi.blue,
  request_finished: ansi.green,
  checkauth_attempt: ansi.cyan,
  checkauth_success: ansi.green,
  checkauth_failed: ansi.red,
  init_requested: ansi.cyan,
  init_success: ansi.green,
  file_upload_started: ansi.magenta,
  file_upload_saved: ansi.green,
  file_upload_failed: ansi.red,
  import_requested: ansi.cyan,
  import_success: ansi.green,
  unsupported_mode: ansi.yellow,
  cloudflared_starting: ansi.cyan,
  cloudflared_ready: ansi.green,
  cloudflared_failed: ansi.red,
  cloudflared_exited: ansi.yellow,
};

export function initLogger() {
  const logPath = join(appConfig.logDir, 'commerce-ml.log');
  logStream = createWriteStream(logPath, { flags: 'a' });
  log('info', 'logger_started', { logPath });
  return logPath;
}

export function log(level, event, details = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...details,
  };
  const line = JSON.stringify(entry);
  const consoleLine = formatConsoleLine(entry);

  if (level === 'error') {
    console.error(consoleLine);
  } else if (level === 'warn') {
    console.warn(consoleLine);
  } else {
    console.info(consoleLine);
  }

  logStream?.write(`${line}\n`);
}

function formatConsoleLine(entry) {
  const parts = [
    paint(ansi.dim, entry.ts),
    paint(levelColors[entry.level] ?? ansi.gray, entry.level.toUpperCase().padEnd(5)),
    paint(eventColors[entry.event] ?? ansi.bold, entry.event),
  ];
  const detailParts = formatDetails(entry);

  if (detailParts.length > 0) {
    parts.push(paint(ansi.gray, detailParts.join(' ')));
  }

  return parts.join(' ');
}

function formatDetails(entry) {
  const parts = [];

  add(parts, 'rid', entry.requestId ? shortId(entry.requestId) : null);
  add(parts, 'method', entry.method);
  add(parts, 'path', entry.path);

  if (entry.query) {
    add(parts, 'mode', entry.query.mode);
    add(parts, 'type', entry.query.type);
    add(parts, 'filename', entry.query.filename);
  }

  add(parts, 'status', entry.status);
  add(parts, 'ms', entry.durationMs);
  add(parts, 'auth', entry.auth?.source);
  add(parts, 'login', entry.basicLogin ?? entry.auth?.basicLogin);
  add(parts, 'basic', entry.basicValid ?? entry.auth?.basicValid);
  add(parts, 'authorized', entry.auth?.authorized);
  add(parts, 'session', entry.sessionIdPrefix ?? entry.auth?.sessionIdPrefix);
  add(parts, 'filename', entry.filename);
  add(parts, 'stored', entry.storedFilename);
  add(parts, 'bytes', entry.writtenBytes ?? entry.contentLength);
  add(parts, 'limit', entry.fileLimit);
  add(parts, 'url', entry.url);
  add(parts, 'command', entry.command);
  add(parts, 'uploadDir', entry.uploadDir);
  add(parts, 'log', entry.logPath);
  add(parts, 'ip', entry.ip);
  add(parts, 'ua', entry.userAgent);
  add(parts, 'conn', entry.connection);
  add(parts, 'expect', entry.expect);
  add(parts, 'te', entry.transferEncoding);

  if (entry.error) {
    parts.push(`error=${formatError(entry.error)}`);
  }

  return parts;
}

function add(parts, key, value) {
  if (value === undefined || value === null || value === '') {
    return;
  }

  parts.push(`${key}=${formatValue(value)}`);
}

function formatValue(value) {
  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  }

  const text = String(value);
  return /\s/.test(text) ? JSON.stringify(text) : text;
}

function formatError(error) {
  const cause = error.cause ? ` cause=${formatError(error.cause)}` : '';
  const code = error.code ? ` code=${error.code}` : '';
  return `${error.name ?? 'Error'}:${error.message ?? 'unknown'}${code}${cause}`;
}

function shortId(value) {
  return String(value).slice(0, 8);
}

function paint(color, text) {
  if (!colorEnabled) {
    return text;
  }

  return `${color}${text}${ansi.reset}`;
}

export function serializeError(error) {
  if (error instanceof Error) {
    const serialized = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };

    if ('code' in error) {
      serialized.code = error.code;
    }

    if (error.cause) {
      serialized.cause = serializeError(error.cause);
    }

    return serialized;
  }

  return {
    message: String(error),
  };
}
