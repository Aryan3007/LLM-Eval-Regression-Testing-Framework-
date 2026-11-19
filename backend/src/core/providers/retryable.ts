/** HTTP statuses worth retrying: timeouts, conflicts, rate limits, server errors. */
export function isRetryableStatus(status: number | undefined): boolean {
  return (
    status === undefined || status === 408 || status === 409 || status === 429 || status >= 500
  );
}

/** SDK error classes type `status` loosely; read it defensively. */
export function statusOf(err: { status?: unknown }): number | undefined {
  return typeof err.status === 'number' ? err.status : undefined;
}
