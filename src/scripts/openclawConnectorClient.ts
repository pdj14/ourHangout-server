import WebSocket from 'ws';

type RequestPayload = {
  event: 'openclaw.request';
  data: {
    requestId: string;
    messageId: string;
    roomId: string;
    senderId: string;
    recipientId: string;
    botKey?: string;
    content: string;
    requestedAt: string;
  };
};

type ResponsePayload = {
  event: 'openclaw.response';
  data: {
    requestId: string;
    ok: boolean;
    providerMessageId?: string;
    replyText?: string;
    error?: string;
    raw?: unknown;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const hubWsBase = process.env.HUB_WS_URL ?? 'ws://localhost:3000/v1/openclaw/connector/ws';
const connectorToken = process.env.OPENCLAW_CONNECTOR_TOKEN ?? '';
const connectorId = process.env.CONNECTOR_ID ?? `connector-local-${Date.now()}`;
const botKeys = process.env.CONNECTOR_BOT_KEYS ?? '*';
const mode = (process.env.CONNECTOR_MODE ?? 'mock').toLowerCase();
const localOpenClawBaseUrl = process.env.OPENCLAW_LOCAL_BASE_URL ?? 'http://127.0.0.1:18789';
const localOpenClawApiToken = process.env.OPENCLAW_LOCAL_API_TOKEN ?? '';
const localOpenClawModel = process.env.OPENCLAW_LOCAL_MODEL ?? 'openclaw:main';
const localOpenClawSessionScope = (process.env.OPENCLAW_LOCAL_SESSION_SCOPE ?? 'room').toLowerCase();
const reconnectDelayMs = Number(process.env.CONNECTOR_RECONNECT_MS ?? 3000);
const timeoutMs = Number(process.env.CONNECTOR_REQUEST_TIMEOUT_MS ?? 4000);

if (!connectorToken || connectorToken.length < 8) {
  throw new Error('OPENCLAW_CONNECTOR_TOKEN is required.');
}

const botKeyQuery = botKeys
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => `botKey=${encodeURIComponent(value)}`)
  .join('&');

const query = `token=${encodeURIComponent(connectorToken)}&connectorId=${encodeURIComponent(connectorId)}${
  botKeyQuery ? `&${botKeyQuery}` : ''
}`;
const wsUrl = `${hubWsBase}${hubWsBase.includes('?') ? '&' : '?'}${query}`;

function resolveSessionKey(payload: RequestPayload['data']): string {
  if (localOpenClawSessionScope === 'user') {
    return `ourhangout:user:${payload.senderId}:bot:${payload.botKey ?? 'default'}`;
  }
  return `ourhangout:room:${payload.roomId}:bot:${payload.botKey ?? 'default'}`;
}

function extractReplyText(raw: unknown): string | undefined {
  if (!isRecord(raw)) return undefined;
  if (typeof raw.replyText === 'string' && raw.replyText.trim().length > 0) {
    return raw.replyText.trim();
  }
  if (typeof raw.output_text === 'string' && raw.output_text.trim().length > 0) {
    return raw.output_text.trim();
  }
  const output = Array.isArray(raw.output) ? raw.output : [];
  const chunks: string[] = [];
  for (const item of output) {
    if (!isRecord(item)) continue;
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
      if (!isRecord(part)) continue;
      if (typeof part.text === 'string' && part.text.trim().length > 0) {
        chunks.push(part.text.trim());
      }
    }
  }
  return chunks.length > 0 ? chunks.join('\n\n') : undefined;
}

async function callLocalOpenClaw(payload: RequestPayload['data']): Promise<{ providerMessageId?: string; replyText?: string; raw?: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      'content-type': 'application/json'
    };
    if (localOpenClawApiToken.trim()) {
      headers.Authorization = `Bearer ${localOpenClawApiToken.trim()}`;
    }

    const response = await fetch(`${localOpenClawBaseUrl.replace(/\/+$/, '')}/v1/responses`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: localOpenClawModel,
        input: payload.content,
        session: {
          key: resolveSessionKey(payload)
        }
      }),
      signal: controller.signal
    });

    const text = await response.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // keep raw text
    }

    if (!response.ok) {
      throw new Error(`OpenClaw HTTP ${response.status}`);
    }

    const parsedObj = isRecord(parsed) ? parsed : {};
    return {
      providerMessageId:
        typeof parsedObj.providerMessageId === 'string'
          ? parsedObj.providerMessageId
          : typeof parsedObj.id === 'string'
          ? parsedObj.id
          : undefined,
      replyText: extractReplyText(parsed),
      raw: parsed
    };
  } finally {
    clearTimeout(timer);
  }
}

async function handleRequest(payload: RequestPayload): Promise<ResponsePayload> {
  const { requestId, content, botKey } = payload.data;

  try {
    if (mode === 'http') {
      const result = await callLocalOpenClaw(payload.data);
      return {
        event: 'openclaw.response',
        data: {
          requestId,
          ok: true,
          providerMessageId: result.providerMessageId,
          replyText: result.replyText ?? `[connector-http] ${content}`,
          raw: result.raw
        }
      };
    }

    return {
      event: 'openclaw.response',
      data: {
        requestId,
        ok: true,
        providerMessageId: `connector-mock-${Date.now()}`,
        replyText: `[connector-mock${botKey ? `:${botKey}` : ''}] ${content}`
      }
    };
  } catch (error) {
    return {
      event: 'openclaw.response',
      data: {
        requestId,
        ok: false,
        error: error instanceof Error ? error.message : 'Connector processing failed.'
      }
    };
  }
}

function connect(): void {
  const socket = new WebSocket(wsUrl);

  socket.on('open', () => {
    console.log(`[connector] connected to hub: ${wsUrl}`);
    socket.send(
      JSON.stringify({
        event: 'connector.hello',
        data: {
          botKeys: botKeys.split(',').map((value) => value.trim()).filter(Boolean),
          mode
        }
      })
    );
  });

  socket.on('message', async (raw) => {
    try {
      const parsed = JSON.parse(raw.toString()) as unknown;
      if (!isRecord(parsed) || parsed.event !== 'openclaw.request' || !isRecord(parsed.data)) {
        return;
      }

      const data = parsed.data;
      if (
        typeof data.requestId !== 'string' ||
        typeof data.messageId !== 'string' ||
        typeof data.roomId !== 'string' ||
        typeof data.senderId !== 'string' ||
        typeof data.recipientId !== 'string' ||
        typeof data.content !== 'string'
      ) {
        return;
      }

      const response = await handleRequest({
        event: 'openclaw.request',
        data: {
          requestId: data.requestId,
          messageId: data.messageId,
          roomId: data.roomId,
          senderId: data.senderId,
          recipientId: data.recipientId,
          botKey: typeof data.botKey === 'string' ? data.botKey : undefined,
          content: data.content,
          requestedAt: typeof data.requestedAt === 'string' ? data.requestedAt : new Date().toISOString()
        }
      });

      socket.send(JSON.stringify(response));
    } catch (error) {
      console.error('[connector] failed to process message', error);
    }
  });

  socket.on('close', () => {
    console.warn(`[connector] disconnected. reconnect in ${reconnectDelayMs}ms`);
    setTimeout(connect, reconnectDelayMs);
  });

  socket.on('error', (error) => {
    console.error('[connector] websocket error', error);
  });
}

connect();
