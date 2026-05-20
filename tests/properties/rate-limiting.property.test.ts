/**
 * Property Test: Rate limiting on lead capture (Property 23)
 *
 * Validates: Requirements 6.11, 13.6, 13.7
 *
 * For any IP address that has submitted more than 5 lead requests within a
 * 60-second sliding window, subsequent submissions from that IP SHALL be
 * rejected with a RATE_LIMITED error until the window expires.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ─── Constants ───────────────────────────────────────────────────────────────

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000; // 60 seconds

// ─── Types ───────────────────────────────────────────────────────────────────

interface Submission {
  ip: string;
  timestamp: number;
}

interface RateLimitResult {
  allowed: boolean;
  error?: 'RATE_LIMITED';
}

// ─── Helper: Rate Limit Checker ──────────────────────────────────────────────

/**
 * Check whether a submission from `currentIp` at `currentTimestamp` should be
 * allowed or rejected based on the sliding window rate limit.
 *
 * Looks at all prior submissions from the same IP within the 60-second window
 * preceding `currentTimestamp`. If there are already 5 or more, the submission
 * is rejected with RATE_LIMITED.
 */
function checkRateLimit(
  submissions: Submission[],
  currentIp: string,
  currentTimestamp: number
): RateLimitResult {
  const windowStart = currentTimestamp - RATE_LIMIT_WINDOW_MS;

  // Count submissions from the same IP within the sliding window
  const recentCount = submissions.filter(
    (s) => s.ip === currentIp && s.timestamp > windowStart && s.timestamp <= currentTimestamp
  ).length;

  if (recentCount >= RATE_LIMIT_MAX) {
    return { allowed: false, error: 'RATE_LIMITED' };
  }

  return { allowed: true };
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate a valid IPv4 address */
const ipAddress = fc.tuple(
  fc.integer({ min: 1, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 })
).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

/** Generate a base timestamp (recent epoch ms) */
const baseTimestamp = fc.integer({ min: 1700000000000, max: 1800000000000 });

/** Generate a small time offset within the rate limit window (0 to 59999ms) */
const withinWindowOffset = fc.integer({ min: 0, max: RATE_LIMIT_WINDOW_MS - 1 });

/** Generate a time offset that exceeds the rate limit window (60001ms+) */
const beyondWindowOffset = fc.integer({ min: RATE_LIMIT_WINDOW_MS + 1, max: RATE_LIMIT_WINDOW_MS * 3 });

/** Generate a sequence of timestamps within a window from a base time */
const timestampsWithinWindow = (base: number, count: number) =>
  fc.array(
    fc.integer({ min: 0, max: RATE_LIMIT_WINDOW_MS - 1 }).map((offset) => base + offset),
    { minLength: count, maxLength: count }
  );

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 23: Rate limiting on lead capture', () => {
  /**
   * **Validates: Requirements 6.11, 13.6**
   * First 5 submissions from any IP within 60s are allowed.
   */
  it('first 5 submissions from any IP within 60s window are allowed', () => {
    fc.assert(
      fc.property(
        ipAddress,
        baseTimestamp,
        fc.array(withinWindowOffset, { minLength: 5, maxLength: 5 }),
        (ip, base, offsets) => {
          // Sort offsets to simulate chronological submissions
          const sortedOffsets = [...offsets].sort((a, b) => a - b);
          const submissions: Submission[] = [];

          for (let i = 0; i < 5; i++) {
            const timestamp = base + sortedOffsets[i];
            const result = checkRateLimit(submissions, ip, timestamp);
            expect(result.allowed).toBe(true);
            expect(result.error).toBeUndefined();
            // Record the submission (it was allowed)
            submissions.push({ ip, timestamp });
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 6.11, 13.6, 13.7**
   * 6th+ submission from same IP within 60s is rejected with RATE_LIMITED.
   */
  it('6th+ submission from same IP within 60s is rejected with RATE_LIMITED', () => {
    fc.assert(
      fc.property(
        ipAddress,
        baseTimestamp,
        fc.array(withinWindowOffset, { minLength: 6, maxLength: 10 }),
        (ip, base, offsets) => {
          const sortedOffsets = [...offsets].sort((a, b) => a - b);
          const submissions: Submission[] = [];

          for (let i = 0; i < sortedOffsets.length; i++) {
            const timestamp = base + sortedOffsets[i];
            const result = checkRateLimit(submissions, ip, timestamp);

            if (i < RATE_LIMIT_MAX) {
              // First 5 should be allowed
              expect(result.allowed).toBe(true);
              expect(result.error).toBeUndefined();
              submissions.push({ ip, timestamp });
            } else {
              // 6th+ should be rejected
              expect(result.allowed).toBe(false);
              expect(result.error).toBe('RATE_LIMITED');
              // Rejected submissions are NOT recorded (they don't count)
            }
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 6.11, 13.6**
   * Submissions from different IPs don't affect each other.
   */
  it('submissions from different IPs do not affect each other', () => {
    fc.assert(
      fc.property(
        fc.array(ipAddress, { minLength: 2, maxLength: 5 }).filter(
          // Ensure all IPs are unique
          (ips) => new Set(ips).size === ips.length
        ),
        baseTimestamp,
        (ips, base) => {
          const submissions: Submission[] = [];

          // Each IP submits 5 times (all within window)
          for (const ip of ips) {
            for (let i = 0; i < RATE_LIMIT_MAX; i++) {
              const timestamp = base + i * 1000; // 1 second apart
              const result = checkRateLimit(submissions, ip, timestamp);
              expect(result.allowed).toBe(true);
              submissions.push({ ip, timestamp });
            }
          }

          // Now the 6th submission from the first IP should be rejected
          const result6th = checkRateLimit(submissions, ips[0], base + 5000);
          expect(result6th.allowed).toBe(false);
          expect(result6th.error).toBe('RATE_LIMITED');

          // But a new IP (not in the list) should still be allowed
          const freshIp = '10.10.10.10';
          const freshResult = checkRateLimit(submissions, freshIp, base + 5000);
          expect(freshResult.allowed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 6.11, 13.7**
   * After 60s window expires, the IP can submit again.
   */
  it('after 60s window expires, the IP can submit again', () => {
    fc.assert(
      fc.property(
        ipAddress,
        baseTimestamp,
        beyondWindowOffset,
        (ip, base, extraOffset) => {
          // Fill up the rate limit with 5 submissions
          const submissions: Submission[] = [];
          for (let i = 0; i < RATE_LIMIT_MAX; i++) {
            submissions.push({ ip, timestamp: base + i * 100 });
          }

          // Verify 6th is rejected within window
          const rejectedResult = checkRateLimit(submissions, ip, base + 50000);
          expect(rejectedResult.allowed).toBe(false);
          expect(rejectedResult.error).toBe('RATE_LIMITED');

          // After the window expires, submission should be allowed again
          const expiredTimestamp = base + RATE_LIMIT_WINDOW_MS + extraOffset;
          const allowedResult = checkRateLimit(submissions, ip, expiredTimestamp);
          expect(allowedResult.allowed).toBe(true);
          expect(allowedResult.error).toBeUndefined();
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 6.11, 13.6**
   * The window is sliding (based on individual submission timestamps, not fixed intervals).
   * Submissions that fall outside the window due to time passing are no longer counted.
   */
  it('sliding window correctly expires old submissions individually', () => {
    fc.assert(
      fc.property(
        ipAddress,
        baseTimestamp,
        (ip, base) => {
          const submissions: Submission[] = [];

          // Submit 3 requests at base time
          for (let i = 0; i < 3; i++) {
            submissions.push({ ip, timestamp: base + i * 100 });
          }

          // Submit 2 more requests at base + 40s (still within window of first 3)
          for (let i = 0; i < 2; i++) {
            submissions.push({ ip, timestamp: base + 40000 + i * 100 });
          }

          // At base + 40200, we have 5 submissions in window — 6th should be rejected
          const rejectedResult = checkRateLimit(submissions, ip, base + 40200);
          expect(rejectedResult.allowed).toBe(false);
          expect(rejectedResult.error).toBe('RATE_LIMITED');

          // At base + 60500, the first 3 submissions (at base+0, base+100, base+200)
          // have expired from the window. Only the 2 at base+40000 and base+40100 remain.
          // So a new submission should be allowed.
          const afterPartialExpiry = base + RATE_LIMIT_WINDOW_MS + 300;
          const allowedResult = checkRateLimit(submissions, ip, afterPartialExpiry);
          expect(allowedResult.allowed).toBe(true);
          expect(allowedResult.error).toBeUndefined();

          // Add that allowed submission
          submissions.push({ ip, timestamp: afterPartialExpiry });

          // We can add more until we hit 5 again within the new window
          // The 2 submissions at base+40000 and base+40100 are still in window
          // Plus the one we just added = 3 total. We can add 2 more.
          const nextTimestamp = afterPartialExpiry + 100;
          const result2 = checkRateLimit(submissions, ip, nextTimestamp);
          expect(result2.allowed).toBe(true);
          submissions.push({ ip, timestamp: nextTimestamp });

          const nextTimestamp2 = afterPartialExpiry + 200;
          const result3 = checkRateLimit(submissions, ip, nextTimestamp2);
          expect(result3.allowed).toBe(true);
          submissions.push({ ip, timestamp: nextTimestamp2 });

          // Now we have 5 in the window — 6th should be rejected
          const nextTimestamp3 = afterPartialExpiry + 300;
          const result4 = checkRateLimit(submissions, ip, nextTimestamp3);
          expect(result4.allowed).toBe(false);
          expect(result4.error).toBe('RATE_LIMITED');
        }
      ),
      { numRuns: 100 }
    );
  });
});
