/**
 * Auditor Dashboard Data Computation
 *
 * Pure functions that compute auditor dashboard data from audits, projects,
 * and funding transactions. These functions encapsulate the business logic for:
 * - Getting assigned audits (pending/in_progress)
 * - Getting available projects matching specializations with no conflict of interest
 * - Getting completed audits (paginated at 25)
 *
 * Requirements validated: 11.3
 */

import type { Audit, Project, FundingTransaction, AuditStatus } from '../../../shared/types';
import { hasConflictOfInterest } from '../verification/conflict';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuditorDashboardData {
  /** Audits assigned to this auditor with status pending or in_progress */
  assignedAudits: Audit[];
  /** Projects available for verification matching specializations, no conflict of interest */
  availableProjects: Project[];
  /** Completed audits by this auditor (up to 25, paginated) */
  completedAudits: Audit[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Maximum number of completed audits per page */
export const COMPLETED_AUDITS_PAGE_SIZE = 25;

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Gets audits assigned to the auditor with status "pending" or "in_progress".
 *
 * @param audits - All audits in the system
 * @param auditorId - The auditor's user ID
 * @returns Array of assigned audits (pending or in_progress)
 */
export function getAssignedAudits(audits: Audit[], auditorId: string): Audit[] {
  return audits.filter(
    (a) =>
      a.auditorId === auditorId &&
      (a.status === 'pending' || a.status === 'in_progress')
  );
}

/**
 * Gets projects available for verification that match the auditor's specializations
 * and have no conflict of interest.
 *
 * Available projects are those with verificationStatus "prescreened" or "pending_audit"
 * that match at least one of the auditor's specializations and where the auditor
 * has no conflict of interest (doesn't own, hasn't funded, hasn't previously audited).
 *
 * @param projects - All projects in the system
 * @param audits - All audits in the system
 * @param transactions - All funding transactions in the system
 * @param auditorId - The auditor's user ID
 * @param specializations - The auditor's declared specializations (category IDs)
 * @returns Array of available projects
 */
export function getAvailableProjects(
  projects: Project[],
  audits: Audit[],
  transactions: FundingTransaction[],
  auditorId: string,
  specializations: string[]
): Project[] {
  return projects.filter((project) => {
    // Must match at least one specialization
    if (specializations.length > 0 && !specializations.includes(project.category)) {
      return false;
    }

    // Must be in a state that needs verification (prescreened or pending_audit)
    if (
      project.verificationStatus !== 'prescreened' &&
      project.verificationStatus !== 'pending_audit'
    ) {
      return false;
    }

    // Check conflict of interest
    const funderIds = transactions
      .filter((tx) => tx.projectId === project.projectId && tx.status === 'confirmed')
      .map((tx) => tx.funderId);

    // Get previous auditor IDs for this project (completed audits)
    const previousAuditorIds = audits
      .filter((a) => a.projectId === project.projectId && a.status === 'completed')
      .map((a) => a.auditorId);

    if (hasConflictOfInterest(auditorId, project.ownerId, funderIds, previousAuditorIds)) {
      return false;
    }

    return true;
  });
}

/**
 * Gets completed audits for the auditor, paginated at 25 per page.
 *
 * @param audits - All audits in the system
 * @param auditorId - The auditor's user ID
 * @param page - Page number (0-indexed, default 0)
 * @returns Array of completed audits (up to 25)
 */
export function getCompletedAudits(
  audits: Audit[],
  auditorId: string,
  page: number = 0
): Audit[] {
  const completed = audits.filter(
    (a) => a.auditorId === auditorId && a.status === 'completed'
  );

  const start = page * COMPLETED_AUDITS_PAGE_SIZE;
  return completed.slice(start, start + COMPLETED_AUDITS_PAGE_SIZE);
}

/**
 * Computes the full auditor dashboard data.
 *
 * @param audits - All audits in the system
 * @param projects - All projects in the system
 * @param transactions - All funding transactions in the system
 * @param auditorId - The auditor's user ID
 * @param specializations - The auditor's declared specializations
 * @param completedPage - Page number for completed audits (0-indexed)
 * @returns Complete auditor dashboard data
 */
export function computeAuditorDashboard(
  audits: Audit[],
  projects: Project[],
  transactions: FundingTransaction[],
  auditorId: string,
  specializations: string[],
  completedPage: number = 0
): AuditorDashboardData {
  return {
    assignedAudits: getAssignedAudits(audits, auditorId),
    availableProjects: getAvailableProjects(projects, audits, transactions, auditorId, specializations),
    completedAudits: getCompletedAudits(audits, auditorId, completedPage),
  };
}
