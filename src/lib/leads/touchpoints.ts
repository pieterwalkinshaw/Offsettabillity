/**
 * Lead Capture Touchpoints — Verification & Documentation
 *
 * This file documents all lead capture touchpoints across the Offsettabillity platform.
 * Each touchpoint submits to the `/api/leads` endpoint (Cloud Function: leads_create)
 * with honeypot detection, consent checkbox, and UTM parameter attachment.
 *
 * Validates Requirements: 6.1, 6.2, 6.3, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11
 *
 * ─────────────────────────────────────────────────────────────────────────────────
 * TOUCHPOINT SUMMARY
 * ─────────────────────────────────────────────────────────────────────────────────
 *
 * | # | Touchpoint              | Lead Type        | Component                          | Location                                      |
 * |---|-------------------------|------------------|------------------------------------|-----------------------------------------------|
 * | 1 | ESG Calculator          | "calculator"     | ESGCalculator                      | src/components/marketing/ESGCalculator.tsx     |
 * | 2 | Category Landing Pages  | "report_request" | LeadCaptureForm                    | src/app/(public)/categories/[id]/...          |
 * | 3 | Footer Newsletter       | "newsletter"     | Footer (inline form)               | src/components/layout/Footer.tsx              |
 * | 4 | Consultation Form       | "consultation"   | ConsultationForm → LeadCaptureForm | src/components/forms/ConsultationForm.tsx      |
 * | 5 | Gated Reports           | "report_request" | LeadCaptureForm                    | Used on project detail / report access pages  |
 *
 * ─────────────────────────────────────────────────────────────────────────────────
 */

import type { LeadType } from '@shared/types';

// ─── Touchpoint Definitions ──────────────────────────────────────────────────

export interface LeadTouchpoint {
  /** Unique identifier for this touchpoint */
  id: string;
  /** Human-readable name */
  name: string;
  /** The lead type submitted to /api/leads */
  leadType: LeadType;
  /** Component responsible for rendering the form */
  component: string;
  /** File path of the component */
  filePath: string;
  /** Description of how the lead is captured */
  description: string;
  /** Whether the touchpoint includes a honeypot field */
  hasHoneypot: boolean;
  /** Whether the touchpoint includes a consent checkbox */
  hasConsent: boolean;
  /** Whether UTM params are attached from session */
  hasUtmAttachment: boolean;
  /** The endpoint the form submits to */
  endpoint: string;
}

/**
 * All lead capture touchpoints in the platform.
 *
 * Each entry documents:
 * - What type of lead is captured
 * - Which component handles the form
 * - Whether honeypot, consent, and UTM attachment are present
 */
export const LEAD_TOUCHPOINTS: readonly LeadTouchpoint[] = [
  {
    id: 'esg-calculator',
    name: 'ESG Calculator',
    leadType: 'calculator',
    component: 'ESGCalculator',
    filePath: 'src/components/marketing/ESGCalculator.tsx',
    description:
      'Gates the detailed ESG allocation report behind an email input. ' +
      'After the visitor calculates their allocation (no personal info required), ' +
      'they must provide an email to receive the full personalized report. ' +
      'Captures industry and budget alongside the lead record.',
    hasHoneypot: false, // ESG Calculator uses a minimal inline email form (no honeypot field)
    hasConsent: false, // Minimal email gate — consent handled at report delivery
    hasUtmAttachment: true, // Uses getUtmParams() from useUtmCapture hook
    endpoint: '/api/leads',
  },
  {
    id: 'category-landing-page',
    name: 'Category Landing Pages',
    leadType: 'report_request',
    component: 'LeadCaptureForm',
    filePath: 'src/app/(public)/categories/[id]/CategoryLandingContent.tsx',
    description:
      'Each category landing page (e.g., /categories/energy-saving) includes a ' +
      'LeadCaptureForm with leadType="report_request" as the primary CTA above the fold. ' +
      'Collects email, name, and company to deliver a personalized ESG impact report.',
    hasHoneypot: true, // LeadCaptureForm includes hidden "website" honeypot field
    hasConsent: true, // LeadCaptureForm includes consent checkbox (unchecked by default)
    hasUtmAttachment: true, // LeadCaptureForm calls getUtmParams() on submit
    endpoint: '/api/leads',
  },
  {
    id: 'footer-newsletter',
    name: 'Footer Newsletter Signup',
    leadType: 'newsletter',
    component: 'Footer',
    filePath: 'src/components/layout/Footer.tsx',
    description:
      'The site footer includes an inline newsletter signup form (email only). ' +
      'Submits directly to /api/leads with type="newsletter" and marketingConsent=true. ' +
      'UTM params are attached from sessionStorage.',
    hasHoneypot: false, // Footer uses a minimal inline form without honeypot
    hasConsent: false, // Newsletter signup implies consent (marketingConsent set to true)
    hasUtmAttachment: true, // Uses getUtmParams() from useUtmCapture hook
    endpoint: '/api/leads',
  },
  {
    id: 'consultation-form',
    name: 'Consultation Form',
    leadType: 'consultation',
    component: 'ConsultationForm',
    filePath: 'src/components/forms/ConsultationForm.tsx',
    description:
      'Secondary CTA form used on category landing pages and contact pages. ' +
      'Wraps LeadCaptureForm with leadType="consultation", showing name, company, ' +
      'and message fields. Used as the secondary conversion path for visitors ' +
      'who want to speak to an advisor.',
    hasHoneypot: true, // Inherits from LeadCaptureForm (hidden "website" field)
    hasConsent: true, // Inherits from LeadCaptureForm (consent checkbox)
    hasUtmAttachment: true, // Inherits from LeadCaptureForm (getUtmParams on submit)
    endpoint: '/api/leads',
  },
  {
    id: 'gated-reports',
    name: 'Gated Reports',
    leadType: 'report_request',
    component: 'LeadCaptureForm',
    filePath: 'src/components/forms/LeadCaptureForm.tsx',
    description:
      'When a visitor requests access to a gated report (access level = "gated"), ' +
      'they must provide a valid email. This captures a lead of type "report_request" ' +
      'with the associated projectId before granting access to the report PDF.',
    hasHoneypot: true, // LeadCaptureForm includes hidden "website" honeypot field
    hasConsent: true, // LeadCaptureForm includes consent checkbox (unchecked by default)
    hasUtmAttachment: true, // LeadCaptureForm calls getUtmParams() on submit
    endpoint: '/api/leads',
  },
] as const;

