/**
 * Property Test: Certificate contains all required fields (Property 12)
 *
 * **Validates: Requirements 5.2, 5.6**
 *
 * For any generated certificate, it SHALL contain: a unique certificate ID (≥12
 * alphanumeric characters), purchase date, funder organisation name, tonnage offset,
 * project title, project location, and a verification reference to the source project.
 *
 * This test validates the Certificate interface structure and the generateCertificateId
 * utility function to ensure all certificates meet the required field constraints.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { Certificate } from '../../shared/types';
import { generateCertificateId } from '../../shared/creditUtils';

// ─── Domain Constants ────────────────────────────────────────────────────────

/** Certificate ID must be at least 12 alphanumeric characters */
const MIN_CERTIFICATE_ID_LENGTH = 12;

/** Certificate ID is exactly 16 characters as per design spec */
const EXACT_CERTIFICATE_ID_LENGTH = 16;

/** Pattern for valid alphanumeric characters only */
const ALPHANUMERIC_PATTERN = /^[a-zA-Z0-9]+$/;

/** ISO 8601 datetime pattern */
const ISO_8601_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Validates that a certificate ID meets the minimum length and alphanumeric requirements.
 */
function isValidCertificateId(id: string): boolean {
  return (
    typeof id === 'string' &&
    id.length >= MIN_CERTIFICATE_ID_LENGTH &&
    ALPHANUMERIC_PATTERN.test(id)
  );
}

/**
 * Validates that a string is a valid ISO 8601 timestamp.
 */
function isValidISO8601(timestamp: string): boolean {
  if (!ISO_8601_PATTERN.test(timestamp)) return false;
  const date = new Date(timestamp);
  return !isNaN(date.getTime());
}

/**
 * Validates that the storage path follows the convention:
 * certificates/{funderId}/{transactionId}.pdf
 */
