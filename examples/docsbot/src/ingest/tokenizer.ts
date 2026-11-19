import { getEncoding } from 'js-tiktoken';
import type { Tokenizer } from './chunk.js';

/** cl100k_base is the tokenizer used by OpenAI's text-embedding-3 models. */
export function createTiktokenTokenizer(): Tokenizer {
  const enc = getEncoding('cl100k_base');
  return {
    count: (text) => enc.encode(text).length,
    split: (text, maxTokens) => {
      const tokens = enc.encode(text);
      const pieces: string[] = [];
      for (let i = 0; i < tokens.length; i += maxTokens) {
        pieces.push(enc.decode(tokens.slice(i, i + maxTokens)));
      }
      return pieces;
    },
  };
}
