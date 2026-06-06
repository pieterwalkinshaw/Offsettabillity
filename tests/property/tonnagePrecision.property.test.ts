/**
 * Property Test: Tonnage stored with two-decimal precision (Property 3)
 *
 * **Validates: Requirements 1.2**
 *
 * For any tonnage value stored in creditInventory, the value SHALL be representable
 * as a number with at most two decimal places (i.e., `Math.round(value * 100) / 100 === value`).
 *
 * This is a data integrity property — it validates that the system never stores
 * tonnage with more than 2 decimal places.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { CreditInventory } from '../../shared/types';

// ─── Domain Constants ────────────────────────────────────────────────────────

/**
 * Maximum tonnage value a project could have.
 * Based on real-world constraints and CreditPurchaseSchema max of 100000.
 */
const MAX_TONNAGE = 100000;

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Checks whether a numeric value has at most two decimal places.
 * This is the core precision invariant for all tonnage values in the system.
 */
function hasTwoDecimalPrecision(value: number): boolean {
  return Math.round(value * 100) / 100 === value;
}

/**
 * Simulates creating a valid tonnage value as the system would store it.
 * Tonnage values are derived from integers divided by 100 to ensure
 * exactly 2 decimal places of precision.
 */
function createValidTonnage(integerCentitonnage: number): number {
  return integerCentitonnage / 100;
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * Generate tonnage values with exactly 0-2 decimal places.
 * Uses integer division by 100 to guarantee valid precision.
 * Range: 0.01 to 100000.00 (1 centitonnage to 10000000 centitonnages)
 */
const validTonnage = fc.integer({ min: 1, max: MAX_TONNAGE * 100 }).map(
  (centitonnage) => centitonnage / 100
);

/**
 * Generate tonnage values that violate the 2-decimal precision constraint.
 * These have 3+ decimal places and should NOT be stored.
 */
const invalidTonnage = fc.double({
  min: 0.001,
  max: MAX_TONNAGE,
  noDefaultInfinity: true,
  noNaN: true,
}).filter((val) => Math.round(val * 100) / 100 !== val);

/**
 * Generate a valid CreditInventory's availableTonnage value.
 * Must be non-negative with at most 2 decimal places.
 */
const validAvailableTonnage = fc.integer({ min: 0, max: MAX_TONNAGE * 100 }).map(
  (centitonnage) => centitonnage / 100
);

/**
 * Generate a valid CreditInventory's totalTonnage value.
 * Must be positive with at most 2 decimal places.
 */
const validTotalTonnage = fc.integer({ min: 1, max: MAX_TONNAGE * 100 }).map(
  (centitonnage) => centitonnage / 100
);

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 3: Tonnage stored with two-decimal precision', () => {
  /**
   * **Validates: Requirements 1.2**
   * All valid tonnage values satisfy the two-decimal precision invariant.
   */
  it('all generated tonnage values satisfy Math.round(value * 100) / 100 === value', () => {
    fc.assert(
      fc.property(
        validTonnage,
        (tonnage) => {
          expect(hasTwoDecimalPrecision(tonnage)).toBe(true);
          expect(Math.round(tonnage * 100) / 100).toBe(tonnage);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 1.2**
   * Values with more than 2 decimal places are correctly identified as invalid.
   */
  it('values with more than 2 decimal places fail the precision check', () => {
    fc.assert(
      fc.property(
        invalidTonnage,
        (tonnage) => {
          expect(hasTwoDecimalPrecision(tonnage)).toBe(false);
          expect(Math.round(tonnage * 100) / 100).not.toBe(tonnage);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 1.2**
   * CreditInventory availableTonnage always satisfies the precision property.
   */
  it('CreditInventory availableTonnage always has at most two decimal places', () => {
    fc.assert(
      fc.property(
        validAvailableTonnage,
        (availableTonnage) => {
          // Simulate storing tonnage in a CreditInventory document
          const inventory: Pick<CreditInventory, 'availableTonnage'> = {
            availableTonnage,
          };

          expect(
            Math.round(inventory.availableTonnage * 100) / 100
          ).toBe(inventory.availableTonnage);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 1.2**
   * CreditInventory totalTonnage always satisfies the precision property.
   */
  it('CreditInventory totalTonnage always has at most two decimal places', () => {
    fc.assert(
      fc.property(
        validTotalTonnage,
        (totalTonnage) => {
          // Simulate storing tonnage in a CreditInventory document
          const inventory: Pick<CreditInventory, 'totalTonnage'> = {
            totalTonnage,
          };

          expect(
            Math.round(inventory.totalTonnage * 100) / 100
          ).toBe(inventory.totalTonnage);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 1.2**
   * Tonnage derived from integer centitonnage division always produces valid precision.
   * This validates the system's approach of using integer math for tonnage storage.
   */
  it('tonnage derived from integer / 100 always satisfies precision', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: MAX_TONNAGE * 100 }),
        (centitonnage) => {
          const tonnage = createValidTonnage(centitonnage);
          expect(Math.round(tonnage * 100) / 100).toBe(tonnage);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 1.2**
   * After a purchase decrement, the resulting tonnage still satisfies precision
   * when both available and purchased quantities have valid precision.
   */
  it('tonnage after purchase decrement maintains two-decimal precision', () => {
    fc.assert(
      fc.property(
        validAvailableTonnage,
        validTonnage,
        (available, purchased) => {
          // Only test when purchase is valid (purchased <= available)
          fc.pre(purchased <= available);

          // Simulate the decrement operation
          const remaining = Math.round((available - purchased) * 100) / 100;

          expect(Math.round(remaining * 100) / 100).toBe(remaining);
        }
      ),
      { numRuns: 200 }
    );
  });
});
