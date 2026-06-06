/**
 * Property Test: Price calculation is quantity times unit price in integer cents (Property 6)
 *
 * Validates: Requirements 2.2, 4.5
 *
 * For any valid quantity and unit price in cents, the calculated total price
 * SHALL equal `Math.round(quantity * unitPriceCents)`, producing an integer result.
 * When a package discount is applied, the result SHALL equal
 * `Math.round(quantity * unitPriceCents * (1 - discount / 100))`.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculatePurchasePrice } from '@shared/creditUtils';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * Generate a valid quantity: positive number between 1 and 100000,
 * with at most 2 decimal places.
 */
const validQuantity = fc.integer({ min: 100, max: 10000000 }).map(n => n / 100);

/**
 * Generate a valid unit price in integer cents (positive integer).
 * Range: 1 cent to 10,000,000 cents (R100,000 per ton max).
 */
const validUnitPriceCents = fc.integer({ min: 1, max: 10000000 });

/**
 * Generate a valid discount percentage: integer between 1 and 99.
 * Discounts of 0% or 100% are edge cases handled separately.
 */
const validDiscount = fc.integer({ min: 1, max: 99 });

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 6: Price calculation is quantity times unit price in integer cents', () => {
  /**
   * **Validates: Requirements 2.2, 4.5**
   * Without discount, result === Math.round(quantity * unitPriceCents)
   */
  it('without discount, result equals Math.round(quantity * unitPriceCents)', () => {
    fc.assert(
      fc.property(
        validQuantity,
        validUnitPriceCents,
        (quantity, unitPriceCents) => {
          const result = calculatePurchasePrice(quantity, unitPriceCents);
          const expected = Math.round(quantity * unitPriceCents);
          expect(result).toBe(expected);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 2.2, 4.5**
   * With discount, result === Math.round(quantity * unitPriceCents * (1 - discount/100))
   */
  it('with discount, result equals Math.round(quantity * unitPriceCents * (1 - discount/100))', () => {
    fc.assert(
      fc.property(
        validQuantity,
        validUnitPriceCents,
        validDiscount,
        (quantity, unitPriceCents, discount) => {
          const result = calculatePurchasePrice(quantity, unitPriceCents, discount);
          const expected = Math.round(quantity * unitPriceCents * (1 - discount / 100));
          expect(result).toBe(expected);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 2.2, 4.5**
   * Result is always a non-negative integer (no fractional cents, no negatives)
   */
  it('result is always a non-negative integer', () => {
    fc.assert(
      fc.property(
        validQuantity,
        validUnitPriceCents,
        fc.option(validDiscount, { nil: undefined }),
        (quantity, unitPriceCents, discount) => {
          const result = calculatePurchasePrice(quantity, unitPriceCents, discount);
          expect(Number.isInteger(result)).toBe(true);
          expect(result).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 2.2, 4.5**
   * Zero discount produces the same result as no discount
   */
  it('zero discount produces the same result as no discount', () => {
    fc.assert(
      fc.property(
        validQuantity,
        validUnitPriceCents,
        (quantity, unitPriceCents) => {
          const withoutDiscount = calculatePurchasePrice(quantity, unitPriceCents);
          const withZeroDiscount = calculatePurchasePrice(quantity, unitPriceCents, 0);
          expect(withZeroDiscount).toBe(withoutDiscount);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.2, 4.5**
   * Higher discount always produces a lower or equal price
   */
  it('higher discount always produces a lower or equal price', () => {
    fc.assert(
      fc.property(
        validQuantity,
        validUnitPriceCents,
        fc.integer({ min: 1, max: 49 }),
        (quantity, unitPriceCents, lowerDiscount) => {
          const higherDiscount = lowerDiscount + fc.sample(fc.integer({ min: 1, max: 50 }), 1)[0];
          const priceLow = calculatePurchasePrice(quantity, unitPriceCents, lowerDiscount);
          const priceHigh = calculatePurchasePrice(quantity, unitPriceCents, Math.min(higherDiscount, 99));
          expect(priceHigh).toBeLessThanOrEqual(priceLow);
        }
      ),
      { numRuns: 200 }
    );
  });
});
