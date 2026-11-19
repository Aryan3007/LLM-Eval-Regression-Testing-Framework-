import pRetry from 'p-retry';
import { TargetError } from '../errors.js';

export interface RetryOptions {
  retries: number;
  signal: AbortSignal;
  minTimeoutMs?: number;
}

/** Retry only errors marked retryable (429, 5xx, timeouts, connection drops). */
export async function withRetry<T>(
  fn: () => Promise<T>,
  { retries, signal, minTimeoutMs = 500 }: RetryOptions,
): Promise<{ value: T; attempts: number }> {
  let attempts = 0;
  const value = await pRetry(
    async () => {
      attempts++;
      return fn();
    },
    {
      retries,
      signal,
      minTimeout: minTimeoutMs,
      factor: 2,
      randomize: true,
      shouldRetry: ({ error }) => error instanceof TargetError && error.retryable,
    },
  );
  return { value, attempts };
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
