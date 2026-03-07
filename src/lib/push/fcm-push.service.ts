import type { FastifyBaseLogger } from 'fastify';
import { GoogleAuth } from 'google-auth-library';
import type { AppEnv } from '../../config/env';

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

type FcmPayload = {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
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

    const accessToken = await this.auth.getAccessToken();
    if (!accessToken) {
      this.logger.warn('Failed to acquire FCM access token');
      return { sentCount: 0, invalidTokens: [] };
    }

    let sentCount = 0;
    const invalidTokens: string[] = [];

    for (const token of tokens) {
      const response = await fetch(`https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: {
            token,
            notification: {
              title: payload.title,
              body: payload.body
            },
            data: payload.data,
            android: {
              priority: 'high',
              notification: {
                channel_id: this.env.FCM_ANDROID_CHANNEL_ID || 'messages',
                tag: String(payload.data?.roomId || '')
              }
            },
            apns: {
              payload: {
                aps: {
                  sound: 'default'
                }
              }
            }
          }
        })
      });

      if (response.ok) {
        sentCount += 1;
        continue;
      }

      const body = (await response.json().catch(() => ({}))) as {
        error?: {
          message?: string;
          details?: Array<{ errorCode?: string }>;
        };
      };
      const errorCode = body.error?.details?.find((detail) => detail.errorCode)?.errorCode || '';
      if (errorCode === 'UNREGISTERED' || errorCode === 'INVALID_ARGUMENT') {
        invalidTokens.push(token);
      }

      this.logger.warn(
        {
          token,
          statusCode: response.status,
          message: body.error?.message,
          errorCode
        },
        'FCM push send failed'
      );
    }

    return {
      sentCount,
      invalidTokens
    };
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
