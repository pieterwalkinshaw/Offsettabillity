/**
 * Auditor Conflict of Interest Detection
 *
 * Determines whether an auditor has a conflict of interest with a project.
 * Conflicts exist when the auditor:
 * 1. Owns the project
 * 2. Has funded the project
 * 3. Has audited the project in the previous cycle
 *
 * Requirements validated: 4.7
 */

/**
 * Check whether an auditor has a conflict of interest with a project.
 *
 * @param auditorId - The ID of the auditor being considered for assignment
 * @param projectOwnerId - The ID of the project's owner
 * @param funderIds - Array of user IDs who have funded the project
 * @param previousAuditorIds - Array of auditor IDs who audited the project in the previous cycle
 * @returns true if a conflict of interest exists, false otherwise
 */
export function hasConflictOfInterest(
  auditorId: string,
  projectOwnerId: string,
  funderIds: string[],
  previousAuditorIds: string[]
): boolean {
  // 1. Auditor cannot own the project
  if (auditorId === projectOwnerId) {
    return true;
  }

  // 2. Auditor cannot have funded the project
  if (funderIds.includes(auditorId)) {
    return true;
  }

  // 3. Auditor cannot have audited the project in the previous cycle
  if (previousAuditorIds.includes(auditorId)) {
    return true;
  }

  return false;
}
