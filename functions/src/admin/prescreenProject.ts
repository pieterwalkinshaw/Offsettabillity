/**
 * Pre-screen Project Cloud Function
 *
 * Admin-only callable function to transition a project from "submitted" to "prescreened".
 * This is the first step in the verification workflow after a project owner submits their project.
 *
 * Requirements validated: 4.1
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { ApiResponse } from '../../../shared/types';

const PROJECTS_COLLECTION = 'projects';
const USERS_COLLECTION = 'users';

/**
 * Verify that the caller is authenticated and has the 'admin' role.
 * Throws HttpsError if not authenticated or not an admin.
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
 * Pre-screen a submitted project.
 *
 * Requires 'admin' role.
 * Accepts { projectId: string }.
 * Verifies project exists and is in "submitted" status.
 * Transitions verificationStatus to "prescreened".
 */
export const admin_prescreenProject = onCall(async (request): Promise<ApiResponse<{ projectId: string }>> => {
  await verifyAdmin(request.auth);

  const data = request.data;

  // Require projectId
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

  const projectId = data.projectId as string;
  const db = getFirestore();
  const projectRef = db.collection(PROJECTS_COLLECTION).doc(projectId);

  // Fetch the project
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

  // Verify project is in "submitted" status
  if (projectData.verificationStatus !== 'submitted') {
    throw new HttpsError('failed-precondition', 'Only submitted projects can be pre-screened.', {
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: `Project is in '${projectData.verificationStatus}' status. Only submitted projects can be pre-screened.`,
      },
    } as unknown as Record<string, unknown>);
  }

  // Transition to "prescreened"
  await projectRef.update({
    verificationStatus: 'prescreened',
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {
    success: true,
    data: { projectId },
  };
});
