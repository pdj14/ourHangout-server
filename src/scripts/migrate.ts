import { readdir, readFile } from 'fs/promises';
import { createHash } from 'crypto';
import path from 'path';
import type { PoolClient } from 'pg';
import { db, closeDb } from '../lib/db';
import { env } from '../config/env';
import { assertMigrationPreconditions } from '../lib/migration-preflight';

function stripUtf8Bom(content: string): string {
  if (content.charCodeAt(0) === 0xfeff) {
    return content.slice(1);
  }
  return content;
}

async function ensureMigrationTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      checksum_sha256 TEXT,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum_sha256 TEXT`);
}

async function runMigrations(): Promise<void> {
  const migrationDir = path.resolve(process.cwd(), 'db', 'migrations');
  const files = (await readdir(migrationDir)).filter((file) => file.endsWith('.sql')).sort();
  const client = await db.connect();

  try {
    await client.query(`SELECT set_config('statement_timeout', $1, false)`, [
      String(env.MIGRATION_STATEMENT_TIMEOUT_MS)
    ]);
    await client.query(`SELECT set_config('lock_timeout', $1, false)`, [
      String(env.MIGRATION_LOCK_TIMEOUT_MS)
    ]);
    await client.query(`SELECT pg_advisory_lock(hashtext('ourhangout_schema_migrations'))`);
    await ensureMigrationTable(client);
    await assertMigrationPreconditions(client);

    for (const file of files) {
      const rawSql = await readFile(path.join(migrationDir, file), 'utf8');
      const sql = stripUtf8Bom(rawSql);
      const normalizedForChecksum = sql.replace(/\r\n/g, '\n');
      const checksum = createHash('sha256').update(normalizedForChecksum, 'utf8').digest('hex');
      const alreadyApplied = await client.query<{ filename: string; checksum_sha256: string | null }>(
        'SELECT filename, checksum_sha256 FROM schema_migrations WHERE filename = $1 LIMIT 1',
        [file]
      );

      const applied = alreadyApplied.rows[0];
      if (applied) {
        if (applied.checksum_sha256 && applied.checksum_sha256 !== checksum) {
          throw new Error(`[migrate] checksum mismatch for already-applied migration ${file}`);
        }
        if (!applied.checksum_sha256) {
          await client.query(
            'UPDATE schema_migrations SET checksum_sha256 = $2 WHERE filename = $1',
            [file, checksum]
          );
        }
        console.log(`[migrate] skip ${file}`);
        continue;
      }

      console.log(`[migrate] apply ${file}`);

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename, checksum_sha256) VALUES ($1, $2)',
          [file, checksum]
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.query(`SELECT pg_advisory_unlock(hashtext('ourhangout_schema_migrations'))`).catch(() => undefined);
    client.release();
  }
}

runMigrations()
  .then(async () => {
    console.log('[migrate] done');
    await closeDb();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('[migrate] failed', error);
    await closeDb();
    process.exit(1);
  });
