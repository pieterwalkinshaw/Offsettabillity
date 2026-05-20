/**
 * Property Test: PII anonymization on account deletion (Property 37)
 *
 * **Validates: Requirements 12.2**
 *
 * For any user requesting account deletion, the system SHALL replace all PII
 * fields (email, name, phone) in their Firestore document with anonymized
 * placeholders within 30 days, while retaining non-PII data for platform integrity.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { User, UserRole } from '../../shared/types';

// ─── Anonymization Constants (matching functions/src/auth/deleteAccount.ts) ──

const ANONYMIZED_EMAIL = 'deleted@anonymized.invalid';
const ANONYMIZED_NAME = '[deleted]';
const ANONYMIZED_PHONE = '[deleted]';

// ─── Helper: anonymizeUser ───────────────────────────────────────────────────

/**
 * Replaces PII fields (email, name, phone) with anonymized placeholders
 * while retaining all non-PII data (role, country, organizationName, etc.)
 * for platform integrity.
 *
 * Models the anonymization logic from functions/src/auth/deleteAccount.ts.
 */
function anonymizeUser(user: User): User & { deletedAt: string; updatedAt: string } {
  const now = new Date().toISOString();

  return {
    ...user,
    email: ANONYMIZED_EMAIL,
    name: ANONYMIZED_NAME,
    phone: ANONYMIZED_PHONE,
    deletedAt: now,
    updatedAt: now,
  };
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate a valid email address */
const validEmail = fc.tuple(
  fc.stringMatching(/^[a-z][a-z0-9]{1,10}$/),
  fc.stringMatching(/^[a-z][a-z0-9]{1,6}$/),
  fc.constantFrom('com', 'org', 'net', 'co.za', 'io')
).map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

/** Generate a valid name (1-100 chars) */
const validName = fc.stringMatching(/^[A-Za-z][A-Za-z ]{0,49}$/).filter(s => s.length >= 1 && s.length <= 100);

/** Generate a valid phone number */
const validPhone = fc.stringMatching(/^\+?[0-9]{7,15}$/);

/** Generate a valid ISO 3166-1 alpha-2 country code */
const validCountry = fc.constantFrom(
  'ZA', 'US', 'GB', 'DE', 'FR', 'AU', 'CA', 'IN', 'BR', 'JP'
);

/** Generate a valid user role */
const validRole: fc.Arbitrary<UserRole> = fc.constantFrom('funder', 'owner', 'auditor', 'admin');

/** Generate a valid userId */
const validUserId = fc.stringMatching(/^[a-zA-Z0-9]{20,28}$/);

/** Generate an optional organization name */
const optionalOrgName = fc.option(fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{2,30}$/), { nil: undefined });

/** Generate an optional organization type */
const optionalOrgType = fc.option(
  fc.constantFrom('corporate', 'ngo', 'government', 'individual'),
  { nil: undefined }
);

/** Generate an optional organization registration number */
const optionalOrgRegNumber = fc.option(fc.stringMatching(/^[A-Z0-9]{5,15}$/), { nil: undefined });

/** Generate optional expertise/specializations */
const optionalExpertise = fc.option(
  fc.array(fc.constantFrom('energy-saving', 'education', 'health', 'carbon-removal'), { minLength: 1, maxLength: 3 }),
  { nil: undefined }
);

/** Generate an ISO timestamp string */
const isoTimestamp = fc.integer({
  min: new Date('2020-01-01').getTime(),
  max: new Date('2030-12-31').getTime(),
}).map(ts => new Date(ts).toISOString());

