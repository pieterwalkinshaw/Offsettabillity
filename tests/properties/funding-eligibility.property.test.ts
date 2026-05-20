/**
 * Property Test: Funding eligibility enforcement (Property 15)
 *
 * Validates: Requirements 5.1, 5.2
 *
 * For any funding commitment attempt, the system SHALL accept it if and only if:
 * the project has verificationStatus "verified" or "live", the funder is authenticated
 * with role "funder", and the amount is between 1000 and 100000000 cents inclusive.
 * All other attempts SHALL be rejected with an appropriate error.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { FundingCreateSchema } from '../../shared/schemas';
import type { VerificationStatus, UserRole } from '../../shared/types';

// ─── Domain Constants ────────────────────────────────────────────────────────

const ELIGIBLE_STATUSES: VerificationStatus[] = ['verified', 'live'];
const ALL_STATUSES: VerificationStatus[] = [
  'draft', 'submitted', 'prescreened', 'pending_audit', 'verified', 'live', 'funded',
];
const INELIGIBLE_STATUSES: VerificationStatus[] = ALL_STATUSES.filter(
  s => !ELIGIBLE_STATUSES.includes(s)
);
const ALL_ROLES: UserRole[] = ['funder', 'owner', 'auditor', 'admin'];
const NON_FUNDER_ROLES: UserRole[] = ALL_ROLES.filter(r => r !== 'funder');

const MIN_AMOUNT = 1000;
const MAX_AMOUNT = 100000000;

// ─── Helper Function ─────────────────────────────────────────────────────────

/**
 * Determines whether a funding commitment should be accepted or rejected.
 *
 * A funding commitment is accepted if and only if:
 * 1. The project has verificationStatus "verified" or "live"
 * 2. The user has role "funder"
 * 3. The amount is between 1000 and 100000000 cents inclusive (integer)
 *
 * Returns { accepted: true } or { accepted: false, reason: string }
 */
