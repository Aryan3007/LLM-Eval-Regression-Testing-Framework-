import { randomBytes } from 'node:crypto';
import path from 'node:path';
import pLimit from 'p-limit';
import { z } from 'zod';
import type { LoadedSuite } from '../config/load-suite.js';
import { ScorerInputError, TargetError } from '../errors.js';
import { createProviderFactory, type ProviderFactory } from '../providers/index.js';
import { computeTotals, summarizeScorers } from '../report/summary.js';
import type { Case } from '../schemas/case.js';
import { type CaseResult, RUN_SCHEMA_VERSION, type Run, type Score } from '../schemas/run.js';
import { createScorers } from '../scorers/index.js';
import type { Scorer } from '../scorers/types.js';
import { createTarget } from '../targets/index.js';
import type { Target, TargetResult } from '../targets/types.js';
import { currentGitSha } from '../util/git.js';
import { hashValue, stableStringify } from '../util/hash.js';
import { FileCache, NoCache } from './cache.js';
import { RateLimiter } from './rate-limiter.js';
import { errorMessage, withRetry } from './retry.js';

export interface RunSuiteOptions {
  /** Root of llmeval's local data (cache lives in `<dataDir>/cache`). */
  dataDir: string;
  cache?: boolean;
  repeats?: number;
  concurrency?: number;
  tags?: string[];
  signal?: AbortSignal;
  env?: Record<string, string | undefined>;
  onProgress?: (done: number, total: number) => void;
  /** Test seams. */
  providers?: ProviderFactory;
  retryMinTimeoutMs?: number;
}

const cachedResponseSchema = z.object({
  output: z.string(),
  context: z.array(z.string()).nullable(),
  inputTokens: z.number().nullable(),
  outputTokens: z.number().nullable(),
  costUsd: z.number().nullable(),
  latencyMs: z.number(),
});

export async function runSuite(suite: LoadedSuite, options: RunSuiteOptions): Promise<Run> {
  const startedAt = new Date();
  const { config } = suite;
  const repeats = options.repeats ?? config.run.repeats;
  const concurrency = options.concurrency ?? config.run.concurrency;
  const useCache = options.cache ?? true;
  const signal = options.signal ?? new AbortController().signal;

  const providers = options.providers ?? createProviderFactory(options.env ?? process.env);
  const cache = useCache ? new FileCache(path.join(options.dataDir, 'cache')) : new NoCache();
  const target = createTarget(config.target, suite.hashableConfig.target, providers);
  const targetLimiter = new RateLimiter(config.run.rpm);
  const judgeLimiter = new RateLimiter(config.run.judge_rpm);
  const scorers = createScorers(suite, () => {
    const judge = config.judge;
    if (!judge) throw new Error('unreachable: judge validated at load');
    return {
      provider: providers(judge.provider),
      cache,
      limiter: judgeLimiter,
      retries: config.run.max_retries,
    };
  });

  const tasks = suite.cases.flatMap((testCase) =>
    Array.from({ length: repeats }, (_, sample) => ({ testCase, sample })),
  );
  const limit = pLimit(concurrency);
  let done = 0;
  options.onProgress?.(0, tasks.length);

  const results = await Promise.all(
    tasks.map(({ testCase, sample }) =>
      limit(async () => {
        const result = await runOne(testCase, sample, {
          target,
          scorers,
          cache,
          limiter: targetLimiter,
          retries: config.run.max_retries,
          retryMinTimeoutMs: options.retryMinTimeoutMs,
          signal,
        });
        options.onProgress?.(++done, tasks.length);
        return result;
      }),
    ),
  );

  const finishedAt = new Date();
  return {
    schemaVersion: RUN_SCHEMA_VERSION,
    id: newRunId(startedAt),
    suite: config.suite,
    description: config.description ?? null,
    target: { type: target.type, label: target.label },
    configHash: suite.configHash,
    datasetHash: suite.datasetHash,
    gitSha: await currentGitSha(suite.dir),
    status: signal.aborted ? 'aborted' : 'completed',
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    options: { repeats, concurrency, tags: options.tags ?? [], cache: useCache },
    totals: computeTotals(results, suite.cases.length),
    summary: summarizeScorers(scorers, results),
    results,
  };
}

interface RunOneDeps {
  target: Target;
  scorers: Scorer[];
  cache: FileCache;
  limiter: RateLimiter;
  retries: number;
  retryMinTimeoutMs: number | undefined;
  signal: AbortSignal;
}

async function runOne(testCase: Case, sample: number, deps: RunOneDeps): Promise<CaseResult> {
  const base = {
    caseId: testCase.id,
    sample,
    input: testCase.input,
    expected: testCase.expected ?? null,
    tags: testCase.tags,
  };
  const cacheKey = hashValue({
    target: deps.target.configHash,
    case: stableStringify({ ...testCase, tags: undefined }),
    sample,
  });

  let response = await deps.cache.get('responses', cacheKey, cachedResponseSchema);
  const cached = response !== undefined;
  let attempts = 0;

  if (!response) {
    try {
      await deps.limiter.take(deps.signal);
      const started = performance.now();
      const { value, attempts: n } = await withRetry<TargetResult>(
        () => deps.target.call(testCase, deps.signal),
        {
          retries: deps.retries,
          signal: deps.signal,
          ...(deps.retryMinTimeoutMs !== undefined && { minTimeoutMs: deps.retryMinTimeoutMs }),
        },
      );
      attempts = n;
      response = { ...value, latencyMs: Math.round(performance.now() - started) };
      await deps.cache.set('responses', cacheKey, response);
    } catch (err) {
      return {
        ...base,
        output: null,
        context: null,
        latencyMs: null,
        inputTokens: null,
        outputTokens: null,
        costUsd: null,
        cached: false,
        attempts: err instanceof TargetError ? Math.max(attempts, 1) : attempts,
        error: errorMessage(err),
        scores: [],
      };
    }
  }

  const scores: Score[] = [];
  for (const scorer of deps.scorers) {
    scores.push(await scoreOne(scorer, testCase, response.output, response.context, deps.signal));
  }

  return {
    ...base,
    output: response.output,
    context: response.context,
    latencyMs: response.latencyMs,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
    costUsd: response.costUsd,
    cached,
    attempts,
    error: null,
    scores,
  };
}

async function scoreOne(
  scorer: Scorer,
  testCase: Case,
  output: string,
  context: string[] | null,
  signal: AbortSignal,
): Promise<Score> {
  try {
    const r = await scorer.score({ testCase, output, context }, signal);
    return {
      scorer: scorer.name,
      value: r.value,
      passed: r.passed,
      reason: r.reason,
      error: null,
      judge: r.judge ?? null,
    };
  } catch (err) {
    return {
      scorer: scorer.name,
      value: null,
      passed: null,
      reason: null,
      error:
        err instanceof ScorerInputError || err instanceof TargetError
          ? err.message
          : errorMessage(err),
      judge: null,
    };
  }
}

/** Sortable and unique enough for a local tool: run_20261117_130512_a1b2. */
function newRunId(at: Date): string {
  const stamp = at.toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15);
  return `run_${stamp}_${randomBytes(2).toString('hex')}`;
}
