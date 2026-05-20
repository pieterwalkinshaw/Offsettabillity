/**
 * Funding Goal Threshold Logic
 *
 * Pure functions that model the funding goal threshold check and
 * project status transition when fundingRaised meets or exceeds fundingGoal.
 *
 * Requirements validated: 5.6, 5.9
 * - When fundingRaised >= fundingGoal, project status transitions to "funded"
 * - Overfunding (fundingRaised > fundingGoal) still transitions to "funded"
 */

import type { VerificationStatus } from '../../../shared/types';

/**
 * Determines whether a confirmed payment causes the project to reach its funding goal.
 *
 * @param fundingRaised - Current fundingRaised value in integer cents (before payment)
 * @param fundingGoal - Project's funding goal in integer cents
 * @param paymentAmount - Confirmed payment amount in integer cents
 * @returns true if the payment causes fundingRaised to equal or exceed fundingGoal
 */
export function checkFundingGoalThreshold(
  fundingRaised: number,
  fundingGoal: number,
  paymentAmount: number
): boolean {
  const newFundingRaised = fundingRaised + paymentAmount;
  return newFundingRaised >= fundingGoal;
}

/**
 * Determines the new verification status after a confirmed payment.
 *
 * If the payment causes fundingRaised to equal or exceed fundingGoal,
 * the status transitions to "funded". Otherwise, the status remains unchanged.
 *
 * @param currentStatus - Current project verification status
 * @param fundingRaised - Current fundingRaised value in integer cents (before payment)
 * @param fundingGoal - Project's funding goal in integer cents
 * @param paymentAmount - Confirmed payment amount in integer cents
 * @returns The new verification status after the payment
 */
export function determineStatusAfterPayment(
  currentStatus: VerificationStatus,
  fundingRaised: number,
  fundingGoal: number,
  paymentAmount: number
): VerificationStatus {
  if (checkFundingGoalThreshold(fundingRaised, fundingGoal, paymentAmount)) {
    return 'funded';
  }
  return currentStatus;
}
