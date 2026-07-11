import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config/env';
import { AppError, ErrorCodes } from './errors';

let activeUploads = 0;

type UploadWaiter = {
  resolve: (release: () => void) => void;
  reject: (error: Error) => void;
  request: FastifyRequest;
  reply: FastifyReply;
  timeout: NodeJS.Timeout;
  onAborted: () => void;
  onClosed: () => void;
};

const waiters: UploadWaiter[] = [];

function createRelease(): () => void {
  let released = false;
  return () => {
    if (released) return;
    released = true;

    const next = waiters.shift();
    if (next) {
      clearTimeout(next.timeout);
      next.request.raw.off('aborted', next.onAborted);
      next.reply.raw.off('close', next.onClosed);
      next.resolve(createRelease());
      return;
    }

    activeUploads = Math.max(0, activeUploads - 1);
  };
}

async function acquireUploadSlot(request: FastifyRequest, reply: FastifyReply): Promise<() => void> {
  if (request.raw.aborted || reply.raw.destroyed) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Binary upload request was aborted.');
  }

  if (activeUploads < env.BINARY_UPLOAD_CONCURRENCY) {
    activeUploads += 1;
    return createRelease();
  }

  if (waiters.length >= env.BINARY_UPLOAD_QUEUE_LIMIT) {
    throw new AppError(429, ErrorCodes.RATE_LIMITED, 'The binary upload queue is full.');
  }

  return new Promise<() => void>((resolve, reject) => {
    let waiter: UploadWaiter;
    const removeWaiter = (): boolean => {
      const index = waiters.indexOf(waiter);
      if (index < 0) return false;
      waiters.splice(index, 1);
      clearTimeout(waiter.timeout);
      request.raw.off('aborted', onAborted);
      reply.raw.off('close', onClosed);
      return true;
    };
    const onAborted = (): void => {
      if (removeWaiter()) {
        reject(new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Binary upload request was aborted.'));
      }
    };
    const onClosed = (): void => {
      if (removeWaiter()) {
        reject(new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Binary upload connection was closed.'));
      }
    };
    const timeout = setTimeout(() => {
      const index = waiters.indexOf(waiter);
      if (index >= 0) waiters.splice(index, 1);
      request.raw.off('aborted', onAborted);
      reply.raw.off('close', onClosed);
      reject(new AppError(429, ErrorCodes.RATE_LIMITED, 'Timed out waiting for a binary upload slot.'));
    }, env.BINARY_UPLOAD_QUEUE_TIMEOUT_MS);
    timeout.unref();

    waiter = { resolve, reject, request, reply, timeout, onAborted, onClosed };
    request.raw.once('aborted', onAborted);
    reply.raw.once('close', onClosed);
    waiters.push(waiter);
  });
}

export async function admitBinaryUpload(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  let release: () => void;
  try {
    release = await acquireUploadSlot(request, reply);
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 429) {
      reply.header('Retry-After', '2');
    }
    throw error;
  }

  if (request.raw.aborted || reply.raw.destroyed) {
    release();
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Binary upload request was aborted.');
  }

  reply.raw.once('finish', release);
  reply.raw.once('close', release);
  request.raw.once('aborted', release);
}
