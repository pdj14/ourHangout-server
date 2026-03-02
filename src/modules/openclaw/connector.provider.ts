import type { FastifyBaseLogger } from 'fastify';
import type { ClawProvider, ClawProviderInput, ClawProviderResult, ClawPingResult } from './claw-provider';
import type { OpenClawConnectorHub } from './connector-hub';

export class ConnectorClawProvider implements ClawProvider {
  readonly name = 'connector';

  constructor(
    private readonly hub: OpenClawConnectorHub,
    private readonly timeoutMs: number,
    private readonly logger: FastifyBaseLogger
  ) {}

  async sendMessage(input: ClawProviderInput): Promise<ClawProviderResult> {
    return this.hub.request(input, this.timeoutMs);
  }

  async ping(): Promise<ClawPingResult> {
    const ping = await this.hub.ping();
    if (!ping.ok) {
      this.logger.warn({ provider: this.name, details: ping.details }, 'OpenClaw connector provider ping failed');
    }
    return ping;
  }
}
