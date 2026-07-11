import type { FastifyInstance } from 'fastify';
import { env } from '../../config/env';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/health',
    {
      config: { rateLimit: false },
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
      config: { rateLimit: false },
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

      await Promise.all([
        app.db.query('SELECT 1').then(
          () => { checks.postgres = true; },
          () => { checks.postgres = false; }
        ),
        app.redis.ping().then(
          (response) => { checks.redis = response === 'PONG'; },
          () => { checks.redis = false; }
        ),
        app.clawBridge.ping().then(
          (result) => { checks.openclaw = result.ok; },
          () => { checks.openclaw = false; }
        )
      ]);

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
      config: { rateLimit: false },
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
