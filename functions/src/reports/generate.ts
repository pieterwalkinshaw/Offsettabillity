/**
 * Report Generation Cloud Function
 *
 * Generates audit-ready impact reports for projects.
 * - Accepts optional authentication (public/gated reports don't require auth)
 * - For private reports: requires 'funder' or 'admin' role
 * - For gated reports: requires email → captures lead of type "report_request"
 * - Fetches project, audits, and funding data from Firestore
 * - Returns report data as JSON (PDF generation would use pdfkit in production)
 * - Stores report metadata in /reports/{reportId}
 * - Never returns partial data on error — throws with specific reason
 * - Handles projects with no completed audits (includes notice)
 *
 * Requirements validated: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod/v4';
import type { ApiResponse, ReportAccessLevel } from '../../../shared/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const PROJECTS_COLLECTION = 'projects';
const AUDITS_COLLECTION = 'audits';
const FUNDING_COLLECTION = 'funding';
const REPORTS_COLLECTION = 'reports';
const LEADS_COLLECTION = 'leads';
const USERS_COLLECTION = 'users';

// ─── Input Validation Schema ─────────────────────────────────────────────────

const ReportGenerateSchema = z.object({
  projectId: z.string().min(1),
  accessLevel: z.enum(['public', 'gated', 'private']).optional(),
  email: z.string().email().optional(),
});

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuditTrailEntry {
  auditId: string;
  auditorId: string;
  findings: string;
  scoreContribution: number;
  recommendation: string;
  methodology: string;
  completedAt: string | null;
}

interface FunderContribution {
  funderId: string;
  totalAmount: number;
  currency: string;
  transactionCount: number;
}

interface ReportData {
  reportId: string;
  projectId: string;
  generatedAt: string;
  project: {
    title: string;
    category: string;
    location: {
      address: string;
      country: string;
      lat: number;
      lng: number;
    };
    fundingGoal: number;
    fundingRaised: number;
    verificationBadge: string;
    verificationScore: number;
    impactMetrics: {
      reportingPeriod: string;
      primaryMetric: {
        label: string;
        value: number;
      };
    };
    espQualification: {
      qualifies: boolean;
      category?: string;
      evidence?: string;
    } | null;
    sdgAlignment: string[];
  };
  auditTrail: AuditTrailEntry[];
  auditNotice: string | null;
  funderContributions: FunderContribution[];
  accessLevel: ReportAccessLevel;
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Verify user role from Firestore user document.
 * Returns the user's role or null if not found.
 */
async function getUserRole(uid: string): Promise<string | null> {
  const db = getFirestore();
  const userDoc = await db.collection(USERS_COLLECTION).doc(uid).get();
  if (!userDoc.exists) return null;
  const data = userDoc.data();
  return data?.role || null;
}

/**
 * Capture a lead for gated report access.
 */
async function captureReportLead(email: string, projectId: string): Promise<string> {
  const db = getFirestore();
  const leadRef = db.collection(LEADS_COLLECTION).doc();
  const leadId = leadRef.id;

  await leadRef.set({
    leadId,
    email,
    type: 'report_request',
    source: `report:${projectId}`,
    projectId,
    marketingConsent: false,
    utm: {},
    status: 'new',
    createdAt: FieldValue.serverTimestamp(),
  });

  return leadId;
}

/**
 * Fetch all completed audits for a project.
 */
async function fetchProjectAudits(projectId: string): Promise<AuditTrailEntry[]> {
  const db = getFirestore();
  const auditsSnapshot = await db
    .collection(AUDITS_COLLECTION)
    .where('projectId', '==', projectId)
    .where('status', '==', 'completed')
    .orderBy('completedAt', 'desc')
    .get();

  return auditsSnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      auditId: data.auditId || doc.id,
      auditorId: data.auditorId,
      findings: data.findings || '',
      scoreContribution: data.scoreContribution || 0,
      recommendation: data.recommendation || '',
      methodology: data.methodology || '',
      completedAt: data.completedAt?.toDate?.()?.toISOString() || data.completedAt || null,
    };
  });
}

