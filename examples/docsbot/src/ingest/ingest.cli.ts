import { parseArgs } from 'node:util';
import { z } from 'zod';
import { ingestEnvSchema, loadEnv } from '../config/env.js';
import { createDb } from '../db/client.js';
import { logger } from '../lib/logger.js';
import { createOpenAiProvider } from '../llm/openai.js';
import { createCollectionRepository } from '../repositories/collection.repository.js';
import { CORPUS, fetchCorpus } from './corpus.js';
import { buildChunkDrafts, ingestCorpus } from './ingest.service.js';
import { createTiktokenTokenizer } from './tokenizer.js';

const argsSchema = z
  .object({
    'chunk-size': z.coerce.number().int().min(64).max(8000).default(512),
    overlap: z.coerce.number().int().min(0).default(64),
    name: z.string().min(1).optional(),
    'dry-run': z.boolean().default(false),
  })
  .refine((a) => a.overlap < a['chunk-size'], { message: 'overlap must be < chunk-size' });

const { values } = parseArgs({
  options: {
    'chunk-size': { type: 'string' },
    overlap: { type: 'string' },
    name: { type: 'string' },
    'dry-run': { type: 'boolean' },
  },
});
const parsedArgs = argsSchema.safeParse(values);
if (!parsedArgs.success) {
  process.stderr.write(`${z.prettifyError(parsedArgs.error)}\n`);
  process.stderr.write(
    'Usage: pnpm ingest [--chunk-size 512] [--overlap 64] [--name <collection>] [--dry-run]\n',
  );
  process.exit(2);
}
const args = parsedArgs.data;
const chunkSize = args['chunk-size'];
const name = args.name ?? `fastapi-${CORPUS.tag}-c${String(chunkSize)}-o${String(args.overlap)}`;

if (args['dry-run']) {
  await fetchCorpus();
  const { files, drafts } = await buildChunkDrafts(
    { chunkSize, overlap: args.overlap },
    createTiktokenTokenizer(),
  );
  const tokens = drafts.map((d) => d.tokenCount).sort((a, b) => a - b);
  logger.info(
    {
      collection: name,
      files: files.length,
      chunks: drafts.length,
      totalTokens: tokens.reduce((a, b) => a + b, 0),
      p50Tokens: tokens[Math.floor(tokens.length / 2)],
      maxTokens: tokens.at(-1),
    },
    'Dry run: chunked corpus (nothing embedded or stored)',
  );
  process.exit(0);
}

const env = loadEnv(ingestEnvSchema);
const { db, pool } = createDb(env.DATABASE_URL, 2);

try {
  const { downloaded } = await fetchCorpus();
  if (downloaded) logger.info('Corpus downloaded');

  const started = performance.now();
  const { collection, embeddingTokens } = await ingestCorpus(
    { name, chunkSize, overlap: args.overlap, embeddingModel: env.EMBEDDING_MODEL },
    {
      llm: createOpenAiProvider({
        apiKey: env.OPENAI_API_KEY,
        embeddingModel: env.EMBEDDING_MODEL,
      }),
      collections: createCollectionRepository(db),
      tokenizer: createTiktokenTokenizer(),
      logger,
    },
  );
  logger.info(
    {
      collection: collection.name,
      chunks: collection.chunkCount,
      embeddingTokens,
      seconds: Math.round((performance.now() - started) / 1000),
    },
    'Ingest complete',
  );
} finally {
  await pool.end();
}
