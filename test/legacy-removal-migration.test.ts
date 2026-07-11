import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

test('legacy integration migration drops dependent tables before bots', async () => {
  const migrationPath = resolve(process.cwd(), 'db/migrations/021_remove_legacy_openclaw.sql');
  const sql = await readFile(migrationPath, 'utf8');

  const dependentDrops = [
    'DROP TABLE IF EXISTS openclaw_connector_pobis',
    'DROP TABLE IF EXISTS openclaw_connector_pairings',
    'DROP TABLE IF EXISTS openclaw_connectors',
    'DROP TABLE IF EXISTS pobis'
  ];
  const botsDropIndex = sql.indexOf('DROP TABLE IF EXISTS bots');

  assert.ok(botsDropIndex > -1, 'bots table drop must be present');
  for (const statement of dependentDrops) {
    const index = sql.indexOf(statement);
    assert.ok(index > -1, `${statement} must be present`);
    assert.ok(index < botsDropIndex, `${statement} must run before dropping bots`);
  }

  assert.match(sql, /ALTER TABLE room_messages\s+DROP COLUMN IF EXISTS reply_to_message_id/);
  assert.doesNotMatch(sql, /DROP TABLE IF EXISTS bots\s+CASCADE/i);
});
