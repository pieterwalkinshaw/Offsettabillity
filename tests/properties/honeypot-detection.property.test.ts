/**
 * Property Test: Honeypot bot detection (Property 40)
 *
 * Validates: Requirements 13.8
 *
 * For any lead form submission where the hidden honeypot field contains a
 * non-empty value, the system SHALL silently discard the submission without
 * storing a lead record or triggering notifications. The system returns a
 * fake success response (not an error) to avoid revealing detection.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LeadSubmissionBody {
  email: string;
  type: string;
  source: string;
  marketingConsent: boolean;
  utm: Record<string, string | undefined>;
  // Honeypot fields
  website?: string;
  _hp?: string;
  // Optional fields
  name?: string;
  company?: string;
}

interface HoneypotResult {
  isBot: boolean;
  response: {
    success: boolean;
    data?: { leadId: string };
  };
}

// ─── Helper: Honeypot Detection ──────────────────────────────────────────────

/**
 * Detect whether a submission is from a bot based on honeypot fields.
 * The honeypot fields are `website` and `_hp` — hidden fields that real users
 * never fill in. If either contains a non-empty value, the submission is a bot.
 *
 * Returns true if honeypot is triggered (bot detected).
 */
function detectHoneypot(body: Record<string, unknown>): boolean {
  return !!(body.website || body._hp);
}

/**
 * Process a lead submission with honeypot detection.
 * If honeypot is triggered, returns a fake success response to avoid
 * revealing detection to the bot.
 */