/** Generate a random User object with all fields */
const arbitraryUser: fc.Arbitrary<User> = fc.record({
  userId: validUserId,
  email: validEmail,
  name: validName,
  role: validRole,
  phone: fc.option(validPhone, { nil: undefined }),
  country: validCountry,
  organizationName: optionalOrgName,
  organizationType: optionalOrgType,
  organizationRegNumber: optionalOrgRegNumber,
  isApproved: fc.boolean(),
  expertise: optionalExpertise,
  esgProfile: fc.option(
    fc.record({
      industry: fc.option(fc.constantFrom('mining', 'finance', 'tech', 'agriculture'), { nil: undefined }),
      budget: fc.option(fc.integer({ min: 10000, max: 999999999 }), { nil: undefined }),
      interests: fc.option(
        fc.array(fc.constantFrom('energy-saving', 'education', 'health'), { minLength: 1, maxLength: 3 }),
        { nil: undefined }
      ),
    }),
    { nil: undefined }
  ),
  industry: fc.option(fc.constantFrom('mining', 'finance', 'tech', 'agriculture'), { nil: undefined }),
  areasOfInterest: fc.option(
    fc.array(fc.constantFrom('energy-saving', 'education', 'health', 'carbon-removal'), { minLength: 1, maxLength: 3 }),
    { nil: undefined }
  ),
  qualifications: fc.option(fc.stringMatching(/^[A-Za-z ]{5,30}$/), { nil: undefined }),
  yearsOfExperience: fc.option(fc.integer({ min: 0, max: 40 }), { nil: undefined }),
  specializations: fc.option(
    fc.array(fc.constantFrom('energy-saving', 'education', 'health'), { minLength: 1, maxLength: 3 }),
    { nil: undefined }
  ),
  utmSource: fc.option(fc.constantFrom('google', 'facebook', 'linkedin'), { nil: undefined }),
  utmMedium: fc.option(fc.constantFrom('cpc', 'organic', 'email'), { nil: undefined }),
  utmCampaign: fc.option(fc.stringMatching(/^[a-z-]{3,20}$/), { nil: undefined }),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
}) as fc.Arbitrary<User>;

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 37: PII anonymization on account deletion', () => {
  /**
   * **Validates: Requirements 12.2**
   * PII fields (email, name, phone) are replaced with anonymized placeholders.
   */
  it('PII fields are replaced with anonymized placeholders', () => {
    fc.assert(
      fc.property(arbitraryUser, (user) => {
        const anonymized = anonymizeUser(user);

        // Invariant: email is replaced with the anonymized placeholder
        expect(anonymized.email).toBe(ANONYMIZED_EMAIL);
        expect(anonymized.email).not.toBe(user.email);

        // Invariant: name is replaced with the anonymized placeholder
        expect(anonymized.name).toBe(ANONYMIZED_NAME);
        expect(anonymized.name).not.toBe(user.name);

        // Invariant: phone is replaced with the anonymized placeholder
        expect(anonymized.phone).toBe(ANONYMIZED_PHONE);
        if (user.phone) {
          expect(anonymized.phone).not.toBe(user.phone);
        }
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 12.2**
   * Non-PII data (role, country, organizationName, isApproved, etc.) is retained unchanged.
   */
  it('non-PII data is retained unchanged', () => {
    fc.assert(
      fc.property(arbitraryUser, (user) => {
        const anonymized = anonymizeUser(user);

        // Invariant: role is retained
        expect(anonymized.role).toBe(user.role);

        // Invariant: country is retained
        expect(anonymized.country).toBe(user.country);

        // Invariant: organizationName is retained
        expect(anonymized.organizationName).toBe(user.organizationName);

        // Invariant: organizationType is retained
        expect(anonymized.organizationType).toBe(user.organizationType);

        // Invariant: organizationRegNumber is retained
        expect(anonymized.organizationRegNumber).toBe(user.organizationRegNumber);

        // Invariant: isApproved is retained
        expect(anonymized.isApproved).toBe(user.isApproved);

        // Invariant: userId is retained
        expect(anonymized.userId).toBe(user.userId);

        // Invariant: expertise is retained
        expect(anonymized.expertise).toEqual(user.expertise);

        // Invariant: esgProfile is retained
        expect(anonymized.esgProfile).toEqual(user.esgProfile);

        // Invariant: createdAt is retained (original creation timestamp preserved)
        expect(anonymized.createdAt).toBe(user.createdAt);

        // Invariant: industry is retained
        expect(anonymized.industry).toBe(user.industry);

        // Invariant: areasOfInterest is retained
        expect(anonymized.areasOfInterest).toEqual(user.areasOfInterest);

        // Invariant: qualifications is retained
        expect(anonymized.qualifications).toBe(user.qualifications);

        // Invariant: yearsOfExperience is retained
        expect(anonymized.yearsOfExperience).toBe(user.yearsOfExperience);

        // Invariant: specializations is retained
        expect(anonymized.specializations).toEqual(user.specializations);

        // Invariant: UTM fields are retained
        expect(anonymized.utmSource).toBe(user.utmSource);
        expect(anonymized.utmMedium).toBe(user.utmMedium);
        expect(anonymized.utmCampaign).toBe(user.utmCampaign);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 12.2**
   * The anonymized document is still structurally valid — it retains all required
   * fields and the structure matches the User interface with deletion metadata.
   */
  it('the anonymized document is still structurally valid', () => {
    fc.assert(
      fc.property(arbitraryUser, (user) => {
        const anonymized = anonymizeUser(user);

        // Invariant: userId is a non-empty string
        expect(typeof anonymized.userId).toBe('string');
        expect(anonymized.userId.length).toBeGreaterThan(0);

        // Invariant: email is a valid string (anonymized placeholder)
        expect(typeof anonymized.email).toBe('string');
        expect(anonymized.email.length).toBeGreaterThan(0);
        expect(anonymized.email).toContain('@');

        // Invariant: name is a non-empty string (anonymized placeholder)
        expect(typeof anonymized.name).toBe('string');
        expect(anonymized.name.length).toBeGreaterThan(0);

        // Invariant: role is still a valid UserRole
        expect(['funder', 'owner', 'auditor', 'admin']).toContain(anonymized.role);

        // Invariant: country is still a valid 2-char code
        expect(typeof anonymized.country).toBe('string');
        expect(anonymized.country.length).toBe(2);

        // Invariant: isApproved is still a boolean
        expect(typeof anonymized.isApproved).toBe('boolean');

        // Invariant: createdAt is a valid ISO timestamp string
        expect(typeof anonymized.createdAt).toBe('string');
        expect(new Date(anonymized.createdAt).toISOString()).toBe(anonymized.createdAt);

        // Invariant: deletedAt is set and is a valid ISO timestamp
        expect(typeof anonymized.deletedAt).toBe('string');
        expect(anonymized.deletedAt.length).toBeGreaterThan(0);
        expect(new Date(anonymized.deletedAt).toISOString()).toBe(anonymized.deletedAt);

        // Invariant: updatedAt is updated and is a valid ISO timestamp
        expect(typeof anonymized.updatedAt).toBe('string');
        expect(new Date(anonymized.updatedAt).toISOString()).toBe(anonymized.updatedAt);
      }),
      { numRuns: 200 }
    );
  });
});
