/**
 * Property Test: Purchase schema validates structure correctly (Property 11)
 *
 * Validates: Requirements 4.1
 *
 * For any input object, the CreditPurchaseSchema SHALL accept it if and only if
 * it contains valid projectAllocations (non-empty array of objects with projectId
 * string and tonnage > 0), a positive quantity with at most 2 decimal places,
 * and optionally a packageId string.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { CreditPurchaseSchema } from '@shared/schemas';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate a valid projectId (non-empty string) */
const validProjectId = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);

/** Generate a valid tonnage (> 0, min 0.01) */
const validTonnage = fc.double({ min: 0.01, max: 10000, noNaN: true, noDefaultInfinity: true });

/** Generate a valid project allocation */
const validAllocation = fc.record({
  projectId: validProjectId,
  tonnage: validTonnage,
});

/** Generate a non-empty array of valid project allocations */
const validAllocations = fc.array(validAllocation, { minLength: 1, maxLength: 5 });

/** Generate a valid quantity: positive, 1-100000, at most 2 decimal places */
const validQuantity = fc.integer({ min: 100, max: 10000000 }).map(n => n / 100);

/** Generate an optional packageId (string or undefined) */
const optionalPackageId = fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined });

/** Generate a fully valid CreditPurchase input */
const validCreditPurchaseInput = fc.record({
  quantity: validQuantity,
  projectAllocations: validAllocations,
  packageId: optionalPackageId,
});

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 11: Purchase schema validates structure correctly', () => {
  /**
   * **Validates: Requirements 4.1**
   * Valid inputs with correct structure are accepted by the schema
   */
  it('accepts valid inputs with correct projectAllocations, quantity, and optional packageId', () => {
    fc.assert(
      fc.property(
        validCreditPurchaseInput,
        (input) => {
          const result = CreditPurchaseSchema.safeParse(input);
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 4.1**
   * Empty projectAllocations array is rejected
   */
  it('rejects inputs with empty projectAllocations array', () => {
    fc.assert(
      fc.property(
        validQuantity,
        optionalPackageId,
        (quantity, packageId) => {
          const input = { quantity, projectAllocations: [], packageId };
          const result = CreditPurchaseSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 4.1**
   * Missing quantity field is rejected
   */
  it('rejects inputs with missing quantity', () => {
    fc.assert(
      fc.property(
        validAllocations,
        optionalPackageId,
        (projectAllocations, packageId) => {
          const input = { projectAllocations, packageId } as any;
          const result = CreditPurchaseSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 4.1**
   * Quantity with 3+ decimal places is rejected
   */
  it('rejects inputs where quantity has 3 or more decimal places', () => {
    // Generate numbers that definitely have 3+ decimal places
    const quantityWith3Decimals = fc.integer({ min: 1001, max: 99999999 }).map(n => n / 1000);

    fc.assert(
      fc.property(
        quantityWith3Decimals,
        validAllocations,
        optionalPackageId,
        (quantity, projectAllocations, packageId) => {
          // Only test cases where the value truly has 3+ decimals
          if (Number(quantity.toFixed(2)) === quantity) return; // skip if happens to have ≤2 decimals

          const input = { quantity, projectAllocations, packageId };
          const result = CreditPurchaseSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 4.1**
   * Zero tonnage in project allocations is rejected
   */
  it('rejects inputs where any allocation has zero tonnage', () => {
    fc.assert(
      fc.property(
        validQuantity,
        validProjectId,
        optionalPackageId,
        (quantity, projectId, packageId) => {
          const input = {
            quantity,
            projectAllocations: [{ projectId, tonnage: 0 }],
            packageId,
          };
          const result = CreditPurchaseSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 4.1**
   * Empty projectId string in allocations is rejected
   */
  it('rejects inputs where any allocation has empty projectId', () => {
    fc.assert(
      fc.property(
        validQuantity,
        validTonnage,
        optionalPackageId,
        (quantity, tonnage, packageId) => {
          const input = {
            quantity,
            projectAllocations: [{ projectId: '', tonnage }],
            packageId,
          };
          const result = CreditPurchaseSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 4.1**
   * Negative tonnage in allocations is rejected
   */
  it('rejects inputs where any allocation has negative tonnage', () => {
    const negativeTonnage = fc.double({ min: -10000, max: -0.01, noNaN: true, noDefaultInfinity: true });

    fc.assert(
      fc.property(
        validQuantity,
        validProjectId,
        negativeTonnage,
        optionalPackageId,
        (quantity, projectId, tonnage, packageId) => {
          const input = {
            quantity,
            projectAllocations: [{ projectId, tonnage }],
            packageId,
          };
          const result = CreditPurchaseSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 4.1**
   * Quantity below minimum (< 1) is rejected
   */
  it('rejects inputs where quantity is below minimum (less than 1)', () => {
    const belowMinQuantity = fc.double({ min: 0, max: 0.99, noNaN: true, noDefaultInfinity: true });

    fc.assert(
      fc.property(
        belowMinQuantity,
        validAllocations,
        optionalPackageId,
        (quantity, projectAllocations, packageId) => {
          const input = { quantity, projectAllocations, packageId };
          const result = CreditPurchaseSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 4.1**
   * Quantity above maximum (> 100000) is rejected
   */
  it('rejects inputs where quantity exceeds maximum (100000)', () => {
    const aboveMaxQuantity = fc.integer({ min: 100001, max: 999999 });

    fc.assert(
      fc.property(
        aboveMaxQuantity,
        validAllocations,
        optionalPackageId,
        (quantity, projectAllocations, packageId) => {
          const input = { quantity, projectAllocations, packageId };
          const result = CreditPurchaseSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
