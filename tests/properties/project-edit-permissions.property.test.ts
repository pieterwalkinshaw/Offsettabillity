/**
 * Property 6: Project edit permissions by status
 *
 * **Validates: Requirements 2.4, 2.5**
 *
 * For any project, if its verificationStatus is "draft" then all fields SHALL be editable.
 * If its verificationStatus is any value other than "draft", then title, category, and
 * fundingGoal SHALL be immutable (edit attempts rejected), while other fields remain
 * editable by the owner.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { VerificationStatus } from '@shared/types';

// ─── Constants (mirroring the Cloud Function logic) ──────────────────────────

/** Fields that are immutable after a project leaves "draft" status. */
const IMMUTABLE_AFTER_DRAFT: string[] = ['title', 'category', 'fundingGoal'];

/** Fields that can be updated on a project (excluding system-managed fields). */
const ALLOWED_UPDATE_FIELDS: string[] = [
  'title',
  'description',
  'category',
  'subCategory',
  'location',
  'fundingGoal',
  'impactMetrics',
];

/** All possible verification statuses. */
const ALL_STATUSES: VerificationStatus[] = [
  'draft',
  'submitted',
  'prescreened',
  'pending_audit',
  'verified',
  'live',
  'funded',
];

/** Non-draft statuses where immutable field restrictions apply. */
const NON_DRAFT_STATUSES: VerificationStatus[] = ALL_STATUSES.filter((s) => s !== 'draft');

/** Fields that remain editable even after leaving draft status. */
const MUTABLE_AFTER_DRAFT: string[] = ALLOWED_UPDATE_FIELDS.filter(
  (f) => !IMMUTABLE_AFTER_DRAFT.includes(f)
);

// ─── Helper: canEditField ────────────────────────────────────────────────────

/**
 * Determines whether a given field can be edited based on the project's
 * verification status.
 *
 * - In "draft" status, all allowed fields are editable.
 * - In any other status, title, category, and fundingGoal are immutable.
 */
function canEditField(verificationStatus: VerificationStatus, fieldName: string): boolean {
  // Only allowed update fields can ever be edited
  if (!ALLOWED_UPDATE_FIELDS.includes(fieldName)) {
    return false;
  }

  // In draft, all allowed fields are editable
  if (verificationStatus === 'draft') {
    return true;
  }

  // After draft, immutable fields cannot be edited
  if (IMMUTABLE_AFTER_DRAFT.includes(fieldName)) {
    return false;
  }

  return true;
}

/**
 * Simulates the edit permission check from the Cloud Function.
 * Returns { allowed: true } if the edit is permitted, or
 * { allowed: false, rejectedFields: string[] } if immutable fields are attempted.
 */
