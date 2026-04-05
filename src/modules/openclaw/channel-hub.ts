import type { FastifyBaseLogger } from 'fastify';
import WebSocket from 'ws';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeValues(values?: string[]): Set<string> {
  return new Set(
    (values ?? [])
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
  );
}

export type OpenClawChannelMessageEvent = {
  event: 'ourhangout.message';
  data: {
    accountId: string;
    sessionKey: string;
    roomId: string;
    roomType: 'direct';
    pobiId: string;
    botKey: string;
    botUserId: string;
    senderUserId: string;
    messageId: string;
    kind: 'text' | 'image' | 'video' | 'system';
    text?: string;
    uri?: string;
    replyToMessageId?: string;
    orderSeq: number;
    createdAt: string;
  };
};

type ChannelSession = {
  accountId: string;
  socket: WebSocket;
  pobiIds: Set<string>;
  botKeys: Set<string>;
  connectedAt: Date;
  lastSeenAt: Date;
};

type RegisterChannelSessionParams = {
  socket: WebSocket;
  accountId: string;
  pobiIds?: string[];
  botKeys?: string[];
};

export class OpenClawChannelHub {
  private readonly logger: FastifyBaseLogger;
  private readonly sessions = new Map<string, ChannelSession>();

  constructor(logger: FastifyBaseLogger) {
    this.logger = logger;
  }

  registerSession(params: RegisterChannelSessionParams): {
    accountId: string;
    pobiIds: string[];
    botKeys: string[];
  } {
    const accountId = params.accountId.trim();
    const existing = this.sessions.get(accountId);
    if (existing && existing.socket !== params.socket) {
      try {
        existing.socket.close(1012, 'Replaced');
      } catch {
        // no-op
      }
    }

    const session: ChannelSession = {
      accountId,
      socket: params.socket,
      pobiIds: normalizeValues(params.pobiIds),
      botKeys: normalizeValues(params.botKeys),
      connectedAt: new Date(),
      lastSeenAt: new Date()
    };

    this.sessions.set(accountId, session);

    params.socket.on('message', (rawData) => {
      this.handleSocketMessage(accountId, rawData);
    });

    params.socket.on('close', () => {
      this.unregisterSession(accountId, params.socket, 'closed');
    });

    params.socket.on('error', (error: Error) => {
      this.logger.warn({ error, accountId }, 'OpenClaw channel socket error');
      this.unregisterSession(accountId, params.socket, 'error');
    });

    this.sendSafe(params.socket, {
      event: 'ourhangout.connected',
      data: {
        accountId,
        pobiIds: Array.from(session.pobiIds),
        botKeys: Array.from(session.botKeys),
        connectedAt: session.connectedAt.toISOString()
      }
    });

    this.logger.info(
      {
        accountId,
        pobiIds: Array.from(session.pobiIds),
        botKeys: Array.from(session.botKeys)
      },
      'OpenClaw channel session registered'
    );

    return {
      accountId,
      pobiIds: Array.from(session.pobiIds),
      botKeys: Array.from(session.botKeys)
    };
  }

  hasActiveSessionForPobi(pobiId: string): boolean {
    return this.getActiveSessions().some((session) => session.pobiIds.has(pobiId));
  }

  getSessionsForPobi(pobiId?: string): Array<{
    accountId: string;
    pobiIds: string[];
    botKeys: string[];
    connectedAt: string;
    lastSeenAt: string;
  }> {
    return this.getActiveSessions()
      .filter((session) => (!pobiId ? true : session.pobiIds.has(pobiId)))
      .map((session) => ({
        accountId: session.accountId,
        pobiIds: Array.from(session.pobiIds),
        botKeys: Array.from(session.botKeys),
        connectedAt: session.connectedAt.toISOString(),
        lastSeenAt: session.lastSeenAt.toISOString()
      }));
  }

  getStatus(): {
    activeChannels: number;
    channels: Array<{
      accountId: string;
      pobiIds: string[];
      botKeys: string[];
      connectedAt: string;
      lastSeenAt: string;
    }>;
  } {
    const channels = this.getSessionsForPobi();
    return {
      activeChannels: channels.length,
      channels
    };
  }

  publishMessageEvent(event: OpenClawChannelMessageEvent): number {
    const sessions = this.getActiveSessions().filter((session) => session.pobiIds.has(event.data.pobiId));
    for (const session of sessions) {
      this.sendSafe(session.socket, event);
    }
    return sessions.length;
  }

  closeAll(): void {
    for (const session of this.sessions.values()) {
      try {
        session.socket.close(1001, 'Server shutdown');
      } catch {
        // no-op
      }
    }
    this.sessions.clear();
  }

  private handleSocketMessage(accountId: string, rawData: WebSocket.RawData): void {
    const session = this.sessions.get(accountId);
    if (!session) {
      return;
    }

    session.lastSeenAt = new Date();

    let parsed: unknown;
    try {
      const asString = Buffer.isBuffer(rawData) ? rawData.toString('utf8') : String(rawData);
      parsed = JSON.parse(asString);
    } catch (error) {
      this.logger.warn({ error, accountId }, 'Failed to parse OpenClaw channel websocket payload');
      return;
    }

    if (!isRecord(parsed) || typeof parsed.event !== 'string') {
      return;
    }

    if (parsed.event === 'channel.ping') {
      this.sendSafe(session.socket, {
        event: 'channel.pong',
        data: {
          serverTime: new Date().toISOString()
        }
      });
      return;
    }

    if (parsed.event === 'channel.hello' && isRecord(parsed.data)) {
      const nextPobiIds = Array.isArray(parsed.data.pobiIds)
        ? parsed.data.pobiIds.filter((value): value is string => typeof value === 'string')
        : [];
      const nextBotKeys = Array.isArray(parsed.data.botKeys)
        ? parsed.data.botKeys.filter((value): value is string => typeof value === 'string')
        : [];

      if (nextPobiIds.length > 0) {
        session.pobiIds = normalizeValues(nextPobiIds);
      }
      if (nextBotKeys.length > 0) {
        session.botKeys = normalizeValues(nextBotKeys);
      }

      this.sendSafe(session.socket, {
        event: 'channel.hello.ack',
        data: {
          accountId,
          pobiIds: Array.from(session.pobiIds),
          botKeys: Array.from(session.botKeys)
        }
      });
    }
  }

  private unregisterSession(accountId: string, socket: WebSocket, reason: string): void {
    const session = this.sessions.get(accountId);
    if (!session || session.socket !== socket) {
      return;
    }

    this.sessions.delete(accountId);
    this.logger.info({ accountId, reason }, 'OpenClaw channel session unregistered');
  }

  private getActiveSessions(): ChannelSession[] {
    return Array.from(this.sessions.values()).filter((session) => session.socket.readyState === WebSocket.OPEN);
  }

  private sendSafe(socket: WebSocket, payload: unknown): void {
    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      socket.send(JSON.stringify(payload));
    } catch (error) {
      this.logger.warn({ error }, 'Failed to send payload to OpenClaw channel socket');
    }
  }
}
