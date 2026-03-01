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
        const payload = JSON.parse(rawData.toString()) as { type?: string; messageId?: string };

        if (payload.type === 'ack' && typeof payload.messageId === 'string') {
          await app.chatService.ackMessageByRecipient(payload.messageId, userId);
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
