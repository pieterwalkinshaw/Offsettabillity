/**
 * Property Test: Role-based dashboard data — Auditor (Property 35)
 *
 * **Validates: Requirements 11.3**
 *
 * For any authenticated approved auditor, the dashboard SHALL display:
 * - Assigned audits with status pending/in_progress
 * - Available projects matching their specializations with no conflict of interest
 * - Completed audits (up to 25, paginated)
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type {
  Audit,
  AuditStatus,
  AuditRecommendation,
  Project,
  FundingTransaction,
  FundingTransactionStatus,
  VerificationStatus,
  VerificationBadge,
} from '../../shared/types';
import {
  getAssignedAudits,
  getAvailableProjects,
  getCompletedAudits,
  computeAuditorDashboard,
  COMPLETED_AUDITS_PAGE_SIZE,
} from '../../src/lib/dashboard/auditorDashboard';

// ─── Domain Constants ────────────────────────────────────────────────────────

const ALL_AUDIT_STATUSES: AuditStatus[] = ['pending', 'in_progress', 'completed', 'rejected'];
const ACTIVE_AUDIT_STATUSES: AuditStatus[] = ['pending', 'in_progress'];
const ALL_RECOMMENDATIONS: AuditRecommendation[] = ['approve', 'conditional', 'reject'];
const ALL_VERIFICATION_STATUSES: VerificationStatus[] = [
  'draft', 'submitted', 'prescreened', 'pending_audit', 'verified', 'live', 'funded',
];
const AVAILABLE_PROJECT_STATUSES: VerificationStatus[] = ['prescreened', 'pending_audit'];
const ALL_BADGES: VerificationBadge[] = ['None', 'Verified', 'Verified+', 'Premium Assured'];
const ALL_TX_STATUSES: FundingTransactionStatus[] = ['pending', 'confirmed', 'failed', 'refunded'];
const SAMPLE_CATEGORIES = [
  'energy-saving', 'renewable-energy', 'carbon-removal', 'education',
  'health', 'food-security', 'clean-water', 'waste-management',
  'biodiversity', 'housing', 'digital-inclusion', 'gender-equality',
];

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate a unique ID string */
const idArb = fc.stringMatching(/^[a-zA-Z0-9]{8,20}$/);

/** Generate a random ISO date string */
const dateArb = fc.constant('2025-01-15T10:00:00Z');

/** Generate a category */
const categoryArb = fc.constantFrom(...SAMPLE_CATEGORIES);

/** Generate a set of specializations (1-4 categories) */
const specializationsArb = fc.subarray(SAMPLE_CATEGORIES, { minLength: 1, maxLength: 4 });

/** Generate a random audit */
function auditArb(auditorIds: string[], projectIds: string[]): fc.Arbitrary<Audit> {
  return fc.record({
    auditId: idArb,
    projectId: fc.constantFrom(...projectIds),
    auditorId: fc.constantFrom(...auditorIds),
    status: fc.constantFrom<AuditStatus>(...ALL_AUDIT_STATUSES),
    findings: fc.string({ minLength: 1, maxLength: 200 }),
    scoreContribution: fc.integer({ min: 0, max: 100 }),
    methodology: fc.string({ minLength: 1, maxLength: 100 }),
    recommendation: fc.constantFrom<AuditRecommendation>(...ALL_RECOMMENDATIONS),
    createdAt: dateArb,
    completedAt: dateArb,
  });
}

