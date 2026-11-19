import type { RequestHandler } from 'express';
import type { z } from 'zod';

/** Parse req.body with a Zod schema; ZodErrors become 400s in the error handler. */
export function validateBody(schema: z.ZodType): RequestHandler {
  return (req, _res, next) => {
    req.body = schema.parse(req.body);
    next();
  };
}