/**
 * Fetch funder contribution summary for a project.
 */
async function fetchFunderContributions(projectId: string): Promise<FunderContribution[]> {
  const db = getFirestore();
  const fundingSnapshot = await db
    .collection(FUNDING_COLLECTION)
    .where('projectId', '==', projectId)
    .where('status', '==', 'confirmed')
    .get();

  // Aggregate by funder
  const funderMap = new Map<string, { totalAmount: number; currency: string; transactionCount: number }>();

  for (const doc of fundingSnapshot.docs) {
    const data = doc.data();
    const funderId = data.funderId;
    const existing = funderMap.get(funderId);

    if (existing) {
      existing.totalAmount += data.amount;
      existing.transactionCount += 1;
    } else {
      funderMap.set(funderId, {
        totalAmount: data.amount,
        currency: data.currency || 'ZAR',
        transactionCount: 1,
      });
    }
  }

  return Array.from(funderMap.entries()).map(([funderId, contribution]) => ({
    funderId,
    ...contribution,
  }));
}

// ─── Main Function ───────────────────────────────────────────────────────────

/**
 * Generate an impact report for a project.
 *
 * Access levels:
 * - public: accessible to all users without authentication
 * - gated: requires email submission → lead capture before granting access
 * - private: accessible only to funders of the project and admin roles
 *
 * Note: In production, this would generate a PDF using a library like pdfkit.
 * For now, it returns the report data as JSON.
 */
