/**
 * Property Test: Total available credits equals sum of individual inventories (Property 4)
 *
 * **Validates: Requirements 1.5**
 *
 * For any set of creditInventory documents, the total available credits displayed
 * in the marketplace SHALL equal the sum of all individual `availableTonnage` values
 * where `availableTonnage > 0`.
 *
 * This tests the pure aggregation logic used in the marketplace page to compute
 * total available credits from a set of inventory items.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ─── Domain Constants ────────────────────────────────────────────────────────

/** Maximum tonnage for a single inventory item */
const MAX_TONNAGE = 10000;

// ─── Types ───────────────────────────────────────────────────────────────────

interface InventoryItem {
  inventoryId: string;
  projectId: string;
  availableTonnage: number;
  totalTonnage: number;
  unitPriceCents: number;
  projectTitle: string;
  projectLocation: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Aggregation Function Under Test ─────────────────────────────────────────

/**
 * Computes total available credits from a set of inventory items.
 * Mirrors the marketplace page logic:
 *   1. Filter items where availableTonnage > 0 (done via Firestore query)
 *   2. Sum all availableTonnage values
 */
function calculateTotalAvailable(inventories: InventoryItem[]): number {
  return inventories
    .filter((inv) => inv.availableTonnage > 0)
    .reduce((sum, inv) => sum + inv.availableTonnage, 0);
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * Generate an inventory item with a specific availableTonnage (in centitonnage for precision).
 * Tonnage can be 0, positive, or negative (representing edge cases).
 */
const inventoryItemArb = (tonnageCenti: number): fc.Arbitrary<InventoryItem> =>
  fc.record({
    inventoryId: fc.uuid(),
    projectId: fc.uuid(),
    availableTonnage: fc.constant(tonnageCenti / 100),
    totalTonnage: fc.constant(Math.max(tonnageCenti / 100, 1)),
    unitPriceCents: fc.integer({ min: 100, max: 10000000 }),
    projectTitle: fc.string({ minLength: 1, maxLength: 50 }),
    projectLocation: fc.string({ minLength: 1, maxLength: 50 }),
    createdAt: fc.constant('2025-01-01T00:00:00Z'),
    updatedAt: fc.constant('2025-01-01T00:00:00Z'),
  });

/**
 * Generate an array of inventory items with varying availableTonnage.
 * Some items will have tonnage > 0, some = 0, and some negative (edge cases).
 */
const inventoryArrayArb = fc
  .array(
    fc.integer({ min: -100, max: MAX_TONNAGE * 100 }).chain((centi) => inventoryItemArb(centi)),
    { minLength: 0, maxLength: 50 }
  );

/**
 * Generate an array with at least some positive tonnage items.
 */
const nonEmptyPositiveInventoryArb = fc
  .array(
    fc.integer({ min: 1, max: MAX_TONNAGE * 100 }).chain((centi) => inventoryItemArb(centi)),
    { minLength: 1, maxLength: 50 }
  );

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 4: Total available credits equals sum of individual inventories', () => {
  /**
   * **Validates: Requirements 1.5**
   * The total available credits equals the sum of all availableTonnage > 0 values.
   */
  it('total equals sum of all positive availableTonnage values', () => {
    fc.assert(
      fc.property(
        inventoryArrayArb,
        (inventories) => {
          const total = calculateTotalAvailable(inventories);

          // Manually compute expected sum of positive values
          const expected = inventories
            .filter((inv) => inv.availableTonnage > 0)
            .reduce((sum, inv) => sum + inv.availableTonnage, 0);

          expect(total).toBeCloseTo(expected, 10);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 1.5**
   * Items with availableTonnage <= 0 do not contribute to the total.
   */
  it('items with availableTonnage <= 0 do not contribute to total', () => {
    fc.assert(
      fc.property(
        inventoryArrayArb,
        (inventories) => {
          const total = calculateTotalAvailable(inventories);

          // Compute total including ONLY positive items
          const positiveItems = inventories.filter((inv) => inv.availableTonnage > 0);
          const totalFromPositiveOnly = positiveItems.reduce(
            (sum, inv) => sum + inv.availableTonnage,
            0
          );

          // These should be identical — non-positive items must not affect result
          expect(total).toBeCloseTo(totalFromPositiveOnly, 10);

          // Additionally verify: removing all non-positive items yields same total
          const totalWithoutNonPositive = calculateTotalAvailable(positiveItems);
          expect(totalWithoutNonPositive).toBeCloseTo(total, 10);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 1.5**
   * An empty inventory array results in a total of exactly 0.
   */
  it('empty array produces total of zero', () => {
    fc.assert(
      fc.property(
        fc.constant([] as InventoryItem[]),
        (inventories) => {
          const total = calculateTotalAvailable(inventories);
          expect(total).toBe(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 1.5**
   * The total is always non-negative (since we only sum positive values).
   */
  it('total available is always non-negative', () => {
    fc.assert(
      fc.property(
        inventoryArrayArb,
        (inventories) => {
          const total = calculateTotalAvailable(inventories);
          expect(total).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 1.5**
   * Adding a new positive-tonnage inventory item increases the total by exactly that amount.
   */
  it('adding a positive item increases total by that items tonnage', () => {
    fc.assert(
      fc.property(
        inventoryArrayArb,
        fc.integer({ min: 1, max: MAX_TONNAGE * 100 }).chain((centi) => inventoryItemArb(centi)),
        (inventories, newItem) => {
          const totalBefore = calculateTotalAvailable(inventories);
          const totalAfter = calculateTotalAvailable([...inventories, newItem]);

          // New item has positive tonnage, so total should increase by that amount
          expect(totalAfter).toBeCloseTo(totalBefore + newItem.availableTonnage, 10);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 1.5**
   * Adding a zero-tonnage item does not change the total.
   */
  it('adding a zero-tonnage item does not change the total', () => {
    fc.assert(
      fc.property(
        nonEmptyPositiveInventoryArb,
        inventoryItemArb(0),
        (inventories, zeroItem) => {
          const totalBefore = calculateTotalAvailable(inventories);
          const totalAfter = calculateTotalAvailable([...inventories, zeroItem]);

          expect(totalAfter).toBeCloseTo(totalBefore, 10);
        }
      ),
      { numRuns: 200 }
    );
  });
});
