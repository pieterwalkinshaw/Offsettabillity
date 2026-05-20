/**
 * Property Test: Role-based dashboard data — Funder (Property 33)
 *
 * **Validates: Requirements 11.1**
 *
 * For any authenticated funder, the dashboard SHALL display:
 * - Their funded projects (up to 25, paginated)
 * - Total impact contribution as sum of confirmed funding amounts in ZAR cents
 * - Up to 10 verified projects matching their ESG profile interests that they have not yet funded
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type {
  FundingTransaction,
  FundingTransactionStatus,
  Project,
  VerificationStatus,
  EsgProfile,
} from '../../shared/types';
import {
  calculateTotalContribution,
  getFundedProjects,
  getRecommendedProjects,
  computeFunderDashboard,
} from '../../src/lib/dashboard/funderDashboard';

// ─── Domain Constants ────────────────────────────────────────────────────────

const ALL_TX_STATUSES: FundingTransactionStatus[] = ['pending', 'confirmed', 'failed', 'refunded'];
const ALL_VERIFICATION_STATUSES: VerificationStatus[] = [
  'draft', 'submitted', 'prescreened', 'pending_audit', 'verified', 'live', 'funded',
];
const ELIGIBLE_STATUSES: VerificationStatus[] = ['verified', 'live'];
const SAMPLE_CATEGORIES = [
  'energy-saving', 'renewable-energy', 'carbon-removal', 'education',
  'health', 'food-security', 'clean-water', 'waste-management',
  'biodiversity', 'housing', 'digital-inclusion', 'gender-equality',
];

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate a unique ID string */
const idArb = fc.stringMatching(/^[a-zA-Z0-9]{8,20}$/);

/** Generate a funder ID */
const funderIdArb = idArb;

/** Generate a project ID */
const projectIdArb = idArb;

/** Generate a funding transaction status */
const txStatusArb = fc.constantFrom<FundingTransactionStatus>(...ALL_TX_STATUSES);

/** Generate a verification status */
const verificationStatusArb = fc.constantFrom<VerificationStatus>(...ALL_VERIFICATION_STATUSES);

/** Generate a category */
const categoryArb = fc.constantFrom(...SAMPLE_CATEGORIES);

/** Generate a valid funding amount (1000–100000000 cents) */
const amountArb = fc.integer({ min: 1000, max: 100000000 });

/** Generate a funding transaction */
function fundingTransactionArb(funderIds: string[], projectIds: string[]) {
  return fc.record({
    transactionId: idArb,
    projectId: fc.constantFrom(...projectIds),
    funderId: fc.constantFrom(...funderIds),
    amount: amountArb,
    currency: fc.constant('ZAR'),
    status: txStatusArb,
    createdAt: fc.constant('2025-01-15T10:00:00Z'),
  });
}

