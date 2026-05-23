import { getCookie } from 'hono/cookie';
import { appConfig } from '../config.js';
import { createSession, getAuthState, getBasicAuthState } from '../auth/commerce-auth.js';
import { getRequestId } from '../http/request-context.js';
import { failure, success, xml } from '../http/responses.js';
import { log, serializeError } from '../logger.js';
import { createUploadTarget, saveUploadStream } from '../storage/upload-storage.js';

const commerceMlPaths = ['/exchange', '/1c_exchange.php'];

export function registerCommerceMlRoutes(app) {
  for (const path of commerceMlPaths) {
    app.all(path, handleCommerceMlRequest);
  }
}

async function handleCommerceMlRequest(context) {
  const mode = context.req.query('mode');

  switch (mode) {
    case 'checkauth':
      return handleCheckAuth(context);
    case 'init':
      return handleInit(context);
    case 'file':
      return handleFile(context);
    case 'import':
      return handleImport(context);
    case 'query':
      return handleQuery(context);
    case 'success':
      return handleSuccess(context);
    default:
      return unsupportedMode(context, mode);
  }
}

function handleCheckAuth(context) {
  const requestId = getRequestId(context);
  const basicAuth = getBasicAuthState(context.req);

  log('info', 'checkauth_attempt', {
    requestId,
    basicProvided: basicAuth.provided,
    basicLogin: basicAuth.login,
    basicValid: basicAuth.valid,
  });

  if (!basicAuth.valid) {
    log('warn', 'checkauth_failed', {
      requestId,
      basicProvided: basicAuth.provided,
      basicLogin: basicAuth.login,
    });

    return failure('Invalid login or password', 401);
  }

  const sessionId = createSession();
  const response = success(`success\n${appConfig.sessionCookieName}\n${sessionId}`);
  response.headers.append(
    'set-cookie',
    `${appConfig.sessionCookieName}=${sessionId}; Path=/; HttpOnly; SameSite=Lax`,
  );

  log('info', 'checkauth_success', {
    requestId,
    sessionCookieName: appConfig.sessionCookieName,
    sessionIdPrefix: sessionId.slice(0, 8),
  });

  return response;
}

function handleInit(context) {
  const requestId = getRequestId(context);
  const auth = getAuthState(context);
  const zip = appConfig.commerceZipEnabled ? 'yes' : 'no';

  log('info', 'init_requested', { requestId, auth });

  if (!auth.authorized) {
    log('warn', 'init_unauthorized', { requestId, auth });
    return failure('Unauthorized', 401);
  }

  log('info', 'init_success', {
    requestId,
    zip,
    fileLimit: appConfig.commerceFileLimitBytes,
  });

  return success(`zip=${zip}\nfile_limit=${appConfig.commerceFileLimitBytes}`);
}

async function handleFile(context) {
  const requestId = getRequestId(context);
  const auth = getAuthState(context);
  const filename = context.req.query('filename');

  if (!auth.authorized) {
    log('warn', 'file_upload_unauthorized', {
      requestId,
      auth,
      filename: filename ?? null,
    });

    return failure('Unauthorized', 401);
  }

  if (!filename) {
    log('warn', 'file_upload_missing_filename', { requestId, auth });
    return failure('Missing filename');
  }

  if (!context.req.raw.body) {
    log('warn', 'file_upload_missing_body', {
      requestId,
      auth,
      filename,
    });

    return failure('Missing request body');
  }

  const sessionId = getUploadSessionId(context);
  const uploadTarget = createUploadTarget(filename, sessionId);

  log('info', 'file_upload_started', {
    requestId,
    auth,
    filename,
    storedFilename: uploadTarget.storedFilename,
    relativeFilename: uploadTarget.relativeFilename,
    targetPath: uploadTarget.targetPath,
    contentType: context.req.header('content-type') ?? null,
    contentLength: context.req.header('content-length') ?? null,
  });

  try {
    const savedFile = await saveUploadStream({
      body: context.req.raw.body,
      uploadTarget,
    });
    const expectedBytes = readContentLength(context);

    log('info', 'file_upload_saved', {
      requestId,
      filename,
      expectedBytes,
      ...savedFile,
    });

    if (expectedBytes !== null && savedFile.writtenBytes !== expectedBytes) {
      log('warn', 'file_upload_size_mismatch', {
        requestId,
        filename,
        expectedBytes,
        writtenBytes: savedFile.writtenBytes,
        storedFilename: savedFile.storedFilename,
        targetPath: savedFile.targetPath,
      });
    }

    return success();
  } catch (error) {
    log('error', 'file_upload_failed', {
      requestId,
      filename,
      storedFilename: error.storedFilename ?? uploadTarget.storedFilename,
      targetPath: error.targetPath ?? uploadTarget.targetPath,
      writtenBytes: error.writtenBytes ?? null,
      startBytes: error.startBytes ?? null,
      expectedBytes: readContentLength(context),
      error: serializeError(error),
    });

    return failure('File save failed', 500);
  }
}

function handleImport(context) {
  const requestId = getRequestId(context);
  const auth = getAuthState(context);
  const filename = context.req.query('filename') ?? null;

  log('info', 'import_requested', {
    requestId,
    auth,
    filename,
  });

  if (!auth.authorized) {
    log('warn', 'import_unauthorized', {
      requestId,
      auth,
      filename,
    });

    return failure('Unauthorized', 401);
  }

  log('info', 'import_success', {
    requestId,
    filename,
  });

  return success();
}

function handleQuery(context) {
  const requestId = getRequestId(context);
  const auth = getAuthState(context);
  const type = context.req.query('type') ?? null;

  log('info', 'query_requested', {
    requestId,
    auth,
    type,
  });

  if (!auth.authorized) {
    log('warn', 'query_unauthorized', { requestId, auth, type });
    return failure('Unauthorized', 401);
  }

  if (type !== 'sale') {
    return unsupportedMode(context, 'query');
  }

  const body = createEmptyOrdersXml();

  log('info', 'query_success', {
    requestId,
    type,
    bytes: Buffer.byteLength(body),
  });

  return xml(body);
}

function handleSuccess(context) {
  const requestId = getRequestId(context);
  const auth = getAuthState(context);
  const type = context.req.query('type') ?? null;

  log('info', 'sale_success_requested', {
    requestId,
    auth,
    type,
  });

  if (!auth.authorized) {
    log('warn', 'sale_success_unauthorized', { requestId, auth, type });
    return failure('Unauthorized', 401);
  }

  if (type !== 'sale') {
    return unsupportedMode(context, 'success');
  }

  log('info', 'sale_success', {
    requestId,
    type,
  });

  return success();
}

function readContentLength(context) {
  const value = context.req.header('content-length');

  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function getUploadSessionId(context) {
  return getCookie(context, appConfig.sessionCookieName) || 'basic-auth';
}

function createEmptyOrdersXml() {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<КоммерческаяИнформация ВерсияСхемы="2.03" ДатаФормирования="${formatCommerceMlDate(new Date())}">`,
    '</КоммерческаяИнформация>',
  ].join('\n');
}

function formatCommerceMlDate(date) {
  return date.toISOString().slice(0, 19);
}

function unsupportedMode(context, mode) {
  log('warn', 'unsupported_mode', {
    requestId: getRequestId(context),
    type: context.req.query('type') ?? null,
    mode: mode ?? null,
  });

  return failure(`Unsupported mode: ${mode ?? 'empty'}`);
}
