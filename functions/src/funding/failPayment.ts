/**
 * Funding Fail Payment Cloud Function
 *
 * Admin-only callable function to mark a pending funding transaction as failed.
 * - Updates transaction status to "failed"
 * - Does NOT modify project fundingRaised
 *
 * Requirements validated: 5.5
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import type { ApiResponse } from '../../../shared/types';

const USERS_COLLECTION = 'users';
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
 * Mark a pending funding transaction as failed.
 *
 * Requires 'admin' role.
 * Accepts { transactionId: string }.
 * Verifies transaction exists and is in "pending" status.
 * Updates transaction status to "failed".
 * Does NOT modify project fundingRaised.
 */
export const funding_failPayment = onCall(async (request): Promise<ApiResponse<{ transactionId: string }>> => {
  await verifyAdmin(request.auth);

  const data = request.data;

  // Validate required field
  if (!data || typeof data.transactionId !== 'string' || !data.transactionId.trim()) {
    throw new HttpsError('invalid-argument', 'Transaction ID is required.', {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Transaction ID is required.',
        fields: { transactionId: 'Transaction ID is required.' },
      },
    } as unknown as Record<string, unknown>);
  }

  const transactionId = data.transactionId as string;
  const db = getFirestore();

  // Fetch the transaction
  const transactionRef = db.collection(FUNDING_COLLECTION).doc(transactionId);
  const transactionDoc = await transactionRef.get();

  if (!transactionDoc.exists) {
    throw new HttpsError('not-found', 'Transaction not found.', {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Transaction with ID '${transactionId}' does not exist.`,
      },
    } as unknown as Record<string, unknown>);
  }

  const transactionData = transactionDoc.data()!;

  // Verify transaction is in "pending" status
  if (transactionData.status !== 'pending') {
    throw new HttpsError('failed-precondition', 'Transaction is not in pending status.', {
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: `Transaction is in '${transactionData.status}' status. Only pending transactions can be marked as failed.`,
      },
    } as unknown as Record<string, unknown>);
  }

  // Update transaction status to "failed" — do NOT touch project fundingRaised
  await transactionRef.update({
    status: 'failed',
  });

  return {
    success: true,
    data: { transactionId },
  };
});
