import { Router } from 'express';
import { askBodySchema, createAskController } from '../../controllers/ask.controller.js';
import { validateBody } from '../../middleware/validate.js';
import type { AnswerService } from '../../services/answer.service.js';

export function createAskRouter(service: AnswerService): Router {
  const router = Router();

  /**
   * @swagger
   * /v1/ask:
   *   post:
   *     summary: Answer a question about FastAPI from the docs
   *     description: >
   *       Embeds the question, retrieves the top-k most similar chunks from the configured
   *       collection (COLLECTION env var), and asks the chat model to answer using only that
   *       context. Returns the answer plus the retrieved sources, token usage and latency, so
   *       llmeval can score faithfulness and context precision.
   *     tags: [Ask]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/AskRequest'
   *     responses:
   *       200:
   *         description: The answer and the context it was based on
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AskResponse'
   *       400:
   *         description: Missing, empty or too-long question
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       429:
   *         description: Rate limit exceeded
   *       500:
   *         description: Model provider or database failure
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       503:
   *         description: The configured collection has not been ingested yet (code COLLECTION_NOT_INGESTED)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.post('/ask', validateBody(askBodySchema), createAskController(service));

  return router;
}