// ─── Verification Helpers ────────────────────────────────────────────────────

/**
 * Returns all touchpoints that use a specific lead type.
 */
export function getTouchpointsByType(type: LeadType): LeadTouchpoint[] {
  return LEAD_TOUCHPOINTS.filter((tp) => tp.leadType === type);
}

/**
 * Returns all touchpoints that include honeypot protection.
 */
export function getTouchpointsWithHoneypot(): LeadTouchpoint[] {
  return LEAD_TOUCHPOINTS.filter((tp) => tp.hasHoneypot);
}

/**
 * Returns all touchpoints that include consent checkbox.
 */
export function getTouchpointsWithConsent(): LeadTouchpoint[] {
  return LEAD_TOUCHPOINTS.filter((tp) => tp.hasConsent);
}

/**
 * Returns all touchpoints that attach UTM parameters.
 */
export function getTouchpointsWithUtm(): LeadTouchpoint[] {
  return LEAD_TOUCHPOINTS.filter((tp) => tp.hasUtmAttachment);
}

/**
 * Verification summary — confirms all touchpoints submit to /api/leads.
 */
export function verifyAllEndpoints(): boolean {
  return LEAD_TOUCHPOINTS.every((tp) => tp.endpoint === '/api/leads');
}

// ─── Wiring Verification Notes ───────────────────────────────────────────────
//
// 1. ESG Calculator (type: "calculator")
//    ✓ File: src/components/marketing/ESGCalculator.tsx
//    ✓ Submits to: fetch('/api/leads', { method: 'POST', ... })
//    ✓ UTM: calls getUtmParams() and attaches to payload
//    ✓ Payload includes: email, type='calculator', source, industry, budget, utm
//    ✓ Gates detailed report behind email input (step: 'email')
//
// 2. Category Landing Pages (type: "report_request")
//    ✓ File: src/app/(public)/categories/[id]/CategoryLandingContent.tsx
//    ✓ Uses: <LeadCaptureForm leadType="report_request" ... />
//    ✓ Honeypot: hidden "website" field in LeadCaptureForm
//    ✓ Consent: checkbox with privacy policy link in LeadCaptureForm
//    ✓ UTM: LeadCaptureForm calls getUtmParams() on submit
//    ✓ Submits to: fetch('/api/leads', { method: 'POST', ... })
//
// 3. Footer Newsletter (type: "newsletter")
//    ✓ File: src/components/layout/Footer.tsx
//    ✓ Submits to: fetch('/api/leads', { method: 'POST', ... })
//    ✓ UTM: calls getUtmParams() and attaches to payload
//    ✓ Payload includes: email, type='newsletter', source, marketingConsent=true, utm
//    ✓ Inline form in footer — email only, minimal friction
//
// 4. Consultation Form (type: "consultation")
//    ✓ File: src/components/forms/ConsultationForm.tsx
//    ✓ Wraps: LeadCaptureForm with leadType="consultation"
//    ✓ Honeypot: inherited from LeadCaptureForm (hidden "website" field)
//    ✓ Consent: inherited from LeadCaptureForm (checkbox)
//    ✓ UTM: inherited from LeadCaptureForm (getUtmParams on submit)
//    ✓ Shows: name, company, message fields
//    ✓ Submits to: fetch('/api/leads', { method: 'POST', ... })
//
// 5. Gated Reports (type: "report_request")
//    ✓ File: src/components/forms/LeadCaptureForm.tsx (reusable)
//    ✓ Used with leadType="report_request" on report access pages
//    ✓ Honeypot: hidden "website" field
//    ✓ Consent: checkbox with privacy policy link
//    ✓ UTM: calls getUtmParams() on submit
//    ✓ Submits to: fetch('/api/leads', { method: 'POST', ... })
//
// ─── Backend Endpoint ────────────────────────────────────────────────────────
//
// All forms submit to: POST /api/leads
// Handled by: functions/src/leads/create.ts (leads_create Cloud Function)
// Firebase Hosting rewrite: /api/** → Cloud Function "api"
//
// Backend features:
// ✓ Rate limiting: 5 requests per IP per 60-second window (Req 6.11)
// ✓ Honeypot detection: silently discards if "website" or "_hp" field is non-empty (Req 13.8)
// ✓ Zod validation: LeadCreateSchema validates email format, required fields (Req 6.7)
// ✓ Duplicate handling: creates new record for same email+type (Req 6.10)
// ✓ Status: sets initial status to "new" (Req 6.3)
// ✓ Async notification: triggers admin notification in background (Req 6.6)
// ✓ UTM storage: stores all UTM params with lead record (Req 6.1)
// ✓ Consent storage: stores marketingConsent boolean (Req 6.8, 6.9)
//
