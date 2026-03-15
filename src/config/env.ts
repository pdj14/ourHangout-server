import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  TRUST_PROXY: z.string().default('false'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  PUBLIC_BASE_URL: z.string().default(''),
  MEDIA_STORAGE_DIR: z.string().default('storage/media'),
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_IDS: z.string().default(''),
  FCM_PROJECT_ID: z.string().default(''),
  FCM_CLIENT_EMAIL: z.string().default(''),
  FCM_PRIVATE_KEY: z.string().default(''),
  FCM_SERVICE_ACCOUNT_JSON: z.string().default(''),
  FCM_ANDROID_CHANNEL_ID: z.string().default('messages'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(14),
  GUARDIAN_MASTER_EMAILS: z.string().default('dj14.park@gmail.com'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(200),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),
  RATE_LIMIT_REDIS_NAMESPACE: z.string().default('ourhangout-rate-limit-'),
  RATE_LIMIT_SKIP_ON_ERROR: z.string().default('true'),
  OPENCLAW_MODE: z.enum(['mock', 'http', 'connector']).default('mock'),
  OPENCLAW_BASE_URL: z.string().url().default('http://127.0.0.1:18888'),
  OPENCLAW_CONNECTOR_TOKEN: z.string().default('replace-openclaw-connector-token'),
  OPENCLAW_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
  OPENCLAW_RETRY_COUNT: z.coerce.number().int().min(0).default(2),
  PAIRING_CODE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info')
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables. Check .env settings.');
}

const rawEnv = parsed.data;

function parseBoolean(value: string, defaultValue: boolean): boolean {
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return defaultValue;
}

function parseTrustProxy(value: string): boolean | number | string[] {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  if (['true', '1', 'yes', 'on'].includes(normalized.toLowerCase())) {
    return true;
  }
  if (['false', '0', 'no', 'off'].includes(normalized.toLowerCase())) {
    return false;
  }

  if (/^\d+$/.test(normalized)) {
    return Number(normalized);
  }

  const asList = normalized
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return asList.length > 0 ? asList : false;
}

export const env = {
  ...rawEnv,
  PUBLIC_BASE_URL: rawEnv.PUBLIC_BASE_URL.trim() || `http://localhost:${rawEnv.PORT}`,
  TRUST_PROXY: parseTrustProxy(rawEnv.TRUST_PROXY),
  FCM_PRIVATE_KEY: rawEnv.FCM_PRIVATE_KEY.replace(/\\n/g, '\n'),
  CORS_ORIGINS: rawEnv.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
  GUARDIAN_MASTER_EMAILS: rawEnv.GUARDIAN_MASTER_EMAILS
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
  GOOGLE_CLIENT_IDS: Array.from(
    new Set(
      [
        ...rawEnv.GOOGLE_CLIENT_IDS.split(',').map((clientId) => clientId.trim()),
        rawEnv.GOOGLE_CLIENT_ID.trim()
      ].filter(Boolean)
    )
  ),
  RATE_LIMIT_SKIP_ON_ERROR: parseBoolean(rawEnv.RATE_LIMIT_SKIP_ON_ERROR, true)
};

export type AppEnv = typeof env;
