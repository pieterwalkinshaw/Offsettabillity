/**
 * Property Test: Payment confirmation effects on fundingRaised (Property 16)
 *
 * Validates: Requirements 5.4, 5.5
 *
 * For any funding transaction, if the payment gateway confirms the payment,
 * the project's fundingRaised SHALL increase by exactly the confirmed amount
 * (in integer cents). If the payment fails, the project's fundingRaised SHALL
 * remain unchanged.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { confirmPayment, failPayment, applyPayments } from '../../src/lib/funding/paymentEffects';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate a valid fundingRaised value (integer cents, non-negative) */
const fundingRaisedArb = fc.integer({ min: 0, max: 999999999 });

/** Generate a valid funding amount (integer cents, within allowed range per Requirement 5.1) */
const fundingAmountArb = fc.integer({ min: 1000, max: 100000000 });

/** Generate a payment result (confirmed or failed) */
const paymentResultArb = fc.record({
  status: fc.constantFrom('confirmed' as const, 'failed' as const),
  amount: fundingAmountArb,
});

/** Generate a list of payment results (1-10 payments) */
const paymentListArb = fc.array(paymentResultArb, { minLength: 1, maxLength: 10 });

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 16: Payment confirmation effects on fundingRaised', () => {
  /**
   * **Validates: Requirements 5.4**
   * Confirmed payment increments fundingRaised by exactly the amount.
   */
  it('confirmed payment increments fundingRaised by exactly the amount', () => {
    fc.assert(
      fc.property(fundingRaisedArb, fundingAmountArb, (currentFundingRaised, amount) => {
        const newFundingRaised = confirmPayment(currentFundingRaised, amount);

        expect(newFundingRaised).toBe(currentFundingRaised + amount);
      }),
      { numRuns: 500 }
    );
  });

  /**
   * **Validates: Requirements 5.5**
   * Failed payment leaves fundingRaised unchanged.
   */
  it('failed payment leaves fundingRaised unchanged', () => {
    fc.assert(
      fc.property(fundingRaisedArb, (currentFundingRaised) => {
        const newFundingRaised = failPayment(currentFundingRaised);

        expect(newFundingRaised).toBe(currentFundingRaised);
      }),
      { numRuns: 500 }
    );
  });

  /**
   * **Validates: Requirements 5.4**
   * Multiple confirmed payments accumulate correctly.
   * The final fundingRaised equals the initial value plus the sum of all confirmed amounts.
   */
  it('multiple confirmed payments accumulate correctly', () => {
    fc.assert(
      fc.property(
        fundingRaisedArb,
        fc.array(fundingAmountArb, { minLength: 1, maxLength: 10 }),
        (initialFundingRaised, amounts) => {
          const payments = amounts.map((amount) => ({
            status: 'confirmed' as const,
            amount,
          }));

          const finalFundingRaised = applyPayments(initialFundingRaised, payments);
          const expectedTotal = initialFundingRaised + amounts.reduce((sum, a) => sum + a, 0);

          expect(finalFundingRaised).toBe(expectedTotal);
        }
      ),
      { numRuns: 300 }
    );
  });

  /**
   * **Validates: Requirements 5.4, 5.5**
   * Mix of confirmed and failed payments only counts confirmed ones.
   * The final fundingRaised equals the initial value plus the sum of only confirmed amounts.
   */
  it('mix of confirmed and failed payments only counts confirmed ones', () => {
    fc.assert(
      fc.property(fundingRaisedArb, paymentListArb, (initialFundingRaised, payments) => {
        const finalFundingRaised = applyPayments(initialFundingRaised, payments);

        const confirmedTotal = payments
          .filter((p) => p.status === 'confirmed')
          .reduce((sum, p) => sum + p.amount, 0);

        expect(finalFundingRaised).toBe(initialFundingRaised + confirmedTotal);
      }),
      { numRuns: 500 }
    );
  });
});
