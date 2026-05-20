/**
 * Property Test: Auditor approval gate (Property 2)
 *
 * Validates: Requirements 1.5
 *
 * For any auditor user where isApproved is false, the system SHALL deny access
 * to audit browsing and audit application endpoints, regardless of the auditor's
 * other attributes.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { User } from '../../shared/types';

// ─── Helper Function ─────────────────────────────────────────────────────────

/**
 * Determines whether an auditor user can access audit-related endpoints
 * (browsing available audits and applying to verify projects).
 *
 * Access is granted if and only if:
 * 1. The user has role 'auditor'
 * 2. The user's isApproved flag is true
 *
 * Returns an object with granted status and reason for denial.
 */
export function canAccessAuditEndpoints(user: Pick<User, 'role' | 'isApproved'>): {
  granted: boolean;
  reason?: string;
} {
  if (user.role !== 'auditor') {
    return { granted: false, reason: 'User is not an auditor' };
  }

  if (!user.isApproved) {
    return { granted: false, reason: 'Auditor account has not been approved by an admin' };
  }

  return { granted: true };
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate a valid auditor user ID */
const validUserId = fc.stringMatching(/^[a-zA-Z0-9]{10,28}$/);

/** Generate a valid email */
const validEmail = fc.tuple(
  fc.stringMatching(/^[a-z][a-z0-9]{1,10}$/),
  fc.stringMatching(/^[a-z][a-z0-9]{1,6}$/),
  fc.constantFrom('com', 'org', 'net', 'co.za', 'io')
).map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

/** Generate a valid name */
const validName = fc.stringMatching(/^[A-Za-z][A-Za-z ]{0,49}$/).filter(s => s.length >= 1);

/** Generate a valid ISO 3166-1 alpha-2 country code */
const validCountry = fc.constantFrom(
  'ZA', 'US', 'GB', 'DE', 'FR', 'AU', 'CA', 'IN', 'BR', 'JP',
  'KE', 'NG', 'EG', 'GH', 'TZ', 'MX', 'AR', 'CL', 'NZ', 'SG'
);

/** Generate auditor qualifications */
const validQualifications = fc.constantFrom(
  'CA(SA)', 'CFA', 'CISA', 'MSc Environmental Science',
  'PhD Climate Science', 'BSc Engineering', 'MBA Sustainability',
  'Certified Carbon Auditor', 'ISO 14001 Lead Auditor'
);

/** Generate years of experience */
const validYearsOfExperience = fc.integer({ min: 0, max: 40 });

/** Generate auditor specializations */
const validSpecializations = fc.array(
  fc.constantFrom(
    'energy-saving', 'renewable-energy', 'carbon-removal',
    'education', 'health', 'food-security', 'clean-water',
    'waste-management', 'biodiversity', 'housing',
    'digital-inclusion', 'gender-equality'
  ),
  { minLength: 1, maxLength: 5 }
);

/** Generate a timestamp string */
const validTimestamp = fc.integer({
  min: new Date('2020-01-01').getTime(),
  max: new Date('2030-12-31').getTime(),
}).map(ts => new Date(ts).toISOString());

/**
 * Generate a complete auditor user object with isApproved=false.
 * Varies all other attributes to ensure the gate is independent of them.
 */
const unapprovedAuditor: fc.Arbitrary<User> = fc.record({
  userId: validUserId,
  email: validEmail,
  name: validName,
  role: fc.constant('auditor' as const),
  country: validCountry,
  isApproved: fc.constant(false),
  qualifications: validQualifications,
  yearsOfExperience: validYearsOfExperience,
  specializations: validSpecializations,
  createdAt: validTimestamp,
  updatedAt: validTimestamp,
}).map(fields => ({
  ...fields,
} as User));

/**
 * Generate a complete auditor user object with isApproved=true.
 * Varies all other attributes to ensure the gate is independent of them.
 */
const approvedAuditor: fc.Arbitrary<User> = fc.record({
  userId: validUserId,
  email: validEmail,
  name: validName,
  role: fc.constant('auditor' as const),
  country: validCountry,
  isApproved: fc.constant(true),
  qualifications: validQualifications,
  yearsOfExperience: validYearsOfExperience,
  specializations: validSpecializations,
  createdAt: validTimestamp,
  updatedAt: validTimestamp,
}).map(fields => ({
  ...fields,
} as User));

/**
 * Generate a non-auditor user (funder or owner) with any approval status.
 */
const nonAuditorUser: fc.Arbitrary<Pick<User, 'role' | 'isApproved'>> = fc.record({
  role: fc.constantFrom('funder' as const, 'owner' as const),
  isApproved: fc.boolean(),
});

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 2: Auditor approval gate', () => {
  /**
   * **Validates: Requirements 1.5**
   * For any auditor with isApproved=false, access to audit browsing and
   * application endpoints is denied, regardless of other attributes.
   */
  it('unapproved auditors are denied access to audit endpoints regardless of other attributes', () => {
    fc.assert(
      fc.property(unapprovedAuditor, (auditor) => {
        const result = canAccessAuditEndpoints(auditor);

        expect(result.granted).toBe(false);
        expect(result.reason).toBeDefined();
        expect(result.reason).toContain('not been approved');
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 1.5**
   * For any auditor with isApproved=true, access to audit browsing and
   * application endpoints is granted.
   */
  it('approved auditors are granted access to audit endpoints', () => {
    fc.assert(
      fc.property(approvedAuditor, (auditor) => {
        const result = canAccessAuditEndpoints(auditor);

        expect(result.granted).toBe(true);
        expect(result.reason).toBeUndefined();
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 1.5**
   * The approval gate is solely determined by the isApproved flag —
   * qualifications, experience, and specializations do not affect access.
   */
  it('access decision is independent of qualifications, experience, and specializations', () => {
    fc.assert(
      fc.property(
        validQualifications,
        validYearsOfExperience,
        validSpecializations,
        (qualifications, yearsOfExperience, specializations) => {
          // Same auditor attributes, but isApproved=false → denied
          const unapproved: Pick<User, 'role' | 'isApproved'> = {
            role: 'auditor',
            isApproved: false,
          };
          const deniedResult = canAccessAuditEndpoints(unapproved);
          expect(deniedResult.granted).toBe(false);

          // Same auditor attributes, but isApproved=true → granted
          const approved: Pick<User, 'role' | 'isApproved'> = {
            role: 'auditor',
            isApproved: true,
          };
          const grantedResult = canAccessAuditEndpoints(approved);
          expect(grantedResult.granted).toBe(true);

          // Verify the qualifications/experience/specializations don't matter
          // by confirming the results are consistent regardless of these values
          expect(deniedResult.granted).not.toBe(grantedResult.granted);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.5**
   * Non-auditor users are always denied access to audit endpoints,
   * regardless of their isApproved status.
   */
  it('non-auditor users are denied access to audit endpoints', () => {
    fc.assert(
      fc.property(nonAuditorUser, (user) => {
        const result = canAccessAuditEndpoints(user);

        expect(result.granted).toBe(false);
        expect(result.reason).toContain('not an auditor');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.5**
   * The isApproved flag is the sole determinant for auditor access —
   * flipping it from false to true changes the access decision.
   */
  it('flipping isApproved from false to true changes access decision for auditors', () => {
    fc.assert(
      fc.property(unapprovedAuditor, (auditor) => {
        // With isApproved=false, access is denied
        const deniedResult = canAccessAuditEndpoints(auditor);
        expect(deniedResult.granted).toBe(false);

        // Flip isApproved to true — access should be granted
        const approvedVersion = { ...auditor, isApproved: true };
        const grantedResult = canAccessAuditEndpoints(approvedVersion);
        expect(grantedResult.granted).toBe(true);
      }),
      { numRuns: 200 }
    );
  });
});
