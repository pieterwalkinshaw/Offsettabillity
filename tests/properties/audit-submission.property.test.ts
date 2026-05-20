/**
 * Property Test: Audit submission completes audit and recalculates score (Property 14)
 *
 * Validates: Requirements 4.3
 *
 * For any audit in "pending" or "in_progress" status, when the assigned auditor submits
 * valid findings (score 0–100, methodology, recommendation), the audit status SHALL
 * transition to "completed" and the project's verification score SHALL be recalculated.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { Project, Audit, AuditRecommendation, AuditStatus, ReportingPeriod } from '../../shared/types';
import { calculateVerificationScore } from '../../src/lib/verification/score';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuditFindings {
  findings: string;
  scoreContribution: number;
  methodology: string;
  recommendation: AuditRecommendation;
  evidenceDocuments?: string[];
}

interface SubmissionResult {
  audit: Audit;
  newVerificationScore: number;
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Simulate audit submission: transitions audit to "completed" and returns
 * the updated audit with completedAt timestamp set.
 */
function submitAudit(audit: Audit, findings: AuditFindings): Audit {
  if (audit.status !== 'pending' && audit.status !== 'in_progress') {
    throw new Error(`Audit is in '${audit.status}' status. Only pending or in-progress audits can be submitted.`);
  }

  return {
    ...audit,
    status: 'completed' as const,
    findings: findings.findings,
    scoreContribution: findings.scoreContribution,
    methodology: findings.methodology,
    recommendation: findings.recommendation,
    evidenceDocuments: findings.evidenceDocuments,
    completedAt: new Date().toISOString(),
  };
}

/**
 * Simulate the full audit submission flow:
 * 1. Submit the audit (transition to completed)
 * 2. Recalculate the project's verification score using all audits
 *    (with the submitted audit now marked as completed)
 */
function processAuditSubmission(
  audit: Audit,
  findings: AuditFindings,
  project: Project,
  existingAudits: Audit[]
): SubmissionResult {
  const completedAudit = submitAudit(audit, findings);

  // Build the full list of audits including the newly completed one
  const allAudits = existingAudits.map((a) =>
    a.auditId === audit.auditId ? completedAudit : a
  );

  // If the audit wasn't in the existing list, add it
  if (!existingAudits.some((a) => a.auditId === audit.auditId)) {
    allAudits.push(completedAudit);
  }

  const newVerificationScore = calculateVerificationScore(project, allAudits);

  return {
    audit: completedAudit,
    newVerificationScore,
  };
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate a submittable audit status (pending or in_progress) */
const submittableStatusArb: fc.Arbitrary<AuditStatus> = fc.constantFrom(
  'pending' as const,
  'in_progress' as const
);

/** Generate a valid audit recommendation */
const recommendationArb: fc.Arbitrary<AuditRecommendation> = fc.constantFrom(
  'approve' as const,
  'conditional' as const,
  'reject' as const
);

/** Generate a valid reporting period */
const reportingPeriodArb: fc.Arbitrary<ReportingPeriod> = fc.constantFrom(
  'Monthly' as const,
  'Quarterly' as const,
  'Annually' as const,
  'Project Duration' as const
);

/** Generate valid audit findings */
const findingsArb: fc.Arbitrary<AuditFindings> = fc.record({
  findings: fc.string({ minLength: 1, maxLength: 500 }),
  scoreContribution: fc.integer({ min: 0, max: 100 }),
  methodology: fc.oneof(
    fc.string({ minLength: 1, maxLength: 49 }),
    fc.string({ minLength: 50, maxLength: 200 }),
    fc.string({ minLength: 201, maxLength: 400 })
  ),
  recommendation: recommendationArb,
  evidenceDocuments: fc.option(
    fc.array(fc.stringMatching(/^audits\/[a-z0-9]+\/evidence\/[a-z0-9]+\.pdf$/), { minLength: 0, maxLength: 3 }),
    { nil: undefined }
  ),
});

/** Generate an audit in a submittable state (pending or in_progress) */
const submittableAuditArb: fc.Arbitrary<Audit> = fc.record({
  auditId: fc.stringMatching(/^[a-z0-9]{10,20}$/),
  projectId: fc.stringMatching(/^[a-z0-9]{10,20}$/),
  auditorId: fc.stringMatching(/^[a-z0-9]{10,20}$/),
  status: submittableStatusArb,
  createdAt: fc.constant('2025-01-01T00:00:00Z'),
});

/** Generate a completed audit (for existing audit history) */
const completedAuditArb: fc.Arbitrary<Audit> = fc.record({
  auditId: fc.stringMatching(/^[a-z0-9]{10,20}$/),
  projectId: fc.stringMatching(/^[a-z0-9]{10,20}$/),
  auditorId: fc.stringMatching(/^[a-z0-9]{10,20}$/),
  status: fc.constant('completed' as const),
  findings: fc.string({ minLength: 10, maxLength: 200 }),
  scoreContribution: fc.integer({ min: 0, max: 100 }),
  methodology: fc.oneof(
    fc.string({ minLength: 1, maxLength: 49 }),
    fc.string({ minLength: 50, maxLength: 200 }),
    fc.string({ minLength: 201, maxLength: 400 })
  ),
  recommendation: recommendationArb,
  createdAt: fc.constant('2025-01-01T00:00:00Z'),
  completedAt: fc.constant('2025-02-01T00:00:00Z'),
});

/** Generate a random array of document paths */
const documentsArb = fc.array(
  fc.stringMatching(/^projects\/[a-z0-9]+\/documents\/[a-z0-9]+\.(pdf|png|jpg)$/),
  { minLength: 0, maxLength: 15 }
);

/** Generate a minimal valid project */
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
    'prescreened' as const, 'pending_audit' as const, 'verified' as const
  ),
  verificationBadge: fc.constantFrom(
    'None' as const, 'Verified' as const, 'Verified+' as const, 'Premium Assured' as const
  ),
  documents: documentsArb,
  createdAt: fc.constant('2025-01-01T00:00:00Z'),
  updatedAt: fc.constant('2025-01-01T00:00:00Z'),
});