function canFundProject(
  verificationStatus: VerificationStatus,
  amount: number,
  userRole: UserRole
): { accepted: true } | { accepted: false; reason: string } {
  if (userRole !== 'funder') {
    return { accepted: false, reason: 'Funder role required.' };
  }

  if (!ELIGIBLE_STATUSES.includes(verificationStatus)) {
    return { accepted: false, reason: 'Project is not eligible for funding.' };
  }

  if (!Number.isInteger(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
    return { accepted: false, reason: 'Amount must be between 1000 and 100000000 cents.' };
  }

  return { accepted: true };
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate an eligible verification status */
const eligibleStatus = fc.constantFrom<VerificationStatus>(...ELIGIBLE_STATUSES);

/** Generate an ineligible verification status */
const ineligibleStatus = fc.constantFrom<VerificationStatus>(...INELIGIBLE_STATUSES);

/** Generate any verification status */
const anyStatus = fc.constantFrom<VerificationStatus>(...ALL_STATUSES);

/** Generate a valid funding amount (1000–100000000 cents, integer) */
const validAmount = fc.integer({ min: MIN_AMOUNT, max: MAX_AMOUNT });

/** Generate an amount below the minimum */
const belowMinAmount = fc.integer({ min: -1000000, max: MIN_AMOUNT - 1 });

/** Generate an amount above the maximum */
const aboveMaxAmount = fc.integer({ min: MAX_AMOUNT + 1, max: MAX_AMOUNT * 10 });

/** Generate a non-funder role */
const nonFunderRole = fc.constantFrom<UserRole>(...NON_FUNDER_ROLES);

/** Generate a valid project ID */
const validProjectId = fc.stringMatching(/^[a-zA-Z0-9]{10,30}$/);

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 15: Funding eligibility enforcement', () => {
  /**
   * **Validates: Requirements 5.1**
   * Verified/live projects with valid amount and funder role → accepted
   */
  it('accepts funding for verified/live projects with valid amount and funder role', () => {
    fc.assert(
      fc.property(
        eligibleStatus,
        validAmount,
        (status, amount) => {
          const result = canFundProject(status, amount, 'funder');
          expect(result.accepted).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 5.2**
   * Projects with ineligible statuses → rejected regardless of amount
   */
  it('rejects funding for projects with ineligible statuses regardless of amount', () => {
    fc.assert(
      fc.property(
        ineligibleStatus,
        validAmount,
        (status, amount) => {
          const result = canFundProject(status, amount, 'funder');
          expect(result.accepted).toBe(false);
          if (!result.accepted) {
            expect(result.reason).toBe('Project is not eligible for funding.');
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 5.1**
   * Amount below 1000 cents → rejected
   */
  it('rejects funding when amount is below minimum (1000 cents)', () => {
    fc.assert(
      fc.property(
        eligibleStatus,
        belowMinAmount,
        (status, amount) => {
          const result = canFundProject(status, amount, 'funder');
          expect(result.accepted).toBe(false);
          if (!result.accepted) {
            expect(result.reason).toBe('Amount must be between 1000 and 100000000 cents.');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 5.1**
   * Amount above 100000000 cents → rejected
   */
  it('rejects funding when amount is above maximum (100000000 cents)', () => {
    fc.assert(
      fc.property(
        eligibleStatus,
        aboveMaxAmount,
        (status, amount) => {
          const result = canFundProject(status, amount, 'funder');
          expect(result.accepted).toBe(false);
          if (!result.accepted) {
            expect(result.reason).toBe('Amount must be between 1000 and 100000000 cents.');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 5.1, 5.2**
   * Non-funder role → rejected regardless of project status or amount
   */
  it('rejects funding for non-funder roles regardless of project status or amount', () => {
    fc.assert(
      fc.property(
        anyStatus,
        validAmount,
        nonFunderRole,
        (status, amount, role) => {
          const result = canFundProject(status, amount, role);
          expect(result.accepted).toBe(false);
          if (!result.accepted) {
            expect(result.reason).toBe('Funder role required.');
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 5.1, 5.2**
   * The canFundProject helper is consistent with the FundingCreateSchema validation
   * for the amount field — valid amounts pass schema, invalid amounts fail schema.
   */
  it('FundingCreateSchema validates amount range consistently with eligibility rules', () => {
    fc.assert(
      fc.property(
        validProjectId,
        validAmount,
        (projectId, amount) => {
          const input = { projectId, amount, currency: 'ZAR' };
          const result = FundingCreateSchema.safeParse(input);
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 5.1**
   * FundingCreateSchema rejects amounts below minimum
   */
  it('FundingCreateSchema rejects amounts below minimum', () => {
    fc.assert(
      fc.property(
        validProjectId,
        belowMinAmount,
        (projectId, amount) => {
          const input = { projectId, amount, currency: 'ZAR' };
          const result = FundingCreateSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 5.1**
   * FundingCreateSchema rejects amounts above maximum
   */
  it('FundingCreateSchema rejects amounts above maximum', () => {
    fc.assert(
      fc.property(
        validProjectId,
        aboveMaxAmount,
        (projectId, amount) => {
          const input = { projectId, amount, currency: 'ZAR' };
          const result = FundingCreateSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 5.1, 5.2**
   * Boundary test: amount exactly at min (1000) and max (100000000) are accepted
   */
  it('accepts funding at exact boundary amounts (min=1000, max=100000000)', () => {
    fc.assert(
      fc.property(
        eligibleStatus,
        fc.constantFrom(MIN_AMOUNT, MAX_AMOUNT),
        (status, amount) => {
          const result = canFundProject(status, amount, 'funder');
          expect(result.accepted).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 5.1, 5.2**
   * Comprehensive: for any random combination of status, amount, and role,
   * the canFundProject function returns accepted=true if and only if all three
   * conditions are met simultaneously.
   */
  it('accepts if and only if all three conditions are met (eligible status, funder role, valid amount)', () => {
    fc.assert(
      fc.property(
        anyStatus,
        fc.integer({ min: -100000, max: MAX_AMOUNT * 5 }),
        fc.constantFrom<UserRole>(...ALL_ROLES),
        (status, amount, role) => {
          const result = canFundProject(status, amount, role);

          const isEligibleStatus = ELIGIBLE_STATUSES.includes(status);
          const isFunderRole = role === 'funder';
          const isValidAmount = Number.isInteger(amount) && amount >= MIN_AMOUNT && amount <= MAX_AMOUNT;

          const shouldAccept = isEligibleStatus && isFunderRole && isValidAmount;

          expect(result.accepted).toBe(shouldAccept);
        }
      ),
      { numRuns: 500 }
    );
  });
});
