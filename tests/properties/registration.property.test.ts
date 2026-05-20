/**
 * Property Test: Registration validation and user document creation (Property 1)
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.7
 *
 * For any registration input, if all fields pass validation (valid email, password
 * with uppercase+lowercase+digit of 8–64 chars, name 1–100 chars, valid ISO 3166-1
 * alpha-2 country, valid role, and role-specific required fields), the system SHALL
 * create a user document with the correct role, all provided fields, and role-specific
 * fields stored correctly. If any field fails validation, the system SHALL reject the
 * registration and return field-specific error messages without creating any account.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { RegistrationSchema } from '../../shared/schemas';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate a valid email address */
const validEmail = fc.tuple(
  fc.stringMatching(/^[a-z][a-z0-9]{1,10}$/),
  fc.stringMatching(/^[a-z][a-z0-9]{1,6}$/),
  fc.constantFrom('com', 'org', 'net', 'co.za', 'io')
).map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

/** Generate a valid password (8-64 chars, must contain uppercase, lowercase, digit) */
const validPassword = fc.tuple(
  fc.stringMatching(/^[a-z]{2,20}$/),
  fc.stringMatching(/^[A-Z]{2,20}$/),
  fc.stringMatching(/^[0-9]{1,5}$/),
  fc.stringMatching(/^[a-zA-Z0-9]{0,15}$/)
).map(([lower, upper, digit, extra]) => {
  const combined = lower + upper + digit + extra;
  // Ensure length is 8-64
  if (combined.length < 8) return combined + 'aA1xxxxx'.slice(0, 8 - combined.length);
  if (combined.length > 64) return combined.slice(0, 64);
  return combined;
});

/** Generate a valid name (1-100 chars) */
const validName = fc.stringMatching(/^[A-Za-z][A-Za-z ]{0,49}$/).filter(s => s.length >= 1 && s.length <= 100);

/** Generate a valid ISO 3166-1 alpha-2 country code */
const validCountry = fc.constantFrom(
  'ZA', 'US', 'GB', 'DE', 'FR', 'AU', 'CA', 'IN', 'BR', 'JP',
  'KE', 'NG', 'EG', 'GH', 'TZ', 'MX', 'AR', 'CL', 'NZ', 'SG'
);

/** Generate a valid role */
const validRole = fc.constantFrom('funder' as const, 'owner' as const, 'auditor' as const);

/** Generate funder-specific fields */
const funderFields = fc.record({
  organizationName: fc.string({ minLength: 1, maxLength: 50 }),
  organizationType: fc.constantFrom('corporate', 'ngo', 'government', 'individual'),
  industry: fc.constantFrom('mining', 'finance', 'technology', 'agriculture', 'manufacturing'),
  areasOfInterest: fc.array(
    fc.constantFrom('energy-saving', 'education', 'health', 'carbon-removal'),
    { minLength: 1, maxLength: 4 }
  ),
});

/** Generate owner-specific fields */
const ownerFields = fc.record({
  organizationName: fc.string({ minLength: 1, maxLength: 50 }),
  organizationRegNumber: fc.stringMatching(/^[A-Z0-9]{5,15}$/),
  organizationType: fc.constantFrom('npo', 'pty', 'cc', 'trust'),
});

/** Generate auditor-specific fields */
const auditorFields = fc.record({
  qualifications: fc.constantFrom('CA(SA)', 'CFA', 'CISA', 'MSc Environmental Science'),
  yearsOfExperience: fc.integer({ min: 0, max: 40 }),
  specializations: fc.array(
    fc.constantFrom('energy-saving', 'carbon-removal', 'education', 'biodiversity'),
    { minLength: 1, maxLength: 4 }
  ),
});

/** Generate a complete valid registration input for a given role */
function validRegistrationForRole(role: 'funder' | 'owner' | 'auditor') {
  const base = fc.record({
    email: validEmail,
    password: validPassword,
    name: validName,
    country: validCountry,
    role: fc.constant(role),
  });

  switch (role) {
    case 'funder':
      return fc.tuple(base, funderFields).map(([b, f]) => ({ ...b, ...f }));
    case 'owner':
      return fc.tuple(base, ownerFields).map(([b, f]) => ({ ...b, ...f }));
    case 'auditor':
      return fc.tuple(base, auditorFields).map(([b, f]) => ({ ...b, ...f }));
  }
}

/** Generate a valid registration input for any role */
const validRegistration = validRole.chain(role => validRegistrationForRole(role));

