import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index.js';

export type Db = NodePgDatabase<typeof schema>;

export function createDb(url: string, poolMax: number): { db: Db; pool: pg.Pool } {
  const pool = new pg.Pool({ connectionString: url, max: poolMax });
  return { db: drizzle(pool, { schema, casing: 'snake_case' }), pool };
}
