import type { FastifyBaseLogger } from 'fastify';
import type { AppEnv } from '../../config/env';
import type { ClawProvider } from './claw-provider';
import { HttpClawProvider } from './http.provider';
import { MockClawProvider } from './mock.provider';

export function createClawProvider(env: AppEnv, logger: FastifyBaseLogger): ClawProvider {
  if (env.OPENCLAW_MODE === 'http') {
    return new HttpClawProvider(env.OPENCLAW_BASE_URL, env.OPENCLAW_TIMEOUT_MS, logger);
  }

  return new MockClawProvider();
}
