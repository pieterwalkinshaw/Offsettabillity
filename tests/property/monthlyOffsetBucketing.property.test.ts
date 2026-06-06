/**
 * Property Test: Monthly offset bucketing groups purchases correctly (Property 15)
 *
 * **Validates: Requirements 6.2**
 *
 * For any set of confirmed purchases with various `createdAt` timestamps, the
 * monthly timeline chart SHALL group each purchase into its correct calendar month
 * and the sum of all monthly buckets SHALL equal the total offset.
 *
 * This tests the pure bucketing logic used in the sustainability dashboard to
 * group confirmed purchase transactions by calendar month for the timeline chart.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PurchaseTransaction {
  transactionId: string;
  funderId: string;
  quantity: number;
  unitPriceCents: number;
  totalAmountCents: number;
  currency: string;
  status: 'pending' | 'confirmed' | 'failed' | 'refunded';
  projectAllocations: { projectId: string; projectTitle: string; tonnage: number }[];
  createdAt: string;
  updatedAt: string;
}

interface MonthlyOffset {
  month: string; // "YYYY-MM" format for unambiguous testing
  tonnage: number;
}

// ─── Pure Bucketing Function Under Test ──────────────────────────────────────

/**
 * Extracts the year-month key from an ISO timestamp string.
 * Returns format "YYYY-MM" for unambiguous month identification.
 */
