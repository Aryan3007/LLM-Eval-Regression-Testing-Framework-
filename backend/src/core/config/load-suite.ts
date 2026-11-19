import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml, YAMLParseError } from 'yaml';
import { z } from 'zod';
import { ConfigError } from '../errors.js';
import { type Case, caseSchema } from '../schemas/case.js';
import { scorerName, type SuiteConfig, suiteSchema } from '../schemas/suite.js';
import { hashValue } from '../util/hash.js';
import { interpolateEnv } from './interpolate-env.js';

export interface LoadedSuite {
  path: string;
  dir: string;
  config: SuiteConfig;
  /** Config with secret env vars left as `${NAME}`: safe to hash, never sent anywhere. */
  hashableConfig: SuiteConfig;
  cases: Case[];
  /** Rubric text per llm_judge scorer name. */
  rubrics: Map<string, string>;
  configHash: string;
  datasetHash: string;
}

export interface LoadSuiteOptions {
  env?: Record<string, string | undefined>;
  /** Keep cases that have at least one of these tags. Empty = all cases. */
  tags?: string[];
}

export async function loadSuite(
  suitePath: string,
  options: LoadSuiteOptions = {},
): Promise<LoadedSuite> {
  const absPath = path.resolve(suitePath);
  const dir = path.dirname(absPath);
  const raw = await readText(absPath, 'suite file');

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (err) {
    const detail = err instanceof YAMLParseError ? err.message : String(err);
    throw new ConfigError(`${suitePath}: invalid YAML\n${detail}`);
  }

  const { value, hashable, missing } = interpolateEnv(parsed, options.env ?? process.env);
  if (missing.length > 0) {
    throw new ConfigError(
      `${suitePath}: environment variable${missing.length > 1 ? 's' : ''} not set: ${missing.join(', ')}\n` +
        'Set them in your shell or .env, or give a default with ${NAME:-default}.',
    );
  }

  const config = parseWith(suiteSchema, value, suitePath);
  const hashableConfig = parseWith(suiteSchema, hashable, suitePath);

  const allCases =
    'path' in config.dataset
      ? await loadCases(path.resolve(dir, config.dataset.path), config.dataset.path)
      : config.dataset.cases;
  assertUniqueIds(allCases);

  const tags = options.tags ?? [];
  const cases = tags.length
    ? allCases.filter((c) => c.tags.some((t) => tags.includes(t)))
    : allCases;
  if (cases.length === 0) {
    throw new ConfigError(
      tags.length
        ? `No cases have any of the tags: ${tags.join(', ')}`
        : `${suitePath}: the dataset has no cases`,
    );
  }

  const rubrics = new Map<string, string>();
  for (const scorer of config.scorers) {
    if (scorer.type === 'llm_judge') {
      const text = await readText(
        path.resolve(dir, scorer.rubric),
        `rubric for scorer "${scorerName(scorer)}"`,
      );
      rubrics.set(scorerName(scorer), text.trim());
    }
  }

  return {
    path: absPath,
    dir,
    config,
    hashableConfig,
    cases,
    rubrics,
    // Rubric text is part of the config: editing a rubric must change the hash.
    configHash: hashValue({ config: hashableConfig, rubrics: [...rubrics.entries()] }),
    datasetHash: hashValue(allCases),
  };
}

async function loadCases(file: string, displayPath: string): Promise<Case[]> {
  const text = await readText(file, 'dataset');
  const ext = path.extname(file).toLowerCase();

  if (ext === '.jsonl') {
    const cases: Case[] = [];
    for (const [i, line] of text.split('\n').entries()) {
      if (!line.trim()) continue;
      let json: unknown;
      try {
        json = JSON.parse(line);
      } catch {
        throw new ConfigError(`${displayPath}:${i + 1}: line is not valid JSON`);
      }
      cases.push(parseWith(caseSchema, json, `${displayPath}:${i + 1}`));
    }
    return cases;
  }

  if (ext === '.yaml' || ext === '.yml') {
    const data: unknown = parseYaml(text);
    return parseWith(z.array(caseSchema), data, displayPath);
  }

  throw new ConfigError(
    `${displayPath}: unsupported dataset format "${ext}" (use .jsonl, .yaml or .yml)`,
  );
}

function assertUniqueIds(cases: Case[]): void {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const c of cases) {
    if (seen.has(c.id)) dupes.add(c.id);
    seen.add(c.id);
  }
  if (dupes.size) {
    throw new ConfigError(
      `Case ids must be unique (they link results across runs). Duplicates: ${[...dupes].join(', ')}`,
    );
  }
}

function parseWith<S extends z.ZodType>(schema: S, data: unknown, where: string): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ConfigError(`${where}: invalid config\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

async function readText(file: string, what: string): Promise<string> {
  try {
    return await readFile(file, 'utf8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    throw new ConfigError(
      code === 'ENOENT'
        ? `Cannot find ${what}: ${file}`
        : `Cannot read ${what} ${file}: ${String(err)}`,
    );
  }
}
