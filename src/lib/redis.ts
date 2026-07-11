import Redis from 'ioredis';
import { env } from '../config/env';

export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: env.REDIS_MAX_RETRIES_PER_REQUEST,
  enableReadyCheck: true,
  enableOfflineQueue: false,
  connectTimeout: env.REDIS_CONNECT_TIMEOUT_MS,
  commandTimeout: env.REDIS_COMMAND_TIMEOUT_MS
});

export const redisSubscriber = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: env.REDIS_MAX_RETRIES_PER_REQUEST,
  enableReadyCheck: false,
  enableOfflineQueue: false,
  connectTimeout: env.REDIS_CONNECT_TIMEOUT_MS,
  commandTimeout: env.REDIS_COMMAND_TIMEOUT_MS
});

async function ensureConnected(client: Redis): Promise<void> {
  if (client.status === 'ready') return;
  if (client.status === 'wait' || client.status === 'end') {
    await client.connect();
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Redis did not become ready within ${env.REDIS_CONNECT_TIMEOUT_MS}ms`));
    }, env.REDIS_CONNECT_TIMEOUT_MS);
    timeout.unref();

    const onReady = (): void => {
      cleanup();
      resolve();
    };
    const onEnd = (): void => {
      cleanup();
      reject(new Error('Redis connection ended before becoming ready'));
    };
    const cleanup = (): void => {
      clearTimeout(timeout);
      client.off('ready', onReady);
      client.off('end', onEnd);
    };

    client.once('ready', onReady);
    client.once('end', onEnd);
  });
}

export async function connectRedis(): Promise<void> {
  await Promise.all([ensureConnected(redis), ensureConnected(redisSubscriber)]);
}

export async function closeRedis(): Promise<void> {
  await Promise.all([redis.quit(), redisSubscriber.quit()]);
}