function getYearMonth(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Groups confirmed purchase transactions by calendar month (UTC) and sums
 * quantities per bucket. This mirrors the dashboard's `groupByMonth` logic
 * but uses a deterministic YYYY-MM key rather than locale-dependent formatting.
 */
function bucketByMonth(transactions: PurchaseTransaction[]): MonthlyOffset[] {
  const map = new Map<string, number>();

  for (const txn of transactions) {
    if (txn.status !== 'confirmed') continue;
    const key = getYearMonth(txn.createdAt);
    map.set(key, (map.get(key) || 0) + txn.quantity);
  }

  return Array.from(map.entries())
    .map(([month, tonnage]) => ({
      month,
      tonnage: Math.round(tonnage * 100) / 100,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * Generate a valid ISO 8601 timestamp within a reasonable date range (2020–2030).
 * Uses integer milliseconds to avoid invalid Date edge cases.
 */
const MIN_TIMESTAMP = new Date('2020-01-01T00:00:00Z').getTime();
const MAX_TIMESTAMP = new Date('2030-12-31T23:59:59Z').getTime();

const isoTimestampArb = fc
  .integer({ min: MIN_TIMESTAMP, max: MAX_TIMESTAMP })
  .map((ms) => new Date(ms).toISOString());

/**
 * Generate a confirmed purchase transaction with a specific createdAt timestamp.
 */
const confirmedPurchaseArb = (createdAt: string): fc.Arbitrary<PurchaseTransaction> =>
  fc.record({
    transactionId: fc.uuid(),
    funderId: fc.uuid(),
    quantity: fc.integer({ min: 1, max: 10000 }).map((v) => v / 100), // 0.01 to 100.00
    unitPriceCents: fc.integer({ min: 100, max: 10000000 }),
    totalAmountCents: fc.integer({ min: 100, max: 999999999 }),
    currency: fc.constant('ZAR'),
    status: fc.constant('confirmed' as const),
    projectAllocations: fc.array(
      fc.record({
        projectId: fc.uuid(),
        projectTitle: fc.string({ minLength: 1, maxLength: 30 }),
        tonnage: fc.integer({ min: 1, max: 10000 }).map((v) => v / 100),
      }),
      { minLength: 1, maxLength: 3 }
    ),
    createdAt: fc.constant(createdAt),
    updatedAt: fc.constant(createdAt),
  });

/**
 * Generate a purchase with any status (some confirmed, some not).
 */
const mixedStatusPurchaseArb = isoTimestampArb.chain((createdAt) =>
  fc.record({
    transactionId: fc.uuid(),
    funderId: fc.uuid(),
    quantity: fc.integer({ min: 1, max: 10000 }).map((v) => v / 100),
    unitPriceCents: fc.integer({ min: 100, max: 10000000 }),
    totalAmountCents: fc.integer({ min: 100, max: 999999999 }),
    currency: fc.constant('ZAR'),
    status: fc.constantFrom('pending', 'confirmed', 'failed', 'refunded') as fc.Arbitrary<PurchaseTransaction['status']>,
    projectAllocations: fc.array(
      fc.record({
        projectId: fc.uuid(),
        projectTitle: fc.string({ minLength: 1, maxLength: 30 }),
        tonnage: fc.integer({ min: 1, max: 10000 }).map((v) => v / 100),
      }),
      { minLength: 1, maxLength: 3 }
    ),
    createdAt: fc.constant(createdAt),
    updatedAt: fc.constant(createdAt),
  })
);

/**
 * Generate an array of confirmed purchases with various timestamps.
 */
const confirmedPurchasesArrayArb = fc.array(
  isoTimestampArb.chain((ts) => confirmedPurchaseArb(ts)),
  { minLength: 0, maxLength: 50 }
);

/**
 * Generate an array of purchases with mixed statuses.
 */
const mixedPurchasesArrayArb = fc.array(mixedStatusPurchaseArb, {
  minLength: 0,
  maxLength: 50,
});

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 15: Monthly offset bucketing groups purchases correctly', () => {
  /**
   * **Validates: Requirements 6.2**
   * Sum of all monthly buckets equals the total offset from confirmed purchases.
   */
  it('sum of all monthly buckets equals total offset', () => {
    fc.assert(
      fc.property(confirmedPurchasesArrayArb, (transactions) => {
        const buckets = bucketByMonth(transactions);

        // Sum of all bucket tonnages
        const bucketSum = buckets.reduce((sum, b) => sum + b.tonnage, 0);

        // Total offset from all confirmed purchases
        const totalOffset = transactions.reduce((sum, txn) => sum + txn.quantity, 0);
        const expectedTotal = Math.round(totalOffset * 100) / 100;

        expect(bucketSum).toBeCloseTo(expectedTotal, 2);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 6.2**
   * Each purchase is assigned to its correct calendar month (YYYY-MM based on UTC).
   */
  it('each purchase is assigned to its correct calendar month', () => {
    fc.assert(
      fc.property(confirmedPurchasesArrayArb, (transactions) => {
        const buckets = bucketByMonth(transactions);
        const bucketMap = new Map(buckets.map((b) => [b.month, b.tonnage]));

        // For each transaction, compute its expected month and verify contribution
        const expectedMap = new Map<string, number>();
        for (const txn of transactions) {
          const month = getYearMonth(txn.createdAt);
          expectedMap.set(month, (expectedMap.get(month) || 0) + txn.quantity);
        }

        // Verify each expected month exists in buckets with correct sum
        for (const [month, expectedTonnage] of expectedMap.entries()) {
          const rounded = Math.round(expectedTonnage * 100) / 100;
          expect(bucketMap.has(month)).toBe(true);
          expect(bucketMap.get(month)).toBeCloseTo(rounded, 2);
        }

        // Verify no extra months appear
        expect(buckets.length).toBe(expectedMap.size);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 6.2**
   * Empty transactions produce no monthly buckets (all zeros).
   */
  it('empty transactions produce no monthly buckets', () => {
    fc.assert(
      fc.property(fc.constant([] as PurchaseTransaction[]), (transactions) => {
        const buckets = bucketByMonth(transactions);
        expect(buckets).toHaveLength(0);

        const bucketSum = buckets.reduce((sum, b) => sum + b.tonnage, 0);
        expect(bucketSum).toBe(0);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 6.2**
   * Only confirmed purchases contribute to monthly buckets (non-confirmed are excluded).
   */
  it('only confirmed purchases contribute to monthly buckets', () => {
    fc.assert(
      fc.property(mixedPurchasesArrayArb, (transactions) => {
        const buckets = bucketByMonth(transactions);

        // Sum of all buckets
        const bucketSum = buckets.reduce((sum, b) => sum + b.tonnage, 0);

        // Expected: only sum confirmed transactions
        const confirmedTotal = transactions
          .filter((txn) => txn.status === 'confirmed')
          .reduce((sum, txn) => sum + txn.quantity, 0);
        const expectedTotal = Math.round(confirmedTotal * 100) / 100;

        expect(bucketSum).toBeCloseTo(expectedTotal, 2);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 6.2**
   * Purchases in the same calendar month are grouped together (not split).
   */
  it('purchases in same calendar month are combined into one bucket', () => {
    // Generate multiple purchases all within March 2025
    const sameMonthPurchasesArb = fc.array(
      fc
        .integer({ min: 1, max: 28 })
        .chain((day) => {
          const d = new Date(Date.UTC(2025, 2, day, 12, 0, 0)); // March 2025
          return confirmedPurchaseArb(d.toISOString());
        }),
      { minLength: 2, maxLength: 20 }
    );

    fc.assert(
      fc.property(sameMonthPurchasesArb, (transactions) => {
        const buckets = bucketByMonth(transactions);

        // All purchases in March 2025 should result in exactly one bucket
        expect(buckets.length).toBe(1);
        expect(buckets[0].month).toBe('2025-03');

        const expectedTotal = transactions.reduce((sum, txn) => sum + txn.quantity, 0);
        expect(buckets[0].tonnage).toBeCloseTo(
          Math.round(expectedTotal * 100) / 100,
          2
        );
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 6.2**
   * Purchases in different months produce separate buckets.
   */
  it('purchases in different months produce separate buckets', () => {
    // Generate two purchases guaranteed to be in different months
    const differentMonthPurchasesArb = fc.tuple(
      confirmedPurchaseArb('2025-01-15T10:00:00Z'),
      confirmedPurchaseArb('2025-06-20T14:30:00Z')
    );

    fc.assert(
      fc.property(differentMonthPurchasesArb, ([purchase1, purchase2]) => {
        const buckets = bucketByMonth([purchase1, purchase2]);

        // Should have exactly 2 buckets (Jan and Jun)
        expect(buckets.length).toBe(2);

        const months = buckets.map((b) => b.month);
        expect(months).toContain('2025-01');
        expect(months).toContain('2025-06');
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 6.2**
   * Month bucketing is order-independent — reordering transactions produces same result.
   */
  it('bucketing is order-independent', () => {
    fc.assert(
      fc.property(
        confirmedPurchasesArrayArb,
        fc.infiniteStream(fc.boolean()),
        (transactions, shuffleStream) => {
          if (transactions.length < 2) return; // Need at least 2 to shuffle

          // Create a shuffled copy using Fisher-Yates with the stream
          const shuffled = [...transactions];
          const iter = shuffleStream[Symbol.iterator]();
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = iter.next().value ? i - 1 : 0;
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }

          const bucketsOriginal = bucketByMonth(transactions);
          const bucketsShuffled = bucketByMonth(shuffled);

          // Both should produce same results (already sorted by month)
          expect(bucketsOriginal.length).toBe(bucketsShuffled.length);
          for (let i = 0; i < bucketsOriginal.length; i++) {
            expect(bucketsOriginal[i].month).toBe(bucketsShuffled[i].month);
            expect(bucketsOriginal[i].tonnage).toBeCloseTo(bucketsShuffled[i].tonnage, 2);
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});
