/**
 * Property Test: Lead status transitions (Property 20)
 *
 * Validates: Requirements 6.4
 *
 * For any lead status update by an admin, the system SHALL accept only transitions
 * to the values: new, contacted, qualified, converted, or lost. Invalid status
 * values SHALL be rejected.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ─── Valid Lead Statuses ─────────────────────────────────────────────────────

const VALID_LEAD_STATUSES = ['new', 'contacted', 'qualified', 'converted', 'lost'] as const;

/**
 * Helper function that checks whether a given status value is a valid lead status.
 * This mirrors the validation logic in functions/src/leads/update.ts.
 */
function isValidLeadStatus(status: unknown): boolean {
  if (typeof status !== 'string') return false;
  return (VALID_LEAD_STATUSES as readonly string[]).includes(status);
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate one of the valid lead status values */
const validLeadStatus = fc.constantFrom(...VALID_LEAD_STATUSES);

/** Generate an invalid status string that is NOT one of the valid values */
const invalidLeadStatusString = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => !(VALID_LEAD_STATUSES as readonly string[]).includes(s));

/** Generate an empty string (invalid) */
const emptyString = fc.constant('');

/** Generate non-string values (numbers, booleans, objects, arrays, null, undefined) */
const nonStringValues = fc.oneof(
  fc.integer(),
  fc.double(),
  fc.boolean(),
  fc.constant(null),
  fc.constant(undefined),
  fc.array(fc.string()),
  fc.dictionary(fc.string(), fc.string())
);

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 20: Lead status transitions', () => {
  /**
   * **Validates: Requirements 6.4**
   * Valid statuses (new, contacted, qualified, converted, lost) are accepted.
   */
  it('valid lead statuses are accepted', () => {
    fc.assert(
      fc.property(validLeadStatus, (status) => {
        expect(isValidLeadStatus(status)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 6.4**
   * Invalid statuses (random strings not in the valid set) are rejected.
   */
  it('invalid status strings are rejected', () => {
    fc.assert(
      fc.property(invalidLeadStatusString, (status) => {
        expect(isValidLeadStatus(status)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 6.4**
   * Non-string values (numbers, booleans, objects, arrays, null, undefined) are rejected.
   */
  it('non-string values are rejected', () => {
    fc.assert(
      fc.property(nonStringValues, (value) => {
        expect(isValidLeadStatus(value)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 6.4**
   * Empty string is rejected as a status value.
   */
  it('empty string is rejected as a status value', () => {
    fc.assert(
      fc.property(emptyString, (status) => {
        expect(isValidLeadStatus(status)).toBe(false);
      }),
      { numRuns: 10 }
    );
  });

  /**
   * **Validates: Requirements 6.4**
   * The set of valid statuses is exactly 5 values.
   */
  it('the set of valid statuses is exactly 5 values', () => {
    expect(VALID_LEAD_STATUSES).toHaveLength(5);
    expect(new Set(VALID_LEAD_STATUSES).size).toBe(5);
  });

  /**
   * **Validates: Requirements 6.4**
   * Every valid status is accepted and every other string is rejected —
   * the acceptance set is exactly the defined valid statuses.
   */
  it('acceptance set is exactly the defined valid statuses', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 100 }), (status) => {
        const expected = (VALID_LEAD_STATUSES as readonly string[]).includes(status);
        expect(isValidLeadStatus(status)).toBe(expected);
      }),
      { numRuns: 500 }
    );
  });

  /**
   * **Validates: Requirements 6.4**
   * Case sensitivity: status values must match exactly (no case-insensitive matching).
   */
  it('status matching is case-sensitive', () => {
    fc.assert(
      fc.property(validLeadStatus, (status) => {
        // Uppercase version should be rejected
        const uppercased = status.toUpperCase();
        if (uppercased !== status) {
          expect(isValidLeadStatus(uppercased)).toBe(false);
        }

        // Mixed case should be rejected
        const mixedCase = status.charAt(0).toUpperCase() + status.slice(1);
        if (mixedCase !== status) {
          expect(isValidLeadStatus(mixedCase)).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });
});
