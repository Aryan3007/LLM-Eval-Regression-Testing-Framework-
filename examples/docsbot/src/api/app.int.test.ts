import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '../db/client.js';
import { createFakeProvider } from '../llm/fake.js';
import { createChunkRepository } from '../repositories/chunk.repository.js';
import { createCollectionRepository } from '../repositories/collection.repository.js';
import { createAnswerService } from '../services/answer.service.js';
import { createApp } from './app.js';

const url = process.env.DATABASE_URL_TEST ?? '';
const { db, pool } = createDb(url, 2);
const llm = createFakeProvider();
const collections = createCollectionRepository(db);
const chunks = createChunkRepository(db);
const COLLECTION = `test-${String(process.pid)}`;

const docs = [
  {
    docPath: 'tutorial/body.md',
    heading: 'Request Body',
    content: 'Declare a request body with a Pydantic BaseModel class.',
  },
  {
    docPath: 'tutorial/query-params.md',
    heading: 'Query Parameters',
    content: 'Function parameters not in the path are query parameters.',
  },
  {
    docPath: 'deployment/docker.md',
    heading: 'Docker',
    content: 'Build a Docker image for FastAPI with a Dockerfile.',
  },
];

function appFor(collectionName: string) {
  return createApp({
    answerService: createAnswerService(
      { collectionName, topK: 2, systemPrompt: 'Answer only from the provided context.' },
      { llm, collections, chunks },
    ),
    checkDb: () => Promise.resolve(true),
    docsUi: false,
  });
}

beforeAll(async () => {
  const { vectors } = await llm.embed(docs.map((d) => `${d.heading}\n\n${d.content}`));
  await collections.replace(
    {
      name: COLLECTION,
      sourceRef: 'test',
      chunkSize: 512,
      chunkOverlap: 0,
      embeddingModel: 'fake',
      chunkCount: docs.length,
      contentHash: 'test',
    },
    docs.map((d, i) => ({ ...d, ordinal: 0, tokenCount: 10, embedding: vectors[i] ?? [] })),
  );
});

afterAll(async () => {
  await collections.deleteByName(COLLECTION);
  await pool.end();
});

describe('POST /v1/ask', () => {
  it('answers with the most similar sources first', async () => {
    const res = await request(appFor(COLLECTION))
      .post('/v1/ask')
      .send({ question: 'How do I declare a request body with Pydantic BaseModel?' });

    expect(res.status).toBe(200);
    const body = res.body as {
      answer: string;
      sources: { docPath: string; score: number }[];
      collection: string;
      usage: Record<string, number>;
    };
    expect(body.answer).toBe('Fake answer based on 2 sources.');
    expect(body.sources).toHaveLength(2);
    expect(body.sources[0]?.docPath).toBe('tutorial/body.md');
    expect(body.sources[0]?.score).toBeGreaterThanOrEqual(body.sources[1]?.score ?? 1);
    expect(body.collection).toBe(COLLECTION);
    expect(body.usage).toMatchObject({ embeddingTokens: expect.any(Number) as number });
  });

  it('rejects an empty question with 400', async () => {
    const res = await request(appFor(COLLECTION)).post('/v1/ask').send({ question: '   ' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  it('rejects a missing or too-long question with 400', async () => {
    const app = appFor(COLLECTION);
    expect((await request(app).post('/v1/ask').send({})).status).toBe(400);
    expect(
      (
        await request(app)
          .post('/v1/ask')
          .send({ question: 'x'.repeat(2001) })
      ).status,
    ).toBe(400);
  });

  it('returns 503 when the configured collection is not ingested', async () => {
    const res = await request(appFor('does-not-exist')).post('/v1/ask').send({ question: 'hi' });
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ error: { code: 'COLLECTION_NOT_INGESTED' } });
  });
});

describe('health', () => {
  it('GET /ready is 200 when the collection exists, 503 when it does not', async () => {
    expect((await request(appFor(COLLECTION)).get('/ready')).status).toBe(200);
    const res = await request(appFor('does-not-exist')).get('/ready');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'not_ready', db: true, collection: false });
  });

  it('unknown routes return 404 in the standard error shape', async () => {
    const res = await request(appFor(COLLECTION)).get('/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });
});
