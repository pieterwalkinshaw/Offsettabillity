/**
 * Property Test: Funding concentration notification (Property 18)
 *
 * **Validates: Requirements 5.8**
 *
 * For any single funder whose cumulative confirmed funding exceeds 50% of a
 * project's fundingGoal, the system SHALL trigger an admin notification for
 * manual review.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { shouldTriggerConcentrationAlert } from '../../src/lib/funding/concentrationCheck';

// ─── Domain Constants ────────────────────────────────────────────────────────

/** Minimum funding goal (1000 cents = R10.00, per Requirement 2.1) */
const MIN_FUNDING_GOAL = 1000;

/** Maximum funding goal (999999999 cents, per Requirement 2.1) */
const MAX_FUNDING_GOAL = 999999999;

/** Concentration threshold: 50% */
const CONCENTRATION_THRESHOLD = 0.5;

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate a valid funding goal (integer cents, within project creation bounds) */
const fundingGoalArb = fc.integer({ min: MIN_FUNDING_GOAL, max: MAX_FUNDING_GOAL });

/**
 * Generate a funder total that strictly exceeds 50% of the given funding goal.
 * We generate the funding goal first, then derive a funder total above the threshold.
 */
const aboveThresholdArb = fundingGoalArb.chain((fundingGoal) => {
  const threshold = Math.floor(fundingGoal * CONCENTRATION_THRESHOLD) + 1;
  // Funder total can be from just above 50% up to the full funding goal (or beyond)
  return fc.tuple(
    fc.constant(fundingGoal),
    fc.integer({ min: threshold, max: fundingGoal * 2 })
  );
});

/**
 * Generate a funder total that is at or below 50% of the given funding goal.
 * This should NOT trigger a concentration alert.
 */
const atOrBelowThresholdArb = fundingGoalArb.chain((fundingGoal) => {
  const maxBelow = Math.floor(fundingGoal * CONCENTRATION_THRESHOLD);
  return fc.tuple(
    fc.constant(fundingGoal),
    fc.integer({ min: 0, max: maxBelow })
  );
});

/**
 * Generate a funder total that is exactly at 50% of the funding goal.
 * This should NOT trigger a concentration alert (must be strictly greater).
 */
const exactlyAtThresholdArb = fc.integer({ min: MIN_FUNDING_GOAL, max: MAX_FUNDING_GOAL }).filter(
  (goal) => (goal * CONCENTRATION_THRESHOLD) === Math.floor(goal * CONCENTRATION_THRESHOLD)
).map((fundingGoal) => ({
  fundingGoal,
  funderTotal: fundingGoal * CONCENTRATION_THRESHOLD,
}));

/**
 * Generate multiple funders each below 50% of the funding goal.
 */
const multipleFundersBelowThresholdArb = fundingGoalArb.chain((fundingGoal) => {
  const maxPerFunder = Math.floor(fundingGoal * CONCENTRATION_THRESHOLD);
  return fc.tuple(
    fc.constant(fundingGoal),
    fc.array(fc.integer({ min: 0, max: maxPerFunder }), { minLength: 2, maxLength: 10 })
  );
});

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 18: Funding concentration notification', () => {
  /**
   * **Validates: Requirements 5.8**
   * Funder total > 50% of fundingGoal → notification triggered
   */
  it('triggers notification when funder total exceeds 50% of fundingGoal', () => {
    fc.assert(
      fc.property(aboveThresholdArb, ([fundingGoal, funderTotal]) => {
        const result = shouldTriggerConcentrationAlert(funderTotal, fundingGoal);
        expect(result).toBe(true);
      }),
      { numRuns: 500 }
    );
  });

  /**
   * **Validates: Requirements 5.8**
   * Funder total <= 50% of fundingGoal → no notification
   */
  it('does not trigger notification when funder total is at or below 50% of fundingGoal', () => {
    fc.assert(
      fc.property(atOrBelowThresholdArb, ([fundingGoal, funderTotal]) => {
        const result = shouldTriggerConcentrationAlert(funderTotal, fundingGoal);
        expect(result).toBe(false);
      }),
      { numRuns: 500 }
    );
  });

  /**
   * **Validates: Requirements 5.8**
   * Funder total exactly at 50% → no notification (must be strictly greater)
   */
  it('does not trigger notification when funder total is exactly 50% of fundingGoal', () => {
    fc.assert(
      fc.property(exactlyAtThresholdArb, ({ fundingGoal, funderTotal }) => {
        const result = shouldTriggerConcentrationAlert(funderTotal, fundingGoal);
        expect(result).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 5.8**
   * Multiple funders each below 50% → no notification for any
   */
  it('does not trigger notification for any funder when all are below 50%', () => {
    fc.assert(
      fc.property(multipleFundersBelowThresholdArb, ([fundingGoal, funderTotals]) => {
        for (const funderTotal of funderTotals) {
          const result = shouldTriggerConcentrationAlert(funderTotal, fundingGoal);
          expect(result).toBe(false);
        }
      }),
      { numRuns: 300 }
    );
  });
});
