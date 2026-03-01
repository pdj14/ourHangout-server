import type { FastifyBaseLogger } from 'fastify';
import type Redis from 'ioredis';
import type { ChatEvent } from './chat.types';

const CHANNEL_NAME = 'ourhangout:chat-events';

type EventHandler = (event: ChatEvent) => Promise<void>;

export class RedisChatEventBus {
  private started = false;
  private handler?: EventHandler;

  constructor(
    private readonly pubClient: Redis,
    private readonly subClient: Redis,
    private readonly logger: FastifyBaseLogger
  ) {}

  async start(handler: EventHandler): Promise<void> {
    if (this.started) {
      return;
    }

    this.handler = handler;

    this.subClient.on('message', async (channel, rawMessage) => {
      if (channel !== CHANNEL_NAME || !this.handler) {
        return;
      }

      try {
        const parsed = JSON.parse(rawMessage) as ChatEvent;
        await this.handler(parsed);
      } catch (error) {
        this.logger.error({ error, rawMessage }, 'Failed to consume chat event');
      }
    });

    await this.subClient.subscribe(CHANNEL_NAME);
    this.started = true;
    this.logger.info({ channel: CHANNEL_NAME }, 'Redis chat event bus started');
  }

  async publish(event: ChatEvent): Promise<void> {
    await this.pubClient.publish(CHANNEL_NAME, JSON.stringify(event));
  }

  async close(): Promise<void> {
    if (!this.started) {
      return;
    }

    await this.subClient.unsubscribe(CHANNEL_NAME);
    this.started = false;
  }
}