/** Generate a project */
function projectArb(projectIds: string[]) {
  return fc.record({
    projectId: fc.constantFrom(...projectIds),
    title: fc.string({ minLength: 1, maxLength: 120 }),
    description: fc.string({ minLength: 1, maxLength: 200 }),
    category: categoryArb,
    ownerId: idArb,
    location: fc.record({
      lat: fc.double({ min: -90, max: 90, noNaN: true }),
      lng: fc.double({ min: -180, max: 180, noNaN: true }),
      address: fc.string({ minLength: 1, maxLength: 100 }),
      country: fc.stringMatching(/^[A-Z]{2}$/),
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
    verificationStatus: verificationStatusArb,
    verificationBadge: fc.constantFrom('None' as const, 'Verified' as const, 'Verified+' as const, 'Premium Assured' as const),
    documents: fc.constant([] as string[]),
    createdAt: fc.constant('2025-01-01T00:00:00Z'),
    updatedAt: fc.constant('2025-01-01T00:00:00Z'),
  });
}

/** Generate an ESG profile with interests */
const esgProfileArb: fc.Arbitrary<EsgProfile> = fc.record({
  industry: fc.string({ minLength: 1, maxLength: 50 }),
  budget: fc.integer({ min: 100, max: 999999999 }),
  interests: fc.subarray(SAMPLE_CATEGORIES, { minLength: 1, maxLength: 5 }),
});

// ─── Test Data Generator ─────────────────────────────────────────────────────

/**
 * Generates a complete test scenario with a target funder, multiple projects,
 * and funding transactions from multiple funders.
 */
function scenarioArb() {
  return fc.tuple(
    // Generate 2-4 funder IDs
    fc.array(funderIdArb, { minLength: 2, maxLength: 4 }),
    // Generate 5-15 project IDs
    fc.array(projectIdArb, { minLength: 5, maxLength: 15 }),
  ).chain(([funderIds, projectIds]) => {
    // Ensure unique IDs
    const uniqueFunderIds = [...new Set(funderIds)];
    const uniqueProjectIds = [...new Set(projectIds)];

    if (uniqueFunderIds.length < 2) uniqueFunderIds.push('funder-extra-1');
    if (uniqueProjectIds.length < 5) {
      while (uniqueProjectIds.length < 5) {
        uniqueProjectIds.push(`project-extra-${uniqueProjectIds.length}`);
      }
    }

    return fc.record({
      targetFunderId: fc.constant(uniqueFunderIds[0]),
      funderIds: fc.constant(uniqueFunderIds),
      projects: fc.array(projectArb(uniqueProjectIds), { minLength: 5, maxLength: 15 }),
      transactions: fc.array(
        fundingTransactionArb(uniqueFunderIds, uniqueProjectIds),
        { minLength: 3, maxLength: 30 }
      ),
      esgProfile: fc.option(esgProfileArb, { nil: undefined }),
    });
  });
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 33: Role-based dashboard data — Funder', () => {
  /**
   * **Validates: Requirements 11.1**
   * Total contribution equals sum of all confirmed funding amounts for the funder
   */
  it('total contribution equals sum of all confirmed funding amounts for the funder', () => {
    fc.assert(
      fc.property(scenarioArb(), (scenario) => {
        const { targetFunderId, transactions } = scenario;

        const result = calculateTotalContribution(transactions, targetFunderId);

        // Manually compute expected total
        const expectedTotal = transactions
          .filter((tx) => tx.funderId === targetFunderId && tx.status === 'confirmed')
          .reduce((sum, tx) => sum + tx.amount, 0);

        expect(result).toBe(expectedTotal);
      }),
      { numRuns: 300 }
    );
  });

  /**
   * **Validates: Requirements 11.1**
   * Total contribution only counts confirmed transactions, not pending/failed/refunded
   */
  it('total contribution excludes non-confirmed transactions (pending, failed, refunded)', () => {
    fc.assert(
      fc.property(scenarioArb(), (scenario) => {
        const { targetFunderId, transactions } = scenario;

        const result = calculateTotalContribution(transactions, targetFunderId);

        // Verify no non-confirmed amounts are included
        const nonConfirmedTotal = transactions
          .filter((tx) => tx.funderId === targetFunderId && tx.status !== 'confirmed')
          .reduce((sum, tx) => sum + tx.amount, 0);

        const confirmedTotal = transactions
          .filter((tx) => tx.funderId === targetFunderId && tx.status === 'confirmed')
          .reduce((sum, tx) => sum + tx.amount, 0);

        expect(result).toBe(confirmedTotal);
        // If there are non-confirmed transactions, the total should be less than all transactions
        if (nonConfirmedTotal > 0) {
          const allTotal = transactions
            .filter((tx) => tx.funderId === targetFunderId)
            .reduce((sum, tx) => sum + tx.amount, 0);
          expect(result).toBeLessThanOrEqual(allTotal);
        }
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 11.1**
   * Funded projects list contains only projects the funder has funded
   */
  it('funded projects list contains only projects the funder has funded', () => {
    fc.assert(
      fc.property(scenarioArb(), (scenario) => {
        const { targetFunderId, transactions, projects } = scenario;

        const result = getFundedProjects(transactions, projects, targetFunderId);

        // Get the set of project IDs the funder has confirmed funding for
        const confirmedProjectIds = new Set(
          transactions
            .filter((tx) => tx.funderId === targetFunderId && tx.status === 'confirmed')
            .map((tx) => tx.projectId)
        );

        // Every project in the result must be in the confirmed set
        for (const project of result) {
          expect(confirmedProjectIds.has(project.projectId)).toBe(true);
        }

        // Every confirmed project ID that exists in the projects list should be in the result
        for (const projectId of confirmedProjectIds) {
          const projectExists = projects.some((p) => p.projectId === projectId);
          if (projectExists) {
            expect(result.some((p) => p.projectId === projectId)).toBe(true);
          }
        }
      }),
      { numRuns: 300 }
    );
  });

  /**
   * **Validates: Requirements 11.1**
   * Funded projects list does not include projects funded only by other funders
   */
  it('funded projects list excludes projects funded only by other funders', () => {
    fc.assert(
      fc.property(scenarioArb(), (scenario) => {
        const { targetFunderId, transactions, projects } = scenario;

        const result = getFundedProjects(transactions, projects, targetFunderId);

        // Get project IDs funded by the target funder (confirmed)
        const targetFundedIds = new Set(
          transactions
            .filter((tx) => tx.funderId === targetFunderId && tx.status === 'confirmed')
            .map((tx) => tx.projectId)
        );

        // No project in the result should be outside the target funder's confirmed set
        for (const project of result) {
          expect(targetFundedIds.has(project.projectId)).toBe(true);
        }
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 11.1**
   * Recommended projects exclude already-funded projects
   */
  it('recommended projects exclude already-funded projects', () => {
    fc.assert(
      fc.property(scenarioArb(), (scenario) => {
        const { targetFunderId, transactions, projects, esgProfile } = scenario;

        const recommended = getRecommendedProjects(
          transactions, projects, targetFunderId, esgProfile
        );

        // Get the set of project IDs the funder has confirmed funding for
        const fundedProjectIds = new Set(
          transactions
            .filter((tx) => tx.funderId === targetFunderId && tx.status === 'confirmed')
            .map((tx) => tx.projectId)
        );

        // No recommended project should be in the funded set
        for (const project of recommended) {
          expect(fundedProjectIds.has(project.projectId)).toBe(false);
        }
      }),
      { numRuns: 300 }
    );
  });

  /**
   * **Validates: Requirements 11.1**
   * Recommended projects match the funder's ESG profile interests
   */
  it('recommended projects match the funder ESG profile interests when interests are set', () => {
    fc.assert(
      fc.property(scenarioArb(), (scenario) => {
        const { targetFunderId, transactions, projects, esgProfile } = scenario;

        // Only test when esgProfile has interests
        if (!esgProfile || !esgProfile.interests || esgProfile.interests.length === 0) {
          return; // Skip — no interests to match against
        }

        const recommended = getRecommendedProjects(
          transactions, projects, targetFunderId, esgProfile
        );

        // Every recommended project's category must be in the funder's interests
        for (const project of recommended) {
          expect(esgProfile.interests).toContain(project.category);
        }
      }),
      { numRuns: 300 }
    );
  });

  /**
   * **Validates: Requirements 11.1**
   * Recommended projects only include verified or live projects
   */
  it('recommended projects only include verified or live projects', () => {
    fc.assert(
      fc.property(scenarioArb(), (scenario) => {
        const { targetFunderId, transactions, projects, esgProfile } = scenario;

        const recommended = getRecommendedProjects(
          transactions, projects, targetFunderId, esgProfile
        );

        // Every recommended project must have status "verified" or "live"
        for (const project of recommended) {
          expect(ELIGIBLE_STATUSES).toContain(project.verificationStatus);
        }
      }),
      { numRuns: 300 }
    );
  });

  /**
   * **Validates: Requirements 11.1**
   * Recommended projects are limited to 10 results
   */
  it('recommended projects are limited to at most 10 results', () => {
    fc.assert(
      fc.property(scenarioArb(), (scenario) => {
        const { targetFunderId, transactions, projects, esgProfile } = scenario;

        const recommended = getRecommendedProjects(
          transactions, projects, targetFunderId, esgProfile
        );

        expect(recommended.length).toBeLessThanOrEqual(10);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 11.1**
   * computeFunderDashboard returns consistent data across all three sections
   */
  it('computeFunderDashboard returns consistent data across all sections', () => {
    fc.assert(
      fc.property(scenarioArb(), (scenario) => {
        const { targetFunderId, transactions, projects, esgProfile } = scenario;

        const dashboard = computeFunderDashboard(
          transactions, projects, targetFunderId, esgProfile
        );

        // Total contribution matches independent calculation
        const expectedTotal = transactions
          .filter((tx) => tx.funderId === targetFunderId && tx.status === 'confirmed')
          .reduce((sum, tx) => sum + tx.amount, 0);
        expect(dashboard.totalContribution).toBe(expectedTotal);

        // Funded projects are all actually funded
        const fundedIds = new Set(
          transactions
            .filter((tx) => tx.funderId === targetFunderId && tx.status === 'confirmed')
            .map((tx) => tx.projectId)
        );
        for (const project of dashboard.fundedProjects) {
          expect(fundedIds.has(project.projectId)).toBe(true);
        }

        // Recommended projects don't overlap with funded projects
        const fundedProjectIds = new Set(dashboard.fundedProjects.map((p) => p.projectId));
        for (const project of dashboard.recommendedProjects) {
          expect(fundedProjectIds.has(project.projectId)).toBe(false);
        }

        // Recommended projects are all verified or live
        for (const project of dashboard.recommendedProjects) {
          expect(['verified', 'live']).toContain(project.verificationStatus);
        }
      }),
      { numRuns: 300 }
    );
  });

  /**
   * **Validates: Requirements 11.1**
   * With no confirmed transactions, total contribution is 0 and funded projects is empty
   */
  it('with no confirmed transactions, total contribution is 0 and funded projects is empty', () => {
    fc.assert(
      fc.property(
        fc.array(projectIdArb, { minLength: 3, maxLength: 10 }),
        funderIdArb,
        (projectIds, funderId) => {
          const uniqueProjectIds = [...new Set(projectIds)];
          if (uniqueProjectIds.length < 3) return;

          // Create transactions that are all non-confirmed
          const nonConfirmedStatuses: FundingTransactionStatus[] = ['pending', 'failed', 'refunded'];
          const transactions: FundingTransaction[] = uniqueProjectIds.map((pid, i) => ({
            transactionId: `tx-${i}`,
            projectId: pid,
            funderId: funderId,
            amount: 50000 + i * 1000,
            currency: 'ZAR',
            status: nonConfirmedStatuses[i % nonConfirmedStatuses.length],
            createdAt: '2025-01-15T10:00:00Z',
          }));

          const total = calculateTotalContribution(transactions, funderId);
          expect(total).toBe(0);

          const projects: Project[] = uniqueProjectIds.map((pid) => ({
            projectId: pid,
            title: `Project ${pid}`,
            description: 'Test',
            category: 'education',
            ownerId: 'owner-1',
            location: { lat: 0, lng: 0, address: 'Test', country: 'ZA' },
            fundingGoal: 1000000,
            fundingRaised: 0,
            impactMetrics: { reportingPeriod: 'Monthly', primaryMetric: { label: 'People', value: 100 } },
            verificationScore: 80,
            verificationStatus: 'verified',
            verificationBadge: 'Verified',
            documents: [],
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
          }));

          const funded = getFundedProjects(transactions, projects, funderId);
          expect(funded).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
