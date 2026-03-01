import type { Pool } from 'pg';
import type Redis from 'ioredis';
import type { MetricsRegistry } from '../lib/metrics';
import type { ConnectionManager } from '../modules/chat/connection-manager';
import type { RedisChatEventBus } from '../modules/chat/redis-event-bus';
import type { ClawBridgeService } from '../modules/openclaw/claw-bridge.service';
import type { ChatService } from '../modules/chat/chat.service';
import type { AuthService } from '../modules/auth/auth.service';
import type { PairingService } from '../modules/pairing/pairing.service';
import type { JwtUserPayload } from '../modules/auth/auth.types';

declare module 'fastify' {
  interface FastifyInstance {
    db: Pool;
    redis: Redis;
    redisSubscriber: Redis;
    metrics: MetricsRegistry;
    connectionManager: ConnectionManager;
    eventBus: RedisChatEventBus;
    clawBridge: ClawBridgeService;
    chatService: ChatService;
    authService: AuthService;
    pairingService: PairingService;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: JwtUserPayload;
    payload: JwtUserPayload;
  }
}
