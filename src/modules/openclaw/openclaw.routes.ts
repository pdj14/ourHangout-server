import { customAlphabet } from 'nanoid';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { env } from '../../config/env';

const testId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 12);

type ConnectorQuery = {
  token?: string;
  connectorId?: string;
  botKeys: string[];
};

function parseConnectorQuery(request: FastifyRequest): ConnectorQuery {
  const rawUrl = request.raw.url ?? '';
  const query = rawUrl.includes('?') ? rawUrl.split('?')[1] : '';
  const params = new URLSearchParams(query);

  const token = params.get('token') ?? undefined;
  const connectorId = params.get('connectorId') ?? undefined;

  const botKeySingles = params.getAll('botKey');
  const botKeysRaw = params.get('botKeys');
  const botKeysFromList =
    botKeysRaw && botKeysRaw.trim().length > 0
      ? botKeysRaw
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      : [];

  const botKeys = [...botKeySingles, ...botKeysFromList].filter((value) => value.trim().length > 0);

  return {
    token,
    connectorId,
    botKeys
  };
}

export async function openClawRoutes(app: FastifyInstance): Promise<void> {
  app.get('/connector/ws', { websocket: true }, (socket, request) => {
    const query = parseConnectorQuery(request);
    if (!query.token || query.token !== env.OPENCLAW_CONNECTOR_TOKEN) {
      socket.close(1008, 'Unauthorized connector');
      return;
    }

    const registration = app.openClawConnectorHub.registerConnector({
      socket,
      connectorId: query.connectorId,
      botKeys: query.botKeys
    });

    app.log.info(
      {
        connectorId: registration.connectorId,
        botKeys: registration.botKeys,
        wildcard: registration.wildcard
      },
      'OpenClaw connector websocket authenticated'
    );
  });

  app.get(
    '/connector/status',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['openclaw'],
        summary: 'Get connected OpenClaw connector sessions'
      }
    },
    async () => {
      return {
        success: true,
        data: app.openClawConnectorHub.getStatus()
      };
    }
  );

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
            botKey: { type: 'string', minLength: 2, maxLength: 64 },
            content: { type: 'string', minLength: 1, maxLength: 500 }
          }
        }
      }
    },
    async (request) => {
      const body = request.body as { botKey?: string; content: string };
      const data = await app.clawBridge.forwardMessage({
        messageId: `test-${testId()}`,
        roomId: 'test-room',
        senderId: request.user.sub,
        recipientId: request.user.sub,
        botKey: body.botKey,
        content: body.content
      });

      return {
        success: true,
        data
      };
    }
  );
}
