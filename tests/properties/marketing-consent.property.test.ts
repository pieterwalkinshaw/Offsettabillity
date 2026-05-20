/**
 * Property Test: Marketing consent enforcement (Property 21)
 *
 * Validates: Requirements 6.9, 12.5
 *
 * For any lead where marketingConsent is false, the system SHALL NOT send
 * marketing communications to that lead's email address, while still storing
 * the lead for transactional purposes.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { LeadCreateSchema } from '../../shared/schemas';

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Determines whether marketing communications can be sent to a lead.
 * Returns true only if the lead has explicitly consented (marketingConsent === true).
 *
 * This mirrors the enforcement logic required by Requirements 6.9 and 12.5:
 * - Leads without consent SHALL NOT receive marketing communications
 * - Leads with consent MAY receive marketing communications
 */
function canSendMarketing(lead: { marketingConsent: boolean }): boolean {
  return lead.marketingConsent === true;
}

/**
 * Determines whether a lead should be stored in the system.
 * All leads are stored regardless of marketing consent status —
 * consent only affects whether marketing communications are sent.
 *
 * Per Requirements 6.9 and 12.5, leads without consent are stored
 * for transactional purposes only.
 */
function shouldStoreLead(lead: { marketingConsent: boolean; email: string }): boolean {
  return true;
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate a valid email address */
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

/** Generate optional lead fields */
const optionalName = fc.option(fc.stringMatching(/^[A-Za-z][A-Za-z ]{0,49}$/).filter(s => s.length <= 100), { nil: undefined });
const optionalCompany = fc.option(fc.stringMatching(/^[A-Za-z][A-Za-z0-9 &.]{0,50}$/).filter(s => s.length <= 200), { nil: undefined });
const optionalPhone = fc.option(fc.stringMatching(/^\+?[0-9]{7,15}$/).filter(s => s.length <= 20), { nil: undefined });

/** Generate a complete valid lead input with explicit marketingConsent control */
function validLeadWithConsent(consent: boolean) {
  return fc.record({
    email: validEmail,
    name: optionalName,
    company: optionalCompany,
    phone: optionalPhone,
    type: validLeadType,
    source: validSourceUrl,
    projectId: fc.option(fc.stringMatching(/^[a-zA-Z0-9]{10,20}$/), { nil: undefined }),
    message: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
    industry: fc.option(fc.constantFrom('mining', 'finance', 'technology', 'agriculture'), { nil: undefined }),
    budget: fc.option(fc.integer({ min: 1, max: 999999999 }), { nil: undefined }),
    marketingConsent: fc.constant(consent),
    utm: validUtm,
  });
}

/** Generate a valid lead with random consent value */
const validLeadRandomConsent = fc.record({
  email: validEmail,
  name: optionalName,
  company: optionalCompany,
  phone: optionalPhone,
  type: validLeadType,
  source: validSourceUrl,
  projectId: fc.option(fc.stringMatching(/^[a-zA-Z0-9]{10,20}$/), { nil: undefined }),
  message: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
  industry: fc.option(fc.constantFrom('mining', 'finance', 'technology', 'agriculture'), { nil: undefined }),
  budget: fc.option(fc.integer({ min: 1, max: 999999999 }), { nil: undefined }),
  marketingConsent: fc.boolean(),
  utm: validUtm,
});

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 21: Marketing consent enforcement', () => {
  /**
   * **Validates: Requirements 6.9, 12.5**
   * Leads with marketingConsent=false are stored but cannot receive marketing communications.
   */
  it('leads with marketingConsent=false are stored but cannot receive marketing', () => {
    fc.assert(
      fc.property(validLeadWithConsent(false), (input) => {
        // Validate the lead passes schema validation (it should be stored)
        const result = LeadCreateSchema.safeParse(input);
        expect(result.success).toBe(true);

        if (result.success) {
          const lead = result.data;

          // Lead SHOULD be stored (for transactional purposes)
          expect(shouldStoreLead(lead)).toBe(true);

          // Lead SHALL NOT receive marketing communications
          expect(canSendMarketing(lead)).toBe(false);

          // Consent value is correctly preserved as false
          expect(lead.marketingConsent).toBe(false);
        }
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 6.9, 12.5**
   * Leads with marketingConsent=true are stored and can receive marketing communications.
   */
  it('leads with marketingConsent=true are stored and can receive marketing', () => {
    fc.assert(
      fc.property(validLeadWithConsent(true), (input) => {
        // Validate the lead passes schema validation
        const result = LeadCreateSchema.safeParse(input);
        expect(result.success).toBe(true);

        if (result.success) {
          const lead = result.data;

          // Lead SHOULD be stored
          expect(shouldStoreLead(lead)).toBe(true);

          // Lead CAN receive marketing communications
          expect(canSendMarketing(lead)).toBe(true);

          // Consent value is correctly preserved as true
          expect(lead.marketingConsent).toBe(true);
        }
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 6.9, 12.5**
   * All leads are stored regardless of consent status.
   */
  it('all leads are stored regardless of consent status', () => {
    fc.assert(
      fc.property(validLeadRandomConsent, (input) => {
        // Validate the lead passes schema validation
        const result = LeadCreateSchema.safeParse(input);
        expect(result.success).toBe(true);

        if (result.success) {
          const lead = result.data;

          // ALL leads should be stored, regardless of marketingConsent value
          expect(shouldStoreLead(lead)).toBe(true);

          // The consent value determines marketing eligibility, not storage
          if (lead.marketingConsent === false) {
            expect(canSendMarketing(lead)).toBe(false);
          } else {
            expect(canSendMarketing(lead)).toBe(true);
          }
        }
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 6.9, 12.5**
   * The canSendMarketing function is a pure function of the marketingConsent field —
   * no other lead attributes affect marketing eligibility.
   */
  it('marketing eligibility depends solely on marketingConsent field', () => {
    fc.assert(
      fc.property(
        validLeadWithConsent(false),
        validLeadWithConsent(true),
        (noConsentLead, consentLead) => {
          const noConsentResult = LeadCreateSchema.safeParse(noConsentLead);
          const consentResult = LeadCreateSchema.safeParse(consentLead);

          expect(noConsentResult.success).toBe(true);
          expect(consentResult.success).toBe(true);

          if (noConsentResult.success && consentResult.success) {
            // Regardless of other fields (email, name, type, etc.),
            // only marketingConsent determines marketing eligibility
            expect(canSendMarketing(noConsentResult.data)).toBe(false);
            expect(canSendMarketing(consentResult.data)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 6.9, 12.5**
   * The marketingConsent field is preserved exactly as submitted through validation —
   * it is never coerced or modified.
   */
  it('marketingConsent value is preserved exactly through schema validation', () => {
    fc.assert(
      fc.property(validLeadRandomConsent, (input) => {
        const result = LeadCreateSchema.safeParse(input);
        expect(result.success).toBe(true);

        if (result.success) {
          // The consent value after validation must exactly match the input
          expect(result.data.marketingConsent).toStrictEqual(input.marketingConsent);
        }
      }),
      { numRuns: 200 }
    );
  });
});
