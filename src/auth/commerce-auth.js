import { getCookie } from 'hono/cookie';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { appConfig } from '../config.js';

const sessions = new Map();

export function getBasicAuthState(request) {
  const credentials = readBasicAuth(request);
  const valid = Boolean(
    credentials &&
      safeCompare(credentials.login, appConfig.login) &&
      safeCompare(credentials.password, appConfig.password),
  );

  return {
    provided: Boolean(credentials),
    login: credentials?.login ?? null,
    valid,
  };
}

export function createSession() {
  const sessionId = randomUUID();
  sessions.set(sessionId, { createdAt: new Date() });
  return sessionId;
}

export function getAuthState(context) {
  const sessionId = getCookie(context, appConfig.sessionCookieName);
  const sessionValid = Boolean(sessionId && sessions.has(sessionId));
  const basicAuth = getBasicAuthState(context.req);

  return {
    authorized: sessionValid || basicAuth.valid,
    source: sessionValid ? 'session' : basicAuth.valid ? 'basic' : 'none',
    sessionPresent: Boolean(sessionId),
    sessionValid,
    sessionIdPrefix: sessionId ? sessionId.slice(0, 8) : null,
    basicProvided: basicAuth.provided,
    basicLogin: basicAuth.login,
    basicValid: basicAuth.valid,
  };
}

function safeCompare(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function readBasicAuth(request) {
  const header = request.header('authorization');

  if (!header?.startsWith('Basic ')) {
    return null;
  }

  try {
    const decoded = Buffer.from(header.slice('Basic '.length), 'base64').toString('utf8');
    const separatorIndex = decoded.indexOf(':');

    if (separatorIndex === -1) {
      return null;
    }

    return {
      login: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}
