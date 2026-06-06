/**
 * Confirm Purchase Cloud Function (Stub)
 *
 * Confirms a pending purchase and triggers certificate generation.
 * Full implementation in task 3.2.
 *
 * Requires 'admin' role.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { ApiResponse } from '../../../shared/types';

export const credits_confirmPurchase = onCall(async (request): Promise<ApiResponse<{ transactionId: string; status: string }>> => {
  // TODO: Full implementation in task 3.2
  throw new HttpsError('unimplemented', 'Purchase confirmation not yet implemented.');
});
