import type { FastifyBaseLogger } from 'fastify';
import WebSocket from 'ws';

export class ConnectionManager {
  private readonly socketsByUserId = new Map<string, Set<WebSocket>>();

  constructor(private readonly logger: FastifyBaseLogger) {}

  register(userId: string, socket: WebSocket): void {
    const existing = this.socketsByUserId.get(userId) ?? new Set<WebSocket>();
    existing.add(socket);
    this.socketsByUserId.set(userId, existing);

    this.logger.debug({ userId, connectionCount: existing.size }, 'WebSocket connection registered');
  }

  unregister(userId: string, socket: WebSocket): void {
    const existing = this.socketsByUserId.get(userId);
    if (!existing) {
      return;
    }

    existing.delete(socket);
    if (existing.size === 0) {
      this.socketsByUserId.delete(userId);
    }

    this.logger.debug({ userId, connectionCount: existing.size }, 'WebSocket connection unregistered');
  }

  sendToUser(userId: string, payload: unknown): boolean {
    const sockets = this.socketsByUserId.get(userId);
    if (!sockets || sockets.size === 0) {
      return false;
    }

    const serialized = JSON.stringify(payload);
    let atLeastOneSent = false;
    const staleSockets: WebSocket[] = [];

    for (const socket of sockets) {
      if (socket.readyState !== WebSocket.OPEN) {
        staleSockets.push(socket);
        continue;
      }

      try {
        socket.send(serialized);
        atLeastOneSent = true;
      } catch (error) {
        staleSockets.push(socket);
        this.logger.warn({ error, userId }, 'WebSocket send failed');
      }
    }

    for (const socket of staleSockets) {
      this.unregister(userId, socket);
    }

    return atLeastOneSent;
  }
}
