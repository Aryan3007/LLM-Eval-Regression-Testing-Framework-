import type { Case } from '../schemas/case.js';

export interface TargetResult {
  output: string;
  context: string[] | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
}

export interface Target {
  readonly type: 'http' | 'model';
  readonly label: string;
  /** Hash of the target's config (secrets excluded); part of every response-cache key. */
  readonly configHash: string;
  call(testCase: Case, signal: AbortSignal): Promise<TargetResult>;
}

export function templateVars(testCase: Case): Record<string, unknown> {
  return {
    input: testCase.input,
    expected: testCase.expected,
    id: testCase.id,
    tags: testCase.tags,
    metadata: testCase.metadata,
  };
}