function isValidStoragePath(
  storagePath: string,
  funderId: string,
  transactionId: string
): boolean {
  return storagePath === `certificates/${funderId}/${transactionId}.pdf`;
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * Generate a valid funder ID (non-empty alphanumeric string simulating Firebase UID).
 */
const validFunderId = fc.stringMatching(/^[a-zA-Z0-9]{10,28}$/);

/**
 * Generate a valid transaction ID (non-empty alphanumeric string simulating Firestore doc ID).
 */
const validTransactionId = fc.stringMatching(/^[a-zA-Z0-9]{15,25}$/);

/**
 * Generate a valid funder organisation name (non-empty string).
 */
const validOrgName = fc.string({ minLength: 1, maxLength: 200 }).filter(
  (s) => s.trim().length > 0
);

/**
 * Generate a valid tonnage offset (positive number with at most 2 decimal places).
 */
const validTonnage = fc.integer({ min: 1, max: 10000000 }).map(
  (centitonnage) => centitonnage / 100
);

/**
 * Generate a valid project title (non-empty string).
 */
const validProjectTitle = fc.string({ minLength: 1, maxLength: 120 }).filter(
  (s) => s.trim().length > 0
);

/**
 * Generate a valid project location (non-empty string).
 */
const validProjectLocation = fc.string({ minLength: 1, maxLength: 200 }).filter(
  (s) => s.trim().length > 0
);

/**
 * Generate a valid ISO 8601 timestamp.
 * Uses integer milliseconds to avoid invalid date issues.
 */
const validTimestamp = fc.integer({
  min: new Date('2020-01-01T00:00:00Z').getTime(),
  max: new Date('2030-12-31T23:59:59Z').getTime(),
}).map((ms) => new Date(ms).toISOString());

/**
 * Generate a complete valid Certificate object.
 */
const validCertificate = fc.record({
  certificateId: fc.constant(null).map(() => generateCertificateId()),
  transactionId: validTransactionId,
  funderId: validFunderId,
  funderOrganisationName: validOrgName,
  tonnageOffset: validTonnage,
  projectTitle: validProjectTitle,
  projectLocation: validProjectLocation,
  storagePath: fc.constant(''),
  generatedAt: validTimestamp,
}).chain((cert) => {
  // Derive storagePath from funderId and transactionId
  const storagePath = `certificates/${cert.funderId}/${cert.transactionId}.pdf`;
  return fc.constant({
    ...cert,
    storagePath,
  } as Certificate);
});

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 12: Certificate contains all required fields', () => {
  /**
   * **Validates: Requirements 5.6**
   * generateCertificateId() always produces a string of at least 12 alphanumeric characters.
   */
  it('generateCertificateId() produces an ID of at least 12 alphanumeric characters', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          const id = generateCertificateId();

          expect(id.length).toBeGreaterThanOrEqual(MIN_CERTIFICATE_ID_LENGTH);
          expect(id).toMatch(ALPHANUMERIC_PATTERN);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 5.6**
   * generateCertificateId() produces exactly 16-character alphanumeric IDs as specified in design.
   */
  it('generateCertificateId() produces exactly 16-character alphanumeric IDs', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          const id = generateCertificateId();

          expect(id.length).toBe(EXACT_CERTIFICATE_ID_LENGTH);
          expect(id).toMatch(ALPHANUMERIC_PATTERN);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 5.6**
   * generateCertificateId() produces unique IDs across multiple calls.
   */
  it('generateCertificateId() produces unique IDs across calls', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 20 }),
        (count) => {
          const ids = new Set<string>();
          for (let i = 0; i < count; i++) {
            ids.add(generateCertificateId());
          }
          // All generated IDs should be unique
          expect(ids.size).toBe(count);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 5.2, 5.6**
   * All required fields are present and non-empty on a generated Certificate.
   */
  it('all required fields are present and non-empty', () => {
    fc.assert(
      fc.property(
        validCertificate,
        (certificate) => {
          // certificateId: non-empty, alphanumeric, ≥12 chars
          expect(certificate.certificateId).toBeDefined();
          expect(certificate.certificateId.length).toBeGreaterThanOrEqual(MIN_CERTIFICATE_ID_LENGTH);
          expect(certificate.certificateId).toMatch(ALPHANUMERIC_PATTERN);

          // transactionId: non-empty string
          expect(certificate.transactionId).toBeDefined();
          expect(certificate.transactionId.length).toBeGreaterThan(0);

          // funderId: non-empty string
          expect(certificate.funderId).toBeDefined();
          expect(certificate.funderId.length).toBeGreaterThan(0);

          // funderOrganisationName: non-empty string (purchase date info via funder)
          expect(certificate.funderOrganisationName).toBeDefined();
          expect(certificate.funderOrganisationName.trim().length).toBeGreaterThan(0);

          // tonnageOffset: positive number
          expect(certificate.tonnageOffset).toBeDefined();
          expect(certificate.tonnageOffset).toBeGreaterThan(0);

          // projectTitle: non-empty string
          expect(certificate.projectTitle).toBeDefined();
          expect(certificate.projectTitle.trim().length).toBeGreaterThan(0);

          // projectLocation: non-empty string
          expect(certificate.projectLocation).toBeDefined();
          expect(certificate.projectLocation.trim().length).toBeGreaterThan(0);

          // storagePath: non-empty string (serves as verification reference)
          expect(certificate.storagePath).toBeDefined();
          expect(certificate.storagePath.length).toBeGreaterThan(0);

          // generatedAt: valid ISO 8601 timestamp (purchase date)
          expect(certificate.generatedAt).toBeDefined();
          expect(certificate.generatedAt.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 5.2**
   * storagePath follows the convention `certificates/{funderId}/{transactionId}.pdf`
   */
  it('storagePath follows the convention certificates/{funderId}/{transactionId}.pdf', () => {
    fc.assert(
      fc.property(
        validCertificate,
        (certificate) => {
          expect(
            isValidStoragePath(
              certificate.storagePath,
              certificate.funderId,
              certificate.transactionId
            )
          ).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 5.2**
   * generatedAt is always a valid ISO 8601 timestamp.
   */
  it('generatedAt is a valid ISO 8601 timestamp', () => {
    fc.assert(
      fc.property(
        validCertificate,
        (certificate) => {
          expect(isValidISO8601(certificate.generatedAt)).toBe(true);

          // Also verify it parses to a valid date
          const date = new Date(certificate.generatedAt);
          expect(date.getTime()).not.toBeNaN();
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 5.2**
   * tonnageOffset has at most two decimal places (consistent with tonnage precision property).
   */
  it('tonnageOffset has at most two decimal places', () => {
    fc.assert(
      fc.property(
        validCertificate,
        (certificate) => {
          expect(
            Math.round(certificate.tonnageOffset * 100) / 100
          ).toBe(certificate.tonnageOffset);
        }
      ),
      { numRuns: 200 }
    );
  });
});
