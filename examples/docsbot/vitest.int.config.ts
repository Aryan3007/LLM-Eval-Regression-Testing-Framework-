import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

// Integration tests hit a real Postgres (DATABASE_URL_TEST), so run files one at a time.
// Values from .env are used unless the variable is already set in the shell (e.g. in CI).
const fileEnv = loadEnv('test', process.cwd(), '');

export default defineConfig({
  test: {
    include: ['src/**/*.int.test.ts'],
    environment: 'node',
    env: {
      ...fileEnv,
      ...(process.env.DATABASE_URL_TEST && { DATABASE_URL_TEST: process.env.DATABASE_URL_TEST }),
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
    },
    fileParallelism: false,
    globalSetup: ['src/test/global-setup.ts'],
  },
});
