import { InMemoryOcrRateLimiter } from '../src/ocr/rate-limiter';
import { OcrRateLimitError } from '../src/ocr/errors';

describe('InMemoryOcrRateLimiter', () => {
  it('isolates users and resets after its configured window', async () => {
    const limiter = new InMemoryOcrRateLimiter(2, 1000);
    const start = new Date('2026-01-01T00:00:00.000Z');

    await limiter.consume('user-a', start);
    await limiter.consume('user-a', new Date(start.getTime() + 200));
    await expect(limiter.consume('user-a', new Date(start.getTime() + 300))).rejects.toBeInstanceOf(
      OcrRateLimitError,
    );
    await expect(limiter.consume('user-b', new Date(start.getTime() + 300))).resolves.toBeUndefined();
    await expect(limiter.consume('user-a', new Date(start.getTime() + 1000))).resolves.toBeUndefined();
  });
});
