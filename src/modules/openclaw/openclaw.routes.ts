import { customAlphabet } from 'nanoid';
import type { FastifyInstance } from 'fastify';

const testId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 12);

export async function openClawRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/ping',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['openclaw'],
        summary: 'Check configured OpenClaw provider status'
      }
    },
    async () => {
      const ping = await app.clawBridge.ping();
      return {
        success: true,
        data: {
          provider: app.clawBridge.getProviderName(),
          ...ping
        }
      };
    }
  );

  app.post(
    '/test-message',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['openclaw'],
        summary: 'Send a test message through OpenClaw provider',
        body: {
          type: 'object',
          required: ['content'],
          properties: {
            content: { type: 'string', minLength: 1, maxLength: 500 }
          }
        }
      }
    },
    async (request) => {
      const body = request.body as { content: string };
      const data = await app.clawBridge.forwardMessage({
        messageId: `test-${testId()}`,
        roomId: 'test-room',
        senderId: request.user.sub,
        recipientId: request.user.sub,
        content: body.content
      });

      return {
        success: true,
        data
      };
    }
  );
}
