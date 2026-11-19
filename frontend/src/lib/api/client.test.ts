import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiRequestError, createApiClient, unwrap } from './client';

const schema = z.object({ status: z.literal('ok') });

function clientReturning(response: Response | Error) {
  const fetchFn = vi.fn<typeof fetch>(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
  return { client: createApiClient({ baseUrl: 'http://api.test', fetch: fetchFn }), fetchFn };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('createApiClient().get', () => {
  it('returns validated data on success', async () => {
    const { client, fetchFn } = clientReturning(json({ status: 'ok' }));
    await expect(client.get('/health', schema)).resolves.toEqual({
      ok: true,
      data: { status: 'ok' },
    });
    expect(fetchFn.mock.calls[0]?.[0]).toBe('http://api.test/health');
  });

  it('returns invalid-response when the body does not match the schema', async () => {
    const { client } = clientReturning(json({ status: 'down' }));
    const result = await client.get('/health', schema);
    expect(result).toMatchObject({ ok: false, error: { kind: 'invalid-response' } });
  });

  it('maps the backend error shape on non-2xx', async () => {
    const { client } = clientReturning(
      json({ error: { code: 'NOT_FOUND', message: 'Run run_42 not found', requestId: 'r1' } }, 404),
    );
    await expect(client.get('/runs/run_42', schema)).resolves.toEqual({
      ok: false,
      error: {
        kind: 'http',
        status: 404,
        code: 'NOT_FOUND',
        message: 'Run run_42 not found',
        requestId: 'r1',
      },
    });
  });

  it('handles non-JSON error bodies', async () => {
    const { client } = clientReturning(new Response('Bad Gateway', { status: 502 }));
    const result = await client.get('/health', schema);
    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'http', status: 502, code: 'UNKNOWN' },
    });
  });

  it('returns a network error when fetch rejects', async () => {
    const { client } = clientReturning(new TypeError('Failed to fetch'));
    await expect(client.get('/health', schema)).resolves.toEqual({
      ok: false,
      error: { kind: 'network', message: 'Failed to fetch' },
    });
  });
});

describe('unwrap', () => {
  it('returns data or throws ApiRequestError', () => {
    expect(unwrap({ ok: true, data: 1 })).toBe(1);
    expect(() => unwrap({ ok: false, error: { kind: 'network', message: 'x' } })).toThrow(
      ApiRequestError,
    );
  });
});