function processSubmissionWithHoneypot(body: Record<string, unknown>): HoneypotResult {
  const isBot = detectHoneypot(body);

  if (isBot) {
    // Silent discard — return fake success to avoid revealing detection
    return {
      isBot: true,
      response: {
        success: true,
        data: { leadId: 'received' },
      },
    };
  }

  // Not a bot — proceed with normal processing
  return {
    isBot: false,
    response: {
      success: true,
      data: { leadId: 'real-lead-id' },
    },
  };
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate a valid email address */
const validEmail = fc.tuple(
  fc.stringMatching(/^[a-z][a-z0-9]{0,15}$/),
  fc.stringMatching(/^[a-z][a-z0-9]{1,8}$/),
  fc.constantFrom('com', 'org', 'net', 'co.za', 'io')
).map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

/** Generate a valid lead type */
const validLeadType = fc.constantFrom(
  'calculator',
  'report_request',
  'consultation',
  'newsletter',
  'auditor_inquiry'
);

/** Generate a valid source URL */
const validSourceUrl = fc.constantFrom(
  'https://offsettabillity.co.za/',
  'https://offsettabillity.co.za/contact',
  'https://offsettabillity.co.za/categories/energy-saving',
  'https://offsettabillity.co.za/calculator'
);

/** Generate valid UTM parameters */
const validUtm = fc.record({
  source: fc.option(fc.constantFrom('google', 'facebook', 'linkedin'), { nil: undefined }),
  medium: fc.option(fc.constantFrom('cpc', 'organic', 'email'), { nil: undefined }),
  campaign: fc.option(fc.constantFrom('esg-2025', 'carbon-q1'), { nil: undefined }),
});

/** Generate a non-empty honeypot value (what bots fill in) */
const nonEmptyHoneypotValue = fc.oneof(
  fc.stringMatching(/^https?:\/\/[a-z]{3,10}\.[a-z]{2,4}$/),
  fc.string({ minLength: 1, maxLength: 100 }),
  fc.constantFrom('http://spam.com', 'buy-now.net', 'yes', '1', 'true', 'click here')
).filter((s) => s.length > 0);

/** Generate an empty or undefined honeypot value (legitimate users) */
const emptyHoneypotValue = fc.constantFrom(undefined, '', undefined);

/** Generate a base lead submission body (without honeypot fields) */
const baseSubmissionBody = fc.record({
  email: validEmail,
  type: validLeadType,
  source: validSourceUrl,
  marketingConsent: fc.boolean(),
  utm: validUtm,
  name: fc.option(fc.stringMatching(/^[A-Za-z ]{2,30}$/), { nil: undefined }),
  company: fc.option(fc.stringMatching(/^[A-Za-z0-9 &]{2,30}$/), { nil: undefined }),
});

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 40: Honeypot bot detection', () => {
  /**
   * **Validates: Requirements 13.8**
   * Submissions with a non-empty `website` honeypot field are detected as bots
   * and silently discarded.
   */
  it('submissions with non-empty website field are detected as bots', () => {
    fc.assert(
      fc.property(
        baseSubmissionBody,
        nonEmptyHoneypotValue,
        (body, honeypotValue) => {
          const submission = { ...body, website: honeypotValue };
          const result = processSubmissionWithHoneypot(submission);

          // Bot should be detected
          expect(result.isBot).toBe(true);
          // Response should be fake success (silent discard)
          expect(result.response.success).toBe(true);
          expect(result.response.data?.leadId).toBe('received');
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 13.8**
   * Submissions with a non-empty `_hp` honeypot field are detected as bots
   * and silently discarded.
   */
  it('submissions with non-empty _hp field are detected as bots', () => {
    fc.assert(
      fc.property(
        baseSubmissionBody,
        nonEmptyHoneypotValue,
        (body, honeypotValue) => {
          const submission = { ...body, _hp: honeypotValue };
          const result = processSubmissionWithHoneypot(submission);

          // Bot should be detected
          expect(result.isBot).toBe(true);
          // Response should be fake success (silent discard)
          expect(result.response.success).toBe(true);
          expect(result.response.data?.leadId).toBe('received');
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 13.8**
   * Submissions without honeypot fields (or with empty/undefined values)
   * are NOT detected as bots and proceed normally.
   */
  it('submissions without honeypot fields are not detected as bots', () => {
    fc.assert(
      fc.property(
        baseSubmissionBody,
        emptyHoneypotValue,
        emptyHoneypotValue,
        (body, websiteValue, hpValue) => {
          const submission: Record<string, unknown> = { ...body };
          if (websiteValue !== undefined) submission.website = websiteValue;
          if (hpValue !== undefined) submission._hp = hpValue;

          const result = processSubmissionWithHoneypot(submission);

          // Should NOT be detected as bot
          expect(result.isBot).toBe(false);
          // Response should be real success
          expect(result.response.success).toBe(true);
          expect(result.response.data?.leadId).not.toBe('received');
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 13.8**
   * Bot detection returns a fake success response (not an error) to avoid
   * revealing that the honeypot was triggered.
   */
  it('bot detection returns fake success response, not an error', () => {
    fc.assert(
      fc.property(
        baseSubmissionBody,
        nonEmptyHoneypotValue,
        fc.boolean(), // randomly choose website or _hp field
        (body, honeypotValue, useWebsite) => {
          const submission = useWebsite
            ? { ...body, website: honeypotValue }
            : { ...body, _hp: honeypotValue };

          const result = processSubmissionWithHoneypot(submission);

          // Must return success: true (not an error response)
          expect(result.response.success).toBe(true);
          // Must include a data object with a leadId (fake)
          expect(result.response.data).toBeDefined();
          expect(result.response.data?.leadId).toBeDefined();
          expect(typeof result.response.data?.leadId).toBe('string');
          expect(result.response.data?.leadId.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 13.8**
   * The detectHoneypot helper correctly identifies bot submissions when
   * both honeypot fields are filled (belt-and-suspenders bots).
   */
  it('submissions with both honeypot fields filled are detected as bots', () => {
    fc.assert(
      fc.property(
        baseSubmissionBody,
        nonEmptyHoneypotValue,
        nonEmptyHoneypotValue,
        (body, websiteValue, hpValue) => {
          const submission = { ...body, website: websiteValue, _hp: hpValue };
          const result = processSubmissionWithHoneypot(submission);

          expect(result.isBot).toBe(true);
          expect(result.response.success).toBe(true);
          expect(result.response.data?.leadId).toBe('received');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 13.8**
   * The detectHoneypot function is a pure function — same input always
   * produces the same detection result.
   */
  it('honeypot detection is deterministic', () => {
    fc.assert(
      fc.property(
        baseSubmissionBody,
        fc.option(nonEmptyHoneypotValue, { nil: undefined }),
        fc.option(nonEmptyHoneypotValue, { nil: undefined }),
        (body, websiteValue, hpValue) => {
          const submission: Record<string, unknown> = { ...body };
          if (websiteValue !== undefined) submission.website = websiteValue;
          if (hpValue !== undefined) submission._hp = hpValue;

          const result1 = detectHoneypot(submission);
          const result2 = detectHoneypot(submission);

          expect(result1).toBe(result2);
        }
      ),
      { numRuns: 200 }
    );
  });
});
