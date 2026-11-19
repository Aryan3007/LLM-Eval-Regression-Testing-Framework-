import path from 'node:path';
import type { Express } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const routesGlob = path.join(import.meta.dirname, '../routes/**/*.{ts,js}');

const spec = swaggerJsdoc({
  definition: {
    openapi: '3.1.0',
    info: {
      title: 'DocsBot API',
      version: '0.0.0',
      description: 'Demo RAG assistant over the FastAPI docs, used as the system under test.',
    },
    components: {
      schemas: {
        AskRequest: {
          type: 'object',
          required: ['question'],
          properties: {
            question: {
              type: 'string',
              minLength: 1,
              maxLength: 2000,
              description: 'The user question. Leading/trailing whitespace is trimmed.',
              example: 'How do I declare a request body in FastAPI?',
            },
          },
        },
        Source: {
          type: 'object',
          required: ['id', 'docPath', 'heading', 'text', 'score'],
          properties: {
            id: { type: 'integer', description: 'Chunk id', example: 812 },
            docPath: {
              type: 'string',
              description: 'Doc page relative to docs/en/docs',
              example: 'tutorial/body.md',
            },
            heading: {
              type: 'string',
              description: 'Heading trail of the section the chunk came from',
              example: 'Request Body > Create your data model',
            },
            text: { type: 'string', description: 'Chunk content given to the model' },
            score: {
              type: 'number',
              description: 'Cosine similarity to the question (1 = identical)',
              example: 0.8123,
            },
          },
        },
        Usage: {
          type: 'object',
          required: ['embeddingTokens', 'promptTokens', 'completionTokens'],
          properties: {
            embeddingTokens: { type: 'integer', example: 9 },
            promptTokens: { type: 'integer', example: 1840 },
            completionTokens: { type: 'integer', example: 212 },
          },
        },
        AskResponse: {
          type: 'object',
          required: ['answer', 'sources', 'model', 'collection', 'usage', 'latencyMs'],
          properties: {
            answer: {
              type: 'string',
              example: 'Declare a Pydantic model and use it as a parameter type…',
            },
            sources: {
              type: 'array',
              description: 'Retrieved chunks, most similar first',
              items: { $ref: '#/components/schemas/Source' },
            },
            model: { type: 'string', description: 'Model that produced the answer' },
            collection: { type: 'string', example: 'fastapi-0.115.0-c512-o64' },
            usage: { $ref: '#/components/schemas/Usage' },
            latencyMs: { type: 'integer', example: 1430 },
          },
        },
        Error: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['code', 'message', 'requestId'],
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR' },
                message: { type: 'string', example: 'Request validation failed' },
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

export function mountDocs(app: Express, { ui }: { ui: boolean }): void {
  app.get('/api/docs-json', (_req, res) => {
    res.json(spec);
  });
  if (ui) app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec));
}
