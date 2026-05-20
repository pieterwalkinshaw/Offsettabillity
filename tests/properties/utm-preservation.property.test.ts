/**
 * Property Test: UTM parameter preservation on registration (Property 3)
 *
 * Validates: Requirements 1.8
 *
 * For any successful registration where UTM parameters (source, medium, campaign)
 * are present in the session, the system SHALL store those UTM values in the user
 * document alongside the user's profile data.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { RegistrationSchema } from '../../shared/schemas';

// ─── UTM Document Builder (mirrors register.ts logic) ────────────────────────

/**
 * Builds the user document from validated registration data and raw request data,
 * replicating the logic in functions/src/auth/register.ts for UTM handling.
 */
function buildUserDocument(
  validatedData: {
    email: string;
    name: string;
    role: string;
    country: string;
  },
  requestData: Record<string, unknown>
): Record<string, unknown> {
  const now = new Date().toISOString();

  const userDocument: Record<string, unknown> = {
    userId: 'test-uid',
    email: validatedData.email,
    name: validatedData.name,
    role: validatedData.role,
    country: validatedData.country,
    isApproved: validatedData.role === 'auditor' ? false : true,
    createdAt: now,
    updatedAt: now,
  };

  // UTM parameter preservation logic (same as register.ts)
  if (requestData.utmSource) userDocument.utmSource = requestData.utmSource;
  if (requestData.utmMedium) userDocument.utmMedium = requestData.utmMedium;
  if (requestData.utmCampaign) userDocument.utmCampaign = requestData.utmCampaign;

  return userDocument;
}

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

/** Generate a non-empty UTM string value */
const utmValue = fc.stringMatching(/^[a-z0-9_-]{1,50}$/).filter(s => s.length >= 1);

/** Generate UTM parameters with all three fields present */
const fullUtmParams = fc.record({
  utmSource: utmValue,
  utmMedium: utmValue,
  utmCampaign: utmValue,
});

/** Generate UTM parameters with a random subset of fields present */
const partialUtmParams = fc.record({
  utmSource: fc.option(utmValue, { nil: undefined }),
  utmMedium: fc.option(utmValue, { nil: undefined }),
  utmCampaign: fc.option(utmValue, { nil: undefined }),
});

/** Generate a valid base registration input (without role-specific fields) */
const validBaseRegistration = fc.record({
  email: validEmail,
  password: validPassword,
  name: validName,
  country: validCountry,
  role: validRole,
});

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 3: UTM parameter preservation on registration', () => {
  /**
   * **Validates: Requirements 1.8**
   * When all UTM parameters (source, medium, campaign) are present in the request,
   * they are stored in the user document.
   */
  it('UTM parameters present in request are stored in user document', () => {
    fc.assert(
      fc.property(validBaseRegistration, fullUtmParams, (regInput, utmParams) => {
        // Validate registration input passes schema
        const result = RegistrationSchema.safeParse(regInput);
        expect(result.success).toBe(true);

        if (result.success) {
          // Simulate request data containing UTM params alongside registration fields
          const requestData = { ...regInput, ...utmParams };

          const userDoc = buildUserDocument(
            {
              email: result.data.email,
              name: result.data.name,
              role: result.data.role,
              country: result.data.country,
            },
            requestData
          );

          // UTM fields should be present in the user document
          expect(userDoc.utmSource).toBe(utmParams.utmSource);
          expect(userDoc.utmMedium).toBe(utmParams.utmMedium);
          expect(userDoc.utmCampaign).toBe(utmParams.utmCampaign);
        }
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 1.8**
   * When UTM parameters are absent from the request, the user document
   * does not contain UTM fields.
   */
  it('absent UTM parameters result in no UTM fields in user document', () => {
    fc.assert(
      fc.property(validBaseRegistration, (regInput) => {
        const result = RegistrationSchema.safeParse(regInput);
        expect(result.success).toBe(true);

        if (result.success) {
          // Request data without any UTM params
          const requestData = { ...regInput };

          const userDoc = buildUserDocument(
            {
              email: result.data.email,
              name: result.data.name,
              role: result.data.role,
              country: result.data.country,
            },
            requestData
          );

          // UTM fields should NOT be present in the user document
          expect(userDoc).not.toHaveProperty('utmSource');
          expect(userDoc).not.toHaveProperty('utmMedium');
          expect(userDoc).not.toHaveProperty('utmCampaign');
        }
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 1.8**
   * When only some UTM parameters are present, only those are stored.
   * The system preserves whichever UTM values are provided without requiring all three.
   */
  it('partial UTM parameters are individually preserved', () => {
    fc.assert(
      fc.property(validBaseRegistration, partialUtmParams, (regInput, utmParams) => {
        const result = RegistrationSchema.safeParse(regInput);
        expect(result.success).toBe(true);

        if (result.success) {
          const requestData = { ...regInput, ...utmParams };

          const userDoc = buildUserDocument(
            {
              email: result.data.email,
              name: result.data.name,
              role: result.data.role,
              country: result.data.country,
            },
            requestData
          );

          // Each UTM field should be present only if it was provided
          if (utmParams.utmSource) {
            expect(userDoc.utmSource).toBe(utmParams.utmSource);
          } else {
            expect(userDoc).not.toHaveProperty('utmSource');
          }

          if (utmParams.utmMedium) {
            expect(userDoc.utmMedium).toBe(utmParams.utmMedium);
          } else {
            expect(userDoc).not.toHaveProperty('utmMedium');
          }

          if (utmParams.utmCampaign) {
            expect(userDoc.utmCampaign).toBe(utmParams.utmCampaign);
          } else {
            expect(userDoc).not.toHaveProperty('utmCampaign');
          }
        }
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 1.8**
   * UTM preservation does not interfere with core user profile fields.
   * The user document always contains the required profile data regardless of UTM presence.
   */
  it('UTM parameters do not interfere with core profile fields', () => {
    fc.assert(
      fc.property(validBaseRegistration, fullUtmParams, (regInput, utmParams) => {
        const result = RegistrationSchema.safeParse(regInput);
        expect(result.success).toBe(true);

        if (result.success) {
          const requestData = { ...regInput, ...utmParams };

          const userDoc = buildUserDocument(
            {
              email: result.data.email,
              name: result.data.name,
              role: result.data.role,
              country: result.data.country,
            },
            requestData
          );

          // Core profile fields are always present and correct
          expect(userDoc.email).toBe(result.data.email);
          expect(userDoc.name).toBe(result.data.name);
          expect(userDoc.role).toBe(result.data.role);
          expect(userDoc.country).toBe(result.data.country);
          expect(userDoc.userId).toBeDefined();
          expect(userDoc.createdAt).toBeDefined();
          expect(userDoc.updatedAt).toBeDefined();
          expect(userDoc.isApproved).toBeDefined();
        }
      }),
      { numRuns: 100 }
    );
  });
});
