import dotenv from 'dotenv';
import { z } from 'zod';
import { getGuardianConsolePasswordValidationError } from './guardian-password-policy';

dotenv.config({ quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  TRUST_PROXY: z.string().default('false'),
  POSTGRES_DB: z.string().default(''),
  POSTGRES_USER: z.string().default(''),
  POSTGRES_PASSWORD: z.string().default(''),
  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(20),
  DATABASE_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  DATABASE_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  MIGRATION_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(0).default(0),
  MIGRATION_LOCK_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  REDIS_URL: z.string().min(1),
  REDIS_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  REDIS_COMMAND_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
  REDIS_MAX_RETRIES_PER_REQUEST: z.coerce.number().int().min(0).max(20).default(2),
  JWT_SECRET: z.string().min(32),
  PUBLIC_BASE_URL: z.string().default(''),
  MEDIA_STORAGE_DIR: z.string().default('storage/media'),
  MEDIA_USER_QUOTA_BYTES: z.coerce.number().int().positive().default(2 * 1024 * 1024 * 1024),
  MEDIA_PENDING_LIMIT: z.coerce.number().int().positive().max(100).default(20),
  APP_UPDATE_STORAGE_DIR: z.string().default('storage/app-updates'),
  HTTP_BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(1024 * 1024),
  BINARY_BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(200 * 1024 * 1024),
  BINARY_UPLOAD_CONCURRENCY: z.coerce.number().int().positive().max(20).default(2),
  BINARY_UPLOAD_QUEUE_LIMIT: z.coerce.number().int().min(0).max(200).default(20),
  BINARY_UPLOAD_QUEUE_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  HTTP_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  HTTP_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),
  HTTP_HANDLER_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  WEBSOCKET_MAX_PAYLOAD_BYTES: z.coerce.number().int().positive().max(1024 * 1024).default(64 * 1024),
  SWAGGER_ENABLED: z.string().default(''),
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_IDS: z.string().default(''),
  ALLOW_PUBLIC_PARENT_SIGNUP: z.string().default('false'),
  FCM_PROJECT_ID: z.string().default(''),
  FCM_CLIENT_EMAIL: z.string().default(''),
  FCM_PRIVATE_KEY: z.string().default(''),
  FCM_SERVICE_ACCOUNT_JSON: z.string().default(''),
  FCM_ANDROID_CHANNEL_ID: z.string().default('messages'),
  FCM_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  FCM_SEND_BUDGET_MS: z.coerce.number().int().positive().default(20000),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(14),
  PASSWORD_HASH_COST: z.coerce.number().int().min(10).max(14).default(12),
  GUARDIAN_CONSOLE_LOGIN_ID: z.string().default(''),
  GUARDIAN_CONSOLE_PASSWORD: z.string().default(''),
  GUARDIAN_CONSOLE_ALLOW_LEGACY_PASSWORD: z.string().default('false'),
  GUARDIAN_CONSOLE_ACCESS_TOKEN_TTL: z.string().default('8h'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(200),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),
  RATE_LIMIT_REDIS_NAMESPACE: z.string().default('ourhangout-rate-limit-'),
  RATE_LIMIT_SKIP_ON_ERROR: z.string().default(''),
  PAIRING_CODE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info')
}).superRefine((value, context) => {
  if (value.NODE_ENV !== 'production') {
    return;
  }

  const normalizedJwtSecret = value.JWT_SECRET.trim().toLowerCase();
  if (
    normalizedJwtSecret.includes('replace-with') ||
    normalizedJwtSecret.includes('change-me') ||
    normalizedJwtSecret.includes('changeme')
  ) {
    context.addIssue({
      code: 'custom',
      path: ['JWT_SECRET'],
      message: 'JWT_SECRET must not use an example or placeholder value in production.'
    });
  }

  try {
    const publicBaseUrl = new URL(value.PUBLIC_BASE_URL);
    const publicHost = publicBaseUrl.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    const isLoopbackHost =
      publicHost === 'localhost' ||
      publicHost.endsWith('.localhost') ||
      publicHost === '0.0.0.0' ||
      publicHost === '::1' ||
      /^127\./.test(publicHost);
    if (
      !['http:', 'https:'].includes(publicBaseUrl.protocol) ||
      isLoopbackHost ||
      publicBaseUrl.username ||
      publicBaseUrl.password ||
      publicBaseUrl.search ||
      publicBaseUrl.hash ||
      publicBaseUrl.pathname !== '/'
    ) {
      throw new Error('invalid public origin');
    }
  } catch {
    context.addIssue({
      code: 'custom',
      path: ['PUBLIC_BASE_URL'],
      message: 'PUBLIC_BASE_URL must be an explicit, non-loopback http(s) origin in production.'
    });
  }

  if (value.POSTGRES_PASSWORD) {
    if (
      value.POSTGRES_PASSWORD.length < 16 ||
      value.POSTGRES_PASSWORD === 'ourhangout_dev_pw'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['POSTGRES_PASSWORD'],
        message: 'POSTGRES_PASSWORD must be a non-development value with at least 16 characters in production.'
      });
    }
    try {
      const databaseUrl = new URL(value.DATABASE_URL);
      if (databaseUrl.hostname === 'postgres') {
        const databasePassword = decodeURIComponent(databaseUrl.password);
        const databaseUser = decodeURIComponent(databaseUrl.username);
        const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ''));
        if (
          databasePassword !== value.POSTGRES_PASSWORD ||
          (value.POSTGRES_USER && databaseUser !== value.POSTGRES_USER) ||
          (value.POSTGRES_DB && databaseName !== value.POSTGRES_DB)
        ) {
          context.addIssue({
            code: 'custom',
            path: ['DATABASE_URL'],
            message: 'DATABASE_URL credentials must match POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB for Compose.'
          });
        }
      }
    } catch {
      context.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'DATABASE_URL must be a valid PostgreSQL URL.'
      });
    }
  }

  const corsOrigins = value.CORS_ORIGINS.split(',').map((origin) => origin.trim());
  if (corsOrigins.includes('*')) {
    context.addIssue({
      code: 'custom',
      path: ['CORS_ORIGINS'],
      message: 'Wildcard CORS is not allowed in production.'
    });
  }

  const guardianLoginId = value.GUARDIAN_CONSOLE_LOGIN_ID.trim();
  const guardianPassword = value.GUARDIAN_CONSOLE_PASSWORD;
  const allowLegacyGuardianPassword = parseBoolean(
    value.GUARDIAN_CONSOLE_ALLOW_LEGACY_PASSWORD,
    false
  );
  if ((guardianLoginId && !guardianPassword) || (!guardianLoginId && guardianPassword)) {
    context.addIssue({
      code: 'custom',
      path: ['GUARDIAN_CONSOLE_PASSWORD'],
      message: 'Guardian Console login id and password must either both be set or both be empty.'
    });
  }
  const guardianPasswordValidationError = getGuardianConsolePasswordValidationError(
    guardianPassword,
    allowLegacyGuardianPassword
  );
  if (guardianPasswordValidationError) {
    context.addIssue({
      code: 'custom',
      path: ['GUARDIAN_CONSOLE_PASSWORD'],
      message: guardianPasswordValidationError
    });
  }

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
  GUARDIAN_CONSOLE_LOGIN_ID: rawEnv.GUARDIAN_CONSOLE_LOGIN_ID.trim(),
  GOOGLE_CLIENT_IDS: Array.from(
    new Set(
      [
        ...rawEnv.GOOGLE_CLIENT_IDS.split(',').map((clientId) => clientId.trim()),
        rawEnv.GOOGLE_CLIENT_ID.trim()
      ].filter(Boolean)
    )
  ),
  RATE_LIMIT_SKIP_ON_ERROR: parseBoolean(
    rawEnv.RATE_LIMIT_SKIP_ON_ERROR,
    rawEnv.NODE_ENV !== 'production'
  ),
  ALLOW_PUBLIC_PARENT_SIGNUP: parseBoolean(rawEnv.ALLOW_PUBLIC_PARENT_SIGNUP, false),
  SWAGGER_ENABLED: parseBoolean(rawEnv.SWAGGER_ENABLED, rawEnv.NODE_ENV !== 'production'),
  GUARDIAN_CONSOLE_ALLOW_LEGACY_PASSWORD: parseBoolean(
    rawEnv.GUARDIAN_CONSOLE_ALLOW_LEGACY_PASSWORD,
    false
  ),
  GUARDIAN_CONSOLE_ENABLED:
    rawEnv.GUARDIAN_CONSOLE_LOGIN_ID.trim().length > 0 && rawEnv.GUARDIAN_CONSOLE_PASSWORD.length > 0
};

export type AppEnv = typeof env;
