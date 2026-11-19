import { describe, expect, it } from 'vitest';
import { RateLimiter } from './rate-limiter.js';

describe('RateLimiter', () => {
  it('spaces starts by 60s / rpm', async () => {
    const limiter = new RateLimiter(3000); // 20ms apart
    const started = performance.now();
    await Promise.all([limiter.take(), limiter.take(), limiter.take(), limiter.take()]);
    expect(performance.now() - started).toBeGreaterThanOrEqual(55);
  });

  it('is a no-op without an rpm', async () => {
    const started = performance.now();
    await Promise.all(Array.from({ length: 50 }, () => new RateLimiter(undefined).take()));
    expect(performance.now() - started).toBeLessThan(20);
  });
});
