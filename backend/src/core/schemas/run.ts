import { z } from 'zod';

/** Bump when the run file shape changes incompatibly. */
export const RUN_SCHEMA_VERSION = 1;

export const scoreSchema = z.object({
  scorer: z.string(),
  /** 0–1, or null when the scorer errored (errors never count as 0). */
  value: z.number().min(0).max(1).nullable(),
  passed: z.boolean().nullable(),
  reason: z.string().nullable(),
  error: z.string().nullable(),
  judge: z
    .object({
      raw: z.string(),
      inputTokens: z.number().int().nullable(),
      outputTokens: z.number().int().nullable(),
      costUsd: z.number().nullable(),
      cached: z.boolean(),
    })
    .nullable(),
});
export type Score = z.infer<typeof scoreSchema>;

export const caseResultSchema = z.object({
  caseId: z.string(),
  sample: z.number().int().min(0),
  input: z.string(),
  expected: z.string().nullable(),
  tags: z.array(z.string()),
  output: z.string().nullable(),
  context: z.array(z.string()).nullable(),
  latencyMs: z.number().int().nullable(),
  inputTokens: z.number().int().nullable(),
  outputTokens: z.number().int().nullable(),
  /** Cost of producing this output, even if it was served from cache this run. */
  costUsd: z.number().nullable(),
  cached: z.boolean(),
  attempts: z.number().int().min(0),
  /** Set when the target call failed; such samples are not scored. */
  error: z.string().nullable(),
  scores: z.array(scoreSchema),
});
export type CaseResult = z.infer<typeof caseResultSchema>;

export const scorerSummarySchema = z.object({
  scorer: z.string(),
  type: z.string(),
  passAt: z.number().nullable(),
  mean: z.number().nullable(),
  passRate: z.number().nullable(),
  scored: z.number().int(),
  errors: z.number().int(),
});
export type ScorerSummary = z.infer<typeof scorerSummarySchema>;

export const runSchema = z.object({
  schemaVersion: z.literal(RUN_SCHEMA_VERSION),
  id: z.string(),
  suite: z.string(),
  description: z.string().nullable(),
  target: z.object({ type: z.enum(['http', 'model']), label: z.string() }),
  configHash: z.string(),
  datasetHash: z.string(),
  gitSha: z.string().nullable(),
  status: z.enum(['completed', 'aborted']),
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime(),
  durationMs: z.number().int(),
  options: z.object({
    repeats: z.number().int(),
    concurrency: z.number().int(),
    tags: z.array(z.string()),
    cache: z.boolean(),
  }),
  totals: z.object({
    cases: z.number().int(),
    samples: z.number().int(),
    errors: z.number().int(),
    cachedSamples: z.number().int(),
    inputTokens: z.number().int(),
    outputTokens: z.number().int(),
    /** What this run actually spent (cache hits are free). Null if pricing isn't configured. */
    spendUsd: z.number().nullable(),
    /** What the run would have cost with no cache. Null if pricing isn't configured. */
    costUsd: z.number().nullable(),
    latencyP50Ms: z.number().nullable(),
    latencyP95Ms: z.number().nullable(),
  }),
  summary: z.array(scorerSummarySchema),
  results: z.array(caseResultSchema),
});
export type Run = z.infer<typeof runSchema>;
