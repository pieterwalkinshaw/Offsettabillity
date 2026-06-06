/**
 * Property Test: Total offset aggregation equals sum of confirmed purchase tonnages (Property 14)
 *
 * **Validates: Requirements 6.1**
 *
 * For any funder with a set of purchaseTransactions, the sustainability dashboard's
 * total CO₂e offset SHALL equal the sum of `quantity` across all transactions with
 * `status === 'confirmed'`.
 *
 * This tests the pure aggregation logic used in the sustainability dashboard to
 * compute total offset from a set of purchase transactions.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ─── Domain Constants ────────────────────────────────────────────────────────

/** Valid purchase transaction statuses */
const TRANSACTION_STATUSES = ['pending', 'confirmed', 'failed', 'refunded'] as const;
type PurchaseTransactionStatus = (typeof TRANSACTION_STATUSES)[number];

/** Maximum tonnage per transaction */
const MAX_TONNAGE = 10000;

// ─── Types ───────────────────────────────────────────────────────────────────

interface PurchaseTransaction {
  transactionId: string;
  funderId: string;
  quantity: number;
  unitPriceCents: number;
  totalAmountCents: number;
  currency: string;
  status: PurchaseTransactionStatus;
  packageId?: string;
  projectAllocations: { projectId: string; projectTitle: string; tonnage: number }[];
  createdAt: string;
  updatedAt: string;
}

// ─── Aggregation Function Under Test ─────────────────────────────────────────

/**
 * Computes the total CO₂e offset from a set of purchase transactions.
 * Mirrors the sustainability dashboard logic:
 *   1. Filter transactions where status === 'confirmed'
 *   2. Sum all quantity values from confirmed transactions
 */
