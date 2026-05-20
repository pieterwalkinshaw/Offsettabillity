/**
 * Property Test: Auditor conflict of interest prevention (Property 13)
 *
 * Validates: Requirements 4.7
 *
 * For any auditor-project pair where the auditor owns the project, has funded it,
 * or has audited it in the previous cycle, the system SHALL reject the audit assignment.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { hasConflictOfInterest } from '../../src/lib/verification/conflict';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate a random user ID (simulating Firebase-style IDs) */
const userIdArb = fc.string({ minLength: 10, maxLength: 28 }).filter((s) => s.length > 0);

/** Generate a list of unique user IDs (for funders or previous auditors) */
const userIdListArb = fc.uniqueArray(userIdArb, { minLength: 0, maxLength: 10 });

/**
 * Generate a scenario where the auditor owns the project.
 * The auditorId is the same as the projectOwnerId.
 */
const auditorOwnsProjectArb = fc.record({
  auditorId: userIdArb,
  funderIds: userIdListArb,
  previousAuditorIds: userIdListArb,
}).map(({ auditorId, funderIds, previousAuditorIds }) => ({
  auditorId,
  projectOwnerId: auditorId, // Same as auditor → conflict
  funderIds: funderIds.filter((id) => id !== auditorId),
  previousAuditorIds: previousAuditorIds.filter((id) => id !== auditorId),
}));

/**
 * Generate a scenario where the auditor has funded the project.
 * The auditorId appears in the funderIds list.
 */
const auditorFundedProjectArb = fc.record({
  auditorId: userIdArb,
  projectOwnerId: userIdArb,
  otherFunderIds: userIdListArb,
  previousAuditorIds: userIdListArb,
}).map(({ auditorId, projectOwnerId, otherFunderIds, previousAuditorIds }) => ({
  auditorId,
  projectOwnerId: projectOwnerId === auditorId ? projectOwnerId + '_owner' : projectOwnerId,
  funderIds: [...otherFunderIds.filter((id) => id !== auditorId), auditorId], // Include auditor as funder
  previousAuditorIds: previousAuditorIds.filter((id) => id !== auditorId),
}));

/**
 * Generate a scenario where the auditor audited the project in the previous cycle.
 * The auditorId appears in the previousAuditorIds list.
 */
const auditorPreviousCycleArb = fc.record({
  auditorId: userIdArb,
  projectOwnerId: userIdArb,
  funderIds: userIdListArb,
  otherPreviousAuditorIds: userIdListArb,
}).map(({ auditorId, projectOwnerId, funderIds, otherPreviousAuditorIds }) => ({
  auditorId,
  projectOwnerId: projectOwnerId === auditorId ? projectOwnerId + '_owner' : projectOwnerId,
  funderIds: funderIds.filter((id) => id !== auditorId),
  previousAuditorIds: [...otherPreviousAuditorIds.filter((id) => id !== auditorId), auditorId], // Include auditor
}));

/**
 * Generate a scenario where the auditor has NO relationship to the project.
 * The auditorId is different from the owner, not in funders, not in previous auditors.
 */
const noConflictArb = fc.record({
  auditorId: userIdArb,
  projectOwnerId: userIdArb,
  funderIds: userIdListArb,
  previousAuditorIds: userIdListArb,
}).filter(({ auditorId, projectOwnerId, funderIds, previousAuditorIds }) =>
  auditorId !== projectOwnerId &&
  !funderIds.includes(auditorId) &&
  !previousAuditorIds.includes(auditorId)
);

/**
 * Generate a scenario where the auditor has multiple conflicts (owns AND funded).
 */
const multipleConflictsArb = fc.record({
  auditorId: userIdArb,
  otherFunderIds: userIdListArb,
  otherPreviousAuditorIds: userIdListArb,
}).map(({ auditorId, otherFunderIds, otherPreviousAuditorIds }) => ({
  auditorId,
  projectOwnerId: auditorId, // Owns the project
  funderIds: [...otherFunderIds.filter((id) => id !== auditorId), auditorId], // Also funded it
  previousAuditorIds: otherPreviousAuditorIds.filter((id) => id !== auditorId),
}));

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 13: Auditor conflict of interest prevention', () => {
  /**
   * **Validates: Requirements 4.7**
   * Auditor who owns the project → conflict detected
   */
  it('detects conflict when auditor owns the project', () => {
    fc.assert(
      fc.property(auditorOwnsProjectArb, ({ auditorId, projectOwnerId, funderIds, previousAuditorIds }) => {
        const result = hasConflictOfInterest(auditorId, projectOwnerId, funderIds, previousAuditorIds);
        expect(result).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 4.7**
   * Auditor who has funded the project → conflict detected
   */
  it('detects conflict when auditor has funded the project', () => {
    fc.assert(
      fc.property(auditorFundedProjectArb, ({ auditorId, projectOwnerId, funderIds, previousAuditorIds }) => {
        const result = hasConflictOfInterest(auditorId, projectOwnerId, funderIds, previousAuditorIds);
        expect(result).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 4.7**
   * Auditor who audited the project in previous cycle → conflict detected
   */
  it('detects conflict when auditor audited the project in previous cycle', () => {
    fc.assert(
      fc.property(auditorPreviousCycleArb, ({ auditorId, projectOwnerId, funderIds, previousAuditorIds }) => {
        const result = hasConflictOfInterest(auditorId, projectOwnerId, funderIds, previousAuditorIds);
        expect(result).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 4.7**
   * Auditor with no relationship to the project → no conflict
   */
  it('reports no conflict when auditor has no relationship to the project', () => {
    fc.assert(
      fc.property(noConflictArb, ({ auditorId, projectOwnerId, funderIds, previousAuditorIds }) => {
        const result = hasConflictOfInterest(auditorId, projectOwnerId, funderIds, previousAuditorIds);
        expect(result).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 4.7**
   * Multiple conflicts (owns AND funded) → still detected
   */
  it('detects conflict when auditor has multiple conflicts (owns AND funded)', () => {
    fc.assert(
      fc.property(multipleConflictsArb, ({ auditorId, projectOwnerId, funderIds, previousAuditorIds }) => {
        const result = hasConflictOfInterest(auditorId, projectOwnerId, funderIds, previousAuditorIds);
        expect(result).toBe(true);
      }),
      { numRuns: 200 }
    );
  });
});
