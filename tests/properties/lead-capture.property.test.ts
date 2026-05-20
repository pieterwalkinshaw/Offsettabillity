/**
 * Property Test: Lead capture validation and storage (Property 19)
 *
 * Validates: Requirements 6.1, 6.3, 6.7, 6.8
 *
 * For any lead submission, if the email is valid (RFC 5322, max 254 chars) and
 * lead type is provided, the system SHALL create a lead record with status="new",
 * all provided fields stored correctly (including UTM parameters, marketing consent,
 * and timestamp), and trigger an async admin notification. If email is invalid or
 * type is missing, the submission SHALL be rejected with field-specific errors.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { LeadCreateSchema } from '../../shared/schemas';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate a valid email address (RFC 5322 compliant, max 254 chars) */
const validEmail = fc.tuple(
  fc.stringMatching(/^[a-z][a-z0-9]{0,20}$/),
  fc.stringMatching(/^[a-z][a-z0-9]{1,10}$/),
  fc.constantFrom('com', 'org', 'net', 'co.za', 'io', 'gov', 'edu')
).map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

/** Generate a valid lead type */
const validLeadType = fc.constantFrom(
  'calculator' as const,
  'report_request' as const,
  'consultation' as const,
  'newsletter' as const,
  'auditor_inquiry' as const
);

/** Generate a valid source URL */
const validSourceUrl = fc.tuple(
  fc.constantFrom('https://offsettabillity.co.za', 'https://www.offsettabillity.co.za'),
  fc.constantFrom('/categories/energy-saving', '/projects/123', '/contact', '/calculator', '/')
).map(([base, path]) => `${base}${path}`);

/** Generate valid UTM parameters */
const validUtm = fc.record({
  source: fc.option(fc.constantFrom('google', 'facebook', 'linkedin', 'direct'), { nil: undefined }),
  medium: fc.option(fc.constantFrom('cpc', 'organic', 'email', 'social'), { nil: undefined }),
  campaign: fc.option(fc.constantFrom('esg-2025', 'carbon-q1', 'brand-awareness'), { nil: undefined }),
  content: fc.option(fc.constantFrom('ad-variant-a', 'banner-1', 'sidebar'), { nil: undefined }),
  term: fc.option(fc.constantFrom('esg funding', 'carbon offset', 'verified projects'), { nil: undefined }),
});

/** Generate a valid marketing consent boolean */
const validMarketingConsent = fc.boolean();

/** Generate optional lead fields */
const optionalName = fc.option(fc.stringMatching(/^[A-Za-z][A-Za-z ]{0,49}$/).filter(s => s.length <= 100), { nil: undefined });
const optionalCompany = fc.option(fc.stringMatching(/^[A-Za-z][A-Za-z0-9 &.]{0,50}$/).filter(s => s.length <= 200), { nil: undefined });
const optionalPhone = fc.option(fc.stringMatching(/^\+?[0-9]{7,15}$/).filter(s => s.length <= 20), { nil: undefined });
const optionalMessage = fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined });
const optionalIndustry = fc.option(fc.constantFrom('mining', 'finance', 'technology', 'agriculture', 'manufacturing'), { nil: undefined });
const optionalBudget = fc.option(fc.integer({ min: 1, max: 999999999 }), { nil: undefined });
const optionalProjectId = fc.option(fc.stringMatching(/^[a-zA-Z0-9]{10,20}$/), { nil: undefined });

/** Generate a complete valid lead input */
const validLeadInput = fc.record({
  email: validEmail,
  name: optionalName,
  company: optionalCompany,
  phone: optionalPhone,
  type: validLeadType,
  source: validSourceUrl,
  projectId: optionalProjectId,
  message: optionalMessage,
  industry: optionalIndustry,
  budget: optionalBudget,
  marketingConsent: validMarketingConsent,
  utm: validUtm,
});

// ─── Invalid Input Generators ────────────────────────────────────────────────

/** Generate an invalid email */
const invalidEmail = fc.constantFrom(
  '',
  'notanemail',
  'missing@',
  '@nodomain.com',
  'spaces in@email.com',
  'no-tld@domain',
  'double@@at.com',
  'a'.repeat(255) + '@test.com'
);

