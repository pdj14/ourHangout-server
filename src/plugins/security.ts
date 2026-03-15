import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { env } from '../config/env';
import { redis } from '../lib/redis';

export const securityPlugin = fp(async (app) => {
  await app.register(helmet, {
    contentSecurityPolicy: false
  });

  await app.register(cors, {
    credentials: true,
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (env.CORS_ORIGINS.includes('*') || env.CORS_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }

      // Returning false disables CORS headers for that origin without turning the request into a 500.
      // This matters for same-origin module script requests that still send an Origin header.
      callback(null, false);
    }
  });

  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    redis,
    nameSpace: env.RATE_LIMIT_REDIS_NAMESPACE,
    skipOnError: env.RATE_LIMIT_SKIP_ON_ERROR
  });

  await app.register(jwt, {
    secret: env.JWT_SECRET
  });
});
