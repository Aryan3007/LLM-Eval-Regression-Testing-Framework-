import { useQuery } from '@tanstack/react-query';
import { unwrap } from '@/lib/api';
import { getHealth } from '../api/get-health';

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: async ({ signal }) => unwrap(await getHealth(signal)),
    refetchInterval: 15_000,
  });
}