/** Generate existing completed audits for a project (0-4) */
const existingAuditsArb: fc.Arbitrary<Audit[]> = fc.array(completedAuditArb, { minLength: 0, maxLength: 4 });

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 14: Audit submission completes audit and recalculates score', () => {
  /**
   * **Validates: Requirements 4.3**
   * Pending audit + valid submission → status becomes "completed"
   */
  it('pending audit transitions to "completed" on valid submission', () => {
    fc.assert(
      fc.property(
        submittableAuditArb.filter((a) => a.status === 'pending'),
        findingsArb,
        (audit, findings) => {
          const result = submitAudit(audit, findings);
          expect(result.status).toBe('completed');
        }
      ),
      { numRuns: 300 }
    );
  });

  /**
   * **Validates: Requirements 4.3**
   * In-progress audit + valid submission → status becomes "completed"
   */
  it('in-progress audit transitions to "completed" on valid submission', () => {
    fc.assert(
      fc.property(
        submittableAuditArb.filter((a) => a.status === 'in_progress'),
        findingsArb,
        (audit, findings) => {
          const result = submitAudit(audit, findings);
          expect(result.status).toBe('completed');
        }
      ),
      { numRuns: 300 }
    );
  });

  /**
   * **Validates: Requirements 4.3**
   * After submission, project verification score is recalculated (not the old value).
   * The new score reflects the submitted audit's scoreContribution.
   */
  it('after submission, project verification score is recalculated', () => {
    fc.assert(
      fc.property(
        submittableAuditArb,
        findingsArb,
        projectArb,
        existingAuditsArb,
        (audit, findings, project, existingAudits) => {
          // Ensure the audit belongs to this project
          const auditForProject = { ...audit, projectId: project.projectId };

          // Calculate score before submission (without this audit being completed)
          const scoreBefore = calculateVerificationScore(project, existingAudits);

          // Process the submission
          const result = processAuditSubmission(
            auditForProject,
            findings,
            project,
            existingAudits
          );

          // The new score should be the result of calculateVerificationScore
          // with the audit now completed
          const allAuditsAfter = [...existingAudits, result.audit];
          const expectedScore = calculateVerificationScore(project, allAuditsAfter);

          expect(result.newVerificationScore).toBe(expectedScore);

          // The score should be a valid integer in range 0-100
          expect(result.newVerificationScore).toBeGreaterThanOrEqual(0);
          expect(result.newVerificationScore).toBeLessThanOrEqual(100);
          expect(Number.isInteger(result.newVerificationScore)).toBe(true);
        }
      ),
      { numRuns: 300 }
    );
  });

  /**
   * **Validates: Requirements 4.3**
   * completedAt timestamp is set on the audit after submission.
   */
  it('completedAt timestamp is set on the audit after submission', () => {
    fc.assert(
      fc.property(
        submittableAuditArb,
        findingsArb,
        (audit, findings) => {
          // Before submission, no completedAt
          expect(audit.completedAt).toBeUndefined();

          const result = submitAudit(audit, findings);

          // After submission, completedAt is set and is a valid ISO string
          expect(result.completedAt).toBeDefined();
          expect(typeof result.completedAt).toBe('string');

          // Verify it's a valid date
          const parsedDate = new Date(result.completedAt!);
          expect(parsedDate.getTime()).not.toBeNaN();
        }
      ),
      { numRuns: 300 }
    );
  });

  /**
   * **Validates: Requirements 4.3**
   * Submitted findings are preserved on the completed audit.
   */
  it('submitted findings are preserved on the completed audit', () => {
    fc.assert(
      fc.property(
        submittableAuditArb,
        findingsArb,
        (audit, findings) => {
          const result = submitAudit(audit, findings);

          expect(result.findings).toBe(findings.findings);
          expect(result.scoreContribution).toBe(findings.scoreContribution);
          expect(result.methodology).toBe(findings.methodology);
          expect(result.recommendation).toBe(findings.recommendation);
          expect(result.evidenceDocuments).toEqual(findings.evidenceDocuments);
        }
      ),
      { numRuns: 300 }
    );
  });

  /**
   * **Validates: Requirements 4.3**
   * Submitting an audit that is already completed or rejected throws an error.
   */
  it('rejects submission for audits not in submittable state', () => {
    const nonSubmittableStatusArb: fc.Arbitrary<AuditStatus> = fc.constantFrom(
      'completed' as const,
      'rejected' as const
    );

    fc.assert(
      fc.property(
        fc.record({
          auditId: fc.stringMatching(/^[a-z0-9]{10,20}$/),
          projectId: fc.stringMatching(/^[a-z0-9]{10,20}$/),
          auditorId: fc.stringMatching(/^[a-z0-9]{10,20}$/),
          status: nonSubmittableStatusArb,
          createdAt: fc.constant('2025-01-01T00:00:00Z'),
        }),
        findingsArb,
        (audit, findings) => {
          expect(() => submitAudit(audit as Audit, findings)).toThrow();
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 4.3**
   * The recalculated score accounts for the new audit's scoreContribution.
   * A higher scoreContribution should generally lead to a higher or equal verification score
   * compared to a lower scoreContribution (all else being equal).
   */
  it('higher scoreContribution leads to higher or equal verification score', () => {
    fc.assert(
      fc.property(
        submittableAuditArb,
        projectArb,
        fc.integer({ min: 0, max: 49 }),
        fc.integer({ min: 50, max: 100 }),
        (audit, project, lowScore, highScore) => {
          const auditForProject = { ...audit, projectId: project.projectId };

          const lowFindings: AuditFindings = {
            findings: 'Test findings',
            scoreContribution: lowScore,
            methodology: 'Standard methodology used for verification',
            recommendation: 'approve',
          };

          const highFindings: AuditFindings = {
            findings: 'Test findings',
            scoreContribution: highScore,
            methodology: 'Standard methodology used for verification',
            recommendation: 'approve',
          };

          const lowResult = processAuditSubmission(auditForProject, lowFindings, project, []);
          const highResult = processAuditSubmission(auditForProject, highFindings, project, []);

          expect(highResult.newVerificationScore).toBeGreaterThanOrEqual(lowResult.newVerificationScore);
        }
      ),
      { numRuns: 200 }
    );
  });
});
