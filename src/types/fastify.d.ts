import type { Pool } from 'pg';
import type Redis from 'ioredis';
import type { MetricsRegistry } from '../lib/metrics';
import type { ConnectionManager } from '../modules/chat/connection-manager';
import type { RedisChatEventBus } from '../modules/chat/redis-event-bus';
import type { ClawBridgeService } from '../modules/openclaw/claw-bridge.service';
import type { OpenClawConnectorHub } from '../modules/openclaw/connector-hub';
import type { ChatService } from '../modules/chat/chat.service';
import type { AuthService } from '../modules/auth/auth.service';
import type { PairingService } from '../modules/pairing/pairing.service';
import type { ContactsService } from '../modules/contacts/contacts.service';
import type { BotService } from '../modules/bots/bot.service';
import type { SocialService } from '../modules/social/social.service';
import type { GuardianService } from '../modules/guardian/guardian.service';
import type { JwtUserPayload } from '../modules/auth/auth.types';

declare module 'fastify' {
  interface FastifyInstance {
    db: Pool;
    redis: Redis;
    redisSubscriber: Redis;
    metrics: MetricsRegistry;
    connectionManager: ConnectionManager;
    eventBus: RedisChatEventBus;
    openClawConnectorHub: OpenClawConnectorHub;
    clawBridge: ClawBridgeService;
    chatService: ChatService;
    authService: AuthService;
    pairingService: PairingService;
    contactsService: ContactsService;
    botService: BotService;
    socialService: SocialService;
    guardianService: GuardianService;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authenticateGuardian: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: JwtUserPayload;
    payload: JwtUserPayload;
  }
}
