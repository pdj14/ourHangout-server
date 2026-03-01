import { buildServer } from './app';
import { env } from './config/env';

async function main(): Promise<void> {
  const app = await buildServer();

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'Graceful shutdown started');
    await app.close();
    process.exit(0);
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
