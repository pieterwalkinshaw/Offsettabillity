/**
 * Property Test: Package discount calculation is consistent (Property 8)
 *
 * **Validates: Requirements 3.2**
 *
 * For any credit package with a tonnage and priceCents, the displayed discount
 * percentage SHALL equal `Math.round((1 - priceCents / (tonnage * unitPriceCents)) * 100)`
 * relative to the standard per-ton price.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculatePurchasePrice } from '@shared/creditUtils';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate a valid tonnage value (1-500 tons) */
const tonnageArb = fc.integer({ min: 1, max: 500 });

/** Generate a valid unit price in cents (1000-50000 cents per ton) */
const unitPriceCentsArb = fc.integer({ min: 1000, max: 50000 });

/** Generate a valid discount percentage (1-50%) */
const discountPercentageArb = fc.integer({ min: 1, max: 50 });

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 8: Package discount calculation is consistent', () => {
  /**
   * **Validates: Requirements 3.2**
   * The discount percentage derived from priceCents matches the original discount percentage
   * used to calculate that priceCents.
   *
   * Given: tonnage, unitPriceCents, discountPercentage
   * Calculate: priceCents = calculatePurchasePrice(tonnage, unitPriceCents, discountPercentage)
   * Verify: Math.round((1 - priceCents / (tonnage * unitPriceCents)) * 100) === discountPercentage
   */
  it('discount percentage derived from priceCents equals original discount percentage', () => {
    fc.assert(
      fc.property(
        tonnageArb,
        unitPriceCentsArb,
        discountPercentageArb,
        (tonnage, unitPriceCents, discountPercentage) => {
          // Calculate priceCents using the utility function with the discount
          const priceCents = calculatePurchasePrice(tonnage, unitPriceCents, discountPercentage);

          // Derive the discount percentage back from priceCents
          const derivedDiscount = Math.round(
            (1 - priceCents / (tonnage * unitPriceCents)) * 100
          );

          // The derived discount should equal the original discount percentage
          expect(derivedDiscount).toBe(discountPercentage);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 3.2**
   * calculatePurchasePrice with a discount produces the expected discounted price in integer cents.
   *
   * The expected priceCents = Math.round(tonnage * unitPriceCents * (1 - discountPercentage / 100))
   */
  it('calculatePurchasePrice produces expected discounted price in integer cents', () => {
    fc.assert(
      fc.property(
        tonnageArb,
        unitPriceCentsArb,
        discountPercentageArb,
        (tonnage, unitPriceCents, discountPercentage) => {
          const priceCents = calculatePurchasePrice(tonnage, unitPriceCents, discountPercentage);

          // Expected calculation
          const expectedPriceCents = Math.round(
            tonnage * unitPriceCents * (1 - discountPercentage / 100)
          );

          expect(priceCents).toBe(expectedPriceCents);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 3.2**
   * Package price with discount is always less than the undiscounted price.
   */
  it('discounted package price is always less than undiscounted price', () => {
    fc.assert(
      fc.property(
        tonnageArb,
        unitPriceCentsArb,
        discountPercentageArb,
        (tonnage, unitPriceCents, discountPercentage) => {
          const discountedPrice = calculatePurchasePrice(tonnage, unitPriceCents, discountPercentage);
          const fullPrice = calculatePurchasePrice(tonnage, unitPriceCents);

          expect(discountedPrice).toBeLessThan(fullPrice);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 3.2**
   * Package price is always a non-negative integer (ZAR cents).
   */
  it('discounted package price is always a non-negative integer', () => {
    fc.assert(
      fc.property(
        tonnageArb,
        unitPriceCentsArb,
        discountPercentageArb,
        (tonnage, unitPriceCents, discountPercentage) => {
          const priceCents = calculatePurchasePrice(tonnage, unitPriceCents, discountPercentage);

          expect(priceCents).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(priceCents)).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });
});
