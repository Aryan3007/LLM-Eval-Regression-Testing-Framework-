import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  casing: 'snake_case',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  // Only used by `drizzle-kit migrate`/`studio`; `generate` works offline.
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});
