import type { FastifyBaseLogger } from 'fastify';
import type { AppEnv } from '../../config/env';
import type { ClawProvider } from './claw-provider';
import type { OpenClawConnectorHub } from './connector-hub';
import { ConnectorClawProvider } from './connector.provider';
import { HttpClawProvider } from './http.provider';
import { MockClawProvider } from './mock.provider';

type CreateClawProviderDeps = {
  env: AppEnv;
  logger: FastifyBaseLogger;
  connectorHub: OpenClawConnectorHub;
};

export function createClawProvider(deps: CreateClawProviderDeps): ClawProvider {
  const { env, logger, connectorHub } = deps;

  if (env.OPENCLAW_MODE === 'connector') {
    return new ConnectorClawProvider(connectorHub, env.OPENCLAW_TIMEOUT_MS, logger);
  }

  if (env.OPENCLAW_MODE === 'http') {
    return new HttpClawProvider(env.OPENCLAW_BASE_URL, env.OPENCLAW_TIMEOUT_MS, logger);
  }

  return new MockClawProvider();
}
