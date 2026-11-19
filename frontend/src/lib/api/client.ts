import { z } from 'zod';

export type ApiError =
  | { kind: 'network'; message: string }
  | { kind: 'http'; status: number; code: string; message: string; requestId?: string }
  | { kind: 'invalid-response'; message: string };

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

// Mirrors the backend's central error handler shape.
const errorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
  }),
});

interface ApiClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
}

export function createApiClient({ baseUrl, fetch: fetchFn = fetch }: ApiClientOptions) {
  async function get<S extends z.ZodType>(
    path: string,
    schema: S,
    init: { signal?: AbortSignal } = {},
  ): Promise<ApiResult<z.infer<S>>> {
    let res: Response;
    try {
      res = await fetchFn(`${baseUrl}${path}`, {
        headers: { accept: 'application/json' },
        ...(init.signal && { signal: init.signal }),
      });
    } catch (err) {
      return {
        ok: false,
        error: { kind: 'network', message: err instanceof Error ? err.message : 'Network error' },
      };
    }

    const body: unknown = await res.json().catch(() => undefined);

    if (!res.ok) {
      const parsedError = errorBodySchema.safeParse(body);
      return {
        ok: false,
        error: parsedError.success
          ? {
              kind: 'http',
              status: res.status,
              code: parsedError.data.error.code,
              message: parsedError.data.error.message,
              ...(parsedError.data.error.requestId && {
                requestId: parsedError.data.error.requestId,
              }),
            }
          : { kind: 'http', status: res.status, code: 'UNKNOWN', message: res.statusText },
      };
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          kind: 'invalid-response',
          message: `Unexpected response from ${path}: ${z.prettifyError(parsed.error)}`,
        },
      };
    }
    return { ok: true, data: parsed.data };
  }

  return { get };
}

/** Thrown only inside TanStack Query's queryFn, so Query can own retries and error state. */
export class ApiRequestError extends Error {
  readonly apiError: ApiError;

  constructor(apiError: ApiError) {
    super(apiError.message);
    this.name = 'ApiRequestError';
    this.apiError = apiError;
  }
}

export function unwrap<T>(result: ApiResult<T>): T {
  if (!result.ok) throw new ApiRequestError(result.error);
  return result.data;
}
