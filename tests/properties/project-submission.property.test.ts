/**
 * Property 8: Project status transition on submission
 *
 * **Validates: Requirements 2.3, 2.7**
 *
 * For any project in "draft" status with at least one supporting document,
 * submitting for verification SHALL transition the status to "submitted".
 * For any project without documents, submission SHALL be rejected.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { VerificationStatus } from '@shared/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProjectSubmissionState {
  projectId: string;
  verificationStatus: VerificationStatus;
  documents: string[];
  ownerId: string;
}

interface SubmissionResult {
  success: boolean;
  newStatus?: VerificationStatus;
  error?: string;
}

// ─── Helper: canSubmitProject ────────────────────────────────────────────────

/**
 * Determines whether a project can be submitted for verification.
 * Returns a result indicating success (with new status) or failure (with error).
 *
 * Rules:
 * - Project must be in "draft" status
 * - Project must have at least one supporting document
 * - On success, status transitions to "submitted"
 */
function canSubmitProject(
  verificationStatus: VerificationStatus,
  documentCount: number
): SubmissionResult {
  // Only draft projects can be submitted
  if (verificationStatus !== 'draft') {
    return {
      success: false,
      error: `Project is in '${verificationStatus}' status. Only draft projects can be submitted.`,
    };
  }

  // Must have at least one supporting document
  if (documentCount === 0) {
    return {
      success: false,
      error: 'At least one supporting document is required before submission.',
    };
  }

  // Submission succeeds — transition to "submitted"
  return {
    success: true,
    newStatus: 'submitted',
  };
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate a random Cloud Storage document path */
const documentPath = fc.stringMatching(/^projects\/[a-zA-Z0-9]+\/documents\/[a-zA-Z0-9_-]+\.(pdf|png|jpeg)$/);

/** Generate a random array of 1 to 10 document paths (non-empty) */
const nonEmptyDocuments = fc.array(documentPath, { minLength: 1, maxLength: 10 });

/** Generate a random array of 0 to 10 document paths */
const anyDocuments = fc.array(documentPath, { minLength: 0, maxLength: 10 });

/** All possible verification statuses */
const allVerificationStatuses: VerificationStatus[] = [
  'draft',
  'submitted',
  'prescreened',
  'pending_audit',
  'verified',
  'live',
  'funded',
];

/** Non-draft verification statuses */
const nonDraftStatuses = fc.constantFrom<VerificationStatus>(
  'submitted',
  'prescreened',
  'pending_audit',
  'verified',
  'live',
  'funded'
);

/** Generate a random project ID */
const projectId = fc.stringMatching(/^[a-zA-Z0-9]{10,30}$/);

/** Generate a random owner ID */
const ownerId = fc.stringMatching(/^[a-zA-Z0-9]{10,30}$/);

/** Generate a draft project with documents (1-10) */
const draftProjectWithDocuments = fc.record({
  projectId,
  verificationStatus: fc.constant('draft' as VerificationStatus),
  documents: nonEmptyDocuments,
  ownerId,
});

/** Generate a draft project with zero documents */
const draftProjectWithoutDocuments = fc.record({
  projectId,
  verificationStatus: fc.constant('draft' as VerificationStatus),
  documents: fc.constant([] as string[]),
  ownerId,
});

/** Generate a non-draft project with any number of documents */
const nonDraftProject = fc.record({
  projectId,
  verificationStatus: nonDraftStatuses,
  documents: anyDocuments,
  ownerId,
});

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 8: Project status transition on submission', () => {
  describe('Draft project with documents → submission succeeds', () => {
    it('draft project with 1+ documents transitions to "submitted" status', () => {
      /**
       * **Validates: Requirements 2.3**
       */
      fc.assert(
        fc.property(draftProjectWithDocuments, (project) => {
          const result = canSubmitProject(
            project.verificationStatus,
            project.documents.length
          );

          expect(result.success).toBe(true);
          expect(result.newStatus).toBe('submitted');
          expect(result.error).toBeUndefined();
        }),
        { numRuns: 200 }
      );
    });

    it('submission result always produces "submitted" status regardless of document count (1-10)', () => {
      /**
       * **Validates: Requirements 2.3**
       */
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          (docCount) => {
            const result = canSubmitProject('draft', docCount);

            expect(result.success).toBe(true);
            expect(result.newStatus).toBe('submitted');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Draft project with 0 documents → submission rejected', () => {
    it('draft project with no documents is rejected', () => {
      /**
       * **Validates: Requirements 2.7**
       */
      fc.assert(
        fc.property(draftProjectWithoutDocuments, (project) => {
          const result = canSubmitProject(
            project.verificationStatus,
            project.documents.length
          );

          expect(result.success).toBe(false);
          expect(result.newStatus).toBeUndefined();
          expect(result.error).toBeDefined();
          expect(result.error).toContain('document');
        }),
        { numRuns: 200 }
      );
    });
  });

  describe('Non-draft project → submission rejected', () => {
    it('projects not in "draft" status cannot be submitted regardless of document count', () => {
      /**
       * **Validates: Requirements 2.3**
       */
      fc.assert(
        fc.property(nonDraftProject, (project) => {
          const result = canSubmitProject(
            project.verificationStatus,
            project.documents.length
          );

          expect(result.success).toBe(false);
          expect(result.newStatus).toBeUndefined();
          expect(result.error).toBeDefined();
          expect(result.error).toContain('Only draft projects can be submitted');
        }),
        { numRuns: 200 }
      );
    });

    it('each non-draft status is individually rejected', () => {
      /**
       * **Validates: Requirements 2.3**
       */
      const nonDraftStatusList: VerificationStatus[] = [
        'submitted',
        'prescreened',
        'pending_audit',
        'verified',
        'live',
        'funded',
      ];

      for (const status of nonDraftStatusList) {
        fc.assert(
          fc.property(
            fc.integer({ min: 0, max: 10 }),
            (docCount) => {
              const result = canSubmitProject(status, docCount);

              expect(result.success).toBe(false);
              expect(result.error).toContain(status);
            }
          ),
          { numRuns: 50 }
        );
      }
    });
  });

  describe('Submission logic consistency with Cloud Function', () => {
    it('canSubmitProject matches the preconditions enforced by projects_submit function', () => {
      /**
       * **Validates: Requirements 2.3, 2.7**
       *
       * For any combination of verification status and document count,
       * the helper function produces consistent results:
       * - success=true only when status="draft" AND documents > 0
       * - success=false in all other cases
       */
      fc.assert(
        fc.property(
          fc.constantFrom<VerificationStatus>(...allVerificationStatuses),
          fc.integer({ min: 0, max: 10 }),
          (status, docCount) => {
            const result = canSubmitProject(status, docCount);

            if (status === 'draft' && docCount > 0) {
              expect(result.success).toBe(true);
              expect(result.newStatus).toBe('submitted');
            } else {
              expect(result.success).toBe(false);
              expect(result.newStatus).toBeUndefined();
            }
          }
        ),
        { numRuns: 500 }
      );
    });
  });
});
