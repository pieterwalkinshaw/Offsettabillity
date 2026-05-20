/**
 * Payment Effects on fundingRaised
 *
 * Pure functions that model the effect of payment confirmation/failure
 * on a project's fundingRaised field.
 *
 * Requirements validated: 5.4, 5.5
 * - Confirmed payments increment fundingRaised by exactly the confirmed amount (integer cents)
 * - Failed payments leave fundingRaised unchanged
 */

/**
 * Applies the effect of a confirmed payment on fundingRaised.
 * Increments fundingRaised by exactly the confirmed amount in integer cents.
 *
 * @param currentFundingRaised - Current fundingRaised value in integer cents
 * @param amount - Confirmed payment amount in integer cents
 * @returns New fundingRaised value after confirmation
 */
export function confirmPayment(currentFundingRaised: number, amount: number): number {
  return currentFundingRaised + amount;
}

/**
 * Applies the effect of a failed payment on fundingRaised.
 * Failed payments do NOT modify the project's fundingRaised field.
 *
 * @param currentFundingRaised - Current fundingRaised value in integer cents
 * @returns Unchanged fundingRaised value
 */
export function failPayment(currentFundingRaised: number): number {
  return currentFundingRaised;
}

/**
 * Applies a sequence of payment results to an initial fundingRaised value.
 * Each payment is either confirmed (increments by amount) or failed (no change).
 *
 * @param initialFundingRaised - Starting fundingRaised value in integer cents
 * @param payments - Array of payment results with status and amount
 * @returns Final fundingRaised value after processing all payments
 */
export function applyPayments(
  initialFundingRaised: number,
  payments: Array<{ status: 'confirmed' | 'failed'; amount: number }>
): number {
  return payments.reduce((fundingRaised, payment) => {
    if (payment.status === 'confirmed') {
      return confirmPayment(fundingRaised, payment.amount);
    }
    return failPayment(fundingRaised);
  }, initialFundingRaised);
}
