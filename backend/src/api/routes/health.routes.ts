import { Router } from 'express';
import { getHealth, getReady } from '../controllers/health.controller.js';

export const healthRouter: Router = Router();

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
healthRouter.get('/health', getHealth);

/**
 * @swagger
 * /ready:
 *   get:
 *     summary: Readiness check — dependencies are reachable
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Ready to serve traffic
 */
healthRouter.get('/ready', getReady);
