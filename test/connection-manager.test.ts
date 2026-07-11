import { EventEmitter } from 'node:events';
import assert from 'node:assert/strict';
import test from 'node:test';
import type { FastifyBaseLogger } from 'fastify';
import WebSocket from 'ws';
import { ConnectionManager } from '../src/modules/chat/connection-manager';

class FakeSocket extends EventEmitter {
  readyState: number = WebSocket.OPEN;
  bufferedAmount = 0;
  sentCount = 0;
  terminated = false;

  send(): void {
    this.sentCount += 1;
  }

  close(): void {
    this.readyState = WebSocket.CLOSED;
  }

  terminate(): void {
    this.terminated = true;
    this.readyState = WebSocket.CLOSED;
  }

  ping(): void {}
}

const logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined
} as unknown as FastifyBaseLogger;

test('sixth websocket immediately terminates and replaces the oldest socket', () => {
  const manager = new ConnectionManager(logger);
  const sockets = Array.from({ length: 6 }, () => new FakeSocket());

  for (const socket of sockets) {
    manager.register('user-1', socket as unknown as WebSocket);
  }

  assert.equal(sockets[0].terminated, true);
  assert.equal(manager.sendToUser('user-1', { event: 'test' }), true);
  assert.equal(sockets[0].sentCount, 0);
  assert.equal(sockets.slice(1).every((socket) => socket.sentCount === 1), true);
  manager.closeAll();
});
