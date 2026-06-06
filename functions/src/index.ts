/**
 * Offsettabillity Cloud Functions — Entry Point
 *
 * Firebase Functions v2 (Gen 2, Cloud Run backed)
 * Runtime: Node.js 20 + TypeScript
 *
 * All callable functions validate Firebase ID tokens before processing.
 * All input validation uses shared Zod schemas from ../shared/schemas.ts
 */

import { initializeApp } from 'firebase-admin/app';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

// Shared schemas and types — single source of truth for FE + BE validation
import type { LeadCreateRequest, ProjectCreateRequest, ApiResponse } from '../../shared/types';
export type { LeadCreateRequest, ProjectCreateRequest, ApiResponse };

// Initialize Firebase Admin SDK
initializeApp();

// ─── Authentication (Public, No Auth Required) ───────────────────────────────

export { auth_register } from './auth/register';

// ─── Account Management (Authenticated) ─────────────────────────────────────

export { auth_deleteAccount } from './auth/deleteAccount';
export { auth_updateConsent } from './auth/updateConsent';

// ─── Lead Capture (Public HTTP Endpoint) ─────────────────────────────────────

export { leads_create } from './leads/create';

// ─── Project Management (Authenticated) ──────────────────────────────────────

export { projects_create } from './projects/create';
export { projects_update } from './projects/update';
export { projects_submit } from './projects/submit';
export { projects_uploadDocument, projects_confirmDocumentUpload } from './projects/uploadDocument';

// ─── Audit Workflow (Authenticated) ──────────────────────────────────────────

export { audits_submit } from './audits/submit';

// ─── Funding (Authenticated) ─────────────────────────────────────────────────

export { funding_create } from './funding/create';
export { funding_confirmPayment } from './funding/confirmPayment';
export { funding_failPayment } from './funding/failPayment';

// ─── Carbon Credits (Authenticated) ──────────────────────────────────────────

export { credits_purchase } from './credits/purchase';
export { credits_confirmPurchase } from './credits/confirmPurchase';
export { credits_generateCertificate } from './credits/generateCertificate';
export { credits_packageCreate, credits_packageUpdate, credits_packageDeactivate } from './credits/packages';
export { credits_exportCSV } from './credits/exportCSV';
export { credits_exportPDF } from './credits/exportPDF';

// ─── Admin Operations (Authenticated, Admin Only) ────────────────────────────

/**
 * Approve an auditor account — requires 'admin' role.
 */
export const admin_approveAuditor = onCall(async (request) => {
  // Placeholder — implementation in task 2.1
  throw new HttpsError('unimplemented', 'Auditor approval not yet implemented');
});

/**
 * Assign an auditor to a project — requires 'admin' role.
 * Enforces conflict of interest rules.
 */
export { admin_assignAudit } from './admin/assignAudit';

/**
 * Pre-screen a submitted project — requires 'admin' role.
 */
export { admin_prescreenProject } from './admin/prescreenProject';

/**
 * Update lead status/notes — requires 'admin' role.
 * Validates status transitions to: new, contacted, qualified, converted, lost.
 * Records change timestamp on every update.
 */
export { leads_update } from './leads/update';

// ─── Taxonomy Management (Admin Only) ────────────────────────────────────────

export { taxonomy_create, taxonomy_update } from './admin/taxonomy';

// ─── Reports (Authenticated) ─────────────────────────────────────────────────

export { reports_generate } from './reports/generate';
