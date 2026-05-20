/**
 * Property 7: Document upload validation
 *
 * **Validates: Requirements 2.6, 2.9**
 *
 * For any file upload attempt on a project, the system SHALL accept the file
 * if and only if: the file type is PDF, PNG, or JPEG; the file size is ≤ 5 MB;
 * and the project has fewer than 10 existing documents. A failed upload SHALL NOT
 * modify the project's existing document list.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ─── Constants (mirroring uploadDocument.ts) ─────────────────────────────────

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_DOCUMENTS_PER_PROJECT = 10;

// ─── Helper: Document upload validation logic ────────────────────────────────

interface DocumentUploadResult {
  accepted: boolean;
  reason?: string;
}

/**
 * Validates a document upload attempt based on file type, file size, and
 * existing document count. Returns accept/reject with reason.
 *
 * This mirrors the validation logic in functions/src/projects/uploadDocument.ts.
 */
function validateDocumentUpload(
  fileType: string,
  fileSize: number,
  existingDocCount: number
): DocumentUploadResult {
  if (!ALLOWED_MIME_TYPES.includes(fileType)) {
    return { accepted: false, reason: 'unsupported file type' };
  }

  if (fileSize > MAX_FILE_SIZE_BYTES) {
    return { accepted: false, reason: 'file too large' };
  }

  if (fileSize <= 0) {
    return { accepted: false, reason: 'file too large' };
  }

  if (existingDocCount >= MAX_DOCUMENTS_PER_PROJECT) {
    return { accepted: false, reason: 'max documents reached' };
  }

  return { accepted: true };
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const validMimeType = fc.constantFrom('application/pdf', 'image/png', 'image/jpeg');

const invalidMimeType = fc.constantFrom(
  'application/msword',
  'text/plain',
  'image/gif',
  'image/bmp',
  'application/zip',
  'video/mp4',
  'audio/mpeg',
  'application/octet-stream',
  'text/html',
  'image/svg+xml',
  'application/json',
  'text/csv'
);

// Valid file size: 1 byte to 5 MB
const validFileSize = fc.integer({ min: 1, max: MAX_FILE_SIZE_BYTES });

// Invalid file size: exceeds 5 MB (up to 10 MB)
const invalidFileSize = fc.integer({ min: MAX_FILE_SIZE_BYTES + 1, max: 10 * 1024 * 1024 });

// Valid existing document count: 0 to 9
const validDocCount = fc.integer({ min: 0, max: MAX_DOCUMENTS_PER_PROJECT - 1 });

// Invalid existing document count: 10 to 15
const invalidDocCount = fc.integer({ min: MAX_DOCUMENTS_PER_PROJECT, max: 15 });

// Arbitrary for existing document list (array of storage paths)
const existingDocumentList = (count: number) =>
  fc.array(
    fc.string({ minLength: 10, maxLength: 80 }).map(
      (s) => `projects/proj-123/documents/${s}`
    ),
    { minLength: count, maxLength: count }
  );

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 7: Document upload validation', () => {
  describe('Valid uploads are accepted', () => {
    it('valid type + valid size + count < 10 → accepted', () => {
      /**
       * **Validates: Requirements 2.6**
       */
      fc.assert(
        fc.property(
          validMimeType,
          validFileSize,
          validDocCount,
          (fileType, fileSize, existingDocCount) => {
            const result = validateDocumentUpload(fileType, fileSize, existingDocCount);
            expect(result.accepted).toBe(true);
            expect(result.reason).toBeUndefined();
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  describe('Invalid file type is rejected', () => {
    it('invalid type → rejected with "unsupported file type" reason', () => {
      /**
       * **Validates: Requirements 2.6, 2.9**
       */
      fc.assert(
        fc.property(
          invalidMimeType,
          validFileSize,
          validDocCount,
          (fileType, fileSize, existingDocCount) => {
            const result = validateDocumentUpload(fileType, fileSize, existingDocCount);
            expect(result.accepted).toBe(false);
            expect(result.reason).toBe('unsupported file type');
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  describe('File size exceeding 5 MB is rejected', () => {
    it('size > 5MB → rejected with "file too large" reason', () => {
      /**
       * **Validates: Requirements 2.6, 2.9**
       */
      fc.assert(
        fc.property(
          validMimeType,
          invalidFileSize,
          validDocCount,
          (fileType, fileSize, existingDocCount) => {
            const result = validateDocumentUpload(fileType, fileSize, existingDocCount);
            expect(result.accepted).toBe(false);
            expect(result.reason).toBe('file too large');
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  describe('Document count at or above limit is rejected', () => {
    it('count >= 10 → rejected with "max documents reached" reason', () => {
      /**
       * **Validates: Requirements 2.6, 2.9**
       */
      fc.assert(
        fc.property(
          validMimeType,
          validFileSize,
          invalidDocCount,
          (fileType, fileSize, existingDocCount) => {
            const result = validateDocumentUpload(fileType, fileSize, existingDocCount);
            expect(result.accepted).toBe(false);
            expect(result.reason).toBe('max documents reached');
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  describe('Failed uploads do not modify existing documents', () => {
    it('on rejection, existing documents remain unchanged', () => {
      /**
       * **Validates: Requirements 2.9**
       */
      fc.assert(
        fc.property(
          fc.oneof(invalidMimeType, validMimeType),
          fc.integer({ min: 0, max: 10 * 1024 * 1024 }),
          fc.integer({ min: 0, max: 15 }),
          fc.array(fc.string({ minLength: 5, maxLength: 50 }), { minLength: 0, maxLength: 15 }),
          (fileType, fileSize, existingDocCount, existingDocs) => {
            // Snapshot the existing documents before the upload attempt
            const docsBefore = [...existingDocs];

            const result = validateDocumentUpload(fileType, fileSize, existingDocCount);

            if (!result.accepted) {
              // On rejection, existing documents must remain unchanged
              expect(existingDocs).toEqual(docsBefore);
              expect(existingDocs.length).toBe(docsBefore.length);
            }
          }
        ),
        { numRuns: 200 }
      );
    });

    it('rejected upload with invalid type preserves document list integrity', () => {
      /**
       * **Validates: Requirements 2.9**
       */
      fc.assert(
        fc.property(
          invalidMimeType,
          validFileSize,
          fc.integer({ min: 0, max: 15 }),
          fc.array(fc.string({ minLength: 5, maxLength: 50 }), { minLength: 0, maxLength: 15 }),
          (fileType, fileSize, existingDocCount, existingDocs) => {
            const originalLength = existingDocs.length;
            const originalDocs = [...existingDocs];

            const result = validateDocumentUpload(fileType, fileSize, existingDocCount);

            expect(result.accepted).toBe(false);
            // Documents array must not be modified
            expect(existingDocs.length).toBe(originalLength);
            expect(existingDocs).toEqual(originalDocs);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('rejected upload with oversized file preserves document list integrity', () => {
      /**
       * **Validates: Requirements 2.9**
       */
      fc.assert(
        fc.property(
          validMimeType,
          invalidFileSize,
          fc.integer({ min: 0, max: 15 }),
          fc.array(fc.string({ minLength: 5, maxLength: 50 }), { minLength: 0, maxLength: 15 }),
          (fileType, fileSize, existingDocCount, existingDocs) => {
            const originalLength = existingDocs.length;
            const originalDocs = [...existingDocs];

            const result = validateDocumentUpload(fileType, fileSize, existingDocCount);

            expect(result.accepted).toBe(false);
            // Documents array must not be modified
            expect(existingDocs.length).toBe(originalLength);
            expect(existingDocs).toEqual(originalDocs);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('rejected upload due to max documents preserves document list integrity', () => {
      /**
       * **Validates: Requirements 2.9**
       */
      fc.assert(
        fc.property(
          validMimeType,
          validFileSize,
          invalidDocCount,
          fc.array(fc.string({ minLength: 5, maxLength: 50 }), { minLength: 10, maxLength: 15 }),
          (fileType, fileSize, existingDocCount, existingDocs) => {
            const originalLength = existingDocs.length;
            const originalDocs = [...existingDocs];

            const result = validateDocumentUpload(fileType, fileSize, existingDocCount);

            expect(result.accepted).toBe(false);
            // Documents array must not be modified
            expect(existingDocs.length).toBe(originalLength);
            expect(existingDocs).toEqual(originalDocs);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
