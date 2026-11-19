import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { loadEnv, serverEnvSchema } from '../config/env.js';
import { createDb } from '../db/client.js';
import { logger } from '../lib/logger.js';
import { fromRoot } from '../lib/paths.js';
import { createOpenAiProvider } from '../llm/openai.js';
import { createChunkRepository } from '../repositories/chunk.repository.js';
import { createCollectionRepository } from '../repositories/collection.repository.js';
import { createAnswerService } from '../services/answer.service.js';
import { createApp } from './app.js';

const env = loadEnv(serverEnvSchema);
const { db, pool } = createDb(env.DATABASE_URL, env.DB_POOL_MAX);
const systemPrompt = readFileSync(fromRoot(env.PROMPT_PATH), 'utf8').trim();

const answerService = createAnswerService(
  { collectionName: env.COLLECTION, topK: env.TOP_K, systemPrompt },
  {
    llm: createOpenAiProvider({
      apiKey: env.OPENAI_API_KEY,
      embeddingModel: env.EMBEDDING_MODEL,
      chatModel: env.CHAT_MODEL,
      chatTemperature: env.CHAT_TEMPERATURE,
    }),
    collections: createCollectionRepository(db),
    chunks: createChunkRepository(db),
  },
);

const app = createApp({
  answerService,
  docsUi: env.NODE_ENV !== 'production',
  checkDb: async () => {
    try {
      // Raw SQL is the simplest possible connectivity probe; no table involved.
      await db.execute(sql`select 1`);
      return true;
    } catch {
      return false;
    }
  },
});

const server = app.listen(env.PORT, () => {
  logger.info(
    { collection: env.COLLECTION, topK: env.TOP_K, model: env.CHAT_MODEL, prompt: env.PROMPT_PATH },
    `DocsBot listening on http://localhost:${String(env.PORT)}`,
  );
});

function shutdown(signal: string): void {
  logger.info({ signal }, 'Shutting down');
  server.close((err) => {
    pool.end().then(
      () => process.exit(err ? 1 : 0),
      () => process.exit(1),
    );
  });
  setTimeout(() => {
    logger.error('Forced shutdown after 10s');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  shutdown('SIGINT');
});
