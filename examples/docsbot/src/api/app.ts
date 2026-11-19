import { randomUUID } from 'node:crypto';
import express, { type Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { mountDocs } from '../docs/swagger.js';
import { logger } from '../lib/logger.js';
import { errorHandler } from '../middleware/error-handler.js';
import { notFound } from '../middleware/not-found.js';
import { createHealthRouter } from '../routes/health.routes.js';
import { createAskRouter } from '../routes/v1/ask.routes.js';
import type { AnswerService } from '../services/answer.service.js';

export interface AppDeps {
  answerService: AnswerService;
  checkDb: () => Promise<boolean>;
  docsUi: boolean;
}

export function createApp({ answerService, checkDb, docsUi }: AppDeps): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const incoming = req.headers['x-request-id'];
        const id = typeof incoming === 'string' && incoming.length <= 128 ? incoming : randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },
      customLogLevel: (_req, res, err) =>
        err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      serializers: {
        req: (req: { id: unknown; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          url: req.url,
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));

  app.use(createHealthRouter({ db: checkDb, collection: () => answerService.isReady() }));
  mountDocs(app, { ui: docsUi });
  // Generous: an eval run fires ~300 requests (100 cases × 3 repeats) at concurrency 8.
  app.use('/v1', rateLimit({ windowMs: 60_000, limit: 1200 }), createAskRouter(answerService));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
