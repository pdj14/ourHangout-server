import type { FastifyInstance } from 'fastify';
import { env } from '../../config/env';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/health',
    {
      schema: {
        tags: ['ops'],
        summary: 'Liveness probe endpoint'
      }
    },
    async () => {
      return {
        success: true,
        data: {
          status: 'ok',
          timestamp: new Date().toISOString()
        }
      };
    }
  );

  app.get(
    '/ready',
    {
      schema: {
        tags: ['ops'],
        summary: 'Readiness probe endpoint'
      }
    },
    async (_request, reply) => {
      const checks = {
        postgres: false,
        redis: false,
        openclaw: false
      };

      try {
        await app.db.query('SELECT 1');
        checks.postgres = true;
      } catch {
        checks.postgres = false;
      }

      try {
        const redisResponse = await app.redis.ping();
        checks.redis = redisResponse === 'PONG';
      } catch {
        checks.redis = false;
      }

      try {
        const openclaw = await app.clawBridge.ping();
        checks.openclaw = openclaw.ok;
      } catch {
        checks.openclaw = false;
      }

      const openClawRequired = env.OPENCLAW_MODE !== 'mock';
      const ready = checks.postgres && checks.redis && (!openClawRequired || checks.openclaw);

      if (!ready) {
        reply.code(503);
      }

      return {
        success: ready,
        data: checks
      };
    }
  );

  app.get(
    '/metrics',
    {
      schema: {
        tags: ['ops'],
        summary: 'Basic request/error counters'
      }
    },
    async () => {
      return {
        success: true,
        data: app.metrics.snapshot()
      };
    }
  );
}
