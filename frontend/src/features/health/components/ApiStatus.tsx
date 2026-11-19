import { Skeleton } from '@/components/ui/Skeleton';
import { ApiRequestError } from '@/lib/api';
import { useHealth } from '../hooks/use-health';

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${String(seconds)}s`;
  if (seconds < 3600) return `${String(Math.floor(seconds / 60))}m`;
  return `${String(Math.floor(seconds / 3600))}h ${String(Math.floor((seconds % 3600) / 60))}m`;
}

export function ApiStatus() {
  const { data, error, isPending, isError, refetch, isFetching } = useHealth();

  return (
    <section
      aria-labelledby="api-status-heading"
      aria-busy={isPending}
      className="rounded-lg border border-stone-200 bg-white p-5"
    >
      <h2
        id="api-status-heading"
        className="font-mono text-xs tracking-wider text-stone-500 uppercase"
      >
        API status
      </h2>

      {isPending && (
        <div className="mt-3 space-y-2">
          <Skeleton width="10rem" height="1.25rem" />
          <Skeleton width="6rem" height="0.875rem" />
        </div>
      )}

      {isError && (
        <div className="mt-3" role="alert">
          <p className="flex items-center gap-2 font-medium text-rose-700">
            <span aria-hidden className="size-2 rounded-full bg-rose-600" />
            Can’t reach the API
          </p>
          <p className="mt-1 text-sm text-stone-600">
            {error instanceof ApiRequestError && error.apiError.kind === 'network'
              ? 'Is the backend running? Start it with `pnpm dev` in backend/.'
              : error.message}
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="mt-3 rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
          >
            {isFetching ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      )}

      {data && (
        <div className="mt-3">
          <p className="flex items-center gap-2 font-medium text-emerald-700">
            <span aria-hidden className="size-2 rounded-full bg-emerald-600" />
            Online
          </p>
          <p className="mt-1 font-mono text-sm text-stone-600">
            up {formatUptime(data.uptimeSeconds)}
          </p>
        </div>
      )}
    </section>
  );
}
