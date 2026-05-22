import { randomUUID } from 'node:crypto';
import { log, serializeError } from '../logger.js';

export async function requestLoggingMiddleware(context, next) {
  const requestId = randomUUID();
  const startedAt = Date.now();
  context.set('requestId', requestId);

  log('info', 'request_started', {
    requestId,
    method: context.req.method,
    path: new URL(context.req.url).pathname,
    query: {
      type: context.req.query('type') ?? null,
      mode: context.req.query('mode') ?? null,
      filename: context.req.query('filename') ?? null,
    },
    ip: getClientIp(context),
    userAgent: context.req.header('user-agent') ?? null,
    host: context.req.header('host') ?? null,
    forwardedProto: context.req.header('x-forwarded-proto') ?? null,
    connection: context.req.header('connection') ?? null,
    expect: context.req.header('expect') ?? null,
    transferEncoding: context.req.header('transfer-encoding') ?? null,
    contentType: context.req.header('content-type') ?? null,
    contentLength: context.req.header('content-length') ?? null,
  });

  try {
    await next();

    log('info', 'request_finished', {
      requestId,
      status: context.res.status,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    log('error', 'request_failed', {
      requestId,
      durationMs: Date.now() - startedAt,
      error: serializeError(error),
    });
    throw error;
  }
}

function getClientIp(context) {
  return (
    context.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    context.req.header('x-real-ip') ||
    null
  );
}