function calculateTotalOffset(transactions: PurchaseTransaction[]): number {
  return transactions
    .filter((t) => t.status === 'confirmed')
    .reduce((sum, t) => sum + t.quantity, 0);
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * Generate a purchase transaction with a specific status and quantity.
 */
const purchaseTransactionArb = (
  status: PurchaseTransactionStatus,
  quantityCenti: number
): fc.Arbitrary<PurchaseTransaction> => {
  const quantity = quantityCenti / 100;
  return fc.record({
    transactionId: fc.uuid(),
    funderId: fc.uuid(),
    quantity: fc.constant(quantity),
    unitPriceCents: fc.integer({ min: 100, max: 10000000 }),
    totalAmountCents: fc.constant(Math.round(quantity * 15000)),
    currency: fc.constant('ZAR'),
    status: fc.constant(status),
    packageId: fc.option(fc.uuid(), { nil: undefined }),
    projectAllocations: fc.constant([
      { projectId: 'proj-1', projectTitle: 'Solar Project', tonnage: quantity },
    ]),
    createdAt: fc.constant('2025-01-15T10:00:00Z'),
    updatedAt: fc.constant('2025-01-15T10:00:00Z'),
  });
};

/**
 * Generate a purchase transaction with a random status and positive quantity.
 */
const randomTransactionArb: fc.Arbitrary<PurchaseTransaction> = fc
  .tuple(
    fc.constantFrom(...TRANSACTION_STATUSES),
    fc.integer({ min: 1, max: MAX_TONNAGE * 100 })
  )
  .chain(([status, quantityCenti]) => purchaseTransactionArb(status, quantityCenti));

/**
 * Generate an array of transactions with mixed statuses.
 */
const transactionArrayArb = fc.array(randomTransactionArb, { minLength: 0, maxLength: 50 });

/**
 * Generate an array that contains at least one confirmed transaction.
 */
const arrayWithConfirmedArb = fc
  .tuple(
    fc.array(randomTransactionArb, { minLength: 0, maxLength: 25 }),
    fc.array(
      fc.integer({ min: 1, max: MAX_TONNAGE * 100 }).chain((centi) =>
        purchaseTransactionArb('confirmed', centi)
      ),
      { minLength: 1, maxLength: 10 }
    )
  )
  .map(([mixed, confirmed]) => [...mixed, ...confirmed]);

/**
 * Generate an array with ONLY non-confirmed transactions.
 */
const nonConfirmedArrayArb = fc.array(
  fc
    .tuple(
      fc.constantFrom('pending' as const, 'failed' as const, 'refunded' as const),
      fc.integer({ min: 1, max: MAX_TONNAGE * 100 })
    )
    .chain(([status, centi]) => purchaseTransactionArb(status, centi)),
  { minLength: 1, maxLength: 50 }
);

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 14: Total offset aggregation equals sum of confirmed purchase tonnages', () => {
  /**
   * **Validates: Requirements 6.1**
   * Total CO₂e equals the sum of `quantity` across all `status === 'confirmed'` transactions.
   */
  it('total offset equals sum of quantities from confirmed-only transactions', () => {
    fc.assert(
      fc.property(
        transactionArrayArb,
        (transactions) => {
          const totalOffset = calculateTotalOffset(transactions);

          // Manually compute expected sum of confirmed quantities
          const expected = transactions
            .filter((t) => t.status === 'confirmed')
            .reduce((sum, t) => sum + t.quantity, 0);

          expect(totalOffset).toBeCloseTo(expected, 10);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 6.1**
   * Non-confirmed transactions (pending, failed, refunded) do not contribute to the total offset.
   */
  it('non-confirmed transactions do not contribute to total offset', () => {
    fc.assert(
      fc.property(
        nonConfirmedArrayArb,
        (transactions) => {
          const totalOffset = calculateTotalOffset(transactions);

          // All transactions are non-confirmed, so total should be 0
          expect(totalOffset).toBe(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 6.1**
   * An empty transaction array results in a total offset of exactly 0.
   */
  it('empty transaction array produces total offset of zero', () => {
    fc.assert(
      fc.property(
        fc.constant([] as PurchaseTransaction[]),
        (transactions) => {
          const totalOffset = calculateTotalOffset(transactions);
          expect(totalOffset).toBe(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 6.1**
   * The total offset is always non-negative (since quantities are positive).
   */
  it('total offset is always non-negative', () => {
    fc.assert(
      fc.property(
        transactionArrayArb,
        (transactions) => {
          const totalOffset = calculateTotalOffset(transactions);
          expect(totalOffset).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 6.1**
   * Adding a confirmed transaction increases the total by exactly its quantity.
   */
  it('adding a confirmed transaction increases total by its quantity', () => {
    fc.assert(
      fc.property(
        transactionArrayArb,
        fc.integer({ min: 1, max: MAX_TONNAGE * 100 }).chain((centi) =>
          purchaseTransactionArb('confirmed', centi)
        ),
        (transactions, newConfirmed) => {
          const totalBefore = calculateTotalOffset(transactions);
          const totalAfter = calculateTotalOffset([...transactions, newConfirmed]);

          expect(totalAfter).toBeCloseTo(totalBefore + newConfirmed.quantity, 10);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 6.1**
   * Adding a non-confirmed transaction does not change the total offset.
   */
  it('adding a non-confirmed transaction does not change total offset', () => {
    fc.assert(
      fc.property(
        arrayWithConfirmedArb,
        fc
          .tuple(
            fc.constantFrom('pending' as const, 'failed' as const, 'refunded' as const),
            fc.integer({ min: 1, max: MAX_TONNAGE * 100 })
          )
          .chain(([status, centi]) => purchaseTransactionArb(status, centi)),
        (transactions, nonConfirmed) => {
          const totalBefore = calculateTotalOffset(transactions);
          const totalAfter = calculateTotalOffset([...transactions, nonConfirmed]);

          expect(totalAfter).toBeCloseTo(totalBefore, 10);
        }
      ),
      { numRuns: 200 }
    );
  });
});
