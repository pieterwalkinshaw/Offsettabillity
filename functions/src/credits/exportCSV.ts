/**
 * Credits Export CSV Cloud Function
 *
 * Generates a CSV export of purchase history within a date range.
 * - Requires 'funder' or 'admin' role
 * - Validates date range with ExportDateRangeSchema
 * - Funder: sees only own confirmed purchases
 * - Admin: sees all confirmed purchases
 * - Generates CSV with columns: date, project title, tonnage, amount paid (ZAR), certificate ID
 * - Returns inline CSV data with filename
 *
 * Requirements validated: 7.1, 7.2, 7.4
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { ExportDateRangeSchema } from '../../../shared/schemas';
import { formatZAR } from '../../../shared/creditUtils';
import type { ApiResponse } from '../../../shared/types';

const USERS_COLLECTION = 'users';
const PURCHASE_TRANSACTIONS_COLLECTION = 'purchaseTransactions';
const CERTIFICATES_COLLECTION = 'certificates';

/**
 * Verify that the caller is authenticated and has 'funder' or 'admin' role.
 * Returns the user's UID and role.
 */
async function verifyFunderOrAdmin(
  auth: { uid: string; token: Record<string, unknown> } | undefined
): Promise<{ uid: string; role: string }> {
  if (!auth || !auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  const db = getFirestore();
  const userDoc = await db.collection(USERS_COLLECTION).doc(auth.uid).get();

  if (!userDoc.exists) {
    throw new HttpsError('permission-denied', 'User record not found.');
  }

  const userData = userDoc.data();
  if (!userData || (userData.role !== 'funder' && userData.role !== 'admin')) {
    throw new HttpsError('permission-denied', 'Funder or Admin role required.');
  }

  return { uid: auth.uid, role: userData.role };
}

/**
 * Export confirmed purchase history as CSV.
 *
 * Requires 'funder' or 'admin' role.
 * Validates date range with ExportDateRangeSchema.
 * Funder: filters by own funderId.
 * Admin: sees all confirmed transactions.
 * Returns CSV data inline with a generated filename.
 */
export const credits_exportCSV = onCall(async (request): Promise<ApiResponse<{ csv: string; filename: string }>> => {
  // 1. Auth & role verification
  const { uid, role } = await verifyFunderOrAdmin(request.auth);

  // 2. Validate date range input
  const parseResult = ExportDateRangeSchema.safeParse(request.data);
  if (!parseResult.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parseResult.error.issues) {
      const path = issue.path.join('.');
      fieldErrors[path || 'dateRange'] = issue.message;
    }
    throw new HttpsError('invalid-argument', 'Validation failed.', {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Date range validation failed.',
        fields: fieldErrors,
      },
    } as unknown as Record<string, unknown>);
  }

  const { startDate, endDate } = parseResult.data;
  const db = getFirestore();

  // 3. Query confirmed purchases within date range
  let query: FirebaseFirestore.Query = db
    .collection(PURCHASE_TRANSACTIONS_COLLECTION)
    .where('status', '==', 'confirmed')
    .where('createdAt', '>=', startDate)
    .where('createdAt', '<=', endDate);

  // Funder sees only own transactions; Admin sees all
  if (role === 'funder') {
    query = query.where('funderId', '==', uid);
  }

  const snapshot = await query.get();

  // 4. Look up certificate IDs for each transaction
  const transactions = snapshot.docs.map((doc) => doc.data());

  const certificateMap = new Map<string, string>();
  if (transactions.length > 0) {
    const transactionIds = transactions.map((t) => t.transactionId);

    // Firestore 'in' queries support max 30 items at a time
    const chunks: string[][] = [];
    for (let i = 0; i < transactionIds.length; i += 30) {
      chunks.push(transactionIds.slice(i, i + 30));
    }

    for (const chunk of chunks) {
      const certSnapshot = await db
        .collection(CERTIFICATES_COLLECTION)
        .where('transactionId', 'in', chunk)
        .get();

      for (const certDoc of certSnapshot.docs) {
        const certData = certDoc.data();
        certificateMap.set(certData.transactionId, certData.certificateId);
      }
    }
  }

  // 5. Generate CSV
  const csvHeader = 'Date,Project Title,Tonnage (tCO₂e),Amount Paid (ZAR),Certificate ID';
  const csvRows = transactions.map((txn) => {
    const date = txn.createdAt ? txn.createdAt.split('T')[0] : '';
    // Combine project titles from allocations
    const projectTitle = (txn.projectAllocations || [])
      .map((a: { projectTitle: string }) => a.projectTitle)
      .join('; ');
    const tonnage = txn.quantity.toFixed(2);
    const amountPaid = formatZAR(txn.totalAmountCents);
    const certificateId = certificateMap.get(txn.transactionId) || '';

    // Escape fields that may contain commas or quotes
    const escapeCsvField = (field: string): string => {
      if (field.includes(',') || field.includes('"') || field.includes('\n')) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };

    return [
      escapeCsvField(date),
      escapeCsvField(projectTitle),
      escapeCsvField(tonnage),
      escapeCsvField(amountPaid),
      escapeCsvField(certificateId),
    ].join(',');
  });

  const csv = [csvHeader, ...csvRows].join('\n');

  // 6. Generate filename with date range
  const startShort = startDate.split('T')[0];
  const endShort = endDate.split('T')[0];
  const filename = `carbon-credits-export_${startShort}_to_${endShort}.csv`;

  return {
    success: true,
    data: { csv, filename },
  };
});
