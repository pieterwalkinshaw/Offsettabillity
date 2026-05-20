/**
 * Verification Badge Determination — Cloud Functions compatible version
 *
 * Duplicated from src/lib/verification/badge.ts for use in Cloud Functions.
 * The logic is identical; this avoids module resolution issues between
 * the Next.js ESM frontend and the CommonJS Cloud Functions runtime.
 */

import type { VerificationBadge } from '../../../shared/types';

/**
 * Determine the verification badge for a project based on its
 * verification score and number of completed audits.
 *
 * Badge tiers:
 * - Premium Assured: 3+ completed audits AND score > 95
 * - Verified+: 2+ completed audits AND score > 85
 * - Verified: 1+ completed audit
 * - None: no completed audits
 */
export function determineBadge(
  score: number,
  completedAudits: number
): VerificationBadge {
  if (completedAudits >= 3 && score > 95) return 'Premium Assured';
  if (completedAudits >= 2 && score > 85) return 'Verified+';
  if (completedAudits >= 1) return 'Verified';
  return 'None';
}
