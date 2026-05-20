/**
 * Property Test: Public project listing status filter (Property 26)
 *
 * Validates: Requirements 8.1
 *
 * For any set of projects in the database, the public listing SHALL display only
 * projects with verificationStatus "verified", "live", or "funded", sorted by most
 * recently verified first. Projects with any other status SHALL NOT appear in
 * public listings.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { Project, VerificationStatus, VerificationBadge } from '../../shared/types';
import { filterPublicProjects, PUBLIC_LISTING_STATUSES } from '../../src/lib/projects/filterPublicProjects';

// ─── Domain Constants ────────────────────────────────────────────────────────

const ALL_STATUSES: VerificationStatus[] = [
  'draft', 'submitted', 'prescreened', 'pending_audit', 'verified', 'live', 'funded',
];

const HIDDEN_STATUSES: VerificationStatus[] = [
  'draft', 'submitted', 'prescreened', 'pending_audit',
];

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate a random ISO date string within a reasonable range */
const dateArb = fc.integer({
  min: new Date('2020-01-01').getTime(),
  max: new Date('2030-12-31').getTime(),
}).map((ts) => new Date(ts).toISOString());

/** Generate a random verification status from all possible values */
const statusArb = fc.constantFrom(...ALL_STATUSES);

/** Generate a random verification badge */
const badgeArb: fc.Arbitrary<VerificationBadge> = fc.constantFrom(
  'None' as const, 'Verified' as const, 'Verified+' as const, 'Premium Assured' as const
);

/** Generate a minimal valid Project object with a given status */
function projectArb(status?: fc.Arbitrary<VerificationStatus>): fc.Arbitrary<Project> {
  return fc.record({
    projectId: fc.uuid(),
    title: fc.string({ minLength: 1, maxLength: 120 }),
    description: fc.string({ minLength: 1, maxLength: 200 }),
    category: fc.constantFrom('energy-saving', 'education', 'health', 'carbon-removal'),
    ownerId: fc.uuid(),
    location: fc.record({
      lat: fc.double({ min: -90, max: 90, noNaN: true }),
      lng: fc.double({ min: -180, max: 180, noNaN: true }),
      address: fc.string({ minLength: 1, maxLength: 100 }),
      country: fc.constantFrom('ZA', 'US', 'GB', 'KE', 'NG'),
    }),
    fundingGoal: fc.integer({ min: 1000, max: 999999999 }),
    fundingRaised: fc.integer({ min: 0, max: 999999999 }),
    impactMetrics: fc.record({
      reportingPeriod: fc.constantFrom('Monthly' as const, 'Quarterly' as const, 'Annually' as const, 'Project Duration' as const),
      primaryMetric: fc.record({
        label: fc.string({ minLength: 1, maxLength: 50 }),
        value: fc.integer({ min: 0, max: 1000000 }),
      }),
    }),
    verificationScore: fc.integer({ min: 0, max: 100 }),
    verificationStatus: status ?? statusArb,
    verificationBadge: badgeArb,
    documents: fc.array(fc.string(), { minLength: 0, maxLength: 5 }),
    createdAt: dateArb,
    updatedAt: dateArb,
  });
}

/** Generate a project that should be visible in public listings */
const visibleProjectArb = projectArb(fc.constantFrom('verified' as const, 'live' as const, 'funded' as const));

/** Generate a project that should be hidden from public listings */
const hiddenProjectArb = projectArb(fc.constantFrom('draft' as const, 'submitted' as const, 'prescreened' as const, 'pending_audit' as const));

/** Generate a mixed array of projects with various statuses */
const projectListArb = fc.array(projectArb(), { minLength: 0, maxLength: 30 });

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 26: Public project listing status filter', () => {
  /**
   * **Validates: Requirements 8.1**
   * Only projects with status verified/live/funded appear in results
   */
  it('only projects with status verified, live, or funded appear in public listing', () => {
    fc.assert(
      fc.property(projectListArb, (projects) => {
        const result = filterPublicProjects(projects);

        for (const project of result) {
          expect(PUBLIC_LISTING_STATUSES).toContain(project.verificationStatus);
        }
      }),
      { numRuns: 300 }
    );
  });

  /**
   * **Validates: Requirements 8.1**
   * Projects with draft/submitted/prescreened/pending_audit status never appear
   */
  it('projects with non-public statuses never appear in public listing', () => {
    fc.assert(
      fc.property(projectListArb, (projects) => {
        const result = filterPublicProjects(projects);

        for (const project of result) {
          expect(HIDDEN_STATUSES).not.toContain(project.verificationStatus);
        }
      }),
      { numRuns: 300 }
    );
  });

  /**
   * **Validates: Requirements 8.1**
   * The filter preserves all visible projects (no false negatives)
   */
  it('all projects with public statuses from input appear in the result', () => {
    fc.assert(
      fc.property(projectListArb, (projects) => {
        const result = filterPublicProjects(projects);
        const expectedVisible = projects.filter((p) =>
          PUBLIC_LISTING_STATUSES.includes(p.verificationStatus)
        );

        expect(result.length).toBe(expectedVisible.length);

        // Every expected visible project should be in the result
        for (const expected of expectedVisible) {
          expect(result.some((r) => r.projectId === expected.projectId)).toBe(true);
        }
      }),
      { numRuns: 300 }
    );
  });

  /**
   * **Validates: Requirements 8.1**
   * A list of only visible projects returns all of them
   */
  it('returns all projects when all have public statuses', () => {
    fc.assert(
      fc.property(
        fc.array(visibleProjectArb, { minLength: 1, maxLength: 20 }),
        (projects) => {
          const result = filterPublicProjects(projects);
          expect(result.length).toBe(projects.length);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 8.1**
   * A list of only hidden projects returns an empty result
   */
  it('returns empty array when all projects have non-public statuses', () => {
    fc.assert(
      fc.property(
        fc.array(hiddenProjectArb, { minLength: 1, maxLength: 20 }),
        (projects) => {
          const result = filterPublicProjects(projects);
          expect(result.length).toBe(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 8.1**
   * Results are sorted by most recently verified first (updatedAt descending)
   */
  it('results are sorted by updatedAt descending (most recent first)', () => {
    fc.assert(
      fc.property(
        fc.array(visibleProjectArb, { minLength: 2, maxLength: 20 }),
        (projects) => {
          const result = filterPublicProjects(projects);

          for (let i = 0; i < result.length - 1; i++) {
            const currentDate = new Date(result[i].updatedAt).getTime();
            const nextDate = new Date(result[i + 1].updatedAt).getTime();
            expect(currentDate).toBeGreaterThanOrEqual(nextDate);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 8.1**
   * Empty input produces empty output
   */
  it('returns empty array for empty input', () => {
    const result = filterPublicProjects([]);
    expect(result.length).toBe(0);
  });
});
