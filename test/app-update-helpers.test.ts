import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyBaseLogger, FastifyReply, FastifyRequest } from 'fastify';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:5432/test';
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.JWT_SECRET = 'test-only-secret-that-is-at-least-thirty-two-characters';
const appUpdateStorageDir = mkdtempSync(join(tmpdir(), 'ourhangout-updates-'));
process.env.APP_UPDATE_STORAGE_DIR = appUpdateStorageDir;

test('app update versions compare numeric components numerically', async () => {
  const { compareVersionStrings } = await import('../src/modules/app-updates/app-updates.service');
  assert.equal(compareVersionStrings('1.10.0', '1.9.9'), 1);
  assert.equal(compareVersionStrings('2.0.0', '2.0'), 0);
  assert.equal(compareVersionStrings('1.0.0-beta', '1.0.0-alpha'), 1);
});

test('content-disposition strips header-breaking ASCII characters', async () => {
  const { buildContentDispositionHeader } = await import('../src/modules/app-updates/app-updates.service');
  const header = buildContentDispositionHeader('release"\\name.apk');
  assert.match(header, /^attachment; filename="release__name\.apk";/);
  assert.doesNotMatch(header, /[\r\n]/);
});

test('concurrent app release uploads preserve both manifest entries and files', async () => {
  try {
    const { AppUpdatesService } = await import('../src/modules/app-updates/app-updates.service');
    const logger = {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
      debug: () => undefined
    } as unknown as FastifyBaseLogger;
    const service = new AppUpdatesService(logger);

    await Promise.all([
      service.uploadRelease({ version: '1.0.0', bytes: Buffer.from('first') }),
      service.uploadRelease({ version: '1.1.0', bytes: Buffer.from('second') })
    ]);

    const releases = await service.listReleases();
    assert.deepEqual(new Set(releases.items.map((item) => item.version)), new Set(['1.0.0', '1.1.0']));
    assert.equal(releases.items.every((item) => item.fileExists), true);
  } finally {
    await rm(appUpdateStorageDir, { recursive: true, force: true });
  }
});

test('binary upload admission queues excess buffered requests and transfers a released slot', async () => {
  const { admitBinaryUpload } = await import('../src/lib/binary-upload-gate');
  const createLifecycle = () => ({
    request: { raw: new EventEmitter() } as unknown as FastifyRequest,
    reply: { raw: new EventEmitter() } as unknown as FastifyReply
  });
  const first = createLifecycle();
  const second = createLifecycle();
  const third = createLifecycle();

  await admitBinaryUpload(first.request, first.reply);
  await admitBinaryUpload(second.request, second.reply);
  let thirdAdmitted = false;
  const queuedAdmission = admitBinaryUpload(third.request, third.reply).then(() => {
    thirdAdmitted = true;
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(thirdAdmitted, false);

  first.reply.raw.emit('finish');
  await queuedAdmission;
  assert.equal(thirdAdmitted, true);
  second.reply.raw.emit('finish');
  third.reply.raw.emit('finish');
});

test('binary upload admission releases a promoted slot when the queued client disconnects', async () => {
  const { admitBinaryUpload } = await import('../src/lib/binary-upload-gate');
  const createLifecycle = () => {
    const requestRaw = Object.assign(new EventEmitter(), { aborted: false });
    const replyRaw = Object.assign(new EventEmitter(), { destroyed: false });
    return {
      request: { raw: requestRaw } as unknown as FastifyRequest,
      reply: { raw: replyRaw } as unknown as FastifyReply
    };
  };
  const first = createLifecycle();
  const second = createLifecycle();
  const disconnected = createLifecycle();

  await admitBinaryUpload(first.request, first.reply);
  await admitBinaryUpload(second.request, second.reply);
  const queuedAdmission = admitBinaryUpload(disconnected.request, disconnected.reply);
  await new Promise<void>((resolve) => setImmediate(resolve));

  first.reply.raw.on('finish', () => {
    disconnected.reply.raw.destroyed = true;
    disconnected.reply.raw.emit('close');
  });
  first.reply.raw.emit('finish');
  await assert.rejects(queuedAdmission, /aborted/);

  const replacement = createLifecycle();
  await admitBinaryUpload(replacement.request, replacement.reply);
  second.reply.raw.emit('finish');
  replacement.reply.raw.emit('finish');
});
