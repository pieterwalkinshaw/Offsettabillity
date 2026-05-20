/**
 * Property Test: Verification score weighted calculation (Property 12)
 *
 * Validates: Requirements 4.8
 *
 * For any set of audit data and project documentation state, the verification score
 * SHALL equal the weighted sum: documentationCompleteness × 0.20 + auditorAssessment × 0.40
 * + impactMethodology × 0.20 + reportingCompliance × 0.20, rounded to the nearest integer
 * in the range 0–100.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { Project, Audit, ReportingPeriod } from '../../shared/types';
import {
  calculateVerificationScore,
  calculateDocumentationScore,
  calculateAuditScore,
  calculateMethodologyScore,
  calculateComplianceScore,
} from '../../src/lib/verification/score';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate a random reporting period */
const reportingPeriodArb: fc.Arbitrary<ReportingPeriod> = fc.constantFrom(
  'Monthly' as const,
  'Quarterly' as const,
  'Annually' as const,
  'Project Duration' as const
);

/** Generate a random array of document paths (0-15 documents) */
const documentsArb = fc.array(
  fc.stringMatching(/^projects\/[a-z0-9]+\/documents\/[a-z0-9]+\.(pdf|png|jpg)$/),
  { minLength: 0, maxLength: 15 }
);

/** Generate a minimal valid project with varying document counts and impact metrics */
const projectArb: fc.Arbitrary<Project> = fc.record({
  projectId: fc.stringMatching(/^[a-z0-9]{10,20}$/),
  title: fc.string({ minLength: 1, maxLength: 120 }),
  description: fc.string({ minLength: 1, maxLength: 200 }),
  category: fc.constantFrom('energy-saving', 'education', 'health', 'carbon-removal'),
  ownerId: fc.stringMatching(/^[a-z0-9]{10,20}$/),
  location: fc.record({
    lat: fc.double({ min: -90, max: 90, noNaN: true }),
    lng: fc.double({ min: -180, max: 180, noNaN: true }),
    address: fc.string({ minLength: 1, maxLength: 100 }),
    country: fc.constantFrom('ZA', 'US', 'GB', 'KE', 'NG'),
  }),
  fundingGoal: fc.integer({ min: 1000, max: 999999999 }),
  fundingRaised: fc.integer({ min: 0, max: 999999999 }),
  impactMetrics: fc.record({
    reportingPeriod: reportingPeriodArb,
    primaryMetric: fc.record({
      label: fc.constantFrom('kWh Saved', 'People Trained', 'Tons CO2e Removed'),
      value: fc.double({ min: 0, max: 1000000, noNaN: true }),
    }),
  }),
  verificationScore: fc.integer({ min: 0, max: 100 }),
  verificationStatus: fc.constantFrom(
    'draft' as const, 'submitted' as const, 'prescreened' as const,
    'pending_audit' as const, 'verified' as const, 'live' as const, 'funded' as const
  ),
  verificationBadge: fc.constantFrom(
    'None' as const, 'Verified' as const, 'Verified+' as const, 'Premium Assured' as const
  ),
  documents: documentsArb,
  createdAt: fc.constant('2025-01-01T00:00:00Z'),
  updatedAt: fc.constant('2025-01-01T00:00:00Z'),
});

/** Generate a random completed audit with varying scores and methodologies */
const completedAuditArb: fc.Arbitrary<Audit> = fc.record({
  auditId: fc.stringMatching(/^[a-z0-9]{10,20}$/),
  projectId: fc.stringMatching(/^[a-z0-9]{10,20}$/),
  auditorId: fc.stringMatching(/^[a-z0-9]{10,20}$/),
  status: fc.constant('completed' as const),
  findings: fc.string({ minLength: 10, maxLength: 500 }),
  scoreContribution: fc.integer({ min: 0, max: 100 }),
  methodology: fc.oneof(
    // Short methodology (< 50 chars)
    fc.string({ minLength: 1, maxLength: 49 }),
    // Medium methodology (50-200 chars)
    fc.string({ minLength: 50, maxLength: 200 }),
    // Detailed methodology (> 200 chars)
    fc.string({ minLength: 201, maxLength: 400 })
  ),
  recommendation: fc.constantFrom('approve' as const, 'conditional' as const, 'reject' as const),
  createdAt: fc.constant('2025-01-01T00:00:00Z'),
  completedAt: fc.constant('2025-02-01T00:00:00Z'),
});

/** Generate a random pending/in_progress audit (no score contribution) */
const incompleteAuditArb: fc.Arbitrary<Audit> = fc.record({
  auditId: fc.stringMatching(/^[a-z0-9]{10,20}$/),
  projectId: fc.stringMatching(/^[a-z0-9]{10,20}$/),
  auditorId: fc.stringMatching(/^[a-z0-9]{10,20}$/),
  status: fc.constantFrom('pending' as const, 'in_progress' as const),
  createdAt: fc.constant('2025-01-01T00:00:00Z'),
});

