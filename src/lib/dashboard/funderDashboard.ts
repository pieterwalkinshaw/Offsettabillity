/**
 * Funder Dashboard Data Computation
 *
 * Pure functions that compute funder dashboard data from funding transactions
 * and project data. These functions encapsulate the business logic for:
 * - Calculating total contribution (sum of confirmed funding amounts)
 * - Determining funded projects list
 * - Generating recommended projects (matching ESG profile, excluding funded)
 *
 * Requirements validated: 11.1
 */

import type { FundingTransaction, Project, EsgProfile } from '@shared/types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FunderDashboardData {
  /** Projects the funder has funded (from confirmed transactions) */
  fundedProjects: Project[];
  /** Total contribution in ZAR cents (sum of all confirmed funding amounts) */
  totalContribution: number;
  /** Recommended projects matching ESG profile, excluding already-funded */
  recommendedProjects: Project[];
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Calculates the total contribution for a funder.
 * Sum of all confirmed funding transaction amounts for the given funder.
 *
 * @param transactions - All funding transactions in the system
 * @param funderId - The funder's user ID
 * @returns Total contribution in integer cents (ZAR)
 */
export function calculateTotalContribution(
  transactions: FundingTransaction[],
  funderId: string
): number {
  return transactions
    .filter((tx) => tx.funderId === funderId && tx.status === 'confirmed')
    .reduce((sum, tx) => sum + tx.amount, 0);
}

/**
 * Gets the list of projects the funder has funded (confirmed transactions only).
 *
 * @param transactions - All funding transactions in the system
 * @param projects - All projects in the system
 * @param funderId - The funder's user ID
 * @returns Array of projects the funder has funded
 */
export function getFundedProjects(
  transactions: FundingTransaction[],
  projects: Project[],
  funderId: string
): Project[] {
  const fundedProjectIds = new Set(
    transactions
      .filter((tx) => tx.funderId === funderId && tx.status === 'confirmed')
      .map((tx) => tx.projectId)
  );

  return projects.filter((p) => fundedProjectIds.has(p.projectId));
}

/**
 * Gets recommended projects for a funder based on their ESG profile interests.
 * Excludes projects the funder has already funded.
 * Only includes projects with verificationStatus "verified" or "live".
 *
 * @param transactions - All funding transactions in the system
 * @param projects - All projects in the system
 * @param funderId - The funder's user ID
 * @param esgProfile - The funder's ESG profile (interests)
 * @param maxResults - Maximum number of recommendations (default 10)
 * @returns Array of recommended projects
 */
export function getRecommendedProjects(
  transactions: FundingTransaction[],
  projects: Project[],
  funderId: string,
  esgProfile: EsgProfile | undefined,
  maxResults: number = 10
): Project[] {
  // Get IDs of projects already funded by this funder
  const fundedProjectIds = new Set(
    transactions
      .filter((tx) => tx.funderId === funderId && tx.status === 'confirmed')
      .map((tx) => tx.projectId)
  );

  const interests = esgProfile?.interests ?? [];

  // Filter projects: verified/live, not already funded, matching interests
  const eligible = projects.filter((project) => {
    // Must be verified or live
    if (project.verificationStatus !== 'verified' && project.verificationStatus !== 'live') {
      return false;
    }
    // Exclude already funded
    if (fundedProjectIds.has(project.projectId)) {
      return false;
    }
    // If funder has interests, match by category
    if (interests.length > 0) {
      return interests.includes(project.category);
    }
    // If no interests set, include all eligible projects
    return true;
  });

  return eligible.slice(0, maxResults);
}

/**
 * Computes the full funder dashboard data.
 *
 * @param transactions - All funding transactions in the system
 * @param projects - All projects in the system
 * @param funderId - The funder's user ID
 * @param esgProfile - The funder's ESG profile
 * @returns Complete funder dashboard data
 */
export function computeFunderDashboard(
  transactions: FundingTransaction[],
  projects: Project[],
  funderId: string,
  esgProfile: EsgProfile | undefined
): FunderDashboardData {
  return {
    fundedProjects: getFundedProjects(transactions, projects, funderId),
    totalContribution: calculateTotalContribution(transactions, funderId),
    recommendedProjects: getRecommendedProjects(transactions, projects, funderId, esgProfile),
  };
}
