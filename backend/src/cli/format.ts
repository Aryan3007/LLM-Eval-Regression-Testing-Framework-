import Table from 'cli-table3';
import pc from 'picocolors';
import type { Run } from '../core/index.js';

const pct = (v: number | null) => (v === null ? '—' : `${(v * 100).toFixed(1)}%`);
const num = (v: number | null, digits = 3) => (v === null ? '—' : v.toFixed(digits));
const usd = (v: number | null) =>
  v === null ? 'n/a' : `$${v < 0.01 ? v.toFixed(4) : v.toFixed(2)}`;
const secs = (ms: number | null) => (ms === null ? '—' : `${(ms / 1000).toFixed(1)}s`);
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function formatRun(run: Run, savedTo?: string): string {
  const t = run.totals;
  const lines: string[] = [];

  lines.push(`${pc.bold('llmeval')} · ${pc.cyan(run.suite)} · ${pc.dim(run.id)}`);
  lines.push(
    pc.dim(
      [
        `${t.cases} cases × ${run.options.repeats} sample${run.options.repeats > 1 ? 's' : ''}`,
        `target ${run.target.label}`,
        secs(run.durationMs),
        `latency p50 ${secs(t.latencyP50Ms)} · p95 ${secs(t.latencyP95Ms)}`,
      ].join(' · '),
    ),
  );
  lines.push(
    pc.dim(
      [
        `${t.inputTokens + t.outputTokens} tokens`,
        `spend ${usd(t.spendUsd)} (full cost ${usd(t.costUsd)})`,
        `${t.cachedSamples}/${t.samples} cached`,
      ].join(' · '),
    ) + (t.errors ? ` · ${pc.red(`${t.errors} errors`)}` : ''),
  );

  const table = new Table({
    head: ['Scorer', 'Type', 'Mean', 'Pass rate', 'Scored', 'Errors'].map((h) => pc.bold(h)),
    style: { head: [], border: [] },
  });
  for (const s of run.summary) {
    const rate = s.passRate === null ? pc.dim('—') : colorRate(s.passRate);
    table.push([
      s.scorer,
      pc.dim(s.type),
      num(s.mean),
      rate,
      String(s.scored),
      s.errors ? pc.red(String(s.errors)) : '0',
    ]);
  }
  lines.push('', table.toString());

  const failing = run.results
    .flatMap((r) => r.scores.filter((s) => s.passed === false).map((s) => ({ r, s })))
    .sort((a, b) => (a.s.value ?? 0) - (b.s.value ?? 0))
    .slice(0, 5);
  if (failing.length) {
    lines.push('', pc.bold('Lowest-scoring failures'));
    for (const { r, s } of failing) {
      lines.push(
        `  ${pc.yellow(r.caseId)} ${pc.dim(`#${r.sample}`)} ${s.scorer} ${num(s.value, 2)}  ${pc.dim(clip(s.reason ?? '', 100))}`,
      );
    }
  }

  const errors = [
    ...run.results
      .filter((r) => r.error)
      .map((r) => ({ id: r.caseId, where: 'target', msg: r.error ?? '' })),
    ...run.results.flatMap((r) =>
      r.scores
        .filter((s) => s.error)
        .map((s) => ({ id: r.caseId, where: s.scorer, msg: s.error ?? '' })),
    ),
  ];
  if (errors.length) {
    lines.push(
      '',
      pc.bold(pc.red(`Errors (${errors.length})`)) + pc.dim(' — not counted as low scores'),
    );
    for (const e of errors.slice(0, 5))
      lines.push(`  ${pc.yellow(e.id)} ${pc.dim(e.where)}  ${clip(e.msg, 120)}`);
    if (errors.length > 5)
      lines.push(pc.dim(`  …and ${errors.length - 5} more (see the run file)`));
  }

  if (savedTo) lines.push('', pc.dim(`Saved ${savedTo}`));
  return lines.join('\n');
}

function colorRate(rate: number): string {
  const text = pct(rate);
  return rate >= 0.9 ? pc.green(text) : rate >= 0.7 ? pc.yellow(text) : pc.red(text);
}
