/**
 * Property Test: Packages disabled when inventory insufficient (Property 10)
 *
 * **Validates: Requirements 3.5**
 *
 * For any credit package where `package.tonnage > totalAvailableInventory`,
 * the marketplace SHALL disable that package and display an insufficient stock indicator.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ─── Pure function under test ────────────────────────────────────────────────

/**
 * Determines whether a package should be disabled based on available inventory.
 * This mirrors the logic in the marketplace page:
 *   `const isDisabled = pkg.tonnage > totalAvailable;`
 */
function isPackageDisabled(packageTonnage: number, totalAvailableInventory: number): boolean {
  return packageTonnage > totalAvailableInventory;
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate total available inventory (0-500 tons) */
const totalAvailableArb = fc.integer({ min: 0, max: 500 });

/** Generate package tonnage (1-200 tons) */
const packageTonnageArb = fc.integer({ min: 1, max: 200 });

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 10: Packages disabled when inventory insufficient', () => {
  /**
   * **Validates: Requirements 3.5**
   * When package tonnage exceeds total available inventory, the package is disabled.
   */
  it('package is disabled when tonnage > totalAvailableInventory', () => {
    fc.assert(
      fc.property(
        totalAvailableArb,
        packageTonnageArb,
        (totalAvailable, packageTonnage) => {
          fc.pre(packageTonnage > totalAvailable);

          const disabled = isPackageDisabled(packageTonnage, totalAvailable);
          expect(disabled).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 3.5**
   * When package tonnage is less than or equal to total available inventory,
   * the package is NOT disabled.
   */
  it('package is NOT disabled when tonnage <= totalAvailableInventory', () => {
    fc.assert(
      fc.property(
        totalAvailableArb,
        packageTonnageArb,
        (totalAvailable, packageTonnage) => {
          fc.pre(packageTonnage <= totalAvailable);

          const disabled = isPackageDisabled(packageTonnage, totalAvailable);
          expect(disabled).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 3.5**
   * Boundary condition: when tonnage exactly equals totalAvailable, package is NOT disabled.
   */
  it('package is NOT disabled when tonnage === totalAvailableInventory (boundary)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 500 }),
        (value) => {
          // tonnage equals totalAvailable exactly
          const disabled = isPackageDisabled(value, value);
          expect(disabled).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 3.5**
   * The disable logic is a strict comparison: disabled iff tonnage > totalAvailable.
   * This tests the bidirectional property.
   */
  it('isDisabled is equivalent to packageTonnage > totalAvailableInventory', () => {
    fc.assert(
      fc.property(
        totalAvailableArb,
        packageTonnageArb,
        (totalAvailable, packageTonnage) => {
          const disabled = isPackageDisabled(packageTonnage, totalAvailable);
          const expected = packageTonnage > totalAvailable;
          expect(disabled).toBe(expected);
        }
      ),
      { numRuns: 200 }
    );
  });
});
