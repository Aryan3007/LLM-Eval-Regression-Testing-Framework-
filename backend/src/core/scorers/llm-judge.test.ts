import { describe, expect, it } from 'vitest';
import { fakeJudge, tempDir } from '../../test/helpers.js';
import { ScorerInputError } from '../errors.js';
import { FileCache } from '../runner/cache.js';
import { RateLimiter } from '../runner/rate-limiter.js';
import { createLlmJudgeScorer, parseVerdict } from './llm-judge.js';

const signal = new AbortController().signal;
const testCase = {
  id: 'c1',
  input: 'Capital of France?',
  expected: 'Paris',
  tags: [],
  metadata: {},
};

describe('parseVerdict', () => {
  it('accepts bare, fenced and prose-wrapped JSON', () => {
    expect(parseVerdict('{"reasoning":"ok","score":4}').score).toBe(4);
    expect(parseVerdict('```json\n{"reasoning":"ok","score":"5"}\n```').score).toBe(5);
    expect(parseVerdict('Here you go: {"reasoning":"meh","score":2} thanks').score).toBe(2);
  });

  it('rejects out-of-range or malformed verdicts', () => {
    expect(() => parseVerdict('{"reasoning":"x","score":7}')).toThrow(ScorerInputError);
    expect(() => parseVerdict('score: 5')).toThrow(ScorerInputError);
  });
});

describe('llm_judge scorer', () => {
  it('maps 1–5 to 0–1, applies pass_at, and caches verdicts', async () => {
    const judge = fakeJudge(4);
    const deps = {
      provider: judge.providers('openai'),
      cache: new FileCache(await tempDir()),
      limiter: new RateLimiter(undefined),
      retries: 0,
    };
    const config = {
      provider: 'openai' as const,
      model: 'm',
      max_tokens: 100,
      pricing: { input_per_mtok: 1, output_per_mtok: 2 },
    };
    const scorer = createLlmJudgeScorer('correctness', 'Be correct.', 0.7, config, deps);

    const first = await scorer.score({ testCase, output: 'Paris.', context: null }, signal);
    expect(first).toMatchObject({ value: 0.75, passed: true, reason: '4/5: Looks right.' });
    expect(first.judge).toMatchObject({ cached: false, costUsd: (100 * 1 + 20 * 2) / 1e6 });

    const second = await scorer.score({ testCase, output: 'Paris.', context: null }, signal);
    expect(second.judge?.cached).toBe(true);
    expect(judge.calls()).toBe(1);

    await scorer.score({ testCase, output: 'Lyon.', context: null }, signal);
    expect(judge.calls()).toBe(2);
  });
});
