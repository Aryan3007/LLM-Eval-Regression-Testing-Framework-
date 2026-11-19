import path from 'node:path';
import type { Express } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { env } from '../config/env.js';

const routesGlob = path.join(import.meta.dirname, '../routes/**/*.{ts,js}');

const spec = swaggerJsdoc({
  definition: {
    openapi: '3.1.0',
    info: {
      title: 'llmeval API',
      version: '0.0.0',
      description: 'Stores eval runs and serves run history, comparisons and trends.',
    },
    components: {
      schemas: {
        Error: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['code', 'message', 'requestId'],
              properties: {
                code: { type: 'string', example: 'NOT_FOUND' },
                message: { type: 'string', example: 'Run run_42 not found' },
                details: { description: 'Extra context, e.g. field-level validation errors' },
                requestId: { type: 'string', example: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed' },
              },
            },
          },
        },
      },
    },
  },
  apis: [routesGlob],
});

/** /api/docs-json is always on; the Swagger UI is only served outside production. */
export function mountDocs(app: Express): void {
  app.get('/api/docs-json', (_req, res) => {
    res.json(spec);
  });
  if (env.NODE_ENV !== 'production') {
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec));
  }
}
