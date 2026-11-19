import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { fromRoot } from '../lib/paths.js';
import { createDb } from './client.js';

export async function runMigrations(url: string): Promise<void> {
  const { db, pool } = createDb(url, 1);
  try {
    await migrate(db, { migrationsFolder: fromRoot('drizzle') });
  } finally {
    await pool.end();
  }
}
