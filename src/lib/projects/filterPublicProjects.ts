/**
 * Public project listing filter
 *
 * Filters and sorts projects for public display. Only projects with
 * verificationStatus "verified", "live", or "funded" are visible in
 * public listings, sorted by most recently verified first.
 *
 * Implements: Requirement 8.1
 */

import type { Project, VerificationStatus } from '../../../shared/types';

/** Statuses that are visible in public project listings */
export const PUBLIC_LISTING_STATUSES: VerificationStatus[] = ['verified', 'live', 'funded'];

/**
 * Filters a list of projects to only those eligible for public display.
 * Returns projects with verificationStatus "verified", "live", or "funded",
 * sorted by most recently verified first (updatedAt descending).
 */
export function filterPublicProjects(projects: Project[]): Project[] {
  return projects
    .filter((project) => PUBLIC_LISTING_STATUSES.includes(project.verificationStatus))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}
