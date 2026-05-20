/**
 * Property Test: ESG calculator allocation output (Property 24)
 *
 * Validates: Requirements 7.1, 7.2
 *
 * For any valid industry selection and budget value (R1 to R999,999,999),
 * the ESG calculator SHALL produce an allocation result containing: a total
 * recommended spend equal to the input budget, and percentage breakdowns
 * across at least 3 active project categories that sum to 100%.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { allocate, INDUSTRIES, type Industry } from '../../src/lib/calculator/allocate';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate a valid industry from the predefined list */
const industryArb = fc.constantFrom(...INDUSTRIES);

/** Generate a valid budget value (R1 to R999,999,999) */
const budgetArb = fc.integer({ min: 1, max: 999_999_999 });

/** Generate a valid allocation input */
const allocationInputArb = fc.record({
  industry: industryArb,
  budget: budgetArb,
});

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 24: ESG calculator allocation output', () => {
  /**
   * **Validates: Requirements 7.1, 7.2**
   * The total recommended spend must equal the input budget for any valid input.
   */
  it('total equals input budget for any valid input', () => {
    fc.assert(
      fc.property(allocationInputArb, (input) => {
        const result = allocate(input);
        expect(result.total).toBe(input.budget);
      }),
      { numRuns: 500 }
    );
  });

  /**
   * **Validates: Requirements 7.1, 7.2**
   * Percentages across all categories must sum to exactly 100%.
   */
  it('percentages sum to exactly 100%', () => {
    fc.assert(
      fc.property(allocationInputArb, (input) => {
        const result = allocate(input);
        const percentageSum = result.allocations.reduce(
          (sum, item) => sum + item.percentage,
          0
        );
        expect(percentageSum).toBe(100);
      }),
      { numRuns: 500 }
    );
  });

  /**
   * **Validates: Requirements 7.2**
   * Every allocation must contain at least 3 categories.
   */
  it('produces at least 3 categories in every allocation', () => {
    fc.assert(
      fc.property(allocationInputArb, (input) => {
        const result = allocate(input);
        expect(result.allocations.length).toBeGreaterThanOrEqual(3);
      }),
      { numRuns: 500 }
    );
  });

  /**
   * **Validates: Requirements 7.1, 7.2**
   * All individual amounts must be non-negative integers.
   */
  it('all amounts are non-negative integers', () => {
    fc.assert(
      fc.property(allocationInputArb, (input) => {
        const result = allocate(input);
        for (const item of result.allocations) {
          expect(Number.isInteger(item.amount)).toBe(true);
          expect(item.amount).toBeGreaterThanOrEqual(0);
        }
      }),
      { numRuns: 500 }
    );
  });

  /**
   * **Validates: Requirements 7.1, 7.2**
   * The sum of all category amounts must equal exactly the input budget.
   */
  it('amounts sum to exactly the input budget', () => {
    fc.assert(
      fc.property(allocationInputArb, (input) => {
        const result = allocate(input);
        const amountSum = result.allocations.reduce(
          (sum, item) => sum + item.amount,
          0
        );
        expect(amountSum).toBe(input.budget);
      }),
      { numRuns: 500 }
    );
  });
});
