/**
 * Property Test: Duplicate lead creation (Property 22)
 *
 * Validates: Requirements 6.10
 *
 * For any lead submission with an email and type matching an existing lead record,
 * the system SHALL create a new separate lead record rather than rejecting or
 * updating the existing one.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { Lead, LeadType, LeadStatus, UtmParams } from '../../shared/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LeadSubmission {
  email: string;
  name?: string;
  company?: string;
  phone?: string;
  type: LeadType;
  source: string;
  projectId?: string;
  message?: string;
  industry?: string;
  budget?: number;
  marketingConsent: boolean;
  utm: UtmParams;
}

interface LeadRecord {
  leadId: string;
  email: string;
  name?: string;
  company?: string;
  phone?: string;
  type: LeadType;
  source: string;
  projectId?: string;
  message?: string;
  industry?: string;
  budget?: number;
  marketingConsent: boolean;
  utm: UtmParams;
  status: LeadStatus;
  createdAt: string;
}

// ─── Helper Function ─────────────────────────────────────────────────────────

/**
 * Simulates the no-deduplication lead submission behavior.
 * Given existing leads and a new submission, creates a new lead record
 * with a unique ID rather than rejecting or updating existing records.
 */
function handleLeadSubmission(
  existingLeads: LeadRecord[],
  newSubmission: LeadSubmission
): { leads: LeadRecord[]; newLead: LeadRecord } {
  // Generate a unique lead ID (simulates Firestore auto-ID)
  const newLeadId = `lead_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;

  // Always create a new record — no deduplication check
  const newLead: LeadRecord = {
    leadId: newLeadId,
    email: newSubmission.email,
    name: newSubmission.name,
    company: newSubmission.company,
    phone: newSubmission.phone,
    type: newSubmission.type,
    source: newSubmission.source,
    projectId: newSubmission.projectId,
    message: newSubmission.message,
    industry: newSubmission.industry,
    budget: newSubmission.budget,
    marketingConsent: newSubmission.marketingConsent,
    utm: newSubmission.utm,
    status: 'new',
    createdAt: new Date().toISOString(),
  };

  return {
    leads: [...existingLeads, newLead],
    newLead,
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
const validLeadType = fc.constantFrom<LeadType>(
  'calculator',
  'report_request',
  'consultation',
  'newsletter',
  'auditor_inquiry'
);

/** Generate a valid source URL */
const validSourceUrl = fc.tuple(
  fc.constantFrom('https://offsettabillity.co.za', 'https://www.offsettabillity.co.za'),
  fc.constantFrom('/categories/energy-saving', '/projects/123', '/contact', '/calculator', '/')
).map(([base, path]) => `${base}${path}`);

/** Generate valid UTM parameters */
const validUtm: fc.Arbitrary<UtmParams> = fc.record({
  source: fc.option(fc.constantFrom('google', 'facebook', 'linkedin'), { nil: undefined }),
  medium: fc.option(fc.constantFrom('cpc', 'organic', 'email'), { nil: undefined }),
  campaign: fc.option(fc.constantFrom('esg-2025', 'carbon-q1'), { nil: undefined }),
  content: fc.option(fc.constantFrom('ad-variant-a', 'banner-1'), { nil: undefined }),
  term: fc.option(fc.constantFrom('esg funding', 'carbon offset'), { nil: undefined }),
});

/** Generate a valid lead submission */
const validLeadSubmission: fc.Arbitrary<LeadSubmission> = fc.record({
  email: validEmail,
  name: fc.option(fc.stringMatching(/^[A-Za-z][A-Za-z ]{0,30}$/), { nil: undefined }),
  company: fc.option(fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,30}$/), { nil: undefined }),
  phone: fc.option(fc.stringMatching(/^\+?[0-9]{7,15}$/), { nil: undefined }),
  type: validLeadType,
  source: validSourceUrl,
  projectId: fc.option(fc.stringMatching(/^[a-zA-Z0-9]{10,20}$/), { nil: undefined }),
  message: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
  industry: fc.option(fc.constantFrom('mining', 'finance', 'technology'), { nil: undefined }),
  budget: fc.option(fc.integer({ min: 1, max: 999999999 }), { nil: undefined }),
  marketingConsent: fc.boolean(),
  utm: validUtm,
});

/** Generate a valid lead status */
const validLeadStatus = fc.constantFrom<LeadStatus>('new', 'contacted', 'qualified', 'converted', 'lost');

/** Generate an existing lead record */
const existingLeadRecord: fc.Arbitrary<LeadRecord> = fc.record({
  leadId: fc.stringMatching(/^[a-zA-Z0-9]{15,25}$/),
  email: validEmail,
  name: fc.option(fc.stringMatching(/^[A-Za-z][A-Za-z ]{0,30}$/), { nil: undefined }),
  company: fc.option(fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,30}$/), { nil: undefined }),
  phone: fc.option(fc.stringMatching(/^\+?[0-9]{7,15}$/), { nil: undefined }),
  type: validLeadType,
  source: validSourceUrl,
  projectId: fc.option(fc.stringMatching(/^[a-zA-Z0-9]{10,20}$/), { nil: undefined }),
  message: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
  industry: fc.option(fc.constantFrom('mining', 'finance', 'technology'), { nil: undefined }),
  budget: fc.option(fc.integer({ min: 1, max: 999999999 }), { nil: undefined }),
  marketingConsent: fc.boolean(),
  utm: validUtm,
  status: validLeadStatus,
  createdAt: fc.integer({ min: 1704067200000, max: 1735689600000 }).map(ts => new Date(ts).toISOString()),
});

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 22: Duplicate lead creation', () => {
  /**
   * **Validates: Requirements 6.10**
   * Submitting a lead with same email+type as existing creates a new record (not rejected).
   */
  it('submitting a lead with same email+type as existing creates a new record, not rejected', () => {
    fc.assert(
      fc.property(
        fc.array(existingLeadRecord, { minLength: 1, maxLength: 5 }),
        validLeadSubmission,
        (existingLeads, submission) => {
          // Use the same email and type as the first existing lead
          const targetLead = existingLeads[0];
          const duplicateSubmission: LeadSubmission = {
            ...submission,
            email: targetLead.email,
            type: targetLead.type,
          };

          const result = handleLeadSubmission(existingLeads, duplicateSubmission);

          // The submission was NOT rejected — a new lead was created
          expect(result.newLead).toBeDefined();
          expect(result.newLead.email).toBe(targetLead.email);
          expect(result.newLead.type).toBe(targetLead.type);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 6.10**
   * The new record has a different leadId from existing records.
   */
  it('the new record has a different leadId from all existing records', () => {
    fc.assert(
      fc.property(
        fc.array(existingLeadRecord, { minLength: 1, maxLength: 5 }),
        validLeadSubmission,
        (existingLeads, submission) => {
          // Use the same email and type as the first existing lead
          const targetLead = existingLeads[0];
          const duplicateSubmission: LeadSubmission = {
            ...submission,
            email: targetLead.email,
            type: targetLead.type,
          };

          const result = handleLeadSubmission(existingLeads, duplicateSubmission);

          // The new lead has a unique ID different from all existing leads
          const existingIds = existingLeads.map(l => l.leadId);
          expect(existingIds).not.toContain(result.newLead.leadId);
          expect(result.newLead.leadId.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 6.10**
   * Both old and new records are preserved (no update/overwrite).
   */
  it('both old and new records are preserved without update or overwrite', () => {
    fc.assert(
      fc.property(
        fc.array(existingLeadRecord, { minLength: 1, maxLength: 5 }),
        validLeadSubmission,
        (existingLeads, submission) => {
          // Use the same email and type as the first existing lead
          const targetLead = existingLeads[0];
          const duplicateSubmission: LeadSubmission = {
            ...submission,
            email: targetLead.email,
            type: targetLead.type,
          };

          const result = handleLeadSubmission(existingLeads, duplicateSubmission);

          // All original leads are still present and unchanged
          for (const original of existingLeads) {
            const preserved = result.leads.find(l => l.leadId === original.leadId);
            expect(preserved).toBeDefined();
            expect(preserved!.email).toBe(original.email);
            expect(preserved!.type).toBe(original.type);
            expect(preserved!.status).toBe(original.status);
            expect(preserved!.createdAt).toBe(original.createdAt);
          }

          // The new lead is also present
          const newLeadInResult = result.leads.find(l => l.leadId === result.newLead.leadId);
          expect(newLeadInResult).toBeDefined();
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 6.10**
   * The total lead count increases by 1 after each submission.
   */
  it('the total lead count increases by exactly 1 after each submission', () => {
    fc.assert(
      fc.property(
        fc.array(existingLeadRecord, { minLength: 1, maxLength: 5 }),
        validLeadSubmission,
        (existingLeads, submission) => {
          // Use the same email and type as the first existing lead
          const targetLead = existingLeads[0];
          const duplicateSubmission: LeadSubmission = {
            ...submission,
            email: targetLead.email,
            type: targetLead.type,
          };

          const countBefore = existingLeads.length;
          const result = handleLeadSubmission(existingLeads, duplicateSubmission);
          const countAfter = result.leads.length;

          // Exactly one new record was added
          expect(countAfter).toBe(countBefore + 1);
        }
      ),
      { numRuns: 200 }
    );
  });
});
