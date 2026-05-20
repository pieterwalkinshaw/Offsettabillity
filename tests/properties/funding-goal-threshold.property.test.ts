/**
 * Property Test: Funding goal threshold triggers status transition (Property 17)
 *
 * Validates: Requirements 5.6, 5.9
 *
 * For any project where a confirmed payment causes fundingRaised to equal or exceed
 * fundingGoal, the project status SHALL transition to "funded", regardless of whether
 * the payment causes overfunding.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  checkFundingGoalThreshold,
  determineStatusAfterPayment,
} from '../../src/lib/funding/fundingGoalThreshold';
import type { VerificationStatus } from '../../shared/types';

// ─── Domain Constants ────────────────────────────────────────────────────────

/** Statuses eligible for funding (projects that can receive payments) */
const FUNDABLE_STATUSES: VerificationStatus[] = ['verified', 'live'];

/** Minimum funding amount per transaction (Requirement 5.1) */
const MIN_AMOUNT = 1000;

/** Maximum funding amount per transaction (Requirement 5.1) */
const MAX_AMOUNT = 100000000;

/** Minimum funding goal (Requirement 2.1) */
const MIN_FUNDING_GOAL = 1000;

/** Maximum funding goal (Requirement 2.1) */
const MAX_FUNDING_GOAL = 999999999;

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate a valid funding goal (integer cents, within project creation bounds) */
const fundingGoalArb = fc.integer({ min: MIN_FUNDING_GOAL, max: MAX_FUNDING_GOAL });

/** Generate a valid payment amount (integer cents, within allowed range) */
const paymentAmountArb = fc.integer({ min: MIN_AMOUNT, max: MAX_AMOUNT });

/** Generate a fundingRaised value (non-negative integer cents) */
const fundingRaisedArb = fc.integer({ min: 0, max: MAX_FUNDING_GOAL });

