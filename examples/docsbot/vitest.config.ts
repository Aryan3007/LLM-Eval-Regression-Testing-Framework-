import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.int.test.ts'],
    environment: 'node',
    env: { NODE_ENV: 'test', LOG_LEVEL: 'silent' },
  },
});
