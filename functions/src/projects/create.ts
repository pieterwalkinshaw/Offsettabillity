/**
 * Project Creation Cloud Function
 *
 * Creates a new project for an authenticated Project Owner.
 * - Requires 'owner' role
 * - Validates input with ProjectCreateSchema
 * - Sets verificationStatus="draft", verificationBadge="None", fundingRaised=0
 * - Stores project in /projects/{projectId} with auto-generated ID
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { ProjectCreateSchema } from '../../../shared/schemas';
import type { ApiResponse, Project } from '../../../shared/types';

const PROJECTS_COLLECTION = 'projects';
const USERS_COLLECTION = 'users';

/**
 * Verify that the caller is authenticated and has the 'owner' role.
 * Returns the authenticated user's UID.
 */
async function verifyOwner(auth: { uid: string; token: Record<string, unknown> } | undefined): Promise<string> {
  if (!auth || !auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  const db = getFirestore();
  const userDoc = await db.collection(USERS_COLLECTION).doc(auth.uid).get();

  if (!userDoc.exists) {
    throw new HttpsError('permission-denied', 'User record not found.');
  }

  const userData = userDoc.data();
  if (!userData || userData.role !== 'owner') {
    throw new HttpsError('permission-denied', 'Owner role required.');
  }

  return auth.uid;
}

/**
 * Create a new project.
 *
 * Requires 'owner' role.
 * Validates input with ProjectCreateSchema.
 * Sets initial state: verificationStatus="draft", verificationBadge="None", fundingRaised=0.
 */
export const projects_create = onCall(async (request): Promise<ApiResponse<{ projectId: string }>> => {
  const uid = await verifyOwner(request.auth);

  // Validate input with Zod schema
  const parseResult = ProjectCreateSchema.safeParse(request.data);
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

  // Auto-generate project ID
  const projectRef = db.collection(PROJECTS_COLLECTION).doc();
  const projectId = projectRef.id;

  const now = FieldValue.serverTimestamp();

  // Build the project document
  const projectData: Record<string, unknown> = {
    projectId,
    title: input.title,
    description: input.description,
    category: input.category,
    ownerId: uid,
    location: input.location,
    fundingGoal: input.fundingGoal,
    fundingRaised: 0,
    impactMetrics: input.impactMetrics,
    verificationScore: 0,
    verificationStatus: 'draft',
    verificationBadge: 'None',
    documents: [],
    createdAt: now,
    updatedAt: now,
  };

  // Optional fields
  if (input.subCategory !== undefined) {
    projectData.subCategory = input.subCategory;
  }

  // Write to Firestore
  await projectRef.set(projectData);

  return {
    success: true,
    data: { projectId },
  };
});
