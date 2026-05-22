import { createWriteStream } from 'node:fs';
import { mkdir, stat, truncate, unlink } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { appConfig } from '../config.js';

const activeSessionFiles = new Set();

export class UploadStorageError extends Error {
  constructor(message, { storedFilename, targetPath, writtenBytes, startBytes, cause }) {
    super(message, { cause });
    this.name = 'UploadStorageError';
    this.storedFilename = storedFilename;
    this.targetPath = targetPath;
    this.writtenBytes = writtenBytes;
    this.startBytes = startBytes;
  }
}

export function createUploadTarget(filename, sessionId) {
  return resolveUploadPath(filename, sessionId);
}

export async function saveUploadStream({ body, uploadTarget }) {
  const { storageKey, storedFilename, targetPath } = uploadTarget;
  const wasSeenInSession = activeSessionFiles.has(storageKey);
  const startBytes = wasSeenInSession ? await getExistingSize(targetPath) : 0;
  const flags = wasSeenInSession ? 'a' : 'w';
  let writtenBytes = 0;

  try {
    await mkdir(dirname(targetPath), { recursive: true });

    await pipeline(
      Readable.fromWeb(body),
      new Transform({
        transform(chunk, encoding, callback) {
          writtenBytes += typeof chunk === 'string' ? Buffer.byteLength(chunk, encoding) : chunk.length;
          callback(null, chunk);
        },
      }),
      createWriteStream(targetPath, { flags }),
    );
  } catch (error) {
    await rollbackPartialWrite(targetPath, startBytes);

    throw new UploadStorageError('Upload stream failed', {
      storedFilename,
      targetPath,
      writtenBytes,
      startBytes,
      cause: error,
    });
  }

  activeSessionFiles.add(storageKey);

  return {
    storedFilename,
    targetPath,
    writtenBytes,
    startBytes,
    totalBytes: startBytes + writtenBytes,
    writeMode: wasSeenInSession ? 'append' : 'write',
  };
}

function resolveUploadPath(filename, sessionId) {
  const sessionDir = sanitizePathSegment(sessionId) || 'anonymous';
  const relativeFilename = sanitizeRelativePath(filename);
  const targetRoot = resolve(join(appConfig.uploadDir, sessionDir));
  const targetPath = resolve(join(targetRoot, relativeFilename));
  const relativeTarget = relative(targetRoot, targetPath);

  if (relativeTarget.startsWith('..') || relativeTarget === '') {
    throw new Error('Invalid upload filename');
  }

  return {
    storageKey: `${sessionDir}/${relativeFilename}`,
    sessionDir,
    storedFilename: `${sessionDir}/${relativeFilename}`,
    relativeFilename,
    targetPath,
  };
}

function sanitizeRelativePath(filename) {
  const safeParts = filename
    .normalize('NFKC')
    .split(/[\\/]+/)
    .map((part) => sanitizePathSegment(part))
    .filter((part) => part && part !== '.' && part !== '..');

  return safeParts.length > 0 ? safeParts.join('/') : 'upload.bin';
}

function sanitizePathSegment(value) {
  return String(value)
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}._-]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 180);
}

async function getExistingSize(targetPath) {
  try {
    const fileStat = await stat(targetPath);
    return fileStat.size;
  } catch {
    return 0;
  }
}

async function rollbackPartialWrite(targetPath, startBytes) {
  try {
    if (startBytes > 0) {
      await truncate(targetPath, startBytes);
      return;
    }

    await unlink(targetPath);
  } catch {
    // Best-effort cleanup. The original upload error is more useful to callers.
  }
}
