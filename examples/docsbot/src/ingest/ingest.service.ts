import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Logger } from 'pino';
import type { NewChunk } from '../db/schema/chunks.js';
import type { Collection } from '../db/schema/collections.js';
import type { LlmProvider } from '../llm/types.js';
import type { CollectionRepository } from '../repositories/collection.repository.js';
import { chunkDocument, type Tokenizer } from './chunk.js';
import { corpusDir, docsDir, listDocFiles, SOURCE_REF } from './corpus.js';
import { preprocessMarkdown } from './preprocess.js';

const EMBED_BATCH = 100;

export interface IngestOptions {
  name: string;
  chunkSize: number;
  overlap: number;
  embeddingModel: string;
}

export interface IngestDeps {
  llm: LlmProvider;
  collections: CollectionRepository;
  tokenizer: Tokenizer;
  logger: Logger;
}

export type ChunkDraftRow = Omit<NewChunk, 'collectionId' | 'embedding'>;

/** Read, clean and chunk every doc page. Pure CPU work: no API calls, no DB. */
export async function buildChunkDrafts(
  options: Pick<IngestOptions, 'chunkSize' | 'overlap'>,
  tokenizer: Tokenizer,
): Promise<{ files: string[]; drafts: ChunkDraftRow[] }> {
  const files = await listDocFiles();
  const drafts: ChunkDraftRow[] = [];

  for (const docPath of files) {
    const raw = await readFile(path.join(docsDir, docPath), 'utf8');
    const markdown = preprocessMarkdown(raw, (p) => readIncludeSync(p));
    for (const [ordinal, chunk] of chunkDocument(markdown, options, tokenizer).entries()) {
      drafts.push({ docPath, ordinal, ...chunk });
    }
  }
  return { files, drafts };
}

export async function ingestCorpus(
  options: IngestOptions,
  { llm, collections, tokenizer, logger }: IngestDeps,
): Promise<{ collection: Collection; embeddingTokens: number }> {
  const { files, drafts } = await buildChunkDrafts(options, tokenizer);
  logger.info({ files: files.length, chunks: drafts.length }, 'Chunked corpus');

  const embeddings: number[][] = [];
  let embeddingTokens = 0;
  for (let i = 0; i < drafts.length; i += EMBED_BATCH) {
    const batch = drafts.slice(i, i + EMBED_BATCH);
    const { vectors, tokens } = await llm.embed(batch.map((d) => `${d.heading}\n\n${d.content}`));
    embeddings.push(...vectors);
    embeddingTokens += tokens;
    logger.info({ done: embeddings.length, total: drafts.length }, 'Embedding');
  }

  const contentHash = createHash('sha256');
  for (const d of drafts) contentHash.update(`${d.docPath}\0${d.heading}\0${d.content}\0`);

  const collection = await collections.replace(
    {
      name: options.name,
      sourceRef: SOURCE_REF,
      chunkSize: options.chunkSize,
      chunkOverlap: options.overlap,
      embeddingModel: options.embeddingModel,
      chunkCount: drafts.length,
      contentHash: contentHash.digest('hex'),
    },
    drafts.map((d, i) => {
      const embedding = embeddings[i];
      if (!embedding) throw new Error(`Missing embedding for chunk ${String(i)}`);
      return { ...d, embedding };
    }),
  );
  return { collection, embeddingTokens };
}

const includeCache = new Map<string, string | undefined>();

function readIncludeSync(docsSrcPath: string): string | undefined {
  if (!includeCache.has(docsSrcPath)) {
    includeCache.set(docsSrcPath, tryRead(path.join(corpusDir, docsSrcPath)));
  }
  return includeCache.get(docsSrcPath);
}

function tryRead(file: string): string | undefined {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return undefined;
  }
}
