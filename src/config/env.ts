import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(14),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(200),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),
  OPENCLAW_MODE: z.enum(['mock', 'http']).default('mock'),
  OPENCLAW_BASE_URL: z.string().url().default('http://127.0.0.1:18888'),
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

export const env = {
  ...rawEnv,
  CORS_ORIGINS: rawEnv.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
};

export type AppEnv = typeof env;
