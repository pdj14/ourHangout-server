import type { PoolClient } from 'pg';

type MigrationPreflightTableState = {
  users_table: string | null;
  friend_requests_table: string | null;
  family_upgrade_requests_table: string | null;
};

type MigrationPreflightViolation = {
  invariant: string;
  violation_count: string;
};

export async function assertMigrationPreconditions(client: PoolClient): Promise<void> {
  const tables = await client.query<MigrationPreflightTableState>(
    `SELECT to_regclass('public.users')::text AS users_table,
            to_regclass('public.friend_requests')::text AS friend_requests_table,
            to_regclass('public.family_upgrade_requests')::text AS family_upgrade_requests_table`
  );
  const state = tables.rows[0];
  if (!state) {
    throw new Error('[migrate] could not determine migration preflight table state');
  }
  if (!state.users_table && !state.friend_requests_table && !state.family_upgrade_requests_table) {
    console.log('[migrate] preflight duplicate checks skipped for a new or partially initialized database');
    return;
  }

  const violations: MigrationPreflightViolation[] = [];
  if (state.users_table) {
    const result = await client.query<MigrationPreflightViolation>(
      `SELECT 'case_insensitive_user_email'::text AS invariant, COUNT(*)::text AS violation_count
       FROM (
         SELECT lower(email)
         FROM users
         GROUP BY lower(email)
         HAVING COUNT(*) > 1
       ) duplicates`
    );
    violations.push(...result.rows);
  }
  if (state.friend_requests_table) {
    const result = await client.query<MigrationPreflightViolation>(
      `SELECT 'pending_friend_pair'::text AS invariant, COUNT(*)::text AS violation_count
       FROM (
         SELECT LEAST(requester_id, target_id), GREATEST(requester_id, target_id)
         FROM friend_requests
         WHERE status = 'pending'
         GROUP BY 1, 2
         HAVING COUNT(*) > 1
       ) duplicates`
    );
    violations.push(...result.rows);
  }
  if (state.family_upgrade_requests_table) {
    const result = await client.query<MigrationPreflightViolation>(
      `SELECT 'pending_family_upgrade_pair'::text AS invariant, COUNT(*)::text AS violation_count
       FROM (
         SELECT LEAST(requester_id, target_user_id),
                GREATEST(requester_id, target_user_id),
                requested_relationship_type
         FROM family_upgrade_requests
         WHERE status = 'pending'
         GROUP BY 1, 2, 3
         HAVING COUNT(*) > 1
       ) duplicates`
    );
    violations.push(...result.rows);
  }

  const failed = violations.filter((row) => Number(row.violation_count) > 0);
  if (failed.length > 0) {
    const summary = failed.map((row) => `${row.invariant}=${row.violation_count}`).join(', ');
    throw new Error(
      `[migrate] duplicate-data preflight failed (${summary}). Resolve the rows using docs/SERVER_AUDIT_2026-07-10_KO.md before migration.`
    );
  }

  console.log('[migrate] duplicate-data preflight passed');
}
