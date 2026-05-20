/**
 * Funding Concentration Check
 *
 * Pure function that determines whether a single funder's cumulative
 * confirmed funding exceeds the concentration threshold (50% of fundingGoal),
 * triggering an admin notification for manual review.
 *
 * Requirements validated: 5.8
 * - If cumulative confirmed funding from a single funder exceeds 50% of a
 *   project's funding goal, the system SHALL trigger an admin notification.
 */

/**
 * Determines whether a funding concentration alert should be triggered.
 *
 * A concentration alert is triggered when a single funder's cumulative
 * confirmed funding STRICTLY exceeds 50% of the project's fundingGoal.
 *
 * @param funderTotal - The single funder's cumulative confirmed funding in integer cents
 * @param fundingGoal - The project's funding goal in integer cents
 * @returns true if the funder's total exceeds 50% of the funding goal (strict >)
 */
export function shouldTriggerConcentrationAlert(funderTotal: number, fundingGoal: number): boolean {
  if (fundingGoal <= 0) {
    return false;
  }
  return funderTotal > fundingGoal * 0.5;
}
