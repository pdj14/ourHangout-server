import bcrypt from 'bcryptjs';
import { db, closeDb } from '../lib/db';

const SEED_USERS = [
  {
    email: 'parent@ourhangout.local',
    password: 'Parent123!',
    role: 'parent',
    displayName: 'Parent'
  },
  {
    email: 'child@ourhangout.local',
    password: 'Child123!',
    role: 'user',
    displayName: 'Child'
  }
] as const;

async function seedUsers(): Promise<void> {
  for (const user of SEED_USERS) {
    const passwordHash = await bcrypt.hash(user.password, 10);

    await db.query(
      `INSERT INTO users (email, password_hash, role, display_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email)
       DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role,
         display_name = EXCLUDED.display_name`,
      [user.email, passwordHash, user.role, user.displayName]
    );

    console.log(`[seed] upsert user ${user.email}`);
  }
}

seedUsers()
  .then(async () => {
    console.log('[seed] done');
    await closeDb();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('[seed] failed', error);
    await closeDb();
    process.exit(1);
  });
