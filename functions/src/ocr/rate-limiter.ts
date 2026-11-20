import { FieldValue, Firestore, Timestamp } from 'firebase-admin/firestore';

import {
  OCR_RATE_LIMIT_MAX_REQUESTS,
  OCR_RATE_LIMIT_WINDOW_MS,
  OcrRateLimiter,
} from './contracts';
import { OcrRateLimitError } from './errors';

interface PersistedRateLimitWindow {
  requestCount?: unknown;
  windowStartedAt?: unknown;
}

function isTimestamp(value: unknown): value is Timestamp {
  return value instanceof Timestamp;
}

/**
 * A per-UID, cross-instance limiter. It stores only a counter and expiry
 * metadata in a server-only collection; no prescription pixels or OCR text are
 * ever written to Firestore.
 */
export class FirestoreOcrRateLimiter implements OcrRateLimiter {
  public constructor(
    private readonly firestore: Firestore,
    private readonly maxRequests = OCR_RATE_LIMIT_MAX_REQUESTS,
    private readonly windowMs = OCR_RATE_LIMIT_WINDOW_MS,
  ) {}

  public async consume(uid: string, now: Date): Promise<void> {
    const reference = this.firestore.collection('_serverOcrRateLimits').doc(uid);
    const nowTimestamp = Timestamp.fromDate(now);
    const expiryTimestamp = Timestamp.fromMillis(now.getTime() + this.windowMs);

    await this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      const existing = snapshot.data() as PersistedRateLimitWindow | undefined;
      const existingStartedAt = existing?.windowStartedAt;
      const existingCount = existing?.requestCount;
      const windowStart = isTimestamp(existingStartedAt) ? existingStartedAt.toDate() : undefined;
      const count = typeof existingCount === 'number' && Number.isInteger(existingCount)
        ? existingCount
        : 0;
      const inActiveWindow =
        windowStart !== undefined && now.getTime() - windowStart.getTime() < this.windowMs;
      const nextCount = inActiveWindow ? count + 1 : 1;

      if (nextCount > this.maxRequests) {
        throw new OcrRateLimitError();
      }

      transaction.set(reference, {
        requestCount: nextCount,
        windowStartedAt: inActiveWindow ? existingStartedAt : nowTimestamp,
        updatedAt: FieldValue.serverTimestamp(),
        // Configure Firestore TTL on this field during a future backend-only
        // operations task if automatic cleanup is required by policy.
        expireAt: expiryTimestamp,
      });
    });
  }
}

/** A deterministic, non-persistent limiter used only by automated tests. */
export class InMemoryOcrRateLimiter implements OcrRateLimiter {
  private readonly windows = new Map<string, { count: number; startedAt: number }>();

  public constructor(
    private readonly maxRequests = OCR_RATE_LIMIT_MAX_REQUESTS,
    private readonly windowMs = OCR_RATE_LIMIT_WINDOW_MS,
  ) {}

  public async consume(uid: string, now: Date): Promise<void> {
    const current = this.windows.get(uid);
    const inActiveWindow =
      current !== undefined && now.getTime() - current.startedAt < this.windowMs;
    const next = inActiveWindow
      ? { count: current.count + 1, startedAt: current.startedAt }
      : { count: 1, startedAt: now.getTime() };

    if (next.count > this.maxRequests) {
      throw new OcrRateLimitError();
    }

    this.windows.set(uid, next);
  }
}
