import { z } from 'zod';

export const caseSchema = z
  .object({
    id: z.string().min(1).max(200),
    input: z.string().min(1),
    expected: z.string().optional(),
    context: z.array(z.string()).optional(),
    tags: z.array(z.string().min(1)).default([]),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export type Case = z.infer<typeof caseSchema>;
