/**
 * Property Test: Quantity validation (Property 5)
 *
 * **Validates: Requirements 2.1, 2.3**
 *
 * For any numeric input, the marketplace SHALL accept it as a valid quantity
 * if and only if it is positive, has at most two decimal places, and is
 * between 1 and 100000 (inclusive).
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { CreditPurchaseSchema } from '@shared/schemas';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a valid purchase input object wrapping a given quantity */
function buildPurchaseInput(quantity: number) {
  return {
    quantity,
    projectAllocations: [
      { projectId: 'proj-test-001', tonnage: Math.max(0.01, quantity) },
    ],
  };
}

/** Check if a number has at most 2 decimal places */
function hasAtMostTwoDecimals(n: number): boolean {
  return Number(n.toFixed(2)) === n;
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * Generate valid quantities: positive numbers between 1 and 100000
 * with at most 2 decimal places.
 */
const validQuantityArb = fc.integer({ min: 100, max: 10000000 }).map((n) => n / 100);

/**
 * Generate negative quantities (always invalid).
 */
const negativeQuantityArb = fc.double({ min: -100000, max: -0.01, noNaN: true }).map(
  (n) => Number(n.toFixed(2))
);

/**
 * Generate zero quantity (always invalid — minimum is 1).
 */
const zeroQuantityArb = fc.constant(0);

/**
 * Generate quantities with more than 2 decimal places (always invalid).
 * We generate integers from 1000 to 100000000 and divide by 1000 to get 3+ decimals.
 */
const tooManyDecimalsArb = fc
  .integer({ min: 1001, max: 99999999 })
  .filter((n) => n % 10 !== 0) // Ensure the last digit is non-zero so we actually have 3 decimals
  .map((n) => n / 1000);

/**
 * Generate quantities above the maximum bound (> 100000).
 */
const aboveMaxQuantityArb = fc.double({ min: 100000.01, max: 1000000, noNaN: true }).map(
  (n) => Number(n.toFixed(2))
);

/**
 * Generate quantities below the minimum bound (0 < qty < 1).
 */
const belowMinQuantityArb = fc.integer({ min: 1, max: 99 }).map((n) => n / 100);

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 5: Quantity validation accepts only positive values with at most two decimal places within bounds', () => {
  /**
   * **Validates: Requirements 2.1, 2.3**
   * Valid quantities (positive, ≤ 2 decimals, 1 ≤ qty ≤ 100000) must pass schema validation.
   */
  it('accepts valid quantities (positive, at most 2 decimal places, 1 ≤ qty ≤ 100000)', () => {
    fc.assert(
      fc.property(validQuantityArb, (quantity) => {
        const input = buildPurchaseInput(quantity);
        const result = CreditPurchaseSchema.safeParse(input);

        expect(result.success).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 2.1, 2.3**
   * Negative quantities must be rejected by the schema.
   */
  it('rejects negative quantities', () => {
    fc.assert(
      fc.property(negativeQuantityArb, (quantity) => {
        const input = buildPurchaseInput(quantity);
        const result = CreditPurchaseSchema.safeParse(input);

        expect(result.success).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.1, 2.3**
   * Zero quantity must be rejected by the schema (minimum is 1).
   */
  it('rejects zero quantity', () => {
    fc.assert(
      fc.property(zeroQuantityArb, (quantity) => {
        const input = buildPurchaseInput(quantity);
        const result = CreditPurchaseSchema.safeParse(input);

        expect(result.success).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.3**
   * Quantities with more than 2 decimal places must be rejected.
   */
  it('rejects quantities with more than 2 decimal places', () => {
    fc.assert(
      fc.property(tooManyDecimalsArb, (quantity) => {
        // Only test values that genuinely have > 2 decimal places
        if (hasAtMostTwoDecimals(quantity)) return; // skip if rounding made it 2 decimals

        const input = buildPurchaseInput(quantity);
        const result = CreditPurchaseSchema.safeParse(input);

        expect(result.success).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 2.1**
   * Quantities exceeding the maximum (100000) must be rejected.
   */
  it('rejects quantities above maximum bound (> 100000)', () => {
    fc.assert(
      fc.property(aboveMaxQuantityArb, (quantity) => {
        const input = buildPurchaseInput(quantity);
        const result = CreditPurchaseSchema.safeParse(input);

        expect(result.success).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.1**
   * Quantities below the minimum (< 1) must be rejected.
   */
  it('rejects quantities below minimum bound (< 1)', () => {
    fc.assert(
      fc.property(belowMinQuantityArb, (quantity) => {
        const input = buildPurchaseInput(quantity);
        const result = CreditPurchaseSchema.safeParse(input);

        expect(result.success).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});
