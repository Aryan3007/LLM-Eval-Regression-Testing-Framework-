import { z } from 'zod';
import { caseSchema } from './case.js';

export const providerSchema = z.enum(['openai', 'anthropic', 'groq']);
export type ProviderName = z.infer<typeof providerSchema>;

const jsonPath = z.string().startsWith('$', 'must be a JSONPath expression starting with $');

/** USD per million tokens. Only used to compute cost; omit it and cost is reported as unknown. */
export const pricingSchema = z
  .object({
    input_per_mtok: z.number().nonnegative(),
    output_per_mtok: z.number().nonnegative(),
  })
  .strict();
export type Pricing = z.infer<typeof pricingSchema>;

export const httpTargetSchema = z
  .object({
    type: z.literal('http'),
    label: z.string().min(1).optional(),
    url: z.string().min(1),
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH']).default('POST'),
    headers: z.record(z.string(), z.string()).default({}),
    body: z.unknown().optional(),
    output: jsonPath,
    context: jsonPath.optional(),
    usage: z
      .object({ input_tokens: jsonPath.optional(), output_tokens: jsonPath.optional() })
      .strict()
      .optional(),
    pricing: pricingSchema.optional(),
    timeout_ms: z.number().int().positive().default(60_000),
  })
  .strict();

export const modelTargetSchema = z
  .object({
    type: z.literal('model'),
    label: z.string().min(1).optional(),
    provider: providerSchema,
    model: z.string().min(1),
    system: z.string().optional(),
    prompt: z.string().min(1).default('{{ input }}'),
    /** Ignored for Anthropic: its current API no longer accepts sampling parameters. */
    temperature: z.number().min(0).max(2).optional(),
    max_tokens: z.number().int().positive().default(16_000),
    pricing: pricingSchema.optional(),
    timeout_ms: z.number().int().positive().default(120_000),
  })
  .strict();

export const targetSchema = z.discriminatedUnion('type', [httpTargetSchema, modelTargetSchema]);
export type TargetConfig = z.infer<typeof targetSchema>;
export type HttpTargetConfig = z.infer<typeof httpTargetSchema>;
export type ModelTargetConfig = z.infer<typeof modelTargetSchema>;

const scorerBase = {
  name: z
    .string()
    .regex(/^[a-z0-9][a-z0-9_-]*$/i)
    .optional(),
};

export const scorerSchema = z.discriminatedUnion('type', [
  z
    .object({
      ...scorerBase,
      type: z.literal('exact_match'),
      case_sensitive: z.boolean().default(true),
      trim: z.boolean().default(true),
    })
    .strict(),
  z
    .object({
      ...scorerBase,
      type: z.literal('contains'),
      value: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
      mode: z.enum(['all', 'any']).default('all'),
      case_sensitive: z.boolean().default(false),
    })
    .strict(),
  z
    .object({
      ...scorerBase,
      type: z.literal('not_contains'),
      value: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
      case_sensitive: z.boolean().default(false),
    })
    .strict(),
  z
    .object({
      ...scorerBase,
      type: z.literal('regex'),
      pattern: z.string().min(1),
      flags: z
        .string()
        .regex(/^[dgimsuvy]*$/)
        .default(''),
    })
    .strict()
    .refine(
      (s) => {
        try {
          new RegExp(s.pattern, s.flags);
          return true;
        } catch {
          return false;
        }
      },
      { message: 'pattern is not a valid regular expression', path: ['pattern'] },
    ),
  z
    .object({
      ...scorerBase,
      type: z.literal('json_schema'),
      schema: z.record(z.string(), z.unknown()),
    })
    .strict(),
  z
    .object({
      ...scorerBase,
      type: z.literal('length'),
      min_chars: z.number().int().nonnegative().optional(),
      max_chars: z.number().int().positive().optional(),
    })
    .strict()
    .refine((s) => s.min_chars !== undefined || s.max_chars !== undefined, {
      message: 'set min_chars, max_chars or both',
    }),
  z
    .object({
      ...scorerBase,
      type: z.literal('llm_judge'),
      /** Path to a markdown rubric, relative to the suite file. */
      rubric: z.string().min(1),
      pass_at: z.number().min(0).max(1).default(0.7),
    })
    .strict(),
]);
export type ScorerConfig = z.infer<typeof scorerSchema>;

export const judgeSchema = z
  .object({
    provider: providerSchema,
    model: z.string().min(1),
    /** Ignored for Anthropic. Leave unset for models that only accept their default. */
    temperature: z.number().min(0).max(2).optional(),
    max_tokens: z.number().int().positive().default(16_000),
    pricing: pricingSchema.optional(),
  })
  .strict();
export type JudgeConfig = z.infer<typeof judgeSchema>;

export const runOptionsSchema = z
  .object({
    repeats: z.number().int().min(1).max(20).default(1),
    concurrency: z.number().int().min(1).max(64).default(4),
    /** Max requests per minute to the target. */
    rpm: z.number().int().positive().optional(),
    /** Max requests per minute to the judge model. */
    judge_rpm: z.number().int().positive().optional(),
    max_retries: z.number().int().min(0).max(10).default(3),
    max_cost_usd: z.number().positive().optional(),
  })
  .strict();

export const gateSchema = z
  .object({
    max_suite_drop: z.number().min(0).max(1).default(0.03),
    max_regressed_cases: z.number().int().min(0).default(0),
    max_error_rate: z.number().min(0).max(1).default(0.05),
  })
  .strict();

export const datasetSchema = z.union([
  z.object({ path: z.string().min(1) }).strict(),
  z.object({ cases: z.array(caseSchema).min(1) }).strict(),
]);

export const suiteSchema = z
  .object({
    suite: z
      .string()
      .regex(/^[a-z0-9][a-z0-9_-]*$/, 'use lowercase letters, digits, - and _ (e.g. docsbot)'),
    description: z.string().optional(),
    target: targetSchema,
    dataset: datasetSchema,
    judge: judgeSchema.optional(),
    run: runOptionsSchema.prefault({}),
    scorers: z.array(scorerSchema).min(1, 'add at least one scorer'),
    gate: gateSchema.optional(),
  })
  .strict()
  .superRefine((suite, ctx) => {
    const seen = new Set<string>();
    suite.scorers.forEach((scorer, i) => {
      const name = scorerName(scorer);
      if (seen.has(name)) {
        ctx.addIssue({
          code: 'custom',
          path: ['scorers', i, 'name'],
          message: `duplicate scorer name "${name}"; give each scorer a unique name`,
        });
      }
      seen.add(name);
      if (scorer.type === 'llm_judge' && !suite.judge) {
        ctx.addIssue({
          code: 'custom',
          path: ['scorers', i],
          message: 'llm_judge scorers need a top-level `judge:` block (provider, model)',
        });
      }
    });
  });

export type SuiteConfig = z.infer<typeof suiteSchema>;

export function scorerName(scorer: ScorerConfig): string {
  return scorer.name ?? scorer.type;
}
