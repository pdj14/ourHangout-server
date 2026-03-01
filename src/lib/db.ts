import { Pool } from 'pg';
import { env } from '../config/env';

export const db = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20
});

db.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error', error);
});

export async function closeDb(): Promise<void> {
  await db.end();
}
