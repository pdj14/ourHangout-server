import type { FastifyBaseLogger } from 'fastify';
import { AppError, ErrorCodes } from '../../lib/errors';
import type { ClawProvider, ClawProviderInput, ClawProviderResult, ClawPingResult } from './claw-provider';

export class HttpClawProvider implements ClawProvider {
  readonly name = 'http';

  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number,
    private readonly logger: FastifyBaseLogger
  ) {}

  async sendMessage(input: ClawProviderInput): Promise<ClawProviderResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.cleanBaseUrl()}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify(input),
        signal: controller.signal
      });

      const bodyText = await response.text();
      const parsedBody = this.tryParseJson(bodyText);

      if (!response.ok) {
        throw new AppError(502, ErrorCodes.OPENCLAW_UPSTREAM_ERROR, 'OpenClaw responded with non-2xx status.', {
          baseUrl: this.cleanBaseUrl(),
          status: response.status,
          body: parsedBody ?? bodyText
        });
      }

      return {
        providerMessageId:
          typeof parsedBody?.providerMessageId === 'string' ? parsedBody.providerMessageId : undefined,
        replyText: typeof parsedBody?.replyText === 'string' ? parsedBody.replyText : undefined,
        raw: parsedBody ?? bodyText
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AppError(504, ErrorCodes.OPENCLAW_TIMEOUT, 'OpenClaw request timed out.', {
          baseUrl: this.cleanBaseUrl(),
          timeoutMs: this.timeoutMs
        });
      }

      if (error instanceof AppError) {
        throw error;
      }

      this.logger.error({ error, baseUrl: this.cleanBaseUrl() }, 'Unexpected OpenClaw HTTP provider error');
      throw new AppError(502, ErrorCodes.OPENCLAW_UPSTREAM_ERROR, 'Failed to reach OpenClaw endpoint.', {
        baseUrl: this.cleanBaseUrl()
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async ping(): Promise<ClawPingResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.cleanBaseUrl()}/health`, {
        method: 'GET',
        signal: controller.signal
      });

      if (!response.ok) {
        return {
          ok: false,
          details: `HTTP ${response.status}`
        };
      }

      return {
        ok: true,
        details: 'OpenClaw HTTP health endpoint reachable.'
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          ok: false,
          details: `Timeout after ${this.timeoutMs}ms`
        };
      }

      return {
        ok: false,
        details: 'Health check failed to connect.'
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private cleanBaseUrl(): string {
    return this.baseUrl.replace(/\/+$/, '');
  }

  private tryParseJson(value: string): Record<string, unknown> | null {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}
