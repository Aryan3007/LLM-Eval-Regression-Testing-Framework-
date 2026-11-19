import { z } from 'zod';
import { ScorerInputError } from '../errors.js';
import type { Provider } from '../providers/index.js';
import type { RateLimiter } from '../runner/rate-limiter.js';
import type { FileCache } from '../runner/cache.js';
import { withRetry } from '../runner/retry.js';
import type { JudgeConfig } from '../schemas/suite.js';
import { computeCost } from '../targets/cost.js';
import { hashValue } from '../util/hash.js';
import type { Scorer, ScoreResult } from './types.js';

/** Bump when JUDGE_SYSTEM or the prompt layout changes, so old cached verdicts aren't reused. */
const JUDGE_PROMPT_VERSION = 1;

const JUDGE_SYSTEM = `You are an impartial evaluator. You grade the output of an AI system against a rubric.

Judge only what the rubric asks for. Do not reward length, confidence or style unless the rubric asks for it. If a reference answer is given, use it as the source of truth for facts. If retrieved context is given, it is what the system was shown.

Reply with only a JSON object, no other text:
{"reasoning": "<2-4 sentences explaining the grade>", "score": <integer 1-5>}

Scale: 1 = fails the rubric, 2 = mostly fails, 3 = partially meets it, 4 = meets it with minor issues, 5 = fully meets it.`;

const verdictSchema = z.object({
  reasoning: z.string().min(1),
  score: z.coerce.number().int().min(1).max(5),
});

const cachedVerdictSchema = z.object({
  raw: z.string(),
  inputTokens: z.number().nullable(),
  outputTokens: z.number().nullable(),
  costUsd: z.number().nullable(),
});

export interface JudgeDeps {
  provider: Provider;
  cache: FileCache;
  limiter: RateLimiter;
  retries: number;
}

export function createLlmJudgeScorer(
  name: string,
  rubric: string,
  passAt: number,
  judge: JudgeConfig,
  deps: JudgeDeps,
): Scorer {
  return {
    name,
    type: 'llm_judge',
    passAt,
    async score({ testCase, output, context }, signal): Promise<ScoreResult> {
      if (!output.trim()) throw new ScorerInputError('output is empty; nothing to judge');

      const prompt = buildJudgePrompt(rubric, testCase.input, testCase.expected, context, output);
      const key = hashValue({
        v: JUDGE_PROMPT_VERSION,
        provider: judge.provider,
        model: judge.model,
        temperature: judge.temperature,
        system: JUDGE_SYSTEM,
        prompt,
      });

      let call = await deps.cache.get('judge', key, cachedVerdictSchema);
      const cached = call !== undefined;
      if (!call) {
        await deps.limiter.take(signal);
        const { value: res } = await withRetry(
          () =>
            deps.provider.chat({
              model: judge.model,
              system: JUDGE_SYSTEM,
              prompt,
              temperature: judge.temperature,
              maxTokens: judge.max_tokens,
              signal,
            }),
          { retries: deps.retries, signal },
        );
        call = {
          raw: res.text,
          inputTokens: res.inputTokens,
          outputTokens: res.outputTokens,
          costUsd: computeCost(judge.pricing, res.inputTokens, res.outputTokens),
        };
        await deps.cache.set('judge', key, call);
      }

      const verdict = parseVerdict(call.raw);
      const value = (verdict.score - 1) / 4;
      return {
        value,
        passed: value >= passAt,
        reason: `${verdict.score}/5: ${verdict.reasoning}`,
        judge: { ...call, cached },
      };
    },
  };
}

export function buildJudgePrompt(
  rubric: string,
  input: string,
  expected: string | undefined,
  context: string[] | null,
  output: string,
): string {
  const contextText = context?.length
    ? context.map((c, i) => `[${i + 1}] ${c}`).join('\n\n')
    : '(none)';
  return [
    `## Rubric\n${rubric}`,
    `## Input\n${input}`,
    `## Reference answer\n${expected ?? '(none provided)'}`,
    `## Retrieved context\n${contextText}`,
    `## Output to grade\n${output}`,
  ].join('\n\n');
}

/** Accepts bare JSON, fenced JSON, or JSON with stray prose around it. */
export function parseVerdict(raw: string): z.infer<typeof verdictSchema> {
  const candidates = [raw.trim(), ...(raw.match(/\{[\s\S]*\}/g) ?? [])];
  for (const candidate of candidates) {
    try {
      const parsed = verdictSchema.safeParse(
        JSON.parse(candidate.replace(/^```(?:json)?|```$/g, '')),
      );
      if (parsed.success) return parsed.data;
    } catch {
      // try the next candidate
    }
  }
  throw new ScorerInputError(`judge reply is not a valid verdict: ${raw.slice(0, 200)}`);
}
