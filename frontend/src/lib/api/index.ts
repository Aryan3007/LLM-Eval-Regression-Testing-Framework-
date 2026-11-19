import { env } from '@/lib/env';
import { createApiClient } from './client';

export const api = createApiClient({ baseUrl: env.VITE_API_URL });
export { ApiRequestError, unwrap, type ApiError, type ApiResult } from './client';
