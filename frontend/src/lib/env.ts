import { z } from 'zod';

const envSchema = z.object({
  VITE_API_URL: z
    .url({ message: 'VITE_API_URL must be a full URL, e.g. http://localhost:8000' })
    .transform((url) => url.replace(/\/+$/, '')),
});

const parsed = envSchema.safeParse(import.meta.env);
if (!parsed.success) {
  throw new Error(`Invalid frontend env (see .env.example):\n${z.prettifyError(parsed.error)}`);
}

export const env = parsed.data;
