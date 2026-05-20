/**
 * Property Test: Role-based dashboard data — Owner (Property 34)
 *
 * Validates: Requirements 11.2
 *
 * For any authenticated project owner, the dashboard SHALL display:
 * their projects with current verification status and badge, funding progress
 * as percentage of goal, and pending actions (drafts needing submission,
 * submitted projects awaiting pre-screening, projects with unresolved audit findings).
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type {
  Project,
  Audit,
  VerificationStatus,
  VerificationBadge,
  AuditStatus,
  AuditRecommendation,
} from '../../shared/types';
import {
  getOwnerProjects,
  calculateFundingProgress,
  computePendingActions,
  buildOwnerDashboardData,
} from '../../src/lib/projects/ownerDashboard';

// ─── Domain Constants ────────────────────────────────────────────────────────

const ALL_STATUSES: VerificationStatus[] = [
  'draft', 'submitted', 'prescreened', 'pending_audit', 'verified', 'live', 'funded',
];

const ALL_BADGES: VerificationBadge[] = ['None', 'Verified', 'Verified+', 'Premium Assured'];

const ALL_AUDIT_STATUSES: AuditStatus[] = ['pending', 'in_progress', 'completed', 'rejected'];

const ALL_RECOMMENDATIONS: AuditRecommendation[] = ['approve', 'conditional', 'reject'];

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate a random ISO date string */
const dateArb = fc.integer({
  min: new Date('2020-01-01').getTime(),
  max: new Date('2030-12-31').getTime(),
}).map((ts) => new Date(ts).toISOString());

/** Generate a random owner ID */
const ownerIdArb = fc.uuid();

/** Generate a random verification status */
const statusArb = fc.constantFrom<VerificationStatus>(...ALL_STATUSES);

/** Generate a random verification badge */
const badgeArb = fc.constantFrom<VerificationBadge>(...ALL_BADGES);

/** Generate a minimal valid Project object with configurable ownerId and status */
function projectArb(
  ownerId?: fc.Arbitrary<string>,
  status?: fc.Arbitrary<VerificationStatus>
): fc.Arbitrary<Project> {
  return fc.record({
    projectId: fc.uuid(),
    title: fc.string({ minLength: 1, maxLength: 120 }),
    description: fc.string({ minLength: 1, maxLength: 200 }),
    category: fc.constantFrom('energy-saving', 'education', 'health', 'carbon-removal'),
    ownerId: ownerId ?? fc.uuid(),
    location: fc.record({
      lat: fc.double({ min: -90, max: 90, noNaN: true }),
      lng: fc.double({ min: -180, max: 180, noNaN: true }),
      address: fc.string({ minLength: 1, maxLength: 100 }),
      country: fc.constantFrom('ZA', 'US', 'GB', 'KE', 'NG'),
    }),
    fundingGoal: fc.integer({ min: 1000, max: 999999999 }),
    fundingRaised: fc.integer({ min: 0, max: 999999999 }),
    impactMetrics: fc.record({
      reportingPeriod: fc.constantFrom(
        'Monthly' as const, 'Quarterly' as const, 'Annually' as const, 'Project Duration' as const
      ),
      primaryMetric: fc.record({
        label: fc.string({ minLength: 1, maxLength: 50 }),
        value: fc.integer({ min: 0, max: 1000000 }),
      }),
    }),
    verificationScore: fc.integer({ min: 0, max: 100 }),
    verificationStatus: status ?? statusArb,
    verificationBadge: badgeArb,
    documents: fc.array(fc.string({ minLength: 1 }), { minLength: 0, maxLength: 5 }),
    createdAt: dateArb,
    updatedAt: dateArb,
  });
}

