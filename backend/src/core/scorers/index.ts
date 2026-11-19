import { ConfigError } from '../errors.js';
import type { LoadedSuite } from '../config/load-suite.js';
import { scorerName } from '../schemas/suite.js';
import { createDeterministicScorer } from './deterministic.js';
import { createLlmJudgeScorer, type JudgeDeps } from './llm-judge.js';
import type { Scorer } from './types.js';

export function createScorers(suite: LoadedSuite, judgeDeps: () => JudgeDeps): Scorer[] {
  return suite.config.scorers.map((config) => {
    if (config.type !== 'llm_judge') return createDeterministicScorer(config);
    const name = scorerName(config);
    const rubric = suite.rubrics.get(name);
    const judge = suite.config.judge;
    if (rubric === undefined || !judge)
      throw new ConfigError(`scorer "${name}" is missing its rubric or judge`);
    return createLlmJudgeScorer(name, rubric, config.pass_at, judge, judgeDeps());
  });
}

export type { Scorer, ScoreInput, ScoreResult } from './types.js';
