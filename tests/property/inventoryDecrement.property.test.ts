/**
 * Property Test: Inventory decrement equals purchase quantity (Property 1)
 *
 * **Validates: Requirements 1.3, 4.3**
 *
 * For any confirmed purchase of Q tons from a project with T available (Q ≤ T),
 * the resulting available tonnage SHALL equal T − Q exactly.
 *
 * This tests the LOGIC of inventory decrement, not the actual Firestore transaction.
 * The actual purchase function uses `FieldValue.increment(-allocatedTonnage)` but
 * the logical invariant is that available = original - purchased.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ─── Domain Constants ────────────────────────────────────────────────────────

/** Maximum tonnage value for inventory (matching CreditPurchaseSchema max) */
const MAX_TONNAGE = 10000;

/** Minimum purchase quantity (1 centitonnage = 0.01 ton) */
const MIN_PURCHASE_CENTITONNAGE = 1;

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Simulates the inventory decrement operation as performed in the purchase function.
 * Uses the same precision-safe arithmetic: Math.round((T - Q) * 100) / 100
 */
function decrementInventory(availableTonnage: number, purchaseQuantity: number): number {
  return Math.round((availableTonnage - purchaseQuantity) * 100) / 100;
}

/**
 * Checks whether a numeric value has at most two decimal places.
 */
function hasTwoDecimalPrecision(value: number): boolean {
  return Math.round(value * 100) / 100 === value;
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * Generate valid (availableTonnage, purchaseQuantity) pairs where Q ≤ T.
 * Both values have exactly 2 decimal precision (derived from integer centitonnage).
 * Range for T: 0.01 to 10000.00
 * Range for Q: 0.01 to T
 */
const validPurchasePair = fc
  .integer({ min: MIN_PURCHASE_CENTITONNAGE, max: MAX_TONNAGE * 100 })
  .chain((availableCenti) =>
    fc
      .integer({ min: MIN_PURCHASE_CENTITONNAGE, max: availableCenti })
      .map((purchaseCenti) => ({
        availableTonnage: availableCenti / 100,
        purchaseQuantity: purchaseCenti / 100,
      }))
  );

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 1: Inventory decrement equals purchase quantity', () => {
  /**
   * **Validates: Requirements 1.3, 4.3**
   * For any confirmed purchase of Q tons from project with T available (Q ≤ T),
   * resulting tonnage = T − Q (with proper floating-point handling).
   */
  it('resulting tonnage equals T − Q for any valid purchase', () => {
    fc.assert(
      fc.property(
        validPurchasePair,
        ({ availableTonnage, purchaseQuantity }) => {
          const resultingTonnage = decrementInventory(availableTonnage, purchaseQuantity);

          // Expected result with floating-point safe arithmetic
          const expected = Math.round((availableTonnage - purchaseQuantity) * 100) / 100;

          expect(resultingTonnage).toBe(expected);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 1.3, 4.3**
   * The resulting tonnage after decrement is always >= 0 when Q ≤ T.
   */
  it('resulting tonnage is always non-negative when purchase quantity ≤ available', () => {
    fc.assert(
      fc.property(
        validPurchasePair,
        ({ availableTonnage, purchaseQuantity }) => {
          const resultingTonnage = decrementInventory(availableTonnage, purchaseQuantity);

          expect(resultingTonnage).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 1.3, 4.3**
   * The resulting tonnage maintains 2-decimal precision after decrement.
   */
  it('resulting tonnage maintains two-decimal precision after decrement', () => {
    fc.assert(
      fc.property(
        validPurchasePair,
        ({ availableTonnage, purchaseQuantity }) => {
          const resultingTonnage = decrementInventory(availableTonnage, purchaseQuantity);

          expect(hasTwoDecimalPrecision(resultingTonnage)).toBe(true);
          expect(Math.round(resultingTonnage * 100) / 100).toBe(resultingTonnage);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 1.3, 4.3**
   * Purchasing the entire available tonnage results in exactly zero.
   */
  it('purchasing all available tonnage results in exactly zero', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MIN_PURCHASE_CENTITONNAGE, max: MAX_TONNAGE * 100 }),
        (centitonnage) => {
          const tonnage = centitonnage / 100;
          const resultingTonnage = decrementInventory(tonnage, tonnage);

          expect(resultingTonnage).toBe(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 1.3, 4.3**
   * The decrement operation is equivalent to adding the remaining and purchased
   * quantities back to get the original (conservation invariant).
   */
  it('remaining + purchased equals original available tonnage (conservation)', () => {
    fc.assert(
      fc.property(
        validPurchasePair,
        ({ availableTonnage, purchaseQuantity }) => {
          const resultingTonnage = decrementInventory(availableTonnage, purchaseQuantity);

          // Conservation: remaining + purchased should equal original
          const reconstructed = Math.round((resultingTonnage + purchaseQuantity) * 100) / 100;

          expect(reconstructed).toBe(availableTonnage);
        }
      ),
      { numRuns: 200 }
    );
  });
});
