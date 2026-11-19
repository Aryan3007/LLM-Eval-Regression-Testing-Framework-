import { z } from 'zod';

const base = {
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
};

const db = {
  DATABASE_URL: z.url(),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
};

const embeddings = {
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  EMBEDDING_MODEL: z.string().min(1).default('text-embedding-3-small'),
};

export const baseEnvSchema = z.object(base);
export const dbEnvSchema = z.object({ ...base, ...db });
export const ingestEnvSchema = z.object({ ...base, ...db, ...embeddings });
export const serverEnvSchema = z.object({
  ...base,
  ...db,
  ...embeddings,
  PORT: z.coerce.number().int().min(1).max(65535).default(8001),
  CHAT_MODEL: z.string().min(1, 'CHAT_MODEL is required, e.g. gpt-4.1-mini'),
  CHAT_TEMPERATURE: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.coerce.number().min(0).max(2).optional(),
  ),
  COLLECTION: z.string().min(1).default('fastapi-0.115.0-c512-o64'),
  TOP_K: z.coerce.number().int().min(1).max(20).default(5),
  PROMPT_PATH: z.string().min(1).default('prompts/answer.md'),
});

/** Validate process.env against a schema at boot; exit with a readable message if invalid. */
export function loadEnv<S extends z.ZodType>(schema: S): z.infer<S> {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    process.stderr.write(`Invalid environment variables:\n${z.prettifyError(parsed.error)}\n`);
    process.exit(1);
  }
  return parsed.data;
}
