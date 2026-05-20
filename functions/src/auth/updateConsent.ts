/**
 * Marketing Consent Update Cloud Function
 *
 * Allows authenticated users to withdraw or grant marketing consent
 * via their account settings. Updates the user's consent status
 * within 24 hours (immediately in practice).
 *
 * Validates: Requirements 12.4, 12.6
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from '../utils/logger';

export const auth_updateConsent = onCall(async (request) => {
  // ─── Authentication Check ────────────────────────────────────────────────────

  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required', {
      code: 'UNAUTHENTICATED',
      message: 'You must be logged in to update consent preferences.',
    });
  }

  const userId = request.auth.uid;
  const { marketingConsent } = request.data || {};

  // ─── Input Validation ────────────────────────────────────────────────────────

  if (typeof marketingConsent !== 'boolean') {
    throw new HttpsError('invalid-argument', 'Invalid consent value', {
      code: 'VALIDATION_ERROR',
      message: 'marketingConsent must be a boolean value.',
      fields: { marketingConsent: 'Must be true or false' },
    });
  }

  // ─── Update User Document ────────────────────────────────────────────────────

  const db = getFirestore();
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    throw new HttpsError('not-found', 'User account not found', {
      code: 'NOT_FOUND',
      message: 'No user account found for the authenticated user.',
    });
  }

  const now = new Date().toISOString();

  try {
    await userRef.update({
      marketingConsent,
      marketingConsentUpdatedAt: now,
      updatedAt: now,
    });
  } catch (error: unknown) {
    logger.error('Failed to update marketing consent', { userId, error });
    throw new HttpsError('internal', 'Failed to update consent preferences', {
      code: 'INTERNAL',
      message: 'Consent update could not be completed. Please try again.',
    });
  }

  logger.info('Marketing consent updated', { userId, marketingConsent });

  // ─── Return Success ──────────────────────────────────────────────────────────

  return {
    success: true,
    data: {
      marketingConsent,
      updatedAt: now,
      message: marketingConsent
        ? 'Marketing consent granted. You may receive marketing communications.'
        : 'Marketing consent withdrawn. You will no longer receive marketing communications.',
    },
  };
});
