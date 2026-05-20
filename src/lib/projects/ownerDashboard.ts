/**
 * Owner Dashboard Data Helpers
 *
 * Computes dashboard data for project owners including:
 * - Filtering projects by owner
 * - Verification status and badge per project
 * - Funding progress as percentage of goal
 * - Pending actions (drafts, submitted, unresolved findings)
 *
 * Implements: Requirement 11.2
 */

import type { Project, Audit, VerificationStatus } from '../../../shared/types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OwnerProjectSummary {
  projectId: string;
  title: string;
  verificationStatus: VerificationStatus;
  verificationBadge: string;
  fundingProgressPercent: number;
  fundingGoal: number;
  fundingRaised: number;
}

export interface PendingActions {
  draftsNeedingSubmission: number;
  submittedAwaitingPrescreen: number;
  unresolvedAuditFindings: number;
}

export interface OwnerDashboardData {
  projects: OwnerProjectSummary[];
  pendingActions: PendingActions;
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Filters projects to only those owned by the given ownerId.
 */
export function getOwnerProjects(projects: Project[], ownerId: string): Project[] {
  return projects.filter((p) => p.ownerId === ownerId);
}

/**
 * Calculates funding progress as a percentage of the funding goal.
 * Returns 0 if fundingGoal is 0 (avoids division by zero).
 * Caps at any value (can exceed 100% if overfunded).
 */
export function calculateFundingProgress(fundingRaised: number, fundingGoal: number): number {
  if (fundingGoal <= 0) return 0;
  return (fundingRaised / fundingGoal) * 100;
}

/**
 * Computes pending actions for an owner's projects.
 *
 * Pending actions are defined as:
 * - Drafts needing submission: projects with verificationStatus "draft"
 * - Submitted awaiting pre-screening: projects with verificationStatus "submitted"
 * - Unresolved audit findings: projects that have audits with recommendation
 *   "conditional" or "reject" where the audit is completed and the project
 *   has not yet progressed past the audit stage
 */
export function computePendingActions(
  ownerProjects: Project[],
  audits: Audit[]
): PendingActions {
  const draftsNeedingSubmission = ownerProjects.filter(
    (p) => p.verificationStatus === 'draft'
  ).length;

  const submittedAwaitingPrescreen = ownerProjects.filter(
    (p) => p.verificationStatus === 'submitted'
  ).length;

  // Unresolved audit findings: projects with completed audits that have
  // "conditional" or "reject" recommendation
  const ownerProjectIds = new Set(ownerProjects.map((p) => p.projectId));
  const unresolvedAuditFindings = audits.filter(
    (a) =>
      ownerProjectIds.has(a.projectId) &&
      a.status === 'completed' &&
      (a.recommendation === 'conditional' || a.recommendation === 'reject')
  ).length;

  return {
    draftsNeedingSubmission,
    submittedAwaitingPrescreen,
    unresolvedAuditFindings,
  };
}

/**
 * Builds the complete owner dashboard data from projects and audits.
 */
export function buildOwnerDashboardData(
  allProjects: Project[],
  audits: Audit[],
  ownerId: string
): OwnerDashboardData {
  const ownerProjects = getOwnerProjects(allProjects, ownerId);

  const projects: OwnerProjectSummary[] = ownerProjects.map((p) => ({
    projectId: p.projectId,
    title: p.title,
    verificationStatus: p.verificationStatus,
    verificationBadge: p.verificationBadge,
    fundingProgressPercent: calculateFundingProgress(p.fundingRaised, p.fundingGoal),
    fundingGoal: p.fundingGoal,
    fundingRaised: p.fundingRaised,
  }));

  const pendingActions = computePendingActions(ownerProjects, audits);

  return { projects, pendingActions };
}
