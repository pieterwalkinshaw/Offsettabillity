/**
 * Property Test: Certificate storage path follows convention (Property 13)
 *
 * **Validates: Requirements 5.3, 5.4**
 *
 * For any generated certificate with a given funderId and transactionId,
 * the Cloud Storage path SHALL equal `certificates/{funderId}/{transactionId}.pdf`
 * and the corresponding Firestore document SHALL reference this path along with
 * transactionId, funderId, and generatedAt timestamp.
 *
 * This tests the pure function `buildStoragePath(funderId, transactionId)`.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { buildStoragePath } from '../../shared/creditUtils';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * Generate non-empty alphanumeric strings representing funderIds.
 * Firebase UIDs are typically 28 characters but we test with varied lengths.
 */
const funderId = fc.stringMatching(/^[a-zA-Z0-9]{1,64}$/);

/**
 * Generate non-empty alphanumeric strings representing transactionIds.
 * Firestore auto-generated IDs are typically 20 characters.
 */
const transactionId = fc.stringMatching(/^[a-zA-Z0-9]{1,64}$/);

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 13: Certificate storage path follows convention', () => {
  /**
   * **Validates: Requirements 5.3, 5.4**
   * The path always starts with 'certificates/'.
   */
  it('path starts with "certificates/"', () => {
    fc.assert(
      fc.property(
        funderId,
        transactionId,
        (fId, tId) => {
          const path = buildStoragePath(fId, tId);
          expect(path.startsWith('certificates/')).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 5.3, 5.4**
   * The path always ends with '.pdf'.
   */
  it('path ends with ".pdf"', () => {
    fc.assert(
      fc.property(
        funderId,
        transactionId,
        (fId, tId) => {
          const path = buildStoragePath(fId, tId);
          expect(path.endsWith('.pdf')).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 5.3, 5.4**
   * The path contains the funderId.
   */
  it('path contains the funderId', () => {
    fc.assert(
      fc.property(
        funderId,
        transactionId,
        (fId, tId) => {
          const path = buildStoragePath(fId, tId);
          expect(path).toContain(fId);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 5.3, 5.4**
   * The path contains the transactionId.
   */
  it('path contains the transactionId', () => {
    fc.assert(
      fc.property(
        funderId,
        transactionId,
        (fId, tId) => {
          const path = buildStoragePath(fId, tId);
          expect(path).toContain(tId);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 5.3, 5.4**
   * The path matches the exact convention: certificates/{funderId}/{transactionId}.pdf
   */
  it('path matches exact pattern certificates/{funderId}/{transactionId}.pdf', () => {
    fc.assert(
      fc.property(
        funderId,
        transactionId,
        (fId, tId) => {
          const path = buildStoragePath(fId, tId);
          const expected = `certificates/${fId}/${tId}.pdf`;
          expect(path).toBe(expected);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 5.3, 5.4**
   * The path has exactly 3 segments separated by '/': certificates, funderId, transactionId.pdf
   */
  it('path has exactly three segments separated by "/"', () => {
    fc.assert(
      fc.property(
        funderId,
        transactionId,
        (fId, tId) => {
          const path = buildStoragePath(fId, tId);
          const segments = path.split('/');
          expect(segments).toHaveLength(3);
          expect(segments[0]).toBe('certificates');
          expect(segments[1]).toBe(fId);
          expect(segments[2]).toBe(`${tId}.pdf`);
        }
      ),
      { numRuns: 200 }
    );
  });
});
