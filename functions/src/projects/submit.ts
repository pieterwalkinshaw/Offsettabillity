/**
 * Project Submission Cloud Function
 *
 * Submits a project for verification.
 * - Requires authentication and project ownership
 * - Project must be in "draft" status
 * - Project must have at least one supporting document
 * - Transitions verificationStatus from "draft" to "submitted"
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { ApiResponse } from '../../../shared/types';

const PROJECTS_COLLECTION = 'projects';

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
 * Submit a project for verification.
 *
 * Requires authentication and project ownership.
 * Project must be in "draft" status and have at least one document.
 * Transitions status from "draft" to "submitted".
 */
export const projects_submit = onCall(async (request): Promise<ApiResponse<{ projectId: string }>> => {
  const uid = verifyAuthenticated(request.auth);

  const data = request.data;

  // Require projectId in the request
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

  // Fetch the existing project
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

  // Verify caller is the project owner
  if (projectData.ownerId !== uid) {
    throw new HttpsError('permission-denied', 'Only the project owner can submit this project.', {
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: 'Only the project owner can submit this project.',
      },
    } as unknown as Record<string, unknown>);
  }

  // Verify project is in "draft" status
  if (projectData.verificationStatus !== 'draft') {
    throw new HttpsError('failed-precondition', 'Only draft projects can be submitted for verification.', {
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: `Project is in '${projectData.verificationStatus}' status. Only draft projects can be submitted.`,
      },
    } as unknown as Record<string, unknown>);
  }

  // Verify project has at least one supporting document
  const documents = projectData.documents as string[] | undefined;
  if (!documents || documents.length === 0) {
    throw new HttpsError('failed-precondition', 'At least one supporting document is required before submission.', {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'At least one supporting document is required before submission.',
        fields: { documents: 'At least one document must be uploaded before submitting.' },
      },
    } as unknown as Record<string, unknown>);
  }

  // Transition status from "draft" to "submitted"
  await projectRef.update({
    verificationStatus: 'submitted',
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {
    success: true,
    data: { projectId },
  };
});
