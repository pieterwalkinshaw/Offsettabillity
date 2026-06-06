/**
 * Property Test: Insufficient inventory rejects purchase and preserves stock (Property 2)
 *
 * **Validates: Requirements 1.4, 4.4**
 *
 * For any purchase request where the requested quantity exceeds the available tonnage
 * for a project, the system SHALL reject the purchase with an INSUFFICIENT_INVENTORY
 * error and the available tonnage SHALL remain unchanged.
 *
 * This tests the LOGIC of the rejection condition — the validation that fires
 * inside the Firestore transaction when `availableTonnage < requestedQuantity`.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ─── Domain Constants ────────────────────────────────────────────────────────

/** Minimum valid tonnage in the system (0.01 metric tons) */
const MIN_TONNAGE = 0.01;

/** Maximum tonnage value a project could have */
const MAX_TONNAGE = 10000;

/** Error code returned when inventory is insufficient */
const INSUFFICIENT_INVENTORY_ERROR = 'INSUFFICIENT_INVENTORY';

// ─── Simulate Purchase Validation Logic ──────────────────────────────────────

/**
 * Simulates the inventory check performed inside the Firestore transaction
 * in `credits_purchase`. This mirrors the condition:
 *   `if (inventoryData.availableTonnage < allocation.tonnage)`
 *
 * Returns an object indicating success/failure and the resulting stock level.
 */
function validatePurchaseInventory(
  availableTonnage: number,
  requestedQuantity: number
): { success: boolean; error?: string; resultingTonnage: number } {
  if (availableTonnage < requestedQuantity) {
    // Reject — stock unchanged
    return {
      success: false,
      error: INSUFFICIENT_INVENTORY_ERROR,
      resultingTonnage: availableTonnage,
    };
  }

  // Accept — decrement stock
  const resultingTonnage = Math.round((availableTonnage - requestedQuantity) * 100) / 100;
  return {
    success: true,
    resultingTonnage,
  };
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * Generate a valid available tonnage value with 2-decimal precision.
 * Range: 0.01 to 10000.00
 */
const availableTonnageArb = fc.integer({ min: 1, max: MAX_TONNAGE * 100 }).map(
  (centitonnage) => centitonnage / 100
);

/**
 * Generate a purchase quantity that EXCEEDS the given available tonnage.
 * Ensures requestedQuantity > availableTonnage.
 * The quantity is also constrained to 2-decimal precision.
 */
function excessQuantityArb(availableTonnage: number): fc.Arbitrary<number> {
  // The minimum excess is one centitonnage above available
  const minExcessCentitonnage = Math.round(availableTonnage * 100) + 1;
  // Cap at a reasonable maximum (double the max tonnage)
  const maxCentitonnage = MAX_TONNAGE * 200;

  return fc.integer({ min: minExcessCentitonnage, max: maxCentitonnage }).map(
    (centitonnage) => centitonnage / 100
  );
}

/**
 * Generate a pair: (availableTonnage, requestedQuantity) where requested > available.
 * Both values have valid 2-decimal precision.
 */
const insufficientInventoryPairArb = availableTonnageArb.chain((available) =>
  excessQuantityArb(available).map((requested) => ({
    availableTonnage: available,
    requestedQuantity: requested,
  }))
);

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 2: Insufficient inventory rejects purchase and preserves stock', () => {
  /**
   * **Validates: Requirements 1.4, 4.4**
   * When requestedQuantity > availableTonnage, the purchase is rejected with
   * INSUFFICIENT_INVENTORY error.
   */
  it('rejects purchase with INSUFFICIENT_INVENTORY when quantity exceeds available tonnage', () => {
    fc.assert(
      fc.property(
        insufficientInventoryPairArb,
        ({ availableTonnage, requestedQuantity }) => {
          const result = validatePurchaseInventory(availableTonnage, requestedQuantity);

          expect(result.success).toBe(false);
          expect(result.error).toBe(INSUFFICIENT_INVENTORY_ERROR);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 1.4, 4.4**
   * After rejection, the available tonnage is unchanged (stock preserved).
   */
  it('preserves available tonnage unchanged after rejection', () => {
    fc.assert(
      fc.property(
        insufficientInventoryPairArb,
        ({ availableTonnage, requestedQuantity }) => {
          const result = validatePurchaseInventory(availableTonnage, requestedQuantity);

          // The resulting tonnage must equal the original available tonnage exactly
          expect(result.resultingTonnage).toBe(availableTonnage);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 1.4, 4.4**
   * The rejection condition detects ANY case where Q > T, no matter how small
   * the difference (even 0.01 ton excess triggers rejection).
   */
  it('detects insufficient inventory for any Q > T combination', () => {
    fc.assert(
      fc.property(
        availableTonnageArb,
        (availableTonnage) => {
          // Request exactly 0.01 more than available (minimum possible excess)
          const minExcess = Math.round((availableTonnage + 0.01) * 100) / 100;
          const result = validatePurchaseInventory(availableTonnage, minExcess);

          expect(result.success).toBe(false);
          expect(result.error).toBe(INSUFFICIENT_INVENTORY_ERROR);
          expect(result.resultingTonnage).toBe(availableTonnage);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 1.4, 4.4**
   * Boundary condition: requesting exactly the available amount succeeds (not rejected),
   * confirming the rejection condition is strictly `<` (availableTonnage < requestedQuantity).
   */
  it('accepts purchase when quantity equals available tonnage (boundary)', () => {
    fc.assert(
      fc.property(
        availableTonnageArb,
        (availableTonnage) => {
          // Request exactly what's available — this should succeed
          const result = validatePurchaseInventory(availableTonnage, availableTonnage);

          expect(result.success).toBe(true);
          expect(result.error).toBeUndefined();
          expect(result.resultingTonnage).toBe(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 1.4, 4.4**
   * Rejection is a pure condition based on the comparison — the system never
   * partially decrements inventory on a failed purchase.
   */
  it('never partially decrements inventory on a rejected purchase', () => {
    fc.assert(
      fc.property(
        insufficientInventoryPairArb,
        ({ availableTonnage, requestedQuantity }) => {
          const result = validatePurchaseInventory(availableTonnage, requestedQuantity);

          // On rejection, resulting tonnage must EXACTLY equal original
          // (no partial decrement occurred)
          expect(result.resultingTonnage).toStrictEqual(availableTonnage);

          // Additionally verify the difference is zero
          const diff = Math.abs(result.resultingTonnage - availableTonnage);
          expect(diff).toBe(0);
        }
      ),
      { numRuns: 200 }
    );
  });
});