/** Generate an invalid lead type */
const invalidLeadType = fc.constantFrom(
  'invalid_type',
  'CALCULATOR',
  '',
  'signup',
  'purchase'
);

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 19: Lead capture validation and storage', () => {
  /**
   * **Validates: Requirements 6.1**
   * Valid lead inputs with valid email and type pass schema validation
   * and all provided fields are preserved correctly.
   */
  it('valid lead inputs pass schema validation with all fields preserved', () => {
    fc.assert(
      fc.property(validLeadInput, (input) => {
        const result = LeadCreateSchema.safeParse(input);
        expect(result.success).toBe(true);

        if (result.success) {
          // Required fields preserved
          expect(result.data.email).toBe(input.email);
          expect(result.data.type).toBe(input.type);
          expect(result.data.source).toBe(input.source);
          expect(result.data.marketingConsent).toBe(input.marketingConsent);

          // Optional fields preserved when provided
          if (input.name !== undefined) expect(result.data.name).toBe(input.name);
          if (input.company !== undefined) expect(result.data.company).toBe(input.company);
          if (input.phone !== undefined) expect(result.data.phone).toBe(input.phone);
          if (input.message !== undefined) expect(result.data.message).toBe(input.message);
          if (input.industry !== undefined) expect(result.data.industry).toBe(input.industry);
          if (input.budget !== undefined) expect(result.data.budget).toBe(input.budget);
          if (input.projectId !== undefined) expect(result.data.projectId).toBe(input.projectId);
        }
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 6.1, 6.8**
   * UTM parameters are stored correctly with the lead record.
   */
  it('UTM parameters are preserved in validated lead data', () => {
    fc.assert(
      fc.property(validLeadInput, (input) => {
        const result = LeadCreateSchema.safeParse(input);
        expect(result.success).toBe(true);

        if (result.success) {
          // UTM object is always present
          expect(result.data.utm).toBeDefined();

          // Each UTM field preserved when provided
          if (input.utm.source !== undefined) expect(result.data.utm.source).toBe(input.utm.source);
          if (input.utm.medium !== undefined) expect(result.data.utm.medium).toBe(input.utm.medium);
          if (input.utm.campaign !== undefined) expect(result.data.utm.campaign).toBe(input.utm.campaign);
          if (input.utm.content !== undefined) expect(result.data.utm.content).toBe(input.utm.content);
          if (input.utm.term !== undefined) expect(result.data.utm.term).toBe(input.utm.term);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 6.8**
   * Marketing consent boolean is stored correctly regardless of value.
   */
  it('marketing consent is stored correctly for both true and false values', () => {
    fc.assert(
      fc.property(validLeadInput, (input) => {
        const result = LeadCreateSchema.safeParse(input);
        expect(result.success).toBe(true);

        if (result.success) {
          expect(typeof result.data.marketingConsent).toBe('boolean');
          expect(result.data.marketingConsent).toBe(input.marketingConsent);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 6.3**
   * Valid lead inputs produce a record that would have status="new".
   * (The schema validates input; the Cloud Function sets status="new" on creation.)
   */
  it('valid lead inputs produce a record structure suitable for status="new" assignment', () => {
    fc.assert(
      fc.property(validLeadInput, (input) => {
        const result = LeadCreateSchema.safeParse(input);
        expect(result.success).toBe(true);

        if (result.success) {
          // The validated data contains all required fields for lead creation
          expect(result.data.email).toBeDefined();
          expect(result.data.type).toBeDefined();
          expect(result.data.source).toBeDefined();
          expect(result.data.marketingConsent).toBeDefined();
          expect(result.data.utm).toBeDefined();

          // Lead type is one of the valid enum values
          expect(['calculator', 'report_request', 'consultation', 'newsletter', 'auditor_inquiry'])
            .toContain(result.data.type);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 6.7**
   * Invalid email addresses are rejected with field-specific errors.
   */
  it('invalid email addresses are rejected', () => {
    fc.assert(
      fc.property(
        invalidEmail,
        validLeadType,
        validSourceUrl,
        validMarketingConsent,
        validUtm,
        (email, type, source, marketingConsent, utm) => {
          const input = { email, type, source, marketingConsent, utm };
          const result = LeadCreateSchema.safeParse(input);
          expect(result.success).toBe(false);

          if (!result.success) {
            // Should have at least one error related to email
            const emailErrors = result.error.issues.filter(
              issue => issue.path.includes('email') || issue.path[0] === 'email'
            );
            expect(emailErrors.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 6.7**
   * Missing or invalid lead type is rejected with field-specific errors.
   */
  it('invalid lead types are rejected', () => {
    fc.assert(
      fc.property(
        validEmail,
        invalidLeadType,
        validSourceUrl,
        validMarketingConsent,
        validUtm,
        (email, type, source, marketingConsent, utm) => {
          const input = { email, type, source, marketingConsent, utm };
          const result = LeadCreateSchema.safeParse(input);
          expect(result.success).toBe(false);

          if (!result.success) {
            // Should have at least one error related to type
            const typeErrors = result.error.issues.filter(
              issue => issue.path.includes('type') || issue.path[0] === 'type'
            );
            expect(typeErrors.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 6.7**
   * Missing required fields (email, type) are rejected.
   */
  it('missing required fields are rejected', () => {
    // Missing email
    fc.assert(
      fc.property(
        validLeadType,
        validSourceUrl,
        validMarketingConsent,
        validUtm,
        (type, source, marketingConsent, utm) => {
          const input = { type, source, marketingConsent, utm };
          const result = LeadCreateSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 20 }
    );

    // Missing type
    fc.assert(
      fc.property(
        validEmail,
        validSourceUrl,
        validMarketingConsent,
        validUtm,
        (email, source, marketingConsent, utm) => {
          const input = { email, source, marketingConsent, utm };
          const result = LeadCreateSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 20 }
    );

    // Missing source
    fc.assert(
      fc.property(
        validEmail,
        validLeadType,
        validMarketingConsent,
        validUtm,
        (email, type, marketingConsent, utm) => {
          const input = { email, type, marketingConsent, utm };
          const result = LeadCreateSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 20 }
    );

    // Missing marketingConsent
    fc.assert(
      fc.property(
        validEmail,
        validLeadType,
        validSourceUrl,
        validUtm,
        (email, type, source, utm) => {
          const input = { email, type, source, utm };
          const result = LeadCreateSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 20 }
    );

    // Missing utm
    fc.assert(
      fc.property(
        validEmail,
        validLeadType,
        validSourceUrl,
        validMarketingConsent,
        (email, type, source, marketingConsent) => {
          const input = { email, type, source, marketingConsent };
          const result = LeadCreateSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * **Validates: Requirements 6.7**
   * Validation failures produce field-specific error details.
   */
  it('validation failures produce field-specific error details', () => {
    fc.assert(
      fc.property(
        invalidEmail,
        invalidLeadType,
        validSourceUrl,
        validMarketingConsent,
        validUtm,
        (email, type, source, marketingConsent, utm) => {
          const input = { email, type, source, marketingConsent, utm };
          const result = LeadCreateSchema.safeParse(input);
          expect(result.success).toBe(false);

          if (!result.success) {
            // Errors should have path information for field-specific reporting
            expect(result.error.issues.length).toBeGreaterThan(0);
            for (const issue of result.error.issues) {
              expect(issue.path).toBeDefined();
              expect(issue.message).toBeDefined();
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 6.1**
   * Email max length of 254 characters is enforced.
   */
  it('email exceeding 254 characters is rejected', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 246, max: 300 }),
        validLeadType,
        validSourceUrl,
        validMarketingConsent,
        validUtm,
        (localLength, type, source, marketingConsent, utm) => {
          // Generate an email that exceeds 254 chars total
          // localPart + '@' + 'test.com' = localLength + 9
          // For localLength >= 246: total = 246 + 9 = 255 (exceeds 254)
          const localPart = 'a'.repeat(localLength);
          const email = `${localPart}@test.com`;
          expect(email.length).toBeGreaterThan(254);
          const input = { email, type, source, marketingConsent, utm };
          const result = LeadCreateSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * **Validates: Requirements 6.1**
   * Optional field length constraints are enforced (name ≤100, company ≤200, phone ≤20).
   */
  it('optional field length constraints are enforced', () => {
    // Name exceeding 100 chars
    fc.assert(
      fc.property(
        validEmail,
        validLeadType,
        validSourceUrl,
        validMarketingConsent,
        validUtm,
        (email, type, source, marketingConsent, utm) => {
          const input = {
            email, type, source, marketingConsent, utm,
            name: 'A'.repeat(101),
          };
          const result = LeadCreateSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 10 }
    );

    // Company exceeding 200 chars
    fc.assert(
      fc.property(
        validEmail,
        validLeadType,
        validSourceUrl,
        validMarketingConsent,
        validUtm,
        (email, type, source, marketingConsent, utm) => {
          const input = {
            email, type, source, marketingConsent, utm,
            company: 'B'.repeat(201),
          };
          const result = LeadCreateSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 10 }
    );

    // Phone exceeding 20 chars
    fc.assert(
      fc.property(
        validEmail,
        validLeadType,
        validSourceUrl,
        validMarketingConsent,
        validUtm,
        (email, type, source, marketingConsent, utm) => {
          const input = {
            email, type, source, marketingConsent, utm,
            phone: '1'.repeat(21),
          };
          const result = LeadCreateSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * **Validates: Requirements 6.1**
   * Budget field enforces min/max constraints (1 to 999999999).
   */
  it('budget outside valid range is rejected', () => {
    // Budget below minimum (0 or negative)
    fc.assert(
      fc.property(
        validEmail,
        validLeadType,
        validSourceUrl,
        validMarketingConsent,
        validUtm,
        fc.integer({ min: -1000, max: 0 }),
        (email, type, source, marketingConsent, utm, budget) => {
          const input = { email, type, source, marketingConsent, utm, budget };
          const result = LeadCreateSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 20 }
    );

    // Budget above maximum
    fc.assert(
      fc.property(
        validEmail,
        validLeadType,
        validSourceUrl,
        validMarketingConsent,
        validUtm,
        fc.integer({ min: 1000000000, max: 2000000000 }),
        (email, type, source, marketingConsent, utm, budget) => {
          const input = { email, type, source, marketingConsent, utm, budget };
          const result = LeadCreateSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 20 }
    );
  });
});
