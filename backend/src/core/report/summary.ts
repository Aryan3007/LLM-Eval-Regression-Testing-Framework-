import type { CaseResult, Run, ScorerSummary } from '../schemas/run.js';
import type { Scorer } from '../scorers/types.js';
import { mean, percentile, sumOrNull } from '../util/stats.js';

export function summarizeScorers(
  scorers: readonly Scorer[],
  results: readonly CaseResult[],
): ScorerSummary[] {
  return scorers.map((scorer) => {
    const scores = results.flatMap((r) => r.scores.filter((s) => s.scorer === scorer.name));
    const values = scores.flatMap((s) => (s.value === null ? [] : [s.value]));
    const passed = scores.filter((s) => s.passed === true).length;
    return {
      scorer: scorer.name,
      type: scorer.type,
      passAt: scorer.passAt,
      mean: mean(values),
      passRate: values.length ? passed / values.length : null,
      scored: values.length,
      errors: scores.filter((s) => s.error !== null).length,
    };
  });
}

export function computeTotals(results: readonly CaseResult[], caseCount: number): Run['totals'] {
  const ok = results.filter((r) => r.error === null);
  const latencies = ok.flatMap((r) => (r.latencyMs === null ? [] : [r.latencyMs]));

  // Cost = target call + every judge call. Spend = only the calls actually made this run.
  const targetCosts = ok.map((r) => r.costUsd);
  const judgeCalls = results.flatMap((r) => r.scores.flatMap((s) => (s.judge ? [s.judge] : [])));
  const costUsd = sumOrNull([...targetCosts, ...judgeCalls.map((j) => j.costUsd)]);
  const spendUsd = sumOrNull([
    ...ok.filter((r) => !r.cached).map((r) => r.costUsd),
    ...judgeCalls.filter((j) => !j.cached).map((j) => j.costUsd),
  ]);

  return {
    cases: caseCount,
    samples: results.length,
    errors: results.length - ok.length,
    cachedSamples: results.filter((r) => r.cached).length,
    inputTokens: ok.reduce((sum, r) => sum + (r.inputTokens ?? 0), 0),
    outputTokens: ok.reduce((sum, r) => sum + (r.outputTokens ?? 0), 0),
    spendUsd,
    costUsd,
    latencyP50Ms: percentile(latencies, 50),
    latencyP95Ms: percentile(latencies, 95),
  };
}
