/**
 * Credits Purchase Cloud Function
 *
 * Processes a carbon credit purchase request for an authenticated Funder.
 * - Requires 'funder' role
 * - Validates input with CreditPurchaseSchema
 * - Atomic Firestore transaction: reads inventory, verifies availability,
 *   decrements tonnage, creates purchaseTransaction with status "pending"
 * - Returns { transactionId, status: 'pending' } wrapped in ApiResponse
 *
 * Requirements validated: 1.3, 1.4, 2.4, 4.1, 4.2, 4.3, 4.4, 4.5, 9.1, 9.2, 9.3
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { CreditPurchaseSchema } from '../../../shared/schemas';
import type { ApiResponse } from '../../../shared/types';

const USERS_COLLECTION = 'users';
const CREDIT_INVENTORY_COLLECTION = 'creditInventory';
const PURCHASE_TRANSACTIONS_COLLECTION = 'purchaseTransactions';

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
 * Purchase carbon credits.
 *
 * Requires 'funder' role.
 * Validates input with CreditPurchaseSchema.
 * Atomically reads inventory, verifies availability, decrements tonnage,
 * and creates a purchaseTransaction document with status "pending".
 */
export const credits_purchase = onCall(async (request): Promise<ApiResponse<{ transactionId: string; status: string }>> => {
  // 1. Auth & role verification
  const uid = await verifyFunder(request.auth);

  // 2. Validate input with Zod schema
  const parseResult = CreditPurchaseSchema.safeParse(request.data);
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

  // 3. Generate transaction ID before entering the transaction
  const transactionId = db.collection(PURCHASE_TRANSACTIONS_COLLECTION).doc().id;

  // 4. Atomic Firestore transaction
  await db.runTransaction(async (txn) => {
    const inventoryRefs: Array<{
      ref: FirebaseFirestore.DocumentReference;
      data: FirebaseFirestore.DocumentData;
      allocatedTonnage: number;
    }> = [];

    // Read and verify inventory for each project allocation
    for (const allocation of input.projectAllocations) {
      const inventoryQuery = await txn.get(
        db.collection(CREDIT_INVENTORY_COLLECTION).where('projectId', '==', allocation.projectId)
      );

      if (inventoryQuery.empty) {
        throw new HttpsError('failed-precondition', `No inventory for project ${allocation.projectId}`);
      }

      const inventoryDoc = inventoryQuery.docs[0];
      const inventoryData = inventoryDoc.data();

      // Verify sufficient tonnage is available
      if (inventoryData.availableTonnage < allocation.tonnage) {
        throw new HttpsError('failed-precondition', 'INSUFFICIENT_INVENTORY');
      }

      inventoryRefs.push({
        ref: inventoryDoc.ref,
        data: inventoryData,
        allocatedTonnage: allocation.tonnage,
      });
    }

    // Decrement inventory for each allocation
    for (const { ref, allocatedTonnage } of inventoryRefs) {
      txn.update(ref, {
        availableTonnage: FieldValue.increment(-allocatedTonnage),
        updatedAt: new Date().toISOString(),
      });
    }

    // Calculate price from the first inventory's unit price
    const unitPriceCents = inventoryRefs[0].data.unitPriceCents;
    const totalAmountCents = Math.round(input.quantity * unitPriceCents);

    // Create the purchase transaction record
    txn.set(db.collection(PURCHASE_TRANSACTIONS_COLLECTION).doc(transactionId), {
      transactionId,
      funderId: uid,
      quantity: input.quantity,
      unitPriceCents,
      totalAmountCents,
      currency: 'ZAR',
      status: 'pending',
      packageId: input.packageId || null,
      projectAllocations: input.projectAllocations.map((a) => ({
        projectId: a.projectId,
        projectTitle: inventoryRefs.find((r) => r.data.projectId === a.projectId)?.data.projectTitle || '',
        tonnage: a.tonnage,
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  return { success: true, data: { transactionId, status: 'pending' } };
});
