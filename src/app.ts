import Fastify, { type FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import { env } from './config/env';
import { db, closeDb } from './lib/db';
import { MetricsRegistry } from './lib/metrics';
import { redis, redisSubscriber, closeRedis } from './lib/redis';
import { AuthService } from './modules/auth/auth.service';
import { authRoutes } from './modules/auth/auth.routes';
import { ChatService } from './modules/chat/chat.service';
import { chatRoutes } from './modules/chat/chat.routes';
import { websocketRoutes } from './modules/chat/chat.ws';
import { ConnectionManager } from './modules/chat/connection-manager';
import { RedisChatEventBus } from './modules/chat/redis-event-bus';
import { healthRoutes } from './modules/health/health.routes';
import { ClawBridgeService } from './modules/openclaw/claw-bridge.service';
import { openClawRoutes } from './modules/openclaw/openclaw.routes';
import { createClawProvider } from './modules/openclaw/provider.factory';
import { PairingService } from './modules/pairing/pairing.service';
import { pairingRoutes } from './modules/pairing/pairing.routes';
import { registerErrorHandlers } from './plugins/error-handler';
import { securityPlugin } from './plugins/security';
import { swaggerPlugin } from './plugins/swagger';

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL
    }
  });

  await app.register(websocket);
  await app.register(swaggerPlugin);
  await app.register(securityPlugin);

  const metrics = new MetricsRegistry();
  const connectionManager = new ConnectionManager(app.log);
  const eventBus = new RedisChatEventBus(redis, redisSubscriber, app.log);
  const clawProvider = createClawProvider(env, app.log);
  const clawBridge = new ClawBridgeService(clawProvider, env.OPENCLAW_RETRY_COUNT, app.log);

  const authService = new AuthService(
    db,
    env,
    (payload) => app.jwt.sign(payload, { expiresIn: env.ACCESS_TOKEN_TTL }),
    app.log
  );

  const pairingService = new PairingService(db, env, app.log);
  const chatService = new ChatService({
    db,
    eventBus,
    connectionManager,
    clawBridge,
    logger: app.log
  });

  app.decorate('db', db);
  app.decorate('redis', redis);
  app.decorate('redisSubscriber', redisSubscriber);
  app.decorate('metrics', metrics);
  app.decorate('connectionManager', connectionManager);
  app.decorate('eventBus', eventBus);
  app.decorate('clawBridge', clawBridge);
  app.decorate('authService', authService);
  app.decorate('pairingService', pairingService);
  app.decorate('chatService', chatService);

  registerErrorHandlers(app);

  app.addHook('onRequest', async () => {
    app.metrics.incrementRequests();
  });

  app.addHook('onResponse', async (_request, reply) => {
    if (reply.statusCode >= 500) {
      app.metrics.incrementErrors();
    }
  });

  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: '/v1/auth' });
  await app.register(pairingRoutes, { prefix: '/v1/pairing' });
  await app.register(chatRoutes, { prefix: '/v1/chats' });
  await app.register(websocketRoutes, { prefix: '/v1' });
  await app.register(openClawRoutes, { prefix: '/v1/openclaw' });

  app.addHook('onReady', async () => {
    await app.eventBus.start(async (event) => {
      await app.chatService.handleEvent(event);
    });
  });

  app.addHook('onClose', async () => {
    await app.eventBus.close();
    await closeRedis();
    await closeDb();
  });

  return app;
}
