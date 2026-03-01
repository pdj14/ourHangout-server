import type { FastifyBaseLogger } from 'fastify';
import type { ClawProvider, ClawProviderInput, ClawProviderResult, ClawPingResult } from './claw-provider';

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

export class ClawBridgeService {
  constructor(
    private readonly provider: ClawProvider,
    private readonly retryCount: number,
    private readonly logger: FastifyBaseLogger
  ) {}

  getProviderName(): string {
    return this.provider.name;
  }

  async ping(): Promise<ClawPingResult> {
    return this.provider.ping();
  }

  async forwardMessage(input: ClawProviderInput): Promise<ClawProviderResult> {
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= this.retryCount) {
      try {
        return await this.provider.sendMessage(input);
      } catch (error) {
        lastError = error;

        if (attempt >= this.retryCount) {
          break;
        }

        const backoffMs = 200 * (attempt + 1);
        this.logger.warn(
          {
            attempt: attempt + 1,
            retryCount: this.retryCount,
            backoffMs,
            error,
            provider: this.provider.name
          },
          'OpenClaw forwarding failed. Retrying.'
        );

        await wait(backoffMs);
      }

      attempt += 1;
    }

    throw lastError;
  }
}
