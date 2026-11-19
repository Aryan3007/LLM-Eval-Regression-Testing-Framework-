import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { jsonl, writeTree } from '../../test/helpers.js';
import { ConfigError } from '../errors.js';
import { loadSuite } from './load-suite.js';

const suiteYaml = (extra = '') => `
suite: demo
target:
  type: http
  url: \${APP_URL:-http://localhost:9999}/ask
  headers: { authorization: 'Bearer \${APP_API_KEY}' }
  body: { question: '{{ input }}' }
  output: $.answer
dataset:
  path: data/cases.jsonl
scorers:
  - type: contains
    value: Paris
${extra}`;

const cases = jsonl([
  { id: 'a', input: 'Capital of France?', tags: ['geo'] },
  { id: 'b', input: 'Capital of Spain?', tags: ['geo', 'edge'] },
  { id: 'c', input: '2+2?' },
]);

describe('loadSuite', () => {
  it('loads, applies defaults and resolves the dataset relative to the suite file', async () => {
    const dir = await writeTree({
      'suites/demo.yaml': suiteYaml(),
      'suites/data/cases.jsonl': cases,
    });
    const suite = await loadSuite(path.join(dir, 'suites/demo.yaml'), {
      env: { APP_API_KEY: 'k1' },
    });
    expect(suite.cases.map((c) => c.id)).toEqual(['a', 'b', 'c']);
    expect(suite.config.run).toMatchObject({ repeats: 1, concurrency: 4, max_retries: 3 });
    expect(suite.config.target).toMatchObject({ url: 'http://localhost:9999/ask', method: 'POST' });
  });

  it('filters cases by tag (any match)', async () => {
    const dir = await writeTree({
      's.yaml': suiteYaml().replace('data/cases.jsonl', 'c.jsonl'),
      'c.jsonl': cases,
    });
    const suite = await loadSuite(path.join(dir, 's.yaml'), {
      env: { APP_API_KEY: 'k' },
      tags: ['edge'],
    });
    expect(suite.cases.map((c) => c.id)).toEqual(['b']);
  });

  it('does not let a rotated API key change the config hash', async () => {
    const dir = await writeTree({
      's.yaml': suiteYaml().replace('data/cases.jsonl', 'c.jsonl'),
      'c.jsonl': cases,
    });
    const a = await loadSuite(path.join(dir, 's.yaml'), { env: { APP_API_KEY: 'old' } });
    const b = await loadSuite(path.join(dir, 's.yaml'), { env: { APP_API_KEY: 'new' } });
    const c = await loadSuite(path.join(dir, 's.yaml'), {
      env: { APP_API_KEY: 'new', APP_URL: 'http://x' },
    });
    expect(a.configHash).toBe(b.configHash);
    expect(c.configHash).not.toBe(b.configHash);
  });

  it('names missing env vars', async () => {
    const dir = await writeTree({
      's.yaml': suiteYaml().replace('data/cases.jsonl', 'c.jsonl'),
      'c.jsonl': cases,
    });
    await expect(loadSuite(path.join(dir, 's.yaml'), { env: {} })).rejects.toThrow(/APP_API_KEY/);
  });

  it('points at the bad dataset line', async () => {
    const dir = await writeTree({
      's.yaml': suiteYaml().replace('data/cases.jsonl', 'c.jsonl'),
      'c.jsonl': `${JSON.stringify({ id: 'a', input: 'x' })}\n${JSON.stringify({ id: 'b' })}\n`,
    });
    await expect(
      loadSuite(path.join(dir, 's.yaml'), { env: { APP_API_KEY: 'k' } }),
    ).rejects.toThrow(/c\.jsonl:2/);
  });

  it('rejects duplicate case ids', async () => {
    const dir = await writeTree({
      's.yaml': suiteYaml().replace('data/cases.jsonl', 'c.jsonl'),
      'c.jsonl': jsonl([
        { id: 'a', input: 'x' },
        { id: 'a', input: 'y' },
      ]),
    });
    await expect(
      loadSuite(path.join(dir, 's.yaml'), { env: { APP_API_KEY: 'k' } }),
    ).rejects.toThrow(/Duplicates: a/);
  });

  it('requires a judge block for llm_judge scorers and reads the rubric', async () => {
    const judgeScorer = `  - type: llm_judge\n    name: correctness\n    rubric: rubric.md\n`;
    const dir = await writeTree({
      's.yaml': suiteYaml(judgeScorer).replace('data/cases.jsonl', 'c.jsonl'),
      'c.jsonl': cases,
      'rubric.md': 'Be correct.\n',
    });
    await expect(
      loadSuite(path.join(dir, 's.yaml'), { env: { APP_API_KEY: 'k' } }),
    ).rejects.toThrow(/judge/);

    const withJudge =
      suiteYaml(judgeScorer).replace('data/cases.jsonl', 'c.jsonl') +
      'judge:\n  provider: openai\n  model: m\n';
    const dir2 = await writeTree({
      's.yaml': withJudge,
      'c.jsonl': cases,
      'rubric.md': 'Be correct.\n',
    });
    const suite = await loadSuite(path.join(dir2, 's.yaml'), { env: { APP_API_KEY: 'k' } });
    expect(suite.rubrics.get('correctness')).toBe('Be correct.');
  });

  it('wraps YAML and schema errors in ConfigError', async () => {
    const dir = await writeTree({
      'bad.yaml': 'suite: [unclosed',
      'typo.yaml': suiteYaml().replace('scorers:', 'scorer:'),
    });
    await expect(loadSuite(path.join(dir, 'bad.yaml'))).rejects.toBeInstanceOf(ConfigError);
    await expect(
      loadSuite(path.join(dir, 'typo.yaml'), { env: { APP_API_KEY: 'k' } }),
    ).rejects.toThrow(/scorer/);
  });
});
