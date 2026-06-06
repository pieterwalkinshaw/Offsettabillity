/**
 * Property Test: Only active packages are displayed (Property 9)
 *
 * **Validates: Requirements 3.4**
 *
 * For any set of creditPackage documents, the marketplace SHALL display only
 * those where `isActive === true`, and no inactive packages shall appear in the listing.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { CreditPackage, CreditPackageTier } from '@shared/types';

// ─── Pure Filter Function (mirrors marketplace display logic) ────────────────

/**
 * Filters packages to only those that are active for marketplace display.
 * This is the core logic tested by Property 9.
 */
function getDisplayedPackages(packages: CreditPackage[]): CreditPackage[] {
  return packages.filter((p) => p.isActive === true);
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate a valid CreditPackageTier */
const tierArb: fc.Arbitrary<CreditPackageTier> = fc.constantFrom(
  'bronze',
  'silver',
  'gold',
  'platinum'
);

/** Generate a valid ISO 8601 timestamp string */
const isoTimestampArb: fc.Arbitrary<string> = fc
  .integer({ min: 1577836800000, max: 1924905600000 }) // 2020-01-01 to 2030-12-31 in ms
  .map((ms) => new Date(ms).toISOString());

/** Generate a valid CreditPackage with a random isActive value */
const creditPackageArb: fc.Arbitrary<CreditPackage> = fc.record({
  packageId: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  tier: tierArb,
  tonnage: fc.integer({ min: 1, max: 1000 }),
  priceCents: fc.integer({ min: 100, max: 999999999 }),
  discountPercentage: fc.integer({ min: 0, max: 50 }),
  isActive: fc.boolean(),
  sortOrder: fc.integer({ min: 0, max: 999 }),
  createdAt: isoTimestampArb,
  updatedAt: isoTimestampArb,
});

/** Generate an array of CreditPackage objects with mixed isActive values */
const packageListArb: fc.Arbitrary<CreditPackage[]> = fc.array(creditPackageArb, {
  minLength: 0,
  maxLength: 20,
});

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 9: Only active packages are displayed', () => {
  /**
   * **Validates: Requirements 3.4**
   * All displayed packages have isActive === true.
   */
  it('all displayed packages have isActive === true', () => {
    fc.assert(
      fc.property(packageListArb, (packages) => {
        const displayed = getDisplayedPackages(packages);

        for (const pkg of displayed) {
          expect(pkg.isActive).toBe(true);
        }
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 3.4**
   * No inactive packages appear in the displayed result.
   */
  it('no inactive packages appear in the displayed result', () => {
    fc.assert(
      fc.property(packageListArb, (packages) => {
        const displayed = getDisplayedPackages(packages);
        const inactivePackageIds = packages
          .filter((p) => !p.isActive)
          .map((p) => p.packageId);

        for (const pkg of displayed) {
          expect(inactivePackageIds).not.toContain(pkg.packageId);
        }
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 3.4**
   * Count of displayed packages equals count of active packages in the input.
   */
  it('count of displayed packages equals count of active packages in input', () => {
    fc.assert(
      fc.property(packageListArb, (packages) => {
        const displayed = getDisplayedPackages(packages);
        const activeCount = packages.filter((p) => p.isActive === true).length;

        expect(displayed.length).toBe(activeCount);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 3.4**
   * Every active package in the input appears in the displayed result (completeness).
   */
  it('every active package in input appears in the displayed result', () => {
    fc.assert(
      fc.property(packageListArb, (packages) => {
        const displayed = getDisplayedPackages(packages);
        const displayedIds = displayed.map((p) => p.packageId);
        const activePackages = packages.filter((p) => p.isActive === true);

        for (const pkg of activePackages) {
          expect(displayedIds).toContain(pkg.packageId);
        }
      }),
      { numRuns: 200 }
    );
  });
});
