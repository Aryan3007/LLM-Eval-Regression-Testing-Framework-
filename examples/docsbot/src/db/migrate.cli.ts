import { dbEnvSchema, loadEnv } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { runMigrations } from './migrate.js';

const env = loadEnv(dbEnvSchema);
await runMigrations(env.DATABASE_URL);
logger.info('Migrations applied');