export const reports_generate = onCall(
  { timeoutSeconds: 30 },
  async (request): Promise<ApiResponse<ReportData>> => {
    // Validate input
    const parseResult = ReportGenerateSchema.safeParse(request.data);
    if (!parseResult.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parseResult.error.issues) {
        const path = issue.path.join('.');
        fieldErrors[path] = issue.message;
      }
      throw new HttpsError('invalid-argument', 'Validation failed.', {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Input validation failed.',
          fields: fieldErrors,
        },
      } as unknown as Record<string, unknown>);
    }

    const { projectId, accessLevel: requestedAccessLevel, email } = parseResult.data;
    const db = getFirestore();

    // Fetch the project
    const projectRef = db.collection(PROJECTS_COLLECTION).doc(projectId);
    const projectDoc = await projectRef.get();

    if (!projectDoc.exists) {
      throw new HttpsError('not-found', 'Project not found.', {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Project with ID '${projectId}' does not exist.`,
        },
      } as unknown as Record<string, unknown>);
    }

    const projectData = projectDoc.data()!;

    // Determine the effective access level
    // Use the requested access level, or fall back to the project's stored report access level, or default to 'private'
    const effectiveAccessLevel: ReportAccessLevel =
      requestedAccessLevel || projectData.reportAccessLevel || 'private';

    // ─── Access Control ────────────────────────────────────────────────────

    if (effectiveAccessLevel === 'private') {
      // Private reports require authentication with funder or admin role
      if (!request.auth || !request.auth.uid) {
        throw new HttpsError('unauthenticated', 'Authentication required for private reports.', {
          success: false,
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required to access private reports.',
          },
        } as unknown as Record<string, unknown>);
      }

      const userRole = await getUserRole(request.auth.uid);

      // Allow admin access to any private report
      if (userRole === 'admin') {
        // Admin has full access — proceed
      } else if (userRole === 'funder') {
        // Funder must have funded this project
        const funderFunding = await db
          .collection(FUNDING_COLLECTION)
          .where('projectId', '==', projectId)
          .where('funderId', '==', request.auth.uid)
          .where('status', '==', 'confirmed')
          .limit(1)
          .get();

        if (funderFunding.empty) {
          throw new HttpsError('permission-denied', 'Access denied. Only funders of this project can access private reports.', {
            success: false,
            error: {
              code: 'PERMISSION_DENIED',
              message: 'Only funders who have funded this project and admins can access private reports.',
            },
          } as unknown as Record<string, unknown>);
        }
      } else {
        throw new HttpsError('permission-denied', 'Access denied. Funder or admin role required.', {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'Only funders and admins can access private reports.',
          },
        } as unknown as Record<string, unknown>);
      }
    } else if (effectiveAccessLevel === 'gated') {
      // Gated reports require email submission for lead capture
      if (!email) {
        throw new HttpsError('invalid-argument', 'Email required for gated report access.', {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'A valid email address is required to access this report.',
            fields: { email: 'Email is required for gated report access.' },
          },
        } as unknown as Record<string, unknown>);
      }

      // Capture lead before granting access
      await captureReportLead(email, projectId);
    }
    // Public reports: no access control needed — proceed

    // ─── Fetch Report Data ─────────────────────────────────────────────────

    let auditTrail: AuditTrailEntry[];
    let funderContributions: FunderContribution[];

    try {
      [auditTrail, funderContributions] = await Promise.all([
        fetchProjectAudits(projectId),
        fetchFunderContributions(projectId),
      ]);
    } catch (err) {
      throw new HttpsError('internal', 'Failed to fetch report data.', {
        success: false,
        error: {
          code: 'INTERNAL',
          message: 'An error occurred while fetching report data. Please try again.',
        },
      } as unknown as Record<string, unknown>);
    }

    // ─── Build Report ──────────────────────────────────────────────────────

    const reportRef = db.collection(REPORTS_COLLECTION).doc();
    const reportId = reportRef.id;
    const generatedAt = new Date().toISOString();

    // Determine audit notice for projects with no completed audits
    const auditNotice =
      auditTrail.length === 0
        ? 'Verification is pending. No audit trail is available for this project at this time.'
        : null;

    const reportData: ReportData = {
      reportId,
      projectId,
      generatedAt,
      project: {
        title: projectData.title || '',
        category: projectData.category || '',
        location: {
          address: projectData.location?.address || '',
          country: projectData.location?.country || '',
          lat: projectData.location?.lat || 0,
          lng: projectData.location?.lng || 0,
        },
        fundingGoal: projectData.fundingGoal || 0,
        fundingRaised: projectData.fundingRaised || 0,
        verificationBadge: projectData.verificationBadge || 'None',
        verificationScore: projectData.verificationScore || 0,
        impactMetrics: {
          reportingPeriod: projectData.impactMetrics?.reportingPeriod || '',
          primaryMetric: {
            label: projectData.impactMetrics?.primaryMetric?.label || '',
            value: projectData.impactMetrics?.primaryMetric?.value || 0,
          },
        },
        espQualification: projectData.espQualification || null,
        sdgAlignment: projectData.sdgAlignment || [],
      },
      auditTrail,
      auditNotice,
      funderContributions,
      accessLevel: effectiveAccessLevel,
    };

    // ─── Store Report Metadata ─────────────────────────────────────────────

    try {
      await reportRef.set({
        reportId,
        projectId,
        title: `Impact Report - ${projectData.title || 'Unknown Project'}`,
        fileUrl: '', // In production, this would be the Cloud Storage path to the generated PDF
        accessLevel: effectiveAccessLevel,
        generatedAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      throw new HttpsError('internal', 'Failed to store report metadata.', {
        success: false,
        error: {
          code: 'INTERNAL',
          message: 'Report generation failed. Unable to store report metadata.',
        },
      } as unknown as Record<string, unknown>);
    }

    // ─── Return Report Data ────────────────────────────────────────────────
    // Note: In production, this would generate a PDF using a library like pdfkit
    // and return a download URL from Cloud Storage. For now, we return the
    // structured report data as JSON.

    return {
      success: true,
      data: reportData,
    };
  }
);
