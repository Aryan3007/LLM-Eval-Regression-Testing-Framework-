import { describe, expect, it } from 'vitest';
import { tempDir } from '../../test/helpers.js';
import { ConfigError } from '../errors.js';
import { RUN_SCHEMA_VERSION, type Run } from '../schemas/run.js';
import { RunStore } from './run-store.js';

const run = (id: string): Run => ({
  schemaVersion: RUN_SCHEMA_VERSION,
  id,
  suite: 's',
  description: null,
  target: { type: 'http', label: 'x' },
  configHash: 'c',
  datasetHash: 'd',
  gitSha: null,
  status: 'completed',
  startedAt: '2026-11-17T10:00:00.000Z',
  finishedAt: '2026-11-17T10:00:01.000Z',
  durationMs: 1000,
  options: { repeats: 1, concurrency: 1, tags: [], cache: true },
  totals: {
    cases: 0,
    samples: 0,
    errors: 0,
    cachedSamples: 0,
    inputTokens: 0,
    outputTokens: 0,
    spendUsd: null,
    costUsd: null,
    latencyP50Ms: null,
    latencyP95Ms: null,
  },
  summary: [],
  results: [],
});

describe('RunStore', () => {
  it('saves, lists newest first and loads "latest"', async () => {
    const store = new RunStore(await tempDir());
    await store.save(run('run_20261117_100000_aaaa'));
    await store.save(run('run_20261117_110000_bbbb'));
    expect(await store.list()).toEqual(['run_20261117_110000_bbbb', 'run_20261117_100000_aaaa']);
    expect((await store.load('latest')).id).toBe('run_20261117_110000_bbbb');
    expect((await store.load('run_20261117_100000_aaaa')).id).toBe('run_20261117_100000_aaaa');
  });

  it('explains what to do when there are no runs or the id is wrong', async () => {
    const store = new RunStore(await tempDir());
    await expect(store.load('latest')).rejects.toThrow(/llmeval run/);
    await expect(store.load('run_nope')).rejects.toBeInstanceOf(ConfigError);
  });
});
