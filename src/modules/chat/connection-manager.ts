import type { FastifyBaseLogger } from 'fastify';
import WebSocket from 'ws';

export class ConnectionManager {
  private readonly socketsByUserId = new Map<string, Set<WebSocket>>();
  private readonly aliveSockets = new WeakSet<WebSocket>();
  private readonly heartbeatTimer: NodeJS.Timeout;

  constructor(private readonly logger: FastifyBaseLogger) {
    this.heartbeatTimer = setInterval(() => this.heartbeat(), 30_000);
    this.heartbeatTimer.unref();
  }

  register(userId: string, socket: WebSocket): void {
    const existing = this.socketsByUserId.get(userId) ?? new Set<WebSocket>();
    if (existing.size >= 5) {
      const oldest = existing.values().next().value as WebSocket | undefined;
      if (oldest) {
        existing.delete(oldest);
        // A close handshake can remain in CLOSING indefinitely if the peer never
        // acknowledges it. Terminate the evicted socket so the limit is also a
        // real resource cap, not only a bookkeeping cap.
        oldest.terminate();
      }
    }
    existing.add(socket);
    this.aliveSockets.add(socket);
    socket.on('pong', () => this.aliveSockets.add(socket));
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

    for (const socket of sockets) {
      if (socket.readyState !== WebSocket.OPEN) {
        continue;
      }
      if (socket.bufferedAmount > 1024 * 1024) {
        socket.terminate();
        this.unregister(userId, socket);
        continue;
      }

      socket.send(serialized);
      atLeastOneSent = true;
    }

    return atLeastOneSent;
  }

  closeAll(): void {
    clearInterval(this.heartbeatTimer);
    for (const sockets of this.socketsByUserId.values()) {
      for (const socket of sockets) {
        socket.close(1001, 'Server shutting down');
      }
    }
    this.socketsByUserId.clear();
  }

  private heartbeat(): void {
    for (const [userId, sockets] of this.socketsByUserId.entries()) {
      for (const socket of sockets) {
        if (socket.readyState !== WebSocket.OPEN || !this.aliveSockets.has(socket)) {
          socket.terminate();
          this.unregister(userId, socket);
          continue;
        }

        this.aliveSockets.delete(socket);
        socket.ping();
      }
    }
  }
}
