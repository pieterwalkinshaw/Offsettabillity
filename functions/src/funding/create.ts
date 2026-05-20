/**
 * Funding Create Cloud Function
 *
 * Creates a new funding commitment for an authenticated Funder.
 * - Requires 'funder' role
 * - Validates input with FundingCreateSchema (amount 1000–100000000 cents)
 * - Enforces eligibility: project must have verificationStatus "verified" or "live"
 * - Creates FundingTransaction with status "pending"
 *
 * Requirements validated: 5.1, 5.2, 5.3
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { FundingCreateSchema } from '../../../shared/schemas';
import type { ApiResponse } from '../../../shared/types';

const PROJECTS_COLLECTION = 'projects';
const USERS_COLLECTION = 'users';
const FUNDING_COLLECTION = 'funding';

/** Eligible project statuses for funding */
const ELIGIBLE_STATUSES = ['verified', 'live'];

/**
 * Verify that the caller is authenticated and has the 'funder' role.
 */
async function verifyFunder(auth: { uid: string; token: Record<string, unknown> } | undefined): Promise<string> {
  if (!auth || !auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  const db = getFirestore();
  const userDoc = await db.collection(USERS_COLLECTION).doc(auth.uid).get();

  if (!userDoc.exists) {
    throw new HttpsError('permission-denied', 'User record not found.');
  }

  const userData = userDoc.data();
  if (!userData || userData.role !== 'funder') {
    throw new HttpsError('permission-denied', 'Funder role required.');
  }

  return auth.uid;
}

/**
 * Create a funding commitment.
 *
 * Requires 'funder' role.
 * Validates input with FundingCreateSchema.
 * Verifies project exists and has verificationStatus "verified" or "live".
 * Creates FundingTransaction in /funding/{transactionId} with status="pending".
 */
export const funding_create = onCall(async (request): Promise<ApiResponse<{ transactionId: string; projectId: string }>> => {
  const uid = await verifyFunder(request.auth);

  // Validate input with Zod schema
  const parseResult = FundingCreateSchema.safeParse(request.data);
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

  // Fetch the project and verify eligibility
  const projectRef = db.collection(PROJECTS_COLLECTION).doc(input.projectId);
  const projectDoc = await projectRef.get();

  if (!projectDoc.exists) {
    throw new HttpsError('not-found', 'Project not found.', {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Project with ID '${input.projectId}' does not exist.`,
      },
    } as unknown as Record<string, unknown>);
  }

  const projectData = projectDoc.data()!;

  // Enforce eligibility: project must be "verified" or "live"
  if (!ELIGIBLE_STATUSES.includes(projectData.verificationStatus)) {
    throw new HttpsError('failed-precondition', 'Project is not eligible for funding.', {
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: `Project is in '${projectData.verificationStatus}' status. Only projects with status 'verified' or 'live' are eligible for funding.`,
      },
    } as unknown as Record<string, unknown>);
  }

  // Create FundingTransaction with status "pending"
  const transactionRef = db.collection(FUNDING_COLLECTION).doc();
  const transactionId = transactionRef.id;

  const transactionData: Record<string, unknown> = {
    transactionId,
    projectId: input.projectId,
    funderId: uid,
    amount: input.amount,
    currency: input.currency,
    status: 'pending',
    createdAt: FieldValue.serverTimestamp(),
  };

  await transactionRef.set(transactionData);

  return {
    success: true,
    data: { transactionId, projectId: input.projectId },
  };
});
