import { randomUUID } from 'crypto';
import type { FastifyBaseLogger } from 'fastify';
import WebSocket from 'ws';
import { AppError, ErrorCodes } from '../../lib/errors';
import type { ClawPingResult, ClawProviderInput, ClawProviderResult } from './claw-provider';

type PendingRequest = {
  connectorId: string;
  timeout: NodeJS.Timeout;
  resolve: (value: ClawProviderResult) => void;
  reject: (error: unknown) => void;
};

type ConnectorSession = {
  connectorId: string;
  socket: WebSocket;
  botKeys: Set<string>;
  wildcard: boolean;
  connectedAt: Date;
  lastSeenAt: Date;
};

type RegisterConnectorParams = {
  socket: WebSocket;
  connectorId?: string;
  botKeys?: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeBotKey(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeBotKeys(values?: string[]): { botKeys: Set<string>; wildcard: boolean } {
  const input = values ?? [];
  const normalized = input
    .map((value) => normalizeBotKey(value))
    .filter((value) => value.length > 0);

  if (normalized.length === 0) {
    return {
      botKeys: new Set<string>(),
      wildcard: true
    };
  }

  const wildcard = normalized.includes('*') || normalized.includes('all');
  return {
    botKeys: new Set(normalized.filter((value) => value !== '*' && value !== 'all')),
    wildcard
  };
}

export class OpenClawConnectorHub {
  private readonly logger: FastifyBaseLogger;
  private readonly sessions = new Map<string, ConnectorSession>();
  private readonly pendingByRequestId = new Map<string, PendingRequest>();

  constructor(logger: FastifyBaseLogger) {
    this.logger = logger;
  }

  registerConnector(params: RegisterConnectorParams): { connectorId: string; botKeys: string[]; wildcard: boolean } {
    const connectorId = params.connectorId?.trim() || `connector-${randomUUID()}`;
    const normalized = normalizeBotKeys(params.botKeys);

    const existing = this.sessions.get(connectorId);
    if (existing && existing.socket !== params.socket) {
      this.failPendingByConnector(connectorId, 'Connector replaced by a new socket.');
      try {
        existing.socket.close(1012, 'Replaced');
      } catch {
        // no-op
      }
    }

    const session: ConnectorSession = {
      connectorId,
      socket: params.socket,
      botKeys: normalized.botKeys,
      wildcard: normalized.wildcard,
      connectedAt: new Date(),
      lastSeenAt: new Date()
    };

    this.sessions.set(connectorId, session);

    params.socket.on('message', (rawData) => {
      this.handleSocketMessage(connectorId, rawData);
    });

    params.socket.on('close', () => {
      this.unregisterConnector(connectorId, params.socket, 'closed');
    });

    params.socket.on('error', (error: Error) => {
      this.logger.warn({ error, connectorId }, 'OpenClaw connector socket error');
      this.unregisterConnector(connectorId, params.socket, 'error');
    });

    this.sendSafe(params.socket, {
      event: 'connector.connected',
      data: {
        connectorId,
        botKeys: Array.from(session.botKeys),
        wildcard: session.wildcard,
        connectedAt: session.connectedAt.toISOString()
      }
    });

    this.logger.info(
      {
        connectorId,
        botKeys: Array.from(session.botKeys),
        wildcard: session.wildcard
      },
      'OpenClaw connector registered'
    );

    return {
      connectorId,
      botKeys: Array.from(session.botKeys),
      wildcard: session.wildcard
    };
  }

  async request(input: ClawProviderInput, timeoutMs: number): Promise<ClawProviderResult> {
    const session = this.pickConnector(input.botKey);
    if (!session) {
      throw new AppError(503, ErrorCodes.OPENCLAW_UPSTREAM_ERROR, 'No active OpenClaw connector available.', {
        botKey: input.botKey ?? null
      });
    }

    if (session.socket.readyState !== WebSocket.OPEN) {
      this.unregisterConnector(session.connectorId, session.socket, 'not-open');
      throw new AppError(503, ErrorCodes.OPENCLAW_UPSTREAM_ERROR, 'Connector is not in OPEN state.', {
        connectorId: session.connectorId
      });
    }

    const requestId = `req-${randomUUID()}`;
    const payload = {
      event: 'openclaw.request',
      data: {
        requestId,
        ...input,
        requestedAt: new Date().toISOString()
      }
    };

    return new Promise<ClawProviderResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingByRequestId.delete(requestId);
        reject(
          new AppError(504, ErrorCodes.OPENCLAW_TIMEOUT, 'Connector response timed out.', {
            connectorId: session.connectorId,
            timeoutMs
          })
        );
      }, timeoutMs);

      this.pendingByRequestId.set(requestId, {
        connectorId: session.connectorId,
        timeout,
        resolve,
        reject
      });

      try {
        session.socket.send(JSON.stringify(payload), (error) => {
          if (!error) {
            return;
          }

          const pending = this.pendingByRequestId.get(requestId);
          if (!pending) {
            return;
          }

          clearTimeout(pending.timeout);
          this.pendingByRequestId.delete(requestId);
          pending.reject(
            new AppError(502, ErrorCodes.OPENCLAW_UPSTREAM_ERROR, 'Failed to send request to connector.', {
              connectorId: session.connectorId
            })
          );
        });
      } catch (error) {
        const pending = this.pendingByRequestId.get(requestId);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingByRequestId.delete(requestId);
          pending.reject(error);
        }
      }
    });
  }

  async ping(): Promise<ClawPingResult> {
    const activeCount = this.getActiveSessions().length;
    if (activeCount === 0) {
      return {
        ok: false,
        details: 'No active connector'
      };
    }

    return {
      ok: true,
      details: `Active connectors: ${activeCount}`
    };
  }

  getStatus(): {
    activeConnectors: number;
    pendingRequests: number;
    connectors: Array<{
      connectorId: string;
      botKeys: string[];
      wildcard: boolean;
      connectedAt: string;
      lastSeenAt: string;
    }>;
  } {
    const connectors = this.getActiveSessions().map((session) => ({
      connectorId: session.connectorId,
      botKeys: Array.from(session.botKeys),
      wildcard: session.wildcard,
      connectedAt: session.connectedAt.toISOString(),
      lastSeenAt: session.lastSeenAt.toISOString()
    }));

    return {
      activeConnectors: connectors.length,
      pendingRequests: this.pendingByRequestId.size,
      connectors
    };
  }

  closeAll(): void {
    for (const session of this.sessions.values()) {
      try {
        session.socket.close(1001, 'Server shutdown');
      } catch {
        // no-op
      }
    }

    this.failPendingByConnector(undefined, 'Connector hub closed');
    this.sessions.clear();
  }

  private handleSocketMessage(connectorId: string, rawData: WebSocket.RawData): void {
    const session = this.sessions.get(connectorId);
    if (!session) {
      return;
    }

    session.lastSeenAt = new Date();

    let parsed: unknown;
    try {
      const asString = Buffer.isBuffer(rawData) ? rawData.toString('utf8') : String(rawData);
      parsed = JSON.parse(asString);
    } catch (error) {
      this.logger.warn({ error, connectorId }, 'Failed to parse connector websocket payload');
      return;
    }

    if (!isRecord(parsed) || typeof parsed.event !== 'string') {
      return;
    }

    if (parsed.event === 'connector.hello' && isRecord(parsed.data)) {
      const fromData = this.extractBotKeysFromUnknown(parsed.data.botKeys);
      const normalized = normalizeBotKeys(fromData);
      session.botKeys = normalized.botKeys;
      session.wildcard = normalized.wildcard;

      this.sendSafe(session.socket, {
        event: 'connector.hello.ack',
        data: {
          connectorId,
          botKeys: Array.from(session.botKeys),
          wildcard: session.wildcard
        }
      });

      this.logger.info(
        {
          connectorId,
          botKeys: Array.from(session.botKeys),
          wildcard: session.wildcard
        },
        'OpenClaw connector capabilities updated'
      );
      return;
    }

    if (parsed.event === 'connector.ping') {
      this.sendSafe(session.socket, {
        event: 'connector.pong',
        data: {
          serverTime: new Date().toISOString()
        }
      });
      return;
    }

    if (parsed.event !== 'openclaw.response' || !isRecord(parsed.data)) {
      return;
    }

    const requestId = typeof parsed.data.requestId === 'string' ? parsed.data.requestId : '';
    if (!requestId) {
      return;
    }

    const pending = this.pendingByRequestId.get(requestId);
    if (!pending) {
      this.logger.warn({ connectorId, requestId }, 'Received response for unknown connector request');
      return;
    }

    if (pending.connectorId !== connectorId) {
      this.logger.warn(
        {
          connectorId,
          expectedConnectorId: pending.connectorId,
          requestId
        },
        'Ignoring connector response from mismatched connector'
      );
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingByRequestId.delete(requestId);

    const ok = parsed.data.ok !== false;
    if (!ok) {
      const errorMessage =
        typeof parsed.data.error === 'string' && parsed.data.error.trim().length > 0
          ? parsed.data.error
          : 'Connector returned error.';

      pending.reject(
        new AppError(502, ErrorCodes.OPENCLAW_UPSTREAM_ERROR, errorMessage, {
          connectorId,
          requestId
        })
      );
      return;
    }

    pending.resolve({
      providerMessageId:
        typeof parsed.data.providerMessageId === 'string' ? parsed.data.providerMessageId : undefined,
      replyText: typeof parsed.data.replyText === 'string' ? parsed.data.replyText : undefined,
      raw: parsed.data.raw
    });
  }

  private unregisterConnector(connectorId: string, socket: WebSocket, reason: string): void {
    const session = this.sessions.get(connectorId);
    if (!session || session.socket !== socket) {
      return;
    }

    this.sessions.delete(connectorId);
    this.failPendingByConnector(connectorId, `Connector disconnected (${reason}).`);

    this.logger.info({ connectorId, reason }, 'OpenClaw connector unregistered');
  }

  private failPendingByConnector(connectorId?: string, message?: string): void {
    for (const [requestId, pending] of this.pendingByRequestId.entries()) {
      if (connectorId && pending.connectorId !== connectorId) {
        continue;
      }

      clearTimeout(pending.timeout);
      this.pendingByRequestId.delete(requestId);
      pending.reject(
        new AppError(502, ErrorCodes.OPENCLAW_UPSTREAM_ERROR, message ?? 'Connector disconnected.', {
          connectorId: pending.connectorId
        })
      );
    }
  }

  private pickConnector(botKey?: string): ConnectorSession | null {
    const active = this.getActiveSessions();
    if (active.length === 0) {
      return null;
    }

    const normalizedBotKey = botKey ? normalizeBotKey(botKey) : '';

    if (normalizedBotKey) {
      const exact = active.filter((session) => session.botKeys.has(normalizedBotKey));
      if (exact.length > 0) {
        return exact[0];
      }

      const wildcard = active.filter((session) => session.wildcard);
      if (wildcard.length > 0) {
        return wildcard[0];
      }

      return null;
    }

    const wildcard = active.filter((session) => session.wildcard);
    if (wildcard.length > 0) {
      return wildcard[0];
    }

    return active[0];
  }

  private getActiveSessions(): ConnectorSession[] {
    return Array.from(this.sessions.values()).filter((session) => session.socket.readyState === WebSocket.OPEN);
  }

  private extractBotKeysFromUnknown(value: unknown): string[] {
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }

    if (Array.isArray(value)) {
      return value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return [];
  }

  private sendSafe(socket: WebSocket, payload: unknown): void {
    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      socket.send(JSON.stringify(payload));
    } catch (error) {
      this.logger.warn({ error }, 'Failed to send payload to connector socket');
    }
  }
}