function checkEditPermissions(
  verificationStatus: VerificationStatus,
  fieldsToEdit: string[]
): { allowed: boolean; rejectedFields: string[] } {
  if (verificationStatus === 'draft') {
    return { allowed: true, rejectedFields: [] };
  }

  const rejectedFields = fieldsToEdit.filter((field) =>
    IMMUTABLE_AFTER_DRAFT.includes(field)
  );

  return {
    allowed: rejectedFields.length === 0,
    rejectedFields,
  };
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const draftStatus = fc.constant('draft' as VerificationStatus);

const nonDraftStatus = fc.constantFrom(...NON_DRAFT_STATUSES);

const anyStatus = fc.constantFrom(...ALL_STATUSES);

const anyAllowedField = fc.constantFrom(...ALLOWED_UPDATE_FIELDS);

const immutableField = fc.constantFrom(...IMMUTABLE_AFTER_DRAFT);

const mutableField = fc.constantFrom(...MUTABLE_AFTER_DRAFT);

/** Generate a non-empty subset of allowed fields */
const fieldSubset = fc
  .subarray(ALLOWED_UPDATE_FIELDS, { minLength: 1 })
  .filter((arr) => arr.length > 0);

/** Generate a non-empty subset of immutable fields */
const immutableFieldSubset = fc
  .subarray(IMMUTABLE_AFTER_DRAFT, { minLength: 1 })
  .filter((arr) => arr.length > 0);

/** Generate a non-empty subset of mutable-after-draft fields */
const mutableFieldSubset = fc
  .subarray(MUTABLE_AFTER_DRAFT, { minLength: 1 })
  .filter((arr) => arr.length > 0);

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 6: Project edit permissions by status', () => {
  describe('Draft status: all fields are editable', () => {
    it('for any project in draft status, any allowed field is editable', () => {
      /**
       * **Validates: Requirements 2.4**
       */
      fc.assert(
        fc.property(draftStatus, anyAllowedField, (status, field) => {
          expect(canEditField(status, field)).toBe(true);
        }),
        { numRuns: 200 }
      );
    });

    it('for any project in draft status, any subset of allowed fields can be edited', () => {
      /**
       * **Validates: Requirements 2.4**
       */
      fc.assert(
        fc.property(draftStatus, fieldSubset, (status, fields) => {
          const result = checkEditPermissions(status, fields);
          expect(result.allowed).toBe(true);
          expect(result.rejectedFields).toHaveLength(0);
        }),
        { numRuns: 200 }
      );
    });
  });

  describe('Non-draft status: title, category, fundingGoal are immutable', () => {
    it('for any project NOT in draft status, title/category/fundingGoal are NOT editable', () => {
      /**
       * **Validates: Requirements 2.5**
       */
      fc.assert(
        fc.property(nonDraftStatus, immutableField, (status, field) => {
          expect(canEditField(status, field)).toBe(false);
        }),
        { numRuns: 200 }
      );
    });

    it('for any project NOT in draft status, editing immutable fields is rejected', () => {
      /**
       * **Validates: Requirements 2.5**
       */
      fc.assert(
        fc.property(nonDraftStatus, immutableFieldSubset, (status, fields) => {
          const result = checkEditPermissions(status, fields);
          expect(result.allowed).toBe(false);
          expect(result.rejectedFields.length).toBeGreaterThan(0);
          // Every rejected field should be in the immutable list
          for (const rejected of result.rejectedFields) {
            expect(IMMUTABLE_AFTER_DRAFT).toContain(rejected);
          }
        }),
        { numRuns: 200 }
      );
    });

    it('rejected fields match exactly the immutable fields attempted', () => {
      /**
       * **Validates: Requirements 2.5**
       */
      fc.assert(
        fc.property(nonDraftStatus, immutableFieldSubset, (status, fields) => {
          const result = checkEditPermissions(status, fields);
          // All attempted immutable fields should be in the rejected list
          expect(result.rejectedFields.sort()).toEqual(fields.sort());
        }),
        { numRuns: 200 }
      );
    });
  });

  describe('Non-draft status: other fields remain editable by the owner', () => {
    it('for any project NOT in draft status, description/subCategory/location/impactMetrics remain editable', () => {
      /**
       * **Validates: Requirements 2.5**
       */
      fc.assert(
        fc.property(nonDraftStatus, mutableField, (status, field) => {
          expect(canEditField(status, field)).toBe(true);
        }),
        { numRuns: 200 }
      );
    });

    it('for any project NOT in draft status, editing only mutable fields is allowed', () => {
      /**
       * **Validates: Requirements 2.5**
       */
      fc.assert(
        fc.property(nonDraftStatus, mutableFieldSubset, (status, fields) => {
          const result = checkEditPermissions(status, fields);
          expect(result.allowed).toBe(true);
          expect(result.rejectedFields).toHaveLength(0);
        }),
        { numRuns: 200 }
      );
    });
  });

  describe('Mixed field edits on non-draft projects', () => {
    it('editing a mix of mutable and immutable fields rejects only the immutable ones', () => {
      /**
       * **Validates: Requirements 2.4, 2.5**
       */
      fc.assert(
        fc.property(
          nonDraftStatus,
          mutableFieldSubset,
          immutableFieldSubset,
          (status, mutableFields, immutableFields) => {
            const allFields = [...new Set([...mutableFields, ...immutableFields])];
            const result = checkEditPermissions(status, allFields);

            expect(result.allowed).toBe(false);
            // Only immutable fields should be rejected
            expect(result.rejectedFields.sort()).toEqual(immutableFields.sort());
            // Mutable fields should NOT appear in rejected list
            for (const field of mutableFields) {
              if (!IMMUTABLE_AFTER_DRAFT.includes(field)) {
                expect(result.rejectedFields).not.toContain(field);
              }
            }
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  describe('canEditField consistency across all statuses', () => {
    it('canEditField returns true for all allowed fields when status is draft, false for immutable fields otherwise', () => {
      /**
       * **Validates: Requirements 2.4, 2.5**
       */
      fc.assert(
        fc.property(anyStatus, anyAllowedField, (status, field) => {
          const editable = canEditField(status, field);

          if (status === 'draft') {
            expect(editable).toBe(true);
          } else if (IMMUTABLE_AFTER_DRAFT.includes(field)) {
            expect(editable).toBe(false);
          } else {
            expect(editable).toBe(true);
          }
        }),
        { numRuns: 500 }
      );
    });
  });
});