// ─── Invalid Input Generators ────────────────────────────────────────────────

/** Generate an invalid email */
const invalidEmail = fc.constantFrom(
  '',
  'notanemail',
  'missing@',
  '@nodomain.com',
  'spaces in@email.com',
  'no-tld@domain',
  'double@@at.com'
);

/** Generate an invalid password (missing requirements) */
const invalidPassword = fc.oneof(
  // Too short (< 8 chars)
  fc.stringMatching(/^[a-zA-Z0-9]{1,7}$/),
  // Too long (> 64 chars)
  fc.constant('aA1' + 'x'.repeat(62)),
  // Missing uppercase
  fc.stringMatching(/^[a-z0-9]{8,16}$/),
  // Missing lowercase
  fc.stringMatching(/^[A-Z0-9]{8,16}$/),
  // Missing digit
  fc.stringMatching(/^[a-zA-Z]{8,16}$/)
);

/** Generate an invalid name */
const invalidName = fc.oneof(
  // Empty string
  fc.constant(''),
  // Too long (> 100 chars)
  fc.constant('A'.repeat(101))
);

/** Generate an invalid country code */
const invalidCountry = fc.oneof(
  fc.constant(''),
  fc.constant('A'),       // Too short
  fc.constant('ABC'),     // Too long
  fc.constant('123')      // Not 2 chars
);

