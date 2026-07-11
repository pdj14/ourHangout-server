import { buildServer } from './app';
import { env } from './config/env';

async function main(): Promise<void> {
  const app = await buildServer();
  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    app.log.info({ signal }, 'Graceful shutdown started');
    const forceExit = setTimeout(() => {
      app.log.error({ signal }, 'Graceful shutdown timed out');
      process.exit(1);
    }, 20_000);
    forceExit.unref();

    try {
      await app.close();
      clearTimeout(forceExit);
      process.exit(0);
    } catch (error) {
      app.log.error({ error, signal }, 'Graceful shutdown failed');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  try {
    await app.listen({
      host: '0.0.0.0',
      port: env.PORT
    });
  } catch (error) {
    app.log.fatal({ error }, 'Failed to start server');
    process.exit(1);
  }
}

void main();
