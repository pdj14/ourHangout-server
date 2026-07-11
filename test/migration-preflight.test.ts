import assert from 'node:assert/strict';
import test from 'node:test';
import type { PoolClient, QueryResult } from 'pg';
import { assertMigrationPreconditions } from '../src/lib/migration-preflight';

function result<T extends object>(rows: T[]): QueryResult<T> {
  return { rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] };
}

test('migration preflight checks each table that exists in a partially migrated database', async () => {
  const queries: string[] = [];
  const client = {
    query: async (sql: string) => {
      queries.push(sql);
      if (sql.includes('to_regclass')) {
        return result([{
          users_table: 'users',
          friend_requests_table: 'friend_requests',
          family_upgrade_requests_table: null
        }]);
      }
      if (sql.includes('case_insensitive_user_email')) {
        return result([{ invariant: 'case_insensitive_user_email', violation_count: '0' }]);
      }
      if (sql.includes('pending_friend_pair')) {
        return result([{ invariant: 'pending_friend_pair', violation_count: '1' }]);
      }
      throw new Error(`Unexpected query: ${sql}`);
    }
  } as unknown as PoolClient;

  await assert.rejects(
    assertMigrationPreconditions(client),
    /pending_friend_pair=1/
  );
  assert.equal(queries.some((sql) => sql.includes('case_insensitive_user_email')), true);
  assert.equal(queries.some((sql) => sql.includes('pending_friend_pair')), true);
  assert.equal(queries.some((sql) => sql.includes('pending_family_upgrade_pair')), false);
});

test('migration preflight skips duplicate queries only when none of the target tables exist', async () => {
  let queryCount = 0;
  const client = {
    query: async () => {
      queryCount += 1;
      return result([{
        users_table: null,
        friend_requests_table: null,
        family_upgrade_requests_table: null
      }]);
    }
  } as unknown as PoolClient;

  await assertMigrationPreconditions(client);
  assert.equal(queryCount, 1);
});
