import type { Case } from '../schemas/case.js';

export interface ScoreInput {
  testCase: Case;
  output: string;
  context: string[] | null;
}

export interface JudgeDetails {
  raw: string;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  cached: boolean;
}

export interface ScoreResult {
  /** 0–1. */
  value: number;
  passed: boolean;
  reason: string;
  judge?: JudgeDetails;
}

export interface Scorer {
  readonly name: string;
  readonly type: string;
  /** Threshold for continuous scorers; null for pass/fail scorers. */
  readonly passAt: number | null;
  score(input: ScoreInput, signal: AbortSignal): Promise<ScoreResult>;
}