/** Generate a mixed array of audits (completed and incomplete) */
const auditsArb: fc.Arbitrary<Audit[]> = fc.tuple(
  fc.array(completedAuditArb, { minLength: 0, maxLength: 5 }),
  fc.array(incompleteAuditArb, { minLength: 0, maxLength: 3 })
).map(([completed, incomplete]) => [...completed, ...incomplete]);

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 12: Verification score weighted calculation', () => {
  /**
   * **Validates: Requirements 4.8**
   * The verification score is always in the range 0-100.
   */
  it('score is always in range 0-100', () => {
    fc.assert(
      fc.property(projectArb, auditsArb, (project, audits) => {
        const score = calculateVerificationScore(project, audits);

        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }),
      { numRuns: 300 }
    );
  });

  /**
   * **Validates: Requirements 4.8**
   * Score equals the weighted sum of sub-scores:
   * doc × 0.20 + audit × 0.40 + methodology × 0.20 + compliance × 0.20
   */
  it('score equals the weighted sum of sub-scores', () => {
    fc.assert(
      fc.property(projectArb, auditsArb, (project, audits) => {
        const docScore = calculateDocumentationScore(project);
        const auditScore = calculateAuditScore(audits);
        const methodologyScore = calculateMethodologyScore(audits);
        const complianceScore = calculateComplianceScore(project);

        const expectedScore = Math.round(
          docScore * 0.20 +
          auditScore * 0.40 +
          methodologyScore * 0.20 +
          complianceScore * 0.20
        );

        const actualScore = calculateVerificationScore(project, audits);

        expect(actualScore).toBe(expectedScore);
      }),
      { numRuns: 300 }
    );
  });

  /**
   * **Validates: Requirements 4.8**
   * More documents increase the documentation sub-score (monotonically non-decreasing).
   */
  it('more documents increase the documentation sub-score', () => {
    fc.assert(
      fc.property(projectArb, (project) => {
        // Create project variants with increasing document counts
        const withZeroDocs = { ...project, documents: [] };
        const withOneDocs = { ...project, documents: ['doc1.pdf'] };
        const withFiveDocs = { ...project, documents: Array.from({ length: 5 }, (_, i) => `doc${i}.pdf`) };
        const withTenDocs = { ...project, documents: Array.from({ length: 10 }, (_, i) => `doc${i}.pdf`) };

        const score0 = calculateDocumentationScore(withZeroDocs);
        const score1 = calculateDocumentationScore(withOneDocs);
        const score5 = calculateDocumentationScore(withFiveDocs);
        const score10 = calculateDocumentationScore(withTenDocs);

        // Monotonically non-decreasing
        expect(score1).toBeGreaterThanOrEqual(score0);
        expect(score5).toBeGreaterThanOrEqual(score1);
        expect(score10).toBeGreaterThanOrEqual(score5);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 4.8**
   * Higher audit scoreContributions increase the auditor assessment sub-score.
   */
  it('higher audit scoreContributions increase the audit sub-score', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 51, max: 100 }),
        (lowScore, highScore) => {
          const lowAudit: Audit = {
            auditId: 'audit-low',
            projectId: 'proj-1',
            auditorId: 'auditor-1',
            status: 'completed',
            findings: 'Some findings',
            scoreContribution: lowScore,
            methodology: 'Standard methodology',
            recommendation: 'approve',
            createdAt: '2025-01-01T00:00:00Z',
            completedAt: '2025-02-01T00:00:00Z',
          };

          const highAudit: Audit = {
            auditId: 'audit-high',
            projectId: 'proj-1',
            auditorId: 'auditor-1',
            status: 'completed',
            findings: 'Some findings',
            scoreContribution: highScore,
            methodology: 'Standard methodology',
            recommendation: 'approve',
            createdAt: '2025-01-01T00:00:00Z',
            completedAt: '2025-02-01T00:00:00Z',
          };

          const lowResult = calculateAuditScore([lowAudit]);
          const highResult = calculateAuditScore([highAudit]);

          expect(highResult).toBeGreaterThanOrEqual(lowResult);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 4.8**
   * Projects with no audits have score based only on documentation and compliance
   * (audit and methodology sub-scores are 0).
   */
  it('projects with no audits have score based only on documentation and compliance', () => {
    fc.assert(
      fc.property(projectArb, (project) => {
        const noAudits: Audit[] = [];

        const score = calculateVerificationScore(project, noAudits);
        const docScore = calculateDocumentationScore(project);
        const complianceScore = calculateComplianceScore(project);

        // With no audits, audit and methodology scores are 0
        const auditScore = calculateAuditScore(noAudits);
        const methodologyScore = calculateMethodologyScore(noAudits);
        expect(auditScore).toBe(0);
        expect(methodologyScore).toBe(0);

        // Score should equal only doc and compliance weighted contributions
        const expectedScore = Math.round(
          docScore * 0.20 + complianceScore * 0.20
        );

        expect(score).toBe(expectedScore);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 4.8**
   * The score is always an integer (rounded to nearest).
   */
  it('score is always an integer', () => {
    fc.assert(
      fc.property(projectArb, auditsArb, (project, audits) => {
        const score = calculateVerificationScore(project, audits);
        expect(Number.isInteger(score)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });
});
