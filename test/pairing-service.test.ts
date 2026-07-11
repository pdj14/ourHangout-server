import assert from 'node:assert/strict';
import test from 'node:test';
import type { FastifyBaseLogger } from 'fastify';
import type { Pool } from 'pg';
import type { AppEnv } from '../src/config/env';
import { PairingService } from '../src/modules/pairing/pairing.service';

const logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined
} as unknown as FastifyBaseLogger;

test('relationship pairing stores only a hash and emits a 10-character one-time code', async () => {
  let insertParameters: unknown[] | undefined;
  const client = {
    query: async (sql: string, parameters?: unknown[]) => {
      if (sql.includes('SELECT id FROM users')) {
        return { rows: [{ id: '00000000-0000-4000-8000-000000000001' }], rowCount: 1 };
      }
      if (sql.includes('INSERT INTO pairing_codes')) {
        insertParameters = parameters;
      }
      return { rows: [], rowCount: 0 };
    },
    release: () => undefined
  };
  const db = {
    connect: async () => client
  } as unknown as Pool;
  const service = new PairingService(
    db,
    { PAIRING_CODE_TTL_SECONDS: 300 } as AppEnv,
    logger
  );

  const created = await service.createCode('00000000-0000-4000-8000-000000000001');
  assert.match(created.code, /^[A-HJ-NP-Z2-9]{10}$/);
  assert.equal(typeof insertParameters?.[0], 'string');
  assert.equal((insertParameters?.[0] as string).length, 64);
  assert.notEqual(insertParameters?.[0], created.code);
});
