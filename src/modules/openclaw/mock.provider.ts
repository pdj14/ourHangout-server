import type { ClawProvider, ClawProviderInput, ClawProviderResult, ClawPingResult } from './claw-provider';

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

export class MockClawProvider implements ClawProvider {
  readonly name = 'mock';

  async sendMessage(input: ClawProviderInput): Promise<ClawProviderResult> {
    await wait(180);
    return {
      providerMessageId: `mock-${Date.now()}`,
      replyText: `[mock-openclaw] ${input.content}`,
      raw: {
        echo: true
      }
    };
  }

  async ping(): Promise<ClawPingResult> {
    return {
      ok: true,
      details: 'Mock provider is always healthy.'
    };
  }
}
