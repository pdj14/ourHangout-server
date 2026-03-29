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
import { BotService } from './modules/bots/bot.service';
import { botRoutes } from './modules/bots/bot.routes';
import { ClawBridgeService } from './modules/openclaw/claw-bridge.service';
import { OpenClawConnectorHub } from './modules/openclaw/connector-hub';
import { openClawRoutes } from './modules/openclaw/openclaw.routes';
import { createClawProvider } from './modules/openclaw/provider.factory';
import { SocialService } from './modules/social/social.service';
import { socialRoutes } from './modules/social/social.routes';
import { PairingService } from './modules/pairing/pairing.service';
import { pairingRoutes } from './modules/pairing/pairing.routes';
import { ContactsService } from './modules/contacts/contacts.service';
import { contactsRoutes } from './modules/contacts/contacts.routes';
import { GuardianService } from './modules/guardian/guardian.service';
import { guardianRoutes } from './modules/guardian/guardian.routes';
import { guardianConsoleRoutes } from './modules/guardian/guardian.console.routes';
import { FamilyService } from './modules/family/family.service';
import { familyRoutes } from './modules/family/family.routes';
import { appUpdatesRoutes } from './modules/app-updates/app-updates.routes';
import { guardianAppUpdatesRoutes } from './modules/app-updates/app-updates.guardian.routes';
import { FcmPushService } from './lib/push/fcm-push.service';
import { registerErrorHandlers } from './plugins/error-handler';
import { securityPlugin } from './plugins/security';
import { swaggerPlugin } from './plugins/swagger';

const MAX_UPLOAD_BODY_BYTES = 200 * 1024 * 1024;

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    trustProxy: env.TRUST_PROXY,
    bodyLimit: MAX_UPLOAD_BODY_BYTES,
    logger: {
      level: env.LOG_LEVEL
    }
  });

  app.addContentTypeParser(/^image\/.*/, { parseAs: 'buffer', bodyLimit: MAX_UPLOAD_BODY_BYTES }, (_request, body, done) => {
    done(null, body);
  });

  app.addContentTypeParser(/^video\/.*/, { parseAs: 'buffer', bodyLimit: MAX_UPLOAD_BODY_BYTES }, (_request, body, done) => {
    done(null, body);
  });

  app.addContentTypeParser(
    /^application\/(octet-stream|vnd\.android\.package-archive)$/i,
    { parseAs: 'buffer', bodyLimit: MAX_UPLOAD_BODY_BYTES },
    (_request, body, done) => {
      done(null, body);
    }
  );

  await app.register(websocket);
  await app.register(swaggerPlugin);
  await app.register(securityPlugin);

  const metrics = new MetricsRegistry();
  const connectionManager = new ConnectionManager(app.log);
  const eventBus = new RedisChatEventBus(redis, redisSubscriber, app.log);
  const openClawConnectorHub = new OpenClawConnectorHub(app.log);
  const clawProvider = createClawProvider({
    env,
    logger: app.log,
    connectorHub: openClawConnectorHub
  });
  const clawBridge = new ClawBridgeService(clawProvider, env.OPENCLAW_RETRY_COUNT, app.log);

  const authService = new AuthService(
    db,
    env,
    (payload) => app.jwt.sign(payload, { expiresIn: env.ACCESS_TOKEN_TTL }),
    app.log
  );

  const pairingService = new PairingService(db, env, app.log);
  const contactsService = new ContactsService(db, app.log);
  const chatService = new ChatService({
    db,
    eventBus,
    connectionManager,
    clawBridge,
    logger: app.log
  });
  const fcmPushService = new FcmPushService(env, app.log);

  const socialService = new SocialService({
    db,
    connectionManager,
    clawBridge,
    pushService: fcmPushService,
    logger: app.log
  });
  const familyService = new FamilyService(db, connectionManager, app.log);
  const guardianService = new GuardianService(db, socialService, app.log);
  const botService = new BotService({
    db,
    socialService,
    logger: app.log
  });

  await botService.ensureDefaultBots();

  app.decorate('db', db);
  app.decorate('redis', redis);
  app.decorate('redisSubscriber', redisSubscriber);
  app.decorate('metrics', metrics);
  app.decorate('connectionManager', connectionManager);
  app.decorate('eventBus', eventBus);
  app.decorate('openClawConnectorHub', openClawConnectorHub);
  app.decorate('clawBridge', clawBridge);
  app.decorate('authService', authService);
  app.decorate('pairingService', pairingService);
  app.decorate('contactsService', contactsService);
  app.decorate('chatService', chatService);
  app.decorate('botService', botService);
  app.decorate('socialService', socialService);
  app.decorate('familyService', familyService);
  app.decorate('guardianService', guardianService);

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
  await app.register(appUpdatesRoutes, { prefix: '/v1/app-updates' });
  await app.register(pairingRoutes, { prefix: '/v1/pairing' });
  await app.register(familyRoutes, { prefix: '/v1/family' });
  await app.register(contactsRoutes, { prefix: '/v1/contacts' });
  await app.register(chatRoutes, { prefix: '/v1/chats' });
  await app.register(socialRoutes, { prefix: '/v1' });
  await app.register(guardianRoutes, { prefix: '/v1/guardian' });
  await app.register(guardianAppUpdatesRoutes, { prefix: '/v1/guardian/app-updates' });
  await app.register(botRoutes, { prefix: '/v1/bots' });
  await app.register(websocketRoutes, { prefix: '/v1' });
  await app.register(openClawRoutes, { prefix: '/v1/openclaw' });
  await app.register(guardianConsoleRoutes);

  app.addHook('onReady', async () => {
    await app.eventBus.start(async (event) => {
      await app.chatService.handleEvent(event);
    });
  });

  app.addHook('onClose', async () => {
    app.openClawConnectorHub.closeAll();
    await app.eventBus.close();
    await closeRedis();
    await closeDb();
  });

  return app;
}
