import { Ajv } from 'ajv';
import { ConfigError, ScorerInputError } from '../errors.js';
import { type ScorerConfig, scorerName } from '../schemas/suite.js';
import type { Scorer, ScoreResult } from './types.js';

type Det = Exclude<ScorerConfig, { type: 'llm_judge' }>;

const pass = (reason: string): ScoreResult => ({ value: 1, passed: true, reason });
const fail = (reason: string): ScoreResult => ({ value: 0, passed: false, reason });
const clip = (s: string, n = 80) => (s.length > n ? `${s.slice(0, n)}…` : s);

export function createDeterministicScorer(config: Det): Scorer {
  const name = scorerName(config);
  const base = { name, type: config.type, passAt: null };

  switch (config.type) {
    case 'exact_match':
      return {
        ...base,
        score: ({ testCase, output }) => {
          if (testCase.expected === undefined) {
            throw new ScorerInputError(`exact_match needs "expected" on case ${testCase.id}`);
          }
          const norm = (s: string) => {
            const t = config.trim ? s.trim() : s;
            return config.case_sensitive ? t : t.toLowerCase();
          };
          return Promise.resolve(
            norm(output) === norm(testCase.expected)
              ? pass('output matches expected exactly')
              : fail(`expected "${clip(testCase.expected)}", got "${clip(output)}"`),
          );
        },
      };

    case 'contains':
    case 'not_contains': {
      const values = Array.isArray(config.value) ? config.value : [config.value];
      const norm = (s: string) => (config.case_sensitive ? s : s.toLowerCase());
      return {
        ...base,
        score: ({ output }) => {
          const found = values.filter((v) => norm(output).includes(norm(v)));
          if (config.type === 'not_contains') {
            return Promise.resolve(
              found.length === 0
                ? pass('none of the forbidden strings appear')
                : fail(`output contains forbidden: ${found.map((f) => `"${f}"`).join(', ')}`),
            );
          }
          const missing = values.filter((v) => !found.includes(v));
          const ok = config.mode === 'all' ? missing.length === 0 : found.length > 0;
          return Promise.resolve(
            ok
              ? pass(`found ${found.map((f) => `"${f}"`).join(', ')}`)
              : fail(`missing ${missing.map((m) => `"${m}"`).join(', ')}`),
          );
        },
      };
    }

    case 'regex': {
      const re = new RegExp(config.pattern, config.flags.replace('g', ''));
      return {
        ...base,
        score: ({ output }) =>
          Promise.resolve(
            re.test(output)
              ? pass(`matches /${config.pattern}/`)
              : fail(`does not match /${config.pattern}/`),
          ),
      };
    }

    case 'json_schema': {
      const ajv = new Ajv({ allErrors: true, strict: false });
      let validate: ReturnType<typeof ajv.compile>;
      try {
        validate = ajv.compile(config.schema);
      } catch (err) {
        throw new ConfigError(`scorer "${name}": invalid JSON schema: ${String(err)}`);
      }
      return {
        ...base,
        score: ({ output }) => {
          let data: unknown;
          try {
            data = JSON.parse(stripFences(output));
          } catch {
            return Promise.resolve(fail('output is not valid JSON'));
          }
          return Promise.resolve(
            validate(data)
              ? pass('output matches the JSON schema')
              : fail(ajv.errorsText(validate.errors, { separator: '; ' })),
          );
        },
      };
    }

    case 'length':
      return {
        ...base,
        score: ({ output }) => {
          const n = output.length;
          if (config.min_chars !== undefined && n < config.min_chars) {
            return Promise.resolve(fail(`${n} chars, below min ${config.min_chars}`));
          }
          if (config.max_chars !== undefined && n > config.max_chars) {
            return Promise.resolve(fail(`${n} chars, above max ${config.max_chars}`));
          }
          return Promise.resolve(pass(`${n} chars, within limits`));
        },
      };
  }
}

function stripFences(text: string): string {
  const m = /^\s*```(?:json)?\s*\n([\s\S]*?)\n\s*```\s*$/.exec(text);
  return m?.[1] ?? text;
}
