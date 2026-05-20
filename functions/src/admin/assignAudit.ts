/**
 * Assign Audit Cloud Function
 *
 * Admin-only callable function to assign an approved auditor to a prescreened project.
 * Creates an Audit record with status "pending" and enforces conflict of interest rules.
 *
 * Conflict of interest rules:
 * - Auditor cannot own the project
 * - Auditor cannot have funded the project
 * - Auditor cannot have audited the project in the previous cycle
 *
 * Requirements validated: 4.2, 4.7
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { ApiResponse, Audit } from '../../../shared/types';

const PROJECTS_COLLECTION = 'projects';
const USERS_COLLECTION = 'users';
const AUDITS_COLLECTION = 'audits';
const FUNDING_COLLECTION = 'funding';

/**
 * Verify that the caller is authenticated and has the 'admin' role.
 */
async function verifyAdmin(auth: { uid: string; token: Record<string, unknown> } | undefined): Promise<string> {
  if (!auth || !auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  const db = getFirestore();
  const userDoc = await db.collection(USERS_COLLECTION).doc(auth.uid).get();

  if (!userDoc.exists) {
    throw new HttpsError('permission-denied', 'User record not found.');
  }

  const userData = userDoc.data();
  if (!userData || userData.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Admin role required.');
  }

  return auth.uid;
}

/**
 * Assign an auditor to a project for verification.
 *
 * Requires 'admin' role.
 * Accepts { projectId: string, auditorId: string }.
 * Verifies project is in "prescreened" status.
 * Verifies auditor exists, has role='auditor', and isApproved=true.
 * Enforces conflict of interest rules.
 * Creates Audit record with status="pending".
 * Transitions project to "pending_audit" status.
 */
export const admin_assignAudit = onCall(async (request): Promise<ApiResponse<{ auditId: string; projectId: string }>> => {
  await verifyAdmin(request.auth);

  const data = request.data;

  // Validate required fields
  if (!data || typeof data.projectId !== 'string' || !data.projectId.trim()) {
    throw new HttpsError('invalid-argument', 'Project ID is required.', {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Project ID is required.',
        fields: { projectId: 'Project ID is required.' },
      },
    } as unknown as Record<string, unknown>);
  }

  if (typeof data.auditorId !== 'string' || !data.auditorId.trim()) {
    throw new HttpsError('invalid-argument', 'Auditor ID is required.', {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Auditor ID is required.',
        fields: { auditorId: 'Auditor ID is required.' },
      },
    } as unknown as Record<string, unknown>);
  }

  const projectId = data.projectId as string;
  const auditorId = data.auditorId as string;
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

  // Verify project is in "prescreened" status
  if (projectData.verificationStatus !== 'prescreened') {
    throw new HttpsError('failed-precondition', 'Only prescreened projects can be assigned an auditor.', {
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: `Project is in '${projectData.verificationStatus}' status. Only prescreened projects can be assigned an auditor.`,
      },
    } as unknown as Record<string, unknown>);
  }

  // Fetch the auditor user
  const auditorRef = db.collection(USERS_COLLECTION).doc(auditorId);
  const auditorDoc = await auditorRef.get();

  if (!auditorDoc.exists) {
    throw new HttpsError('not-found', 'Auditor not found.', {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `User with ID '${auditorId}' does not exist.`,
      },
    } as unknown as Record<string, unknown>);
  }

  const auditorData = auditorDoc.data()!;

  // Verify user has role='auditor'
  if (auditorData.role !== 'auditor') {
    throw new HttpsError('failed-precondition', 'User is not an auditor.', {
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: 'The specified user does not have the auditor role.',
      },
    } as unknown as Record<string, unknown>);
  }

  // Verify auditor is approved
  if (auditorData.isApproved !== true) {
    throw new HttpsError('failed-precondition', 'Auditor is not approved.', {
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: 'The auditor must be approved before being assigned to a project.',
      },
    } as unknown as Record<string, unknown>);
  }

  // ─── Conflict of Interest Checks ────────────────────────────────────────────

  // 1. Auditor cannot own the project
  if (projectData.ownerId === auditorId) {
    throw new HttpsError('failed-precondition', 'Conflict of interest: auditor owns this project.', {
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: 'Conflict of interest: the auditor cannot verify a project they own.',
      },
    } as unknown as Record<string, unknown>);
  }

  // 2. Auditor cannot have funded the project
  const fundingSnapshot = await db
    .collection(FUNDING_COLLECTION)
    .where('projectId', '==', projectId)
    .where('funderId', '==', auditorId)
    .where('status', '==', 'confirmed')
    .limit(1)
    .get();

  if (!fundingSnapshot.empty) {
    throw new HttpsError('failed-precondition', 'Conflict of interest: auditor has funded this project.', {
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: 'Conflict of interest: the auditor cannot verify a project they have funded.',
      },
    } as unknown as Record<string, unknown>);
  }

  // 3. Auditor cannot have audited this project in the previous cycle
  // "Previous cycle" = the most recent completed audit for this project by this auditor
  const previousAuditSnapshot = await db
    .collection(AUDITS_COLLECTION)
    .where('projectId', '==', projectId)
    .where('auditorId', '==', auditorId)
    .where('status', '==', 'completed')
    .orderBy('completedAt', 'desc')
    .limit(1)
    .get();

  if (!previousAuditSnapshot.empty) {
    throw new HttpsError('failed-precondition', 'Conflict of interest: auditor audited this project in the previous cycle.', {
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: 'Conflict of interest: the auditor cannot verify the same project in consecutive audit cycles.',
      },
    } as unknown as Record<string, unknown>);
  }

  // ─── Create Audit Record ────────────────────────────────────────────────────

  const auditRef = db.collection(AUDITS_COLLECTION).doc();
  const auditId = auditRef.id;

  const auditData: Record<string, unknown> = {
    auditId,
    projectId,
    auditorId,
    status: 'pending',
    createdAt: FieldValue.serverTimestamp(),
  };

  // Use a batch to atomically create the audit and update the project status
  const batch = db.batch();

  batch.set(auditRef, auditData);
  batch.update(projectRef, {
    verificationStatus: 'pending_audit',
    updatedAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();

  // Note: In production, we would also send a notification to the auditor here.
  // For now, the audit assignment is recorded and the auditor can see it in their dashboard.

  return {
    success: true,
    data: { auditId, projectId },
  };
});