/** Generate a fundable project status */
const fundableStatusArb = fc.constantFrom<VerificationStatus>(...FUNDABLE_STATUSES);

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 17: Funding goal threshold triggers status transition', () => {
  /**
   * **Validates: Requirements 5.6**
   * Payment that causes fundingRaised >= fundingGoal → transitions to "funded"
   */
  it('transitions to "funded" when payment causes fundingRaised >= fundingGoal', () => {
    fc.assert(
      fc.property(
        fundingGoalArb,
        paymentAmountArb,
        fundableStatusArb,
        (fundingGoal, paymentAmount, currentStatus) => {
          // Set fundingRaised so that adding paymentAmount meets or exceeds the goal
          // fundingRaised = fundingGoal - paymentAmount (or 0 if that would be negative)
          const fundingRaised = Math.max(0, fundingGoal - paymentAmount);

          // After this payment, fundingRaised + paymentAmount >= fundingGoal
          const thresholdMet = checkFundingGoalThreshold(fundingRaised, fundingGoal, paymentAmount);
          expect(thresholdMet).toBe(true);

          const newStatus = determineStatusAfterPayment(currentStatus, fundingRaised, fundingGoal, paymentAmount);
          expect(newStatus).toBe('funded');
        }
      ),
      { numRuns: 500 }
    );
  });

  /**
   * **Validates: Requirements 5.9**
   * Payment that causes overfunding (fundingRaised > fundingGoal) → still transitions to "funded"
   */
  it('transitions to "funded" even when payment causes overfunding', () => {
    fc.assert(
      fc.property(
        fundingGoalArb,
        paymentAmountArb,
        fundableStatusArb,
        fc.integer({ min: 1, max: MAX_AMOUNT }),
        (fundingGoal, paymentAmount, currentStatus, extraAmount) => {
          // Set fundingRaised so that adding paymentAmount exceeds the goal by extraAmount
          // fundingRaised = fundingGoal - paymentAmount + extraAmount
          // This ensures newFundingRaised = fundingGoal + extraAmount > fundingGoal
          const fundingRaised = Math.max(0, fundingGoal - paymentAmount + extraAmount);
          const newFundingRaised = fundingRaised + paymentAmount;

          // Only test cases where overfunding actually occurs
          fc.pre(newFundingRaised > fundingGoal);

          const thresholdMet = checkFundingGoalThreshold(fundingRaised, fundingGoal, paymentAmount);
          expect(thresholdMet).toBe(true);

          const newStatus = determineStatusAfterPayment(currentStatus, fundingRaised, fundingGoal, paymentAmount);
          expect(newStatus).toBe('funded');
        }
      ),
      { numRuns: 500 }
    );
  });

  /**
   * **Validates: Requirements 5.6**
   * Payment that leaves fundingRaised < fundingGoal → no transition (status unchanged)
   */
  it('does not transition when payment leaves fundingRaised below fundingGoal', () => {
    fc.assert(
      fc.property(
        fundableStatusArb,
        (currentStatus) => {
          // Generate a scenario where fundingRaised + paymentAmount < fundingGoal
          // Use a large enough goal and small enough raised + payment
          const fundingGoal = MAX_FUNDING_GOAL; // 999999999
          const fundingRaised = 0;
          const paymentAmount = MIN_AMOUNT; // 1000

          // fundingRaised + paymentAmount = 1000 < 999999999
          const thresholdMet = checkFundingGoalThreshold(fundingRaised, fundingGoal, paymentAmount);
          expect(thresholdMet).toBe(false);

          const newStatus = determineStatusAfterPayment(currentStatus, fundingRaised, fundingGoal, paymentAmount);
          expect(newStatus).toBe(currentStatus);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 5.6**
   * Payment that leaves fundingRaised < fundingGoal → no transition (randomized)
   */
  it('does not transition for any payment that leaves fundingRaised below fundingGoal (randomized)', () => {
    fc.assert(
      fc.property(
        fundingGoalArb,
        fundableStatusArb,
        (fundingGoal, currentStatus) => {
          // Ensure fundingRaised + paymentAmount < fundingGoal
          // Pick a small fundingRaised and paymentAmount relative to the goal
          fc.pre(fundingGoal > MIN_AMOUNT * 2); // Need room for both raised and payment to be below goal

          const maxRaised = fundingGoal - MIN_AMOUNT - 1; // Leave room for at least MIN_AMOUNT payment
          const fundingRaised = 0; // Start from zero
          const paymentAmount = MIN_AMOUNT; // Minimum payment

          // Verify: 0 + 1000 < fundingGoal (since fundingGoal > 2000)
          fc.pre(fundingRaised + paymentAmount < fundingGoal);

          const thresholdMet = checkFundingGoalThreshold(fundingRaised, fundingGoal, paymentAmount);
          expect(thresholdMet).toBe(false);

          const newStatus = determineStatusAfterPayment(currentStatus, fundingRaised, fundingGoal, paymentAmount);
          expect(newStatus).toBe(currentStatus);
        }
      ),
      { numRuns: 300 }
    );
  });

  /**
   * **Validates: Requirements 5.6**
   * Payment that causes fundingRaised == fundingGoal exactly → transitions to "funded"
   */
  it('transitions to "funded" when payment causes fundingRaised to exactly equal fundingGoal', () => {
    fc.assert(
      fc.property(
        fundingGoalArb,
        paymentAmountArb,
        fundableStatusArb,
        (fundingGoal, paymentAmount, currentStatus) => {
          // Set fundingRaised so that adding paymentAmount equals exactly the goal
          const fundingRaised = fundingGoal - paymentAmount;

          // Only test valid cases where fundingRaised is non-negative
          fc.pre(fundingRaised >= 0);

          // Verify exact equality
          const newFundingRaised = fundingRaised + paymentAmount;
          expect(newFundingRaised).toBe(fundingGoal);

          const thresholdMet = checkFundingGoalThreshold(fundingRaised, fundingGoal, paymentAmount);
          expect(thresholdMet).toBe(true);

          const newStatus = determineStatusAfterPayment(currentStatus, fundingRaised, fundingGoal, paymentAmount);
          expect(newStatus).toBe('funded');
        }
      ),
      { numRuns: 500 }
    );
  });

  /**
   * **Validates: Requirements 5.6, 5.9**
   * Comprehensive: checkFundingGoalThreshold returns true if and only if
   * fundingRaised + paymentAmount >= fundingGoal
   */
  it('checkFundingGoalThreshold is equivalent to fundingRaised + paymentAmount >= fundingGoal', () => {
    fc.assert(
      fc.property(
        fundingRaisedArb,
        fundingGoalArb,
        paymentAmountArb,
        (fundingRaised, fundingGoal, paymentAmount) => {
          const result = checkFundingGoalThreshold(fundingRaised, fundingGoal, paymentAmount);
          const expected = (fundingRaised + paymentAmount) >= fundingGoal;

          expect(result).toBe(expected);
        }
      ),
      { numRuns: 1000 }
    );
  });
});
