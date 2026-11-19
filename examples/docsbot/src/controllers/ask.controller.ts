import type { RequestHandler } from 'express';
import { z } from 'zod';
import type { AnswerResult, AnswerService } from '../services/answer.service.js';

export const askBodySchema = z.object({
  question: z.string().trim().min(1, 'question is required').max(2000),
});
type AskBody = z.infer<typeof askBodySchema>;

export function createAskController(
  service: AnswerService,
): RequestHandler<Record<string, never>, AnswerResult, AskBody> {
  return async (req, res) => {
    res.json(await service.answer(req.body.question));
  };
}
