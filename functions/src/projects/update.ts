/**
 * Project Update Cloud Function
 *
 * Updates an existing project for the authenticated Project Owner.
 * - Requires authentication and ownership of the project
 * - If verificationStatus is "draft", all fields are editable
 * - If verificationStatus is anything other than "draft", title, category, and fundingGoal are immutable
 * - Validates updated fields
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { ApiResponse } from '../../../shared/types';

const PROJECTS_COLLECTION = 'projects';
const USERS_COLLECTION = 'users';

/** Fields that are immutable after a project leaves "draft" status. */
const IMMUTABLE_AFTER_DRAFT = ['title', 'category', 'fundingGoal'];

/** Fields that can be updated on a project (excluding system-managed fields). */
const ALLOWED_UPDATE_FIELDS = [
  'title',
  'description',
  'category',
  'subCategory',
  'location',
  'fundingGoal',
  'impactMetrics',
];

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
 * Update an existing project.
 *
 * Requires authentication and project ownership.
 * Enforces edit permissions based on verificationStatus:
 * - "draft": all fields editable
 * - Any other status: title, category, fundingGoal are immutable
 */
export const projects_update = onCall(async (request): Promise<ApiResponse<{ projectId: string }>> => {
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
    throw new HttpsError('permission-denied', 'Only the project owner can update this project.', {
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: 'Only the project owner can update this project.',
      },
    } as unknown as Record<string, unknown>);
  }

  const verificationStatus = projectData.verificationStatus as string;

  // Check for immutable field violations when not in draft
  if (verificationStatus !== 'draft') {
    const attemptedImmutableFields: string[] = [];
    for (const field of IMMUTABLE_AFTER_DRAFT) {
      if (data[field] !== undefined) {
        attemptedImmutableFields.push(field);
      }
    }
    if (attemptedImmutableFields.length > 0) {
      const fieldErrors: Record<string, string> = {};
      for (const field of attemptedImmutableFields) {
        fieldErrors[field] = `Cannot modify '${field}' after project has been submitted.`;
      }
      throw new HttpsError('failed-precondition', 'Some fields cannot be modified after submission.', {
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'Some fields cannot be modified after submission.',
          fields: fieldErrors,
        },
      } as unknown as Record<string, unknown>);
    }
  }

  // Build the update payload from allowed fields
  const updateData: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  let hasUpdates = false;
  for (const field of ALLOWED_UPDATE_FIELDS) {
    if (data[field] !== undefined) {
      updateData[field] = data[field];
      hasUpdates = true;
    }
  }

  if (!hasUpdates) {
    throw new HttpsError('invalid-argument', 'No valid fields provided for update.', {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'No valid fields provided for update.',
      },
    } as unknown as Record<string, unknown>);
  }

  // Perform the update
  await projectRef.update(updateData);

  return {
    success: true,
    data: { projectId },
  };
});
