import { customAlphabet } from 'nanoid';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { env } from '../../config/env';
import { AppError, ErrorCodes } from '../../lib/errors';

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

function getRawQueryParams(request: FastifyRequest): URLSearchParams {
  const rawUrl = request.raw.url ?? '';
  const query = rawUrl.includes('?') ? rawUrl.split('?')[1] : '';
  return new URLSearchParams(query);
}

function parseBearerToken(request: FastifyRequest): string | undefined {
  const authHeader = request.headers.authorization;
  if (!authHeader) {
    return undefined;
  }

  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return match?.[1]?.trim() || undefined;
}

function resolveChannelTokenFromRequest(request: FastifyRequest): string | undefined {
  const params = getRawQueryParams(request);
  return params.get('token') ?? parseBearerToken(request);
}

export async function openClawRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/connectors/register',
    {
      schema: {
        tags: ['openclaw'],
        summary: 'Register an OpenClaw connector using a one-time pairing code',
        body: {
          type: 'object',
          required: ['pairingCode', 'connectorKey'],
          properties: {
            pairingCode: { type: 'string', minLength: 6, maxLength: 12 },
            connectorKey: { type: 'string', minLength: 3, maxLength: 120 },
            deviceName: { type: 'string', maxLength: 120 },
            platform: { type: 'string', maxLength: 40 }
          }
        }
      }
    },
    async (request) => {
      const body = request.body as {
        pairingCode: string;
        connectorKey: string;
        deviceName?: string;
        platform?: string;
      };
      const data = await app.pobiService.registerOpenClawConnectorByPairing(body);
      return {
        success: true,
        data
      };
    }
  );

  app.post(
    '/channel/register',
    {
      schema: {
        tags: ['openclaw'],
        summary: 'Register an OurHangout OpenClaw channel account using a one-time pairing code',
        body: {
          type: 'object',
          required: ['pairingCode', 'deviceKey'],
          properties: {
            pairingCode: { type: 'string', minLength: 6, maxLength: 12 },
            deviceKey: { type: 'string', minLength: 3, maxLength: 120 },
            deviceName: { type: 'string', maxLength: 120 },
            platform: { type: 'string', maxLength: 40 }
          }
        }
      }
    },
    async (request) => {
      const body = request.body as {
        pairingCode: string;
        deviceKey: string;
        deviceName?: string;
        platform?: string;
      };
      const data = await app.pobiService.registerOpenClawChannelByPairing(body);
      return {
        success: true,
        data
      };
    }
  );

  app.get('/channel/ws', { websocket: true }, async (socket, request) => {
    const token = resolveChannelTokenFromRequest(request);
    if (!token) {
      socket.close(1008, 'Unauthorized channel');
      return;
    }

    const account = await app.pobiService.resolveOpenClawChannelByAuthToken(token);
    if (!account) {
      socket.close(1008, 'Unauthorized channel');
      return;
    }

    const registration = app.openClawChannelHub.registerSession({
      socket,
      accountId: account.accountId,
      pobiIds: account.pobiBindings.map((binding) => binding.pobiId),
      botKeys: account.pobiBindings.map((binding) => binding.botKey)
    });

    void app.pobiService.markConnectorConnected(registration.accountId).catch(() => null);
    socket.on('close', () => {
      void app.pobiService.markConnectorDisconnected(registration.accountId).catch(() => null);
    });

    app.log.info(
      {
        accountId: registration.accountId,
        pobiIds: registration.pobiIds,
        botKeys: registration.botKeys
      },
      'OpenClaw channel websocket authenticated'
    );
  });

  app.get('/connector/ws', { websocket: true }, async (socket, request) => {
    const query = parseConnectorQuery(request);
    let connectorId = query.connectorId;
    let botKeys = query.botKeys;

    if (!query.token) {
      socket.close(1008, 'Unauthorized connector');
      return;
    }

    if (query.token !== env.OPENCLAW_CONNECTOR_TOKEN) {
      const resolved = await app.pobiService.resolveConnectorByAuthToken(query.token);
      if (!resolved) {
        socket.close(1008, 'Unauthorized connector');
        return;
      }

      connectorId = resolved.connectorId;
      if (botKeys.length === 0) {
        botKeys = resolved.botKeys;
      }
    }

    const registration = app.openClawConnectorHub.registerConnector({
      socket,
      connectorId,
      botKeys
    });

    void app.pobiService.markConnectorConnected(registration.connectorId).catch(() => null);
    socket.on('close', () => {
      void app.pobiService.markConnectorDisconnected(registration.connectorId).catch(() => null);
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
    '/channel/status',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['openclaw'],
        summary: 'Get connected OurHangout OpenClaw channel sessions'
      }
    },
    async () => {
      return {
        success: true,
        data: app.openClawChannelHub.getStatus()
      };
    }
  );

  app.get(
    '/channel/messages/sync',
    {
      schema: {
        tags: ['openclaw'],
        summary: 'Sync inbound OurHangout direct-room messages for the OpenClaw channel plugin',
        querystring: {
          type: 'object',
          properties: {
            token: { type: 'string', minLength: 16, maxLength: 512 },
            pobiId: { type: 'string', format: 'uuid' },
            afterOrderSeq: { type: 'number', minimum: 0 },
            limit: { type: 'number', minimum: 1, maximum: 200 }
          }
        }
      }
    },
    async (request) => {
      const token = resolveChannelTokenFromRequest(request);
      const account = token ? await app.pobiService.resolveOpenClawChannelByAuthToken(token) : null;
      if (!account) {
        throw new AppError(401, ErrorCodes.AUTH_UNAUTHORIZED, 'Unauthorized channel');
      }

      const query = (request.query as {
        pobiId?: string;
        afterOrderSeq?: number;
        limit?: number;
      } | undefined) ?? {};

      const data = await app.pobiService.listOpenClawChannelInboundMessages(account, query);
      return {
        success: true,
        data
      };
    }
  );

  app.post(
    '/channel/messages',
    {
      schema: {
        tags: ['openclaw'],
        summary: 'Store an outbound reply from the OpenClaw channel plugin into an OurHangout direct room',
        body: {
          type: 'object',
          required: ['roomId', 'pobiId', 'text'],
          properties: {
            roomId: { type: 'string', format: 'uuid' },
            pobiId: { type: 'string', format: 'uuid' },
            text: { type: 'string', minLength: 1, maxLength: 5000 },
            clientMessageId: { type: 'string', minLength: 1, maxLength: 128 },
            replyToMessageId: { type: 'string', format: 'uuid' }
          }
        }
      }
    },
    async (request) => {
      const token = resolveChannelTokenFromRequest(request);
      const account = token ? await app.pobiService.resolveOpenClawChannelByAuthToken(token) : null;
      if (!account) {
        throw new AppError(401, ErrorCodes.AUTH_UNAUTHORIZED, 'Unauthorized channel');
      }

      const body = request.body as {
        roomId: string;
        pobiId: string;
        text: string;
        clientMessageId?: string;
        replyToMessageId?: string;
      };
      const data = await app.pobiService.sendOpenClawChannelMessage(account, body);
      return {
        success: true,
        data
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
