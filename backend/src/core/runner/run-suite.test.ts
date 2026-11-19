import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  fakeJudge,
  jsonl,
  startStub,
  type StubServer,
  tempDir,
  writeTree,
} from '../../test/helpers.js';
import { loadSuite } from '../config/load-suite.js';
import { runSuite } from './run-suite.js';

let stub: StubServer | undefined;
afterEach(async () => {
  await stub?.close();
  stub = undefined;
});

const cases = jsonl([
  { id: 'fr', input: 'Capital of France?', expected: 'Paris' },
  { id: 'es', input: 'Capital of Spain?', expected: 'Madrid' },
  { id: 'it', input: 'Capital of Italy?', expected: 'Rome' },
  { id: 'de', input: 'Capital of Germany?', expected: 'Berlin' },
]);

const answers: Record<string, string> = {
  'Capital of France?': 'Paris',
  'Capital of Spain?': 'Madrid',
  'Capital of Italy?': 'Milan',
  'Capital of Germany?': 'Berlin',
};

async function setup(url: string, extra = '') {
  const dir = await writeTree({
    'suite.yaml': `
suite: capitals
target:
  type: http
  url: ${url}/ask
  body: { question: '{{ input }}' }
  output: $.answer
  context: $.sources[*].text
  usage: { input_tokens: $.usage.in, output_tokens: $.usage.out }
  pricing: { input_per_mtok: 1, output_per_mtok: 1 }
dataset: { path: cases.jsonl }
judge: { provider: openai, model: fake, pricing: { input_per_mtok: 1, output_per_mtok: 1 } }
run: { concurrency: 2, max_retries: 2 }
scorers:
  - type: exact_match
  - type: llm_judge
    name: correctness
    rubric: rubric.md
${extra}`,
    'cases.jsonl': cases,
    'rubric.md': 'Correct capital.',
  });
  return {
    suite: await loadSuite(path.join(dir, 'suite.yaml'), { env: {} }),
    dataDir: await tempDir(),
  };
}

const ok = (body: Record<string, unknown>) => ({
  json: {
    answer: answers[String(body.question)],
    sources: [{ text: 'ctx' }],
    usage: { in: 10, out: 5 },
  },
  delayMs: 20,
});

describe('runSuite', () => {
  it('scores every case and summarises per scorer', async () => {
    stub = await startStub(ok);
    const { suite, dataDir } = await setup(stub.url);
    const judge = fakeJudge(5);
    const run = await runSuite(suite, { dataDir, providers: judge.providers });

    expect(run.status).toBe('completed');
    expect(run.totals).toMatchObject({
      cases: 4,
      samples: 4,
      errors: 0,
      cachedSamples: 0,
      inputTokens: 40,
      outputTokens: 20,
    });
    const exact = run.summary.find((s) => s.scorer === 'exact_match');
    expect(exact).toMatchObject({ mean: 0.75, passRate: 0.75, scored: 4, errors: 0 });
    expect(run.results.find((r) => r.caseId === 'it')?.context).toEqual(['ctx']);
    expect(stub.maxInFlight()).toBeLessThanOrEqual(2);
    // 4 target calls × 15 tokens + 4 judge calls × 120 tokens, at $1/Mtok.
    expect(run.totals.costUsd).toBeCloseTo((4 * 15 + 4 * 120) / 1e6, 12);
    expect(run.totals.spendUsd).toBeCloseTo(run.totals.costUsd ?? -1, 12);
  });

  it('serves a re-run from cache: no target or judge calls, zero spend', async () => {
    stub = await startStub(ok);
    const { suite, dataDir } = await setup(stub.url);
    const judge = fakeJudge(5);
    await runSuite(suite, { dataDir, providers: judge.providers });
    const hitsAfterFirst = stub.hits();

    const rerun = await runSuite(suite, { dataDir, providers: judge.providers });
    expect(stub.hits()).toBe(hitsAfterFirst);
    expect(judge.calls()).toBe(4);
    expect(rerun.totals.cachedSamples).toBe(4);
    expect(rerun.totals.spendUsd).toBe(0);
    expect(rerun.totals.costUsd).toBeGreaterThan(0);
    expect(rerun.summary).toEqual(
      (await runSuite(suite, { dataDir, providers: judge.providers })).summary,
    );
  });

  it('bypasses the cache with cache: false', async () => {
    stub = await startStub(ok);
    const { suite, dataDir } = await setup(stub.url);
    const judge = fakeJudge(5);
    await runSuite(suite, { dataDir, providers: judge.providers });
    await runSuite(suite, { dataDir, providers: judge.providers, cache: false });
    expect(stub.hits()).toBe(8);
  });

  it('retries 5xx, then records hard failures as errors that are never scored', async () => {
    const failures = new Map<string, number>();
    stub = await startStub((body) => {
      const q = String(body.question);
      if (q.includes('Spain')) {
        const n = (failures.get(q) ?? 0) + 1;
        failures.set(q, n);
        if (n === 1) return { status: 503, json: { error: 'busy' } };
      }
      if (q.includes('Germany')) return { status: 400, json: { error: 'bad request' } };
      return ok(body);
    });
    const { suite, dataDir } = await setup(stub.url);
    const run = await runSuite(suite, {
      dataDir,
      providers: fakeJudge(5).providers,
      retryMinTimeoutMs: 1,
    });

    const es = run.results.find((r) => r.caseId === 'es');
    expect(es).toMatchObject({ error: null, attempts: 2, output: 'Madrid' });

    const de = run.results.find((r) => r.caseId === 'de');
    expect(de?.error).toMatch(/returned 400/);
    expect(de?.attempts).toBe(1);
    expect(de?.scores).toEqual([]);
    expect(run.totals.errors).toBe(1);
    expect(run.summary.find((s) => s.scorer === 'exact_match')?.scored).toBe(3);
  });

  it('records a scorer error separately from a low score', async () => {
    stub = await startStub(ok);
    const { suite, dataDir } = await setup(stub.url);
    const badJudge = {
      providers: () => ({
        name: 'bad',
        chat: () =>
          Promise.resolve({
            text: 'I refuse to use JSON',
            model: 'x',
            inputTokens: 1,
            outputTokens: 1,
          }),
      }),
    };
    const run = await runSuite(suite, { dataDir, providers: badJudge.providers });
    const correctness = run.summary.find((s) => s.scorer === 'correctness');
    expect(correctness).toMatchObject({ scored: 0, errors: 4, mean: null });
    expect(run.results[0]?.scores.find((s) => s.scorer === 'correctness')).toMatchObject({
      value: null,
      passed: null,
    });
  });

  it('runs N samples per case with repeats', async () => {
    stub = await startStub(ok);
    const { suite, dataDir } = await setup(stub.url);
    const run = await runSuite(suite, { dataDir, providers: fakeJudge(5).providers, repeats: 3 });
    expect(run.totals.samples).toBe(12);
    expect(new Set(run.results.map((r) => `${r.caseId}#${r.sample}`)).size).toBe(12);
  });
});
