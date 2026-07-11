import { closeDb, db } from '../lib/db';
import { assertMigrationPreconditions } from '../lib/migration-preflight';

async function main(): Promise<void> {
  const client = await db.connect();
  try {
    await assertMigrationPreconditions(client);
  } finally {
    client.release();
  }
}

main()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('[migrate] preflight failed', error);
    await closeDb();
    process.exit(1);
  });
