import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

const app = createApp();

describe('health routes', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
  });

  it('GET /ready returns ready', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ready' });
  });

  it('echoes a provided x-request-id', async () => {
    const res = await request(app).get('/health').set('x-request-id', 'test-123');
    expect(res.headers['x-request-id']).toBe('test-123');
  });
});

describe('unknown routes', () => {
  it('return 404 in the standard error shape', async () => {
    const res = await request(app).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      error: { code: 'NOT_FOUND', requestId: expect.any(String) as string },
    });
  });
});

describe('docs', () => {
  it('GET /api/docs-json serves the OpenAPI spec', async () => {
    const res = await request(app).get('/api/docs-json');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ openapi: '3.1.0' });
    expect(Object.keys((res.body as { paths: Record<string, unknown> }).paths)).toEqual(
      expect.arrayContaining(['/health', '/ready']),
    );
  });
});
