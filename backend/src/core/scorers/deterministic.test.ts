import { describe, expect, it } from 'vitest';
import { ScorerInputError } from '../errors.js';
import type { Case } from '../schemas/case.js';
import { scorerSchema } from '../schemas/suite.js';
import { createDeterministicScorer } from './deterministic.js';

const signal = new AbortController().signal;
const testCase: Case = { id: 'c1', input: 'q', expected: 'Paris', tags: [], metadata: {} };

async function score(config: unknown, output: string, c: Case = testCase) {
  const parsed = scorerSchema.parse(config);
  if (parsed.type === 'llm_judge') throw new Error('not deterministic');
  return createDeterministicScorer(parsed).score({ testCase: c, output, context: null }, signal);
}

describe('deterministic scorers', () => {
  it('exact_match trims by default and is case sensitive', async () => {
    expect((await score({ type: 'exact_match' }, ' Paris\n')).passed).toBe(true);
    expect((await score({ type: 'exact_match' }, 'paris')).passed).toBe(false);
    expect((await score({ type: 'exact_match', case_sensitive: false }, 'paris')).passed).toBe(
      true,
    );
  });

  it('exact_match without expected is an input error, not a 0', async () => {
    const noExpected: Case = { id: 'c1', input: 'q', tags: [], metadata: {} };
    await expect(score({ type: 'exact_match' }, 'x', noExpected)).rejects.toBeInstanceOf(
      ScorerInputError,
    );
  });

  it('contains supports all/any and is case-insensitive by default', async () => {
    expect(
      (await score({ type: 'contains', value: ['paris', 'FRANCE'] }, 'Paris is in France')).value,
    ).toBe(1);
    expect((await score({ type: 'contains', value: ['Paris', 'Lyon'] }, 'Paris')).passed).toBe(
      false,
    );
    expect(
      (await score({ type: 'contains', value: ['Paris', 'Lyon'], mode: 'any' }, 'Paris')).passed,
    ).toBe(true);
  });

  it('not_contains fails on any forbidden string', async () => {
    const r = await score({ type: 'not_contains', value: 'as an ai' }, 'As an AI language model…');
    expect(r).toMatchObject({ passed: false, value: 0 });
  });

  it('regex and length', async () => {
    expect((await score({ type: 'regex', pattern: '^\\d{3}$' }, '123')).passed).toBe(true);
    expect((await score({ type: 'length', max_chars: 3 }, 'abcd')).reason).toMatch(/above max 3/);
  });

  it('json_schema validates fenced or bare JSON', async () => {
    const config = {
      type: 'json_schema',
      schema: { type: 'object', required: ['a'], properties: { a: { type: 'number' } } },
    };
    expect((await score(config, '```json\n{"a": 1}\n```')).passed).toBe(true);
    expect((await score(config, '{"a": "x"}')).passed).toBe(false);
    expect((await score(config, 'not json')).reason).toBe('output is not valid JSON');
  });

  it('rejects an invalid regex at config time', () => {
    expect(scorerSchema.safeParse({ type: 'regex', pattern: '(' }).success).toBe(false);
  });
});
