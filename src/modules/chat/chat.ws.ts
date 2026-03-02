import type { FastifyInstance, FastifyRequest } from 'fastify';

function extractBearerToken(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.substring('Bearer '.length);
  }

  const rawUrl = request.raw.url ?? '';
  const query = rawUrl.includes('?') ? rawUrl.split('?')[1] : '';
  if (!query) {
    return undefined;
  }

  const params = new URLSearchParams(query);
  return params.get('token') ?? undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function websocketRoutes(app: FastifyInstance): Promise<void> {
  app.get('/ws', { websocket: true }, (socket, request) => {
    const token = extractBearerToken(request);
    if (!token) {
      socket.close(1008, 'Unauthorized');
      return;
    }

    let userId: string;

    try {
      const payload = app.jwt.verify<{ sub: string }>(token);
      userId = payload.sub;
    } catch {
      socket.close(1008, 'Unauthorized');
      return;
    }

    app.connectionManager.register(userId, socket);

    socket.send(
      JSON.stringify({
        type: 'ws.connected',
        data: {
          userId,
          connectedAt: new Date().toISOString()
        }
      })
    );

    socket.on('message', async (rawData: Buffer) => {
      try {
        const payload = JSON.parse(rawData.toString()) as {
          type?: string;
          messageId?: string;
          event?: string;
          data?: unknown;
        };

        if (payload.type === 'ack' && typeof payload.messageId === 'string') {
          await app.chatService.ackMessageByRecipient(payload.messageId, userId);
          return;
        }

        if (payload.event === 'message.send' && isRecord(payload.data)) {
          const roomId = payload.data.roomId;
          const kind = payload.data.kind;
          const text = payload.data.text;
          const uri = payload.data.uri;
          const clientMessageId = payload.data.clientMessageId;

          if (typeof roomId !== 'string' || typeof kind !== 'string') {
            socket.send(
              JSON.stringify({
                event: 'error',
                data: {
                  code: 'VALIDATION_ERROR',
                  message: 'roomId and kind are required for message.send.'
                }
              })
            );
            return;
          }

          await app.socialService.sendRoomMessage({
            userId,
            roomId,
            kind: kind as 'text' | 'image' | 'video' | 'system',
            text: typeof text === 'string' ? text : undefined,
            uri: typeof uri === 'string' ? uri : undefined,
            clientMessageId: typeof clientMessageId === 'string' ? clientMessageId : undefined
          });
          return;
        }

        if (payload.event === 'message.read' && isRecord(payload.data)) {
          const roomId = payload.data.roomId;
          const lastReadMessageId = payload.data.lastReadMessageId;

          if (typeof roomId !== 'string') {
            socket.send(
              JSON.stringify({
                event: 'error',
                data: {
                  code: 'VALIDATION_ERROR',
                  message: 'roomId is required for message.read.'
                }
              })
            );
            return;
          }

          await app.socialService.markRoomRead({
            userId,
            roomId,
            lastReadMessageId: typeof lastReadMessageId === 'string' ? lastReadMessageId : undefined
          });
          return;
        }

        if (payload.event === 'room.join' || payload.event === 'room.leave') {
          socket.send(
            JSON.stringify({
              event: payload.event,
              data: { ok: true }
            })
          );
          return;
        }
      } catch (error) {
        app.log.warn({ error, userId }, 'Failed to process websocket message payload');
      }
    });

    socket.on('close', () => {
      app.connectionManager.unregister(userId, socket);
    });

    socket.on('error', (error: Error) => {
      app.log.warn({ error, userId }, 'WebSocket connection error');
      app.connectionManager.unregister(userId, socket);
    });
  });
}
