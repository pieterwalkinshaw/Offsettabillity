/**
 * Audit Submission Cloud Function
 *
 * Callable function for auditors to submit their audit findings.
 * - Verifies caller is the assigned auditor for this audit
 * - Validates input with AuditSubmitSchema
 * - Transitions audit status to "completed"
 * - Recalculates project verification score and badge
 * - If first audit with "approve" recommendation, transitions project to "verified"
 *
 * Requirements validated: 4.3, 4.4, 4.5, 4.6
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { AuditSubmitSchema } from '../../../shared/schemas';
import type { ApiResponse, Audit, Project } from '../../../shared/types';
import { calculateVerificationScore } from '../verification/score';
import { determineBadge } from '../verification/badge';

const AUDITS_COLLECTION = 'audits';
const PROJECTS_COLLECTION = 'projects';
const USERS_COLLECTION = 'users';

/**
 * Verify that the caller is authenticated.
 * Returns the authenticated user's UID.
 */
function verifyAuthenticated(auth: { uid: string; token: Record<string, unknown> } | undefined): string {
  if (!auth || !auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
  return auth.uid;
}

/**
 * Submit audit findings.
 *
 * Requires authentication. Caller must be the assigned auditor for this audit.
 * Validates input with AuditSubmitSchema.
 * Transitions audit to "completed", recalculates project verification score and badge.
 * If first audit with "approve" recommendation, transitions project to "verified".
 */
export const audits_submit = onCall(async (request): Promise<ApiResponse<{ auditId: string; projectId: string; verificationScore: number; verificationBadge: string }>> => {
  const uid = verifyAuthenticated(request.auth);

  // Validate input with Zod schema
  const parseResult = AuditSubmitSchema.safeParse(request.data);
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

  const input = parseResult.data;
  const db = getFirestore();

  // Fetch the audit record
  const auditRef = db.collection(AUDITS_COLLECTION).doc(input.auditId);
  const auditDoc = await auditRef.get();

  if (!auditDoc.exists) {
    throw new HttpsError('not-found', 'Audit not found.', {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Audit with ID '${input.auditId}' does not exist.`,
      },
    } as unknown as Record<string, unknown>);
  }

  const auditData = auditDoc.data()!;

  // Verify caller is the assigned auditor
  if (auditData.auditorId !== uid) {
    throw new HttpsError('permission-denied', 'Only the assigned auditor can submit findings for this audit.', {
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: 'Only the assigned auditor can submit findings for this audit.',
      },
    } as unknown as Record<string, unknown>);
  }

  // Verify audit is in a submittable state (pending or in_progress)
  if (auditData.status !== 'pending' && auditData.status !== 'in_progress') {
    throw new HttpsError('failed-precondition', 'Audit is not in a submittable state.', {
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: `Audit is in '${auditData.status}' status. Only pending or in-progress audits can be submitted.`,
      },
    } as unknown as Record<string, unknown>);
  }

  const projectId = auditData.projectId as string;

  // Fetch the project
  const projectRef = db.collection(PROJECTS_COLLECTION).doc(projectId);
  const projectDoc = await projectRef.get();

  if (!projectDoc.exists) {
    throw new HttpsError('not-found', 'Associated project not found.', {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Project with ID '${projectId}' does not exist.`,
      },
    } as unknown as Record<string, unknown>);
  }

  const projectData = projectDoc.data()!;

  // Fetch all audits for this project (to recalculate score)
  const allAuditsSnapshot = await db
    .collection(AUDITS_COLLECTION)
    .where('projectId', '==', projectId)
    .get();

  // Build the list of audits including the current submission as completed
  const allAudits: Audit[] = allAuditsSnapshot.docs.map((doc) => {
    const d = doc.data();
    // For the current audit, use the submitted data
    if (doc.id === input.auditId) {
      return {
        auditId: doc.id,
        projectId: d.projectId,
        auditorId: d.auditorId,
        status: 'completed' as const,
        findings: input.findings,
        scoreContribution: input.scoreContribution,
        methodology: input.methodology,
        recommendation: input.recommendation,
        evidenceDocuments: input.evidenceDocuments,
        createdAt: d.createdAt?.toDate?.()?.toISOString?.() ?? d.createdAt ?? '',
        completedAt: new Date().toISOString(),
      };
    }
    // For other audits, use existing data
    return {
      auditId: doc.id,
      projectId: d.projectId,
      auditorId: d.auditorId,
      status: d.status,
      findings: d.findings,
      scoreContribution: d.scoreContribution,
      methodology: d.methodology,
      recommendation: d.recommendation,
      evidenceDocuments: d.evidenceDocuments,
      createdAt: d.createdAt?.toDate?.()?.toISOString?.() ?? d.createdAt ?? '',
      completedAt: d.completedAt?.toDate?.()?.toISOString?.() ?? d.completedAt,
    };
  });

  // Build the project object for score calculation
  const project: Project = {
    projectId,
    title: projectData.title,
    description: projectData.description,
    category: projectData.category,
    subCategory: projectData.subCategory,
    ownerId: projectData.ownerId,
    location: projectData.location,
    fundingGoal: projectData.fundingGoal,
    fundingRaised: projectData.fundingRaised ?? 0,
    impactMetrics: projectData.impactMetrics,
    verificationScore: projectData.verificationScore ?? 0,
    verificationStatus: projectData.verificationStatus,
    verificationBadge: projectData.verificationBadge ?? 'None',
    documents: projectData.documents ?? [],
    createdAt: projectData.createdAt?.toDate?.()?.toISOString?.() ?? projectData.createdAt ?? '',
    updatedAt: projectData.updatedAt?.toDate?.()?.toISOString?.() ?? projectData.updatedAt ?? '',
  };

  // Calculate new verification score
  const newScore = calculateVerificationScore(project, allAudits);

  // Count completed audits (including this one)
  const completedAudits = allAudits.filter((a) => a.status === 'completed');
  const completedAuditCount = completedAudits.length;

  // Determine new badge
  const newBadge = determineBadge(newScore, completedAuditCount);

  // Determine if project should transition to "verified"
  // First audit with "approve" recommendation transitions project to "verified"
  const isFirstApproveAudit =
    input.recommendation === 'approve' &&
    completedAudits.filter((a) => a.recommendation === 'approve').length === 1;

  // Build project update
  const projectUpdate: Record<string, unknown> = {
    verificationScore: newScore,
    verificationBadge: newBadge,
    updatedAt: FieldValue.serverTimestamp(),
  };

  // Transition to "verified" if this is the first approve audit
  if (isFirstApproveAudit && (projectData.verificationStatus === 'pending_audit' || projectData.verificationStatus === 'prescreened')) {
    projectUpdate.verificationStatus = 'verified';
  }

  // Update audit and project atomically
  const batch = db.batch();

  batch.update(auditRef, {
    status: 'completed',
    findings: input.findings,
    scoreContribution: input.scoreContribution,
    methodology: input.methodology,
    recommendation: input.recommendation,
    evidenceDocuments: input.evidenceDocuments ?? [],
    completedAt: FieldValue.serverTimestamp(),
  });

  batch.update(projectRef, projectUpdate);

  await batch.commit();

  return {
    success: true,
    data: {
      auditId: input.auditId,
      projectId,
      verificationScore: newScore,
      verificationBadge: newBadge,
    },
  };
});
