import { Router } from 'express';
import { createReadyController, getHealth } from '../controllers/health.controller.js';

export function createHealthRouter(checks: Parameters<typeof createReadyController>[0]): Router {
  const router = Router();

  /**
   * @swagger
   * /health:
   *   get:
   *     summary: Liveness check — the process is up
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Process is alive
   */
  router.get('/health', getHealth);

  /**
   * @swagger
   * /ready:
   *   get:
   *     summary: Readiness check — Postgres is reachable and the configured collection is ingested
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Ready to answer questions
   *       503:
   *         description: Database unreachable or collection not ingested
   */
  router.get('/ready', createReadyController(checks));

  return router;
}
