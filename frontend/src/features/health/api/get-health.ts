import { z } from 'zod';
import { api } from '@/lib/api';

export const healthSchema = z.object({
  status: z.literal('ok'),
  uptimeSeconds: z.number().int().nonnegative(),
});

export type Health = z.infer<typeof healthSchema>;

export function getHealth(signal?: AbortSignal) {
  return api.get('/health', healthSchema, signal ? { signal } : {});
}
