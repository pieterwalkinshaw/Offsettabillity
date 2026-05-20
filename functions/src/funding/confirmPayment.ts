/**
 * Funding Confirm Payment Cloud Function
 *
 * Admin-only callable function to confirm a pending funding transaction.
 * Called by the payment gateway webhook handler.
 * - Updates transaction status to "confirmed"
 * - Increments project fundingRaised by the confirmed amount (FieldValue.increment)
 * - Checks if fundingRaised >= fundingGoal → transitions project to "funded"
 * - Checks concentration: if single funder exceeds 50% of fundingGoal, triggers admin alert
 *
 * Requirements validated: 5.4, 5.6, 5.8, 5.9
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { ApiResponse } from '../../../shared/types';

const PROJECTS_COLLECTION = 'projects';
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
 * Confirm a pending funding transaction.
 *
 * Requires 'admin' role.
 * Accepts { transactionId: string }.
 * Verifies transaction exists and is in "pending" status.
 * Updates transaction to "confirmed", increments project fundingRaised.
 * Checks funding goal threshold and concentration limits.
 */
export const funding_confirmPayment = onCall(async (request): Promise<ApiResponse<{ transactionId: string; projectId: string }>> => {
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
        message: `Transaction is in '${transactionData.status}' status. Only pending transactions can be confirmed.`,
      },
    } as unknown as Record<string, unknown>);
  }

  const projectId = transactionData.projectId as string;
  const funderId = transactionData.funderId as string;
  const amount = transactionData.amount as number;

  // Fetch the project to check funding goal
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
  const fundingGoal = projectData.fundingGoal as number;
  const currentFundingRaised = (projectData.fundingRaised as number) || 0;

  // Use a batch to atomically update transaction and project
  const batch = db.batch();

  // Update transaction status to "confirmed"
  batch.update(transactionRef, {
    status: 'confirmed',
  });

  // Increment project fundingRaised by the confirmed amount
  const updateData: Record<string, unknown> = {
    fundingRaised: FieldValue.increment(amount),
    updatedAt: FieldValue.serverTimestamp(),
  };

  // Check if funding goal is reached (including this payment)
  const newFundingRaised = currentFundingRaised + amount;
  if (newFundingRaised >= fundingGoal) {
    updateData.verificationStatus = 'funded';
  }

  batch.update(projectRef, updateData);

  await batch.commit();

  // ─── Concentration Check ────────────────────────────────────────────────────
  // Query all confirmed funding from this funder for this project
  // (including the one we just confirmed)
  const funderFundingSnapshot = await db
    .collection(FUNDING_COLLECTION)
    .where('projectId', '==', projectId)
    .where('funderId', '==', funderId)
    .where('status', '==', 'confirmed')
    .get();

  let funderTotal = 0;
  for (const doc of funderFundingSnapshot.docs) {
    funderTotal += (doc.data().amount as number) || 0;
  }

  // If single funder exceeds 50% of fundingGoal, trigger admin notification
  if (funderTotal > fundingGoal * 0.5) {
    // Log admin alert (in production, this would send an email/notification)
    console.warn(
      `[CONCENTRATION ALERT] Funder '${funderId}' has contributed ${funderTotal} cents ` +
      `(${((funderTotal / fundingGoal) * 100).toFixed(1)}% of goal) to project '${projectId}'. ` +
      `Manual review required.`
    );
  }

  return {
    success: true,
    data: { transactionId, projectId },
  };
});