/** Generate a random Audit record */
function auditArb(projectId?: fc.Arbitrary<string>): fc.Arbitrary<Audit> {
  return fc.record({
    auditId: fc.uuid(),
    projectId: projectId ?? fc.uuid(),
    auditorId: fc.uuid(),
    status: fc.constantFrom<AuditStatus>(...ALL_AUDIT_STATUSES),
    findings: fc.string({ minLength: 1, maxLength: 200 }),
    scoreContribution: fc.integer({ min: 0, max: 100 }),
    methodology: fc.string({ minLength: 1, maxLength: 100 }),
    recommendation: fc.constantFrom<AuditRecommendation>(...ALL_RECOMMENDATIONS),
    createdAt: dateArb,
    completedAt: dateArb,
  });
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 34: Role-based dashboard data — Owner', () => {
  /**
   * **Validates: Requirements 11.2**
   * Owner sees all their own projects (filtered by ownerId)
   */
  it('owner sees all and only their own projects filtered by ownerId', () => {
    fc.assert(
      fc.property(
        ownerIdArb,
        fc.array(projectArb(), { minLength: 0, maxLength: 20 }),
        (ownerId, allProjects) => {
          const ownerProjects = getOwnerProjects(allProjects, ownerId);

          // All returned projects belong to the owner
          for (const project of ownerProjects) {
            expect(project.ownerId).toBe(ownerId);
          }

          // All projects belonging to the owner are returned (no false negatives)
          const expectedCount = allProjects.filter((p) => p.ownerId === ownerId).length;
          expect(ownerProjects.length).toBe(expectedCount);
        }
      ),
      { numRuns: 300 }
    );
  });

  /**
   * **Validates: Requirements 11.2**
   * Owner sees only their own projects when mixed with other owners' projects
   */
  it('owner does not see projects belonging to other owners', () => {
    fc.assert(
      fc.property(
        ownerIdArb,
        fc.uuid(),
        fc.array(projectArb(), { minLength: 1, maxLength: 10 }),
        fc.array(projectArb(), { minLength: 1, maxLength: 10 }),
        (ownerId, otherOwnerId, ownerProjectsRaw, otherProjectsRaw) => {
          // Ensure different owners
          fc.pre(ownerId !== otherOwnerId);

          // Assign ownership
          const ownerProjects = ownerProjectsRaw.map((p) => ({ ...p, ownerId }));
          const otherProjects = otherProjectsRaw.map((p) => ({ ...p, ownerId: otherOwnerId }));
          const allProjects = [...ownerProjects, ...otherProjects];

          const result = getOwnerProjects(allProjects, ownerId);

          expect(result.length).toBe(ownerProjects.length);
          for (const project of result) {
            expect(project.ownerId).toBe(ownerId);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 11.2**
   * Each project shows verificationStatus and verificationBadge
   */
  it('each project in dashboard data includes verificationStatus and verificationBadge', () => {
    fc.assert(
      fc.property(
        ownerIdArb,
        fc.array(projectArb(), { minLength: 1, maxLength: 15 }),
        (ownerId, allProjectsRaw) => {
          // Ensure at least some projects belong to the owner
          const allProjects = allProjectsRaw.map((p, i) =>
            i === 0 ? { ...p, ownerId } : p
          );

          const dashboardData = buildOwnerDashboardData(allProjects, [], ownerId);

          for (const projectSummary of dashboardData.projects) {
            // verificationStatus must be one of the valid statuses
            expect(ALL_STATUSES).toContain(projectSummary.verificationStatus);
            // verificationBadge must be one of the valid badges
            expect(ALL_BADGES).toContain(projectSummary.verificationBadge);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 11.2**
   * Funding progress is calculated as fundingRaised/fundingGoal percentage
   */
  it('funding progress is correctly calculated as (fundingRaised / fundingGoal) * 100', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 999999999 }),
        fc.integer({ min: 1000, max: 999999999 }),
        (fundingRaised, fundingGoal) => {
          const progress = calculateFundingProgress(fundingRaised, fundingGoal);
          const expected = (fundingRaised / fundingGoal) * 100;

          expect(progress).toBeCloseTo(expected, 10);
        }
      ),
      { numRuns: 300 }
    );
  });

  /**
   * **Validates: Requirements 11.2**
   * Funding progress is 0 when fundingGoal is 0 (avoids division by zero)
   */
  it('funding progress is 0 when fundingGoal is 0 or negative', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 999999999 }),
        fc.integer({ min: -1000, max: 0 }),
        (fundingRaised, fundingGoal) => {
          const progress = calculateFundingProgress(fundingRaised, fundingGoal);
          expect(progress).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 11.2**
   * Funding progress in dashboard data matches the formula for each project
   */
  it('dashboard project summaries have correct funding progress percentages', () => {
    fc.assert(
      fc.property(
        ownerIdArb,
        fc.array(projectArb(), { minLength: 1, maxLength: 10 }),
        (ownerId, allProjectsRaw) => {
          const allProjects = allProjectsRaw.map((p) => ({ ...p, ownerId }));
          const dashboardData = buildOwnerDashboardData(allProjects, [], ownerId);

          for (const summary of dashboardData.projects) {
            const expected = summary.fundingGoal > 0
              ? (summary.fundingRaised / summary.fundingGoal) * 100
              : 0;
            expect(summary.fundingProgressPercent).toBeCloseTo(expected, 10);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 11.2**
   * Pending actions correctly count drafts needing submission
   */
  it('pending actions counts drafts needing submission correctly', () => {
    fc.assert(
      fc.property(
        ownerIdArb,
        fc.array(
          projectArb(undefined, fc.constantFrom<VerificationStatus>(...ALL_STATUSES)),
          { minLength: 1, maxLength: 15 }
        ),
        (ownerId, allProjectsRaw) => {
          const ownerProjects = allProjectsRaw.map((p) => ({ ...p, ownerId }));
          const pendingActions = computePendingActions(ownerProjects, []);

          const expectedDrafts = ownerProjects.filter(
            (p) => p.verificationStatus === 'draft'
          ).length;

          expect(pendingActions.draftsNeedingSubmission).toBe(expectedDrafts);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 11.2**
   * Pending actions correctly count submitted projects awaiting pre-screening
   */
  it('pending actions counts submitted projects awaiting pre-screening correctly', () => {
    fc.assert(
      fc.property(
        ownerIdArb,
        fc.array(
          projectArb(undefined, fc.constantFrom<VerificationStatus>(...ALL_STATUSES)),
          { minLength: 1, maxLength: 15 }
        ),
        (ownerId, allProjectsRaw) => {
          const ownerProjects = allProjectsRaw.map((p) => ({ ...p, ownerId }));
          const pendingActions = computePendingActions(ownerProjects, []);

          const expectedSubmitted = ownerProjects.filter(
            (p) => p.verificationStatus === 'submitted'
          ).length;

          expect(pendingActions.submittedAwaitingPrescreen).toBe(expectedSubmitted);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 11.2**
   * Pending actions correctly count unresolved audit findings
   */
  it('pending actions counts unresolved audit findings correctly', () => {
    fc.assert(
      fc.property(
        ownerIdArb,
        fc.array(projectArb(), { minLength: 1, maxLength: 10 }),
        fc.array(auditArb(), { minLength: 0, maxLength: 15 }),
        (ownerId, allProjectsRaw, auditsRaw) => {
          const ownerProjects = allProjectsRaw.map((p) => ({ ...p, ownerId }));
          const ownerProjectIds = new Set(ownerProjects.map((p) => p.projectId));

          // Make some audits reference owner projects
          const audits = auditsRaw.map((a, i) =>
            i % 2 === 0 && ownerProjects.length > 0
              ? { ...a, projectId: ownerProjects[i % ownerProjects.length].projectId }
              : a
          );

          const pendingActions = computePendingActions(ownerProjects, audits);

          // Manually count expected unresolved findings
          const expectedUnresolved = audits.filter(
            (a) =>
              ownerProjectIds.has(a.projectId) &&
              a.status === 'completed' &&
              (a.recommendation === 'conditional' || a.recommendation === 'reject')
          ).length;

          expect(pendingActions.unresolvedAuditFindings).toBe(expectedUnresolved);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 11.2**
   * Audits for non-owner projects do not count as pending actions
   */
  it('audits for non-owner projects do not affect pending actions', () => {
    fc.assert(
      fc.property(
        ownerIdArb,
        fc.uuid(),
        fc.array(projectArb(), { minLength: 1, maxLength: 5 }),
        fc.array(projectArb(), { minLength: 1, maxLength: 5 }),
        (ownerId, otherOwnerId, ownerProjectsRaw, otherProjectsRaw) => {
          fc.pre(ownerId !== otherOwnerId);

          const ownerProjects = ownerProjectsRaw.map((p) => ({ ...p, ownerId }));
          const otherProjects = otherProjectsRaw.map((p) => ({ ...p, ownerId: otherOwnerId }));

          // Create audits only for other owner's projects with unresolved findings
          const otherAudits: Audit[] = otherProjects.map((p) => ({
            auditId: crypto.randomUUID(),
            projectId: p.projectId,
            auditorId: crypto.randomUUID(),
            status: 'completed' as const,
            findings: 'Some findings',
            scoreContribution: 50,
            methodology: 'Standard',
            recommendation: 'reject' as const,
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          }));

          const pendingActions = computePendingActions(ownerProjects, otherAudits);

          // Other owner's audits should not count
          expect(pendingActions.unresolvedAuditFindings).toBe(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 11.2**
   * buildOwnerDashboardData integrates all components correctly
   */
  it('buildOwnerDashboardData returns correct integrated data for owner', () => {
    fc.assert(
      fc.property(
        ownerIdArb,
        fc.array(projectArb(), { minLength: 0, maxLength: 15 }),
        fc.array(auditArb(), { minLength: 0, maxLength: 10 }),
        (ownerId, allProjectsRaw, audits) => {
          // Mix owner and non-owner projects
          const allProjects = allProjectsRaw.map((p, i) =>
            i % 3 === 0 ? { ...p, ownerId } : p
          );

          const dashboardData = buildOwnerDashboardData(allProjects, audits, ownerId);

          // Verify project count matches owner's projects
          const expectedOwnerCount = allProjects.filter((p) => p.ownerId === ownerId).length;
          expect(dashboardData.projects.length).toBe(expectedOwnerCount);

          // Verify pending actions structure
          expect(dashboardData.pendingActions).toHaveProperty('draftsNeedingSubmission');
          expect(dashboardData.pendingActions).toHaveProperty('submittedAwaitingPrescreen');
          expect(dashboardData.pendingActions).toHaveProperty('unresolvedAuditFindings');

          // All counts are non-negative
          expect(dashboardData.pendingActions.draftsNeedingSubmission).toBeGreaterThanOrEqual(0);
          expect(dashboardData.pendingActions.submittedAwaitingPrescreen).toBeGreaterThanOrEqual(0);
          expect(dashboardData.pendingActions.unresolvedAuditFindings).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 200 }
    );
  });
});
