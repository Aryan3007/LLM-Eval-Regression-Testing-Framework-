import { runMigrations } from '../db/migrate.js';

export default async function setup(): Promise<void> {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) {
    throw new Error(
      'DATABASE_URL_TEST is not set. Start Postgres with `docker compose up -d db` and see .env.example.',
    );
  }
  await runMigrations(url);
}
