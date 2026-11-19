import type { ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../errors/app-error.js';

interface ErrorBody {
  error: { code: string; message: string; details?: unknown; requestId: string };
}

/** Last middleware in the chain: maps every thrown error to one response shape. */
export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, _next) => {
  // genReqId in app.ts always returns a string.
  const requestId = typeof req.id === 'string' ? req.id : 'unknown';

  if (err instanceof AppError) {
    const body: ErrorBody = {
      error: { code: err.code, message: err.message, details: err.details, requestId },
    };
    res.status(err.statusCode).json(body);
    return;
  }

  if (err instanceof z.ZodError) {
    const body: ErrorBody = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: z.flattenError(err),
        requestId,
      },
    };
    res.status(400).json(body);
    return;
  }

  req.log.error({ err }, 'Unhandled error');
  const body: ErrorBody = {
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId },
  };
  res.status(500).json(body);
};
