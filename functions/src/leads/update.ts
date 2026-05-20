/**
 * Lead Management Cloud Function — Update Lead Status/Notes
 *
 * Admin-only callable function for updating lead status and notes.
 * - Restricts status transitions to: new, contacted, qualified, converted, lost
 * - Records change timestamp (updatedAt)
 * - Validates notes max length (2000 chars)
 *
 * Validates: Requirements 6.4
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { ApiResponse, LeadStatus } from '../../../shared/types';

const LEADS_COLLECTION = 'leads';

const VALID_STATUSES: LeadStatus[] = ['new', 'contacted', 'qualified', 'converted', 'lost'];

/**
 * Verify that the caller is authenticated and has the 'admin' role.
 * Throws HttpsError if not authenticated or not an admin.
 */
async function verifyAdmin(auth: { uid: string; token: Record<string, unknown> } | undefined): Promise<string> {
  if (!auth || !auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  const db = getFirestore();
  const userDoc = await db.collection('users').doc(auth.uid).get();

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
 * Update a lead's status and/or notes.
 *
 * Requires 'admin' role.
 * Accepts: leadId (required), status (optional, must be valid), notes (optional, max 2000 chars).
 * Sets updatedAt timestamp on every update.
 */
export const leads_update = onCall(async (request): Promise<ApiResponse<{ leadId: string }>> => {
  await verifyAdmin(request.auth);

  const data = request.data;

  // Validate leadId is provided
  if (!data || typeof data.leadId !== 'string' || !data.leadId.trim()) {
    throw new HttpsError('invalid-argument', 'Lead ID is required.', {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Lead ID is required.',
        fields: { leadId: 'Lead ID is required.' },
      },
    } as unknown as Record<string, unknown>);
  }

  const leadId = data.leadId.trim();
  const fieldErrors: Record<string, string> = {};

  // Validate status if provided
  if (data.status !== undefined) {
    if (typeof data.status !== 'string' || !VALID_STATUSES.includes(data.status as LeadStatus)) {
      fieldErrors.status = `Status must be one of: ${VALID_STATUSES.join(', ')}`;
    }
  }

  // Validate notes if provided
  if (data.notes !== undefined) {
    if (typeof data.notes !== 'string') {
      fieldErrors.notes = 'Notes must be a string.';
    } else if (data.notes.length > 2000) {
      fieldErrors.notes = 'Notes must not exceed 2000 characters.';
    }
  }

  // At least one field to update must be provided
  if (data.status === undefined && data.notes === undefined) {
    throw new HttpsError('invalid-argument', 'At least one field (status or notes) must be provided.', {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'At least one field (status or notes) must be provided.',
        fields: { _form: 'Provide status or notes to update.' },
      },
    } as unknown as Record<string, unknown>);
  }

  // Return validation errors if any
  if (Object.keys(fieldErrors).length > 0) {
    throw new HttpsError('invalid-argument', 'Validation failed.', {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Input validation failed.',
        fields: fieldErrors,
      },
    } as unknown as Record<string, unknown>);
  }

  const db = getFirestore();
  const leadRef = db.collection(LEADS_COLLECTION).doc(leadId);

  // Verify the lead exists
  const leadDoc = await leadRef.get();
  if (!leadDoc.exists) {
    throw new HttpsError('not-found', `Lead with ID '${leadId}' not found.`, {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Lead with ID '${leadId}' does not exist.`,
      },
    } as unknown as Record<string, unknown>);
  }

  // Build the update payload
  const updateData: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (data.status !== undefined) {
    updateData.status = data.status;
  }

  if (data.notes !== undefined) {
    updateData.notes = data.notes;
  }

  // Perform the update
  await leadRef.update(updateData);

  return {
    success: true,
    data: { leadId },
  };
});
