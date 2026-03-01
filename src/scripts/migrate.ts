import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { db, closeDb } from '../lib/db';

function stripUtf8Bom(content: string): string {
  if (content.charCodeAt(0) === 0xfeff) {
    return content.slice(1);
  }
  return content;
}

async function ensureMigrationTable(): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function runMigrations(): Promise<void> {
  await ensureMigrationTable();

  const migrationDir = path.resolve(process.cwd(), 'db', 'migrations');
  const files = (await readdir(migrationDir)).filter((file) => file.endsWith('.sql')).sort();

  for (const file of files) {
    const alreadyApplied = await db.query<{ filename: string }>(
      'SELECT filename FROM schema_migrations WHERE filename = $1 LIMIT 1',
      [file]
    );

    if (alreadyApplied.rows[0]) {
      console.log(`[migrate] skip ${file}`);
      continue;
    }

    const rawSql = await readFile(path.join(migrationDir, file), 'utf8');
    const sql = stripUtf8Bom(rawSql);

    console.log(`[migrate] apply ${file}`);

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
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