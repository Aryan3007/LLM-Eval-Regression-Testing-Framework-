import { QueryClient } from '@tanstack/react-query';
import { ApiRequestError } from '@/lib/api/client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // A 4xx won't fix itself on retry; network blips and 5xx might.
      retry: (failureCount, error) => {
        if (
          error instanceof ApiRequestError &&
          error.apiError.kind === 'http' &&
          error.apiError.status < 500
        ) {
          return false;
        }
        return failureCount < 2;
      },
    },
  },
});
