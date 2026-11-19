import { EMBEDDING_DIMENSIONS } from '../db/schema/chunks.js';
import type { LlmProvider } from './types.js';

/**
 * Deterministic, offline provider for tests: bag-of-words hashed into a unit vector, so
 * texts that share words land close together and retrieval order is predictable.
 */
export function createFakeProvider(): LlmProvider {
  return {
    embed(texts) {
      return Promise.resolve({
        vectors: texts.map(hashEmbed),
        tokens: texts.reduce((sum, t) => sum + t.split(/\s+/).length, 0),
      });
    },
    chat({ user }) {
      const sources = (user.match(/^\[\d+\]/gm) ?? []).length;
      return Promise.resolve({
        text: `Fake answer based on ${String(sources)} sources.`,
        model: 'fake-chat',
        promptTokens: user.length,
        completionTokens: 8,
      });
    },
  };
}

function hashEmbed(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  for (const word of text.toLowerCase().match(/[a-z0-9_]+/g) ?? []) {
    let h = 2166136261;
    for (let i = 0; i < word.length; i++) h = Math.imul(h ^ word.charCodeAt(i), 16777619);
    const slot = (h >>> 0) % EMBEDDING_DIMENSIONS;
    vector[slot] = (vector[slot] ?? 0) + 1;
  }
  const norm = Math.hypot(...vector) || 1;
  return vector.map((v) => v / norm);
}
