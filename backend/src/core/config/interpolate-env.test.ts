import { describe, expect, it } from 'vitest';
import { interpolateEnv } from './interpolate-env.js';

describe('interpolateEnv', () => {
  const env = { MODEL: 'gpt-x', OPENAI_API_KEY: 'sk-secret' };

  it('replaces vars in nested strings and applies defaults', () => {
    const { value, missing } = interpolateEnv(
      { model: '${MODEL}', list: ['${PORT:-8001}'], n: 3 },
      env,
    );
    expect(value).toEqual({ model: 'gpt-x', list: ['8001'], n: 3 });
    expect(missing).toEqual([]);
  });

  it('reports every missing var', () => {
    expect(interpolateEnv({ a: '${B}', c: '${A}' }, env).missing).toEqual(['A', 'B']);
  });

  it('keeps secret-looking vars out of the hashable copy', () => {
    const { value, hashable } = interpolateEnv(
      { auth: 'Bearer ${OPENAI_API_KEY}', m: '${MODEL}' },
      env,
    );
    expect(value.auth).toBe('Bearer sk-secret');
    expect(hashable).toEqual({ auth: 'Bearer ${OPENAI_API_KEY}', m: 'gpt-x' });
  });
});