/** Generate a random project */
function projectArb(ownerIds: string[]): fc.Arbitrary<Project> {
  return fc.record({
    projectId: idArb,
    title: fc.string({ minLength: 1, maxLength: 120 }),
    description: fc.string({ minLength: 1, maxLength: 200 }),
    category: categoryArb,
    ownerId: fc.constantFrom(...ownerIds),
    location: fc.record({
      lat: fc.double({ min: -90, max: 90, noNaN: true }),
      lng: fc.double({ min: -180, max: 180, noNaN: true }),
      address: fc.string({ minLength: 1, maxLength: 100 }),
      country: fc.constantFrom('ZA', 'US', 'GB', 'KE'),
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
    verificationStatus: fc.constantFrom<VerificationStatus>(...ALL_VERIFICATION_STATUSES),
    verificationBadge: fc.constantFrom<VerificationBadge>(...ALL_BADGES),
    documents: fc.constant([] as string[]),
    createdAt: dateArb,
    updatedAt: dateArb,
  });
}

/** Generate a funding transaction */
function transactionArb(funderIds: string[], projectIds: string[]): fc.Arbitrary<FundingTransaction> {
  return fc.record({
    transactionId: idArb,
    projectId: fc.constantFrom(...projectIds),
    funderId: fc.constantFrom(...funderIds),
    amount: fc.integer({ min: 1000, max: 100000000 }),
    currency: fc.constant('ZAR'),
    status: fc.constantFrom<FundingTransactionStatus>(...ALL_TX_STATUSES),
    createdAt: dateArb,
  });
}

// ─── Scenario Generator ──────────────────────────────────────────────────────

/**
 * Generates a complete test scenario with a target auditor, multiple projects,
 * audits from multiple auditors, and funding transactions.
 */
function scenarioArb() {
  return fc.tuple(
    // Generate 2-4 auditor IDs
    fc.array(idArb, { minLength: 2, maxLength: 4 }),
    // Generate 3-6 owner IDs
    fc.array(idArb, { minLength: 3, maxLength: 6 }),
    // Generate 5-15 project IDs
    fc.array(idArb, { minLength: 5, maxLength: 15 }),
    // Generate 2-4 funder IDs
    fc.array(idArb, { minLength: 2, maxLength: 4 }),
  ).chain(([auditorIds, ownerIds, projectIds, funderIds]) => {
    // Ensure unique IDs
    const uniqueAuditorIds = [...new Set(auditorIds)];
    const uniqueOwnerIds = [...new Set(ownerIds)];
    const uniqueProjectIds = [...new Set(projectIds)];
    const uniqueFunderIds = [...new Set(funderIds)];

    if (uniqueAuditorIds.length < 2) uniqueAuditorIds.push('auditor-extra-1');
    if (uniqueOwnerIds.length < 3) {
      while (uniqueOwnerIds.length < 3) uniqueOwnerIds.push(`owner-extra-${uniqueOwnerIds.length}`);
    }
    if (uniqueProjectIds.length < 5) {
      while (uniqueProjectIds.length < 5) uniqueProjectIds.push(`project-extra-${uniqueProjectIds.length}`);
    }
    if (uniqueFunderIds.length < 2) uniqueFunderIds.push('funder-extra-1');

    return fc.record({
      targetAuditorId: fc.constant(uniqueAuditorIds[0]),
      auditorIds: fc.constant(uniqueAuditorIds),
      specializations: specializationsArb,
      projects: fc.array(projectArb(uniqueOwnerIds), { minLength: 5, maxLength: 15 }),
      audits: fc.array(auditArb(uniqueAuditorIds, uniqueProjectIds), { minLength: 3, maxLength: 30 }),
      transactions: fc.array(transactionArb(uniqueFunderIds, uniqueProjectIds), { minLength: 0, maxLength: 15 }),
    });
  });
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 35: Role-based dashboard data — Auditor', () => {
  /**
   * **Validates: Requirements 11.3**
   * Auditor sees only their assigned audits with status pending or in_progress
   */
  it('auditor sees assigned audits with status pending or in_progress only', () => {
    fc.assert(
      fc.property(scenarioArb(), (scenario) => {
        const { targetAuditorId, audits } = scenario;

        const result = getAssignedAudits(audits, targetAuditorId);

        // All returned audits belong to the target auditor
        for (const audit of result) {
          expect(audit.auditorId).toBe(targetAuditorId);
        }

        // All returned audits have status pending or in_progress
        for (const audit of result) {
          expect(ACTIVE_AUDIT_STATUSES).toContain(audit.status);
        }

        // All audits matching the criteria are included (no false negatives)
        const expectedCount = audits.filter(
          (a) => a.auditorId === targetAuditorId &&
            (a.status === 'pending' || a.status === 'in_progress')
        ).length;
        expect(result.length).toBe(expectedCount);
      }),
      { numRuns: 300 }
    );
  });

  /**
   * **Validates: Requirements 11.3**
   * Available projects match at least one of the auditor's specializations
   */
  it('available projects match at least one of the auditor specializations', () => {
    fc.assert(
      fc.property(scenarioArb(), (scenario) => {
        const { targetAuditorId, specializations, projects, audits, transactions } = scenario;

        const result = getAvailableProjects(
          projects, audits, transactions, targetAuditorId, specializations
        );

        // Every available project's category must be in the auditor's specializations
        for (const project of result) {
          expect(specializations).toContain(project.category);
        }
      }),
      { numRuns: 300 }
    );
  });

  /**
   * **Validates: Requirements 11.3**
   * Available projects exclude conflict of interest (owned by auditor)
   */
  it('available projects exclude projects owned by the auditor', () => {
    fc.assert(
      fc.property(scenarioArb(), (scenario) => {
        const { targetAuditorId, specializations, projects, audits, transactions } = scenario;

        const result = getAvailableProjects(
          projects, audits, transactions, targetAuditorId, specializations
        );

        // No available project should be owned by the auditor
        for (const project of result) {
          expect(project.ownerId).not.toBe(targetAuditorId);
        }
      }),
      { numRuns: 300 }
    );
  });

  /**
   * **Validates: Requirements 11.3**
   * Available projects exclude conflict of interest (funded by auditor)
   */
  it('available projects exclude projects funded by the auditor', () => {
    fc.assert(
      fc.property(scenarioArb(), (scenario) => {
        const { targetAuditorId, specializations, projects, audits, transactions } = scenario;

        const result = getAvailableProjects(
          projects, audits, transactions, targetAuditorId, specializations
        );

        // Get project IDs funded by the auditor
        const fundedByAuditor = new Set(
          transactions
            .filter((tx) => tx.funderId === targetAuditorId && tx.status === 'confirmed')
            .map((tx) => tx.projectId)
        );

        // No available project should be funded by the auditor
        for (const project of result) {
          expect(fundedByAuditor.has(project.projectId)).toBe(false);
        }
      }),
      { numRuns: 300 }
    );
  });

  /**
   * **Validates: Requirements 11.3**
   * Available projects exclude conflict of interest (previously audited by auditor)
   */
  it('available projects exclude projects previously audited by the auditor', () => {
    fc.assert(
      fc.property(scenarioArb(), (scenario) => {
        const { targetAuditorId, specializations, projects, audits, transactions } = scenario;

        const result = getAvailableProjects(
          projects, audits, transactions, targetAuditorId, specializations
        );

        // Get project IDs previously audited (completed) by the auditor
        const previouslyAudited = new Set(
          audits
            .filter((a) => a.auditorId === targetAuditorId && a.status === 'completed')
            .map((a) => a.projectId)
        );

        // No available project should have been previously audited by this auditor
        for (const project of result) {
          expect(previouslyAudited.has(project.projectId)).toBe(false);
        }
      }),
      { numRuns: 300 }
    );
  });

  /**
   * **Validates: Requirements 11.3**
   * Completed audits are paginated at 25 per page
   */
  it('completed audits are paginated at 25 per page', () => {
    fc.assert(
      fc.property(
        idArb,
        fc.array(idArb, { minLength: 1, maxLength: 5 }),
        fc.integer({ min: 30, max: 60 }),
        (auditorId, projectIds, auditCount) => {
          const uniqueProjectIds = [...new Set(projectIds)];
          if (uniqueProjectIds.length < 1) return;

          // Create more than 25 completed audits for this auditor
          const audits: Audit[] = Array.from({ length: auditCount }, (_, i) => ({
            auditId: `audit-${i}`,
            projectId: uniqueProjectIds[i % uniqueProjectIds.length],
            auditorId: auditorId,
            status: 'completed' as const,
            findings: `Finding ${i}`,
            scoreContribution: 50,
            methodology: 'Standard',
            recommendation: 'approve' as const,
            createdAt: '2025-01-15T10:00:00Z',
            completedAt: '2025-01-15T10:00:00Z',
          }));

          // Page 0 should return exactly 25
          const page0 = getCompletedAudits(audits, auditorId, 0);
          expect(page0.length).toBe(COMPLETED_AUDITS_PAGE_SIZE);

          // Page 1 should return the remainder (up to 25)
          const page1 = getCompletedAudits(audits, auditorId, 1);
          expect(page1.length).toBe(Math.min(auditCount - 25, COMPLETED_AUDITS_PAGE_SIZE));

          // Total across pages should equal total completed audits
          const totalPages = Math.ceil(auditCount / COMPLETED_AUDITS_PAGE_SIZE);
          let totalReturned = 0;
          for (let p = 0; p < totalPages; p++) {
            totalReturned += getCompletedAudits(audits, auditorId, p).length;
          }
          expect(totalReturned).toBe(auditCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 11.3**
   * Completed audits only include audits with status "completed" for this auditor
   */
  it('completed audits only include audits with status completed for this auditor', () => {
    fc.assert(
      fc.property(scenarioArb(), (scenario) => {
        const { targetAuditorId, audits } = scenario;

        const result = getCompletedAudits(audits, targetAuditorId, 0);

        // All returned audits belong to the target auditor
        for (const audit of result) {
          expect(audit.auditorId).toBe(targetAuditorId);
        }

        // All returned audits have status "completed"
        for (const audit of result) {
          expect(audit.status).toBe('completed');
        }
      }),
      { numRuns: 300 }
    );
  });

  /**
   * **Validates: Requirements 11.3**
   * computeAuditorDashboard returns consistent data across all sections
   */
  it('computeAuditorDashboard returns consistent data across all sections', () => {
    fc.assert(
      fc.property(scenarioArb(), (scenario) => {
        const { targetAuditorId, specializations, projects, audits, transactions } = scenario;

        const dashboard = computeAuditorDashboard(
          audits, projects, transactions, targetAuditorId, specializations
        );

        // Assigned audits are all pending/in_progress for this auditor
        for (const audit of dashboard.assignedAudits) {
          expect(audit.auditorId).toBe(targetAuditorId);
          expect(ACTIVE_AUDIT_STATUSES).toContain(audit.status);
        }

        // Available projects match specializations
        for (const project of dashboard.availableProjects) {
          expect(specializations).toContain(project.category);
        }

        // Available projects have no conflict of interest (not owned by auditor)
        for (const project of dashboard.availableProjects) {
          expect(project.ownerId).not.toBe(targetAuditorId);
        }

        // Completed audits are all completed and belong to this auditor
        for (const audit of dashboard.completedAudits) {
          expect(audit.auditorId).toBe(targetAuditorId);
          expect(audit.status).toBe('completed');
        }

        // Completed audits are paginated at 25
        expect(dashboard.completedAudits.length).toBeLessThanOrEqual(COMPLETED_AUDITS_PAGE_SIZE);
      }),
      { numRuns: 300 }
    );
  });

  /**
   * **Validates: Requirements 11.3**
   * Available projects only include projects needing verification (prescreened/pending_audit)
   */
  it('available projects only include projects with status prescreened or pending_audit', () => {
    fc.assert(
      fc.property(scenarioArb(), (scenario) => {
        const { targetAuditorId, specializations, projects, audits, transactions } = scenario;

        const result = getAvailableProjects(
          projects, audits, transactions, targetAuditorId, specializations
        );

        // Every available project must have status prescreened or pending_audit
        for (const project of result) {
          expect(AVAILABLE_PROJECT_STATUSES).toContain(project.verificationStatus);
        }
      }),
      { numRuns: 300 }
    );
  });
});