/** Generate an invalid role */
const invalidRole = fc.constantFrom('admin', 'superuser', 'moderator', '', 'FUNDER');

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 1: Registration validation and user document creation', () => {
  /**
   * **Validates: Requirements 1.1**
   * Valid registration inputs across all roles should pass schema validation
   * and produce a correctly structured user document.
   */
  it('valid registration inputs pass schema validation for all roles', () => {
    fc.assert(
      fc.property(validRegistration, (input) => {
        const result = RegistrationSchema.safeParse(input);
        expect(result.success).toBe(true);

        if (result.success) {
          // Verify core fields are preserved
          expect(result.data.email).toBe(input.email);
          expect(result.data.name).toBe(input.name);
          expect(result.data.country).toBe(input.country);
          expect(result.data.role).toBe(input.role);
          expect(result.data.password).toBe(input.password);
        }
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 1.2**
   * Funder role registration preserves role-specific fields.
   */
  it('funder registration preserves organization name, type, industry, and areas of interest', () => {
    fc.assert(
      fc.property(validRegistrationForRole('funder'), (input) => {
        const result = RegistrationSchema.safeParse(input);
        expect(result.success).toBe(true);

        if (result.success) {
          expect(result.data.role).toBe('funder');
          expect(result.data.organizationName).toBe(input.organizationName);
          expect(result.data.organizationType).toBe(input.organizationType);
          expect(result.data.industry).toBe(input.industry);
          expect(result.data.areasOfInterest).toEqual(input.areasOfInterest);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.3**
   * Owner role registration preserves role-specific fields.
   */
  it('owner registration preserves organization name, reg number, and type', () => {
    fc.assert(
      fc.property(validRegistrationForRole('owner'), (input) => {
        const result = RegistrationSchema.safeParse(input);
        expect(result.success).toBe(true);

        if (result.success) {
          expect(result.data.role).toBe('owner');
          expect(result.data.organizationName).toBe(input.organizationName);
          expect(result.data.organizationRegNumber).toBe(input.organizationRegNumber);
          expect(result.data.organizationType).toBe(input.organizationType);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.4**
   * Auditor role registration preserves role-specific fields.
   */
  it('auditor registration preserves qualifications, years of experience, and specializations', () => {
    fc.assert(
      fc.property(validRegistrationForRole('auditor'), (input) => {
        const result = RegistrationSchema.safeParse(input);
        expect(result.success).toBe(true);

        if (result.success) {
          expect(result.data.role).toBe('auditor');
          expect(result.data.qualifications).toBe(input.qualifications);
          expect(result.data.yearsOfExperience).toBe(input.yearsOfExperience);
          expect(result.data.specializations).toEqual(input.specializations);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.7**
   * Invalid email addresses are rejected with field-specific errors.
   */
  it('invalid email addresses are rejected', () => {
    fc.assert(
      fc.property(
        invalidEmail,
        validPassword,
        validName,
        validCountry,
        validRole,
        (email, password, name, country, role) => {
          const input = { email, password, name, country, role };
          const result = RegistrationSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 1.1, 1.7**
   * Invalid passwords are rejected with field-specific errors.
   */
  it('invalid passwords are rejected', () => {
    fc.assert(
      fc.property(
        validEmail,
        invalidPassword,
        validName,
        validCountry,
        validRole,
        (email, password, name, country, role) => {
          const input = { email, password, name, country, role };
          const result = RegistrationSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 1.1, 1.7**
   * Invalid names (empty or > 100 chars) are rejected.
   */
  it('invalid names are rejected', () => {
    fc.assert(
      fc.property(
        validEmail,
        validPassword,
        invalidName,
        validCountry,
        validRole,
        (email, password, name, country, role) => {
          const input = { email, password, name, country, role };
          const result = RegistrationSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 1.1, 1.7**
   * Invalid country codes (not exactly 2 chars) are rejected.
   */
  it('invalid country codes are rejected', () => {
    fc.assert(
      fc.property(
        validEmail,
        validPassword,
        validName,
        invalidCountry,
        validRole,
        (email, password, name, country, role) => {
          const input = { email, password, name, country, role };
          const result = RegistrationSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 1.7**
   * Invalid roles are rejected.
   */
  it('invalid roles are rejected', () => {
    fc.assert(
      fc.property(
        validEmail,
        validPassword,
        validName,
        validCountry,
        invalidRole,
        (email, password, name, country, role) => {
          const input = { email, password, name, country, role };
          const result = RegistrationSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 1.7**
   * When validation fails, the result contains error information (field-specific).
   */
  it('validation failures produce error details', () => {
    fc.assert(
      fc.property(
        invalidEmail,
        validPassword,
        validName,
        validCountry,
        validRole,
        (email, password, name, country, role) => {
          const input = { email, password, name, country, role };
          const result = RegistrationSchema.safeParse(input);
          expect(result.success).toBe(false);

          if (!result.success) {
            // Zod v4 provides error issues
            expect(result.error.issues.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 1.1**
   * Password must contain at least one uppercase, one lowercase, and one digit.
   */
  it('password regex enforces uppercase, lowercase, and digit requirement', () => {
    // Passwords with only lowercase + digits (no uppercase) should fail
    fc.assert(
      fc.property(
        validEmail,
        fc.stringMatching(/^[a-z0-9]{8,16}$/),
        validName,
        validCountry,
        validRole,
        (email, password, name, country, role) => {
          const input = { email, password, name, country, role };
          const result = RegistrationSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 1.1**
   * Password length must be between 8 and 64 characters.
   */
  it('password length boundaries are enforced', () => {
    // 7-char password with all requirements should still fail (too short)
    const shortPassword = fc.constant('aB1cdef'); // 7 chars
    fc.assert(
      fc.property(
        validEmail,
        shortPassword,
        validName,
        validCountry,
        validRole,
        (email, password, name, country, role) => {
          const input = { email, password, name, country, role };
          const result = RegistrationSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 10 }
    );

    // 65-char password should fail (too long)
    const longPassword = fc.constant('aB1' + 'x'.repeat(62)); // 65 chars
    fc.assert(
      fc.property(
        validEmail,
        longPassword,
        validName,
        validCountry,
        validRole,
        (email, password, name, country, role) => {
          const input = { email, password, name, country, role };
          const result = RegistrationSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
   * Valid inputs produce a user document structure with the correct role and all fields.
   */
  it('valid inputs produce correct user document structure', () => {
    fc.assert(
      fc.property(validRegistration, (input) => {
        const result = RegistrationSchema.safeParse(input);
        expect(result.success).toBe(true);

        if (result.success) {
          const doc = result.data;

          // Core fields always present
          expect(doc.email).toBeDefined();
          expect(doc.password).toBeDefined();
          expect(doc.name).toBeDefined();
          expect(doc.country).toBeDefined();
          expect(doc.role).toBeDefined();

          // Role is one of the valid values
          expect(['funder', 'owner', 'auditor']).toContain(doc.role);

          // Country is exactly 2 characters
          expect(doc.country.length).toBe(2);

          // Name is 1-100 characters
          expect(doc.name.length).toBeGreaterThanOrEqual(1);
          expect(doc.name.length).toBeLessThanOrEqual(100);

          // Password is 8-64 characters
          expect(doc.password.length).toBeGreaterThanOrEqual(8);
          expect(doc.password.length).toBeLessThanOrEqual(64);
        }
      }),
      { numRuns: 200 }
    );
  });
});
