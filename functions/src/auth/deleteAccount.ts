/**
 * Account Deletion Cloud Function
 *
 * Handles user account deletion requests by anonymizing PII fields
 * (email, name, phone) in the Firestore user document within 30 days.
 * Retains non-PII data (role, country, organizationName, etc.) for platform integrity.
 *
 * Uses onCall — verifies the caller is the account owner before processing.
 *
 * Validates: Requirements 12.2
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from '../utils/logger';

/**
 * Anonymized placeholder values used to replace PII fields.
 * These are deterministic so the document structure remains valid.
 */
const ANONYMIZED_EMAIL = 'deleted@anonymized.invalid';
const ANONYMIZED_NAME = '[deleted]';
const ANONYMIZED_PHONE = '[deleted]';

export const auth_deleteAccount = onCall(async (request) => {
  // ─── Authentication Check ────────────────────────────────────────────────────

  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required', {
      code: 'UNAUTHENTICATED',
      message: 'You must be logged in to delete your account.',
    });
  }

  const userId = request.auth.uid;

  // ─── Verify Caller is the Account Owner ──────────────────────────────────────

  const db = getFirestore();
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    throw new HttpsError('not-found', 'User account not found', {
      code: 'NOT_FOUND',
      message: 'No user account found for the authenticated user.',
    });
  }

  // ─── Anonymize PII Fields ────────────────────────────────────────────────────

  const now = new Date().toISOString();

  try {
    await userRef.update({
      email: ANONYMIZED_EMAIL,
      name: ANONYMIZED_NAME,
      phone: ANONYMIZED_PHONE,
      deletedAt: now,
      updatedAt: now,
    });
  } catch (error: unknown) {
    throw new HttpsError('internal', 'Failed to process account deletion', {
      code: 'INTERNAL',
      message: 'Account deletion could not be completed. Please try again.',
    });
  }

  // ─── Disable Firebase Auth Account ───────────────────────────────────────────

  const authAdmin = getAuth();

  try {
    await authAdmin.updateUser(userId, {
      disabled: true,
      displayName: ANONYMIZED_NAME,
    });
  } catch (error: unknown) {
    // Auth disable is best-effort — PII is already anonymized in Firestore
    logger.error('Failed to disable auth account for deleted user', { userId });
  }

  // ─── Return Success ──────────────────────────────────────────────────────────

  return {
    success: true,
    data: {
      message: 'Your account has been scheduled for deletion. PII has been anonymized.',
      deletedAt: now,
    },
  };
});
