import { CollectionNotIngestedError } from '../errors/app-error.js';
import type { LlmProvider } from '../llm/types.js';
import type { ChunkRepository, RetrievedChunk } from '../repositories/chunk.repository.js';
import type { CollectionRepository } from '../repositories/collection.repository.js';

export interface Source {
  id: number;
  docPath: string;
  heading: string;
  text: string;
  score: number;
}

export interface AnswerResult {
  answer: string;
  sources: Source[];
  model: string;
  collection: string;
  usage: { embeddingTokens: number; promptTokens: number; completionTokens: number };
  latencyMs: number;
}

export interface AnswerServiceConfig {
  collectionName: string;
  topK: number;
  systemPrompt: string;
}

export function createAnswerService(
  config: AnswerServiceConfig,
  deps: { llm: LlmProvider; collections: CollectionRepository; chunks: ChunkRepository },
) {
  let collectionId: number | undefined;

  async function resolveCollectionId(): Promise<number> {
    if (collectionId === undefined) {
      const collection = await deps.collections.findByName(config.collectionName);
      if (!collection) throw new CollectionNotIngestedError(config.collectionName);
      collectionId = collection.id;
    }
    return collectionId;
  }

  return {
    async isReady(): Promise<boolean> {
      try {
        await resolveCollectionId();
        return true;
      } catch {
        return false;
      }
    },

    async answer(question: string): Promise<AnswerResult> {
      const started = performance.now();
      const id = await resolveCollectionId();

      const { vectors, tokens: embeddingTokens } = await deps.llm.embed([question]);
      const queryVector = vectors[0];
      if (!queryVector) throw new Error('Embedding provider returned no vector');

      const retrieved = await deps.chunks.search(id, queryVector, config.topK);
      const chat = await deps.llm.chat({
        system: config.systemPrompt,
        user: buildUserMessage(question, retrieved),
      });

      return {
        answer: chat.text,
        sources: retrieved.map((c) => ({
          id: c.id,
          docPath: c.docPath,
          heading: c.heading,
          text: c.content,
          score: Math.round((1 - c.distance) * 10_000) / 10_000,
        })),
        model: chat.model,
        collection: config.collectionName,
        usage: {
          embeddingTokens,
          promptTokens: chat.promptTokens,
          completionTokens: chat.completionTokens,
        },
        latencyMs: Math.round(performance.now() - started),
      };
    },
  };
}

export type AnswerService = ReturnType<typeof createAnswerService>;

export function buildUserMessage(question: string, retrieved: RetrievedChunk[]): string {
  const context = retrieved
    .map((c, i) => `[${String(i + 1)}] ${c.docPath} — ${c.heading}\n${c.content}`)
    .join('\n\n---\n\n');
  return `Context:\n\n${context}\n\nQuestion: ${question}`;
}
