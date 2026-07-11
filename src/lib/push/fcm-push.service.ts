import type { FastifyBaseLogger } from 'fastify';
import { createHash } from 'crypto';
import { GoogleAuth } from 'google-auth-library';
import type { AppEnv } from '../../config/env';

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

type FcmPayload = {
  tokens: string[];
  title?: string;
  body?: string;
  data?: Record<string, string>;
  headless?: boolean;
};

type FcmServiceAccount = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

export class FcmPushService {
  private readonly auth: GoogleAuth | null;
  private readonly projectId: string;

  constructor(
    private readonly env: AppEnv,
    private readonly logger: FastifyBaseLogger
  ) {
    const serviceAccount = this.parseServiceAccount(env.FCM_SERVICE_ACCOUNT_JSON);
    this.projectId = (env.FCM_PROJECT_ID || serviceAccount?.project_id || '').trim();

    if (serviceAccount?.client_email && serviceAccount?.private_key) {
      this.auth = new GoogleAuth({
        credentials: {
          client_email: serviceAccount.client_email,
          private_key: serviceAccount.private_key
        },
        projectId: this.projectId || serviceAccount.project_id,
        scopes: [FCM_SCOPE]
      });
      return;
    }

    if (env.FCM_CLIENT_EMAIL && env.FCM_PRIVATE_KEY) {
      this.auth = new GoogleAuth({
        credentials: {
          client_email: env.FCM_CLIENT_EMAIL,
          private_key: env.FCM_PRIVATE_KEY
        },
        projectId: this.projectId,
        scopes: [FCM_SCOPE]
      });
      return;
    }

    this.auth = this.projectId ? new GoogleAuth({ projectId: this.projectId, scopes: [FCM_SCOPE] }) : null;
  }

  isEnabled(): boolean {
    return !!this.auth && !!this.projectId;
  }

  async send(payload: FcmPayload): Promise<{ sentCount: number; invalidTokens: string[] }> {
    const tokens = Array.from(new Set(payload.tokens.map((token) => token.trim()).filter(Boolean)));
    if (!this.auth || !this.projectId || tokens.length === 0) {
      return { sentCount: 0, invalidTokens: [] };
    }

    const deadline = Date.now() + this.env.FCM_SEND_BUDGET_MS;
    const accessToken = await this.getAccessToken(Math.min(this.env.FCM_TIMEOUT_MS, this.env.FCM_SEND_BUDGET_MS));
    if (!accessToken) {
      return { sentCount: 0, invalidTokens: [] };
    }

    let sentCount = 0;
    const invalidTokens: string[] = [];

    for (let offset = 0; offset < tokens.length; offset += 10) {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        this.logger.warn({ skippedTokenCount: tokens.length - offset }, 'FCM send budget exhausted');
        break;
      }
      const batch = tokens.slice(offset, offset + 10);
      const perRequestTimeoutMs = Math.max(1, Math.min(this.env.FCM_TIMEOUT_MS, remainingMs));
      const results = await Promise.all(
        batch.map((token) => this.sendToToken(token, accessToken, payload, perRequestTimeoutMs))
      );
      for (const result of results) {
        if (result.sent) sentCount += 1;
        if (result.invalidToken) invalidTokens.push(result.invalidToken);
      }
    }

    return {
      sentCount,
      invalidTokens
    };
  }

  private async sendToToken(
    token: string,
    accessToken: string,
    payload: FcmPayload,
    timeoutMs: number
  ): Promise<{ sent: boolean; invalidToken?: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const tokenHash = createHash('sha256').update(token).digest('hex').slice(0, 12);

    try {
      const response = await fetch(`https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: {
            token,
            ...(!payload.headless
              ? { notification: { title: payload.title || '', body: payload.body || '' } }
              : {}),
            data: payload.data,
            android: {
              priority: 'high',
              ...(!payload.headless
                ? {
                    notification: {
                      channel_id: this.env.FCM_ANDROID_CHANNEL_ID || 'messages',
                      tag: String(payload.data?.roomId || '')
                    }
                  }
                : {})
            },
            apns: {
              headers: payload.headless
                ? { 'apns-push-type': 'background', 'apns-priority': '5' }
                : undefined,
              payload: {
                aps: { ...(payload.headless ? { 'content-available': 1 } : { sound: 'default' }) }
              }
            }
          }
        })
      });

      if (response.ok) {
        await response.arrayBuffer();
        return { sent: true };
      }

      const body = (await response.json().catch(() => ({}))) as {
        error?: { message?: string; details?: Array<{ errorCode?: string }> };
      };
      const errorCode = body.error?.details?.find((detail) => detail.errorCode)?.errorCode || '';
      this.logger.warn(
        { tokenHash, statusCode: response.status, message: body.error?.message, errorCode },
        'FCM push send failed'
      );
      return {
        sent: false,
        ...(['UNREGISTERED', 'INVALID_ARGUMENT'].includes(errorCode) ? { invalidToken: token } : {})
      };
    } catch (error) {
      this.logger.warn({ error, tokenHash }, 'FCM push request failed');
      return { sent: false };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async getAccessToken(timeoutMs: number): Promise<string | null> {
    if (!this.auth) {
      return null;
    }

    let timeout: NodeJS.Timeout | undefined;
    try {
      return (await Promise.race([
        this.auth.getAccessToken(),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => reject(new Error('FCM access token request timed out')), timeoutMs);
          timeout.unref();
        })
      ])) ?? null;
    } catch (error) {
      this.logger.warn({ error }, 'Failed to acquire FCM access token');
      return null;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  private parseServiceAccount(raw: string): FcmServiceAccount | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed) as FcmServiceAccount;
      return {
        ...parsed,
        private_key: parsed.private_key?.replace(/\\n/g, '\n')
      };
    } catch {
      this.logger.warn('FCM_SERVICE_ACCOUNT_JSON is invalid JSON');
      return null;
    }
  }
}
