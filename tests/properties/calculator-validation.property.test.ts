/**
 * Property Test: Calculator input validation (Property 25)
 *
 * Validates: Requirements 7.6
 *
 * For any calculator submission with an empty industry selection or a budget
 * value outside the range R1–R999,999,999, the system SHALL display inline
 * validation errors and NOT produce an allocation result.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateCalculatorInput } from '../../src/lib/calculator/validate';
import { INDUSTRIES } from '../../src/lib/calculator/allocate';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate an empty industry (empty string) */
const emptyIndustryArb = fc.constant('');

/** Generate a budget below the minimum (< 1) */
const budgetBelowMinArb = fc.integer({ min: -1_000_000_000, max: 0 });

/** Generate a budget above the maximum (> 999,999,999) */
const budgetAboveMaxArb = fc.integer({ min: 1_000_000_000, max: 2_000_000_000 });

/** Generate a valid industry from the predefined list */
const validIndustryArb = fc.constantFrom(...INDUSTRIES);

/** Generate a valid budget value (R1 to R999,999,999) */
const validBudgetArb = fc.integer({ min: 1, max: 999_999_999 });

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 25: Calculator input validation', () => {
  /**
   * **Validates: Requirements 7.6**
   * Empty industry selection must produce a validation error and no result.
   */
  it('empty industry produces validation error and no result', () => {
    fc.assert(
      fc.property(emptyIndustryArb, validBudgetArb, (industry, budget) => {
        const result = validateCalculatorInput(industry, budget);

        // Must not be valid
        expect(result.valid).toBe(false);

        // Must have an industry error
        expect(result.errors.industry).toBeDefined();
        expect(result.errors.industry!.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 7.6**
   * Budget below minimum (< 1) must produce a validation error and no result.
   */
  it('budget below minimum produces validation error and no result', () => {
    fc.assert(
      fc.property(validIndustryArb, budgetBelowMinArb, (industry, budget) => {
        const result = validateCalculatorInput(industry, budget);

        // Must not be valid
        expect(result.valid).toBe(false);

        // Must have a budget error
        expect(result.errors.budget).toBeDefined();
        expect(result.errors.budget!.length).toBeGreaterThan(0);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 7.6**
   * Budget above maximum (> 999,999,999) must produce a validation error and no result.
   */
  it('budget above maximum produces validation error and no result', () => {
    fc.assert(
      fc.property(validIndustryArb, budgetAboveMaxArb, (industry, budget) => {
        const result = validateCalculatorInput(industry, budget);

        // Must not be valid
        expect(result.valid).toBe(false);

        // Must have a budget error
        expect(result.errors.budget).toBeDefined();
        expect(result.errors.budget!.length).toBeGreaterThan(0);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 7.6**
   * Valid industry + valid budget must produce no validation errors.
   */
  it('valid industry and valid budget produces no validation errors', () => {
    fc.assert(
      fc.property(validIndustryArb, validBudgetArb, (industry, budget) => {
        const result = validateCalculatorInput(industry, budget);

        // Must be valid
        expect(result.valid).toBe(true);

        // Must have no errors
        expect(result.errors.industry).toBeUndefined();
        expect(result.errors.budget).toBeUndefined();
      }),
      { numRuns: 500 }
    );
  });
});
