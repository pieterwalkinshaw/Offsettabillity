/**
 * Registration Cloud Function
 *
 * Creates a Firebase Auth account and corresponding Firestore user document.
 * Handles role-specific fields for Funder, Owner, and Auditor roles.
 * Implements orphaned auth account cleanup on Firestore write failure.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.6, 1.7, 1.9
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { RegistrationSchema } from '../../../shared/schemas';
import { logger } from '../utils/logger';

export const auth_register = onCall(async (request) => {
  const { data } = request;

  // ─── Input Validation ────────────────────────────────────────────────────────

  const parseResult = RegistrationSchema.safeParse(data);

  if (!parseResult.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parseResult.error.issues) {
      const fieldPath = issue.path.join('.');
      if (fieldPath && !fieldErrors[fieldPath]) {
        fieldErrors[fieldPath] = issue.message;
      }
    }

    throw new HttpsError('invalid-argument', 'Validation failed', {
      code: 'VALIDATION_ERROR',
      message: 'Registration validation failed',
      fields: fieldErrors,
    });
  }

  const validatedData = parseResult.data;

  // ─── Role-Specific Field Validation ──────────────────────────────────────────

  const roleFieldErrors: Record<string, string> = {};

  if (validatedData.role === 'funder') {
    if (!validatedData.organizationName) {
      roleFieldErrors.organizationName = 'Organization name is required for funders';
    }
    if (!validatedData.organizationType) {
      roleFieldErrors.organizationType = 'Organization type is required for funders';
    }
    if (!validatedData.industry) {
      roleFieldErrors.industry = 'Industry is required for funders';
    }
    if (!validatedData.areasOfInterest || validatedData.areasOfInterest.length === 0) {
      roleFieldErrors.areasOfInterest = 'At least one area of interest is required for funders';
    }
  } else if (validatedData.role === 'owner') {
    if (!validatedData.organizationName) {
      roleFieldErrors.organizationName = 'Organization name is required for project owners';
    }
    if (!validatedData.organizationRegNumber) {
      roleFieldErrors.organizationRegNumber = 'Organization registration number is required for project owners';
    }
    if (!validatedData.organizationType) {
      roleFieldErrors.organizationType = 'Organization type is required for project owners';
    }
  } else if (validatedData.role === 'auditor') {
    if (!validatedData.qualifications) {
      roleFieldErrors.qualifications = 'Professional qualifications are required for auditors';
    }
    if (validatedData.yearsOfExperience === undefined || validatedData.yearsOfExperience === null) {
      roleFieldErrors.yearsOfExperience = 'Years of experience is required for auditors';
    }
    if (!validatedData.specializations || validatedData.specializations.length === 0) {
      roleFieldErrors.specializations = 'At least one specialization is required for auditors';
    }
  }

  if (Object.keys(roleFieldErrors).length > 0) {
    throw new HttpsError('invalid-argument', 'Role-specific validation failed', {
      code: 'VALIDATION_ERROR',
      message: 'Missing required fields for the selected role',
      fields: roleFieldErrors,
    });
  }

  // ─── Create Firebase Auth Account ────────────────────────────────────────────

  const auth = getAuth();
  const db = getFirestore();

  let userId: string;

  try {
    const userRecord = await auth.createUser({
      email: validatedData.email,
      password: validatedData.password,
      displayName: validatedData.name,
    });
    userId = userRecord.uid;
  } catch (error: unknown) {
    const firebaseError = error as { code?: string; message?: string };

    if (firebaseError.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'Email is already registered', {
        code: 'ALREADY_EXISTS',
        message: 'An account with this email address already exists',
        fields: { email: 'This email is already registered' },
      });
    }

    if (firebaseError.code === 'auth/invalid-email') {
      throw new HttpsError('invalid-argument', 'Invalid email address', {
        code: 'VALIDATION_ERROR',
        message: 'The email address is not valid',
        fields: { email: 'Invalid email address format' },
      });
    }

    if (firebaseError.code === 'auth/invalid-password') {
      throw new HttpsError('invalid-argument', 'Invalid password', {
        code: 'VALIDATION_ERROR',
        message: 'The password does not meet requirements',
        fields: { password: 'Password does not meet requirements' },
      });
    }

    throw new HttpsError('internal', 'Failed to create account');
  }

  // ─── Build User Document ─────────────────────────────────────────────────────

  const now = new Date().toISOString();

  const userDocument: Record<string, unknown> = {
    userId,
    email: validatedData.email,
    name: validatedData.name,
    role: validatedData.role,
    country: validatedData.country,
    isApproved: validatedData.role === 'auditor' ? false : true,
    createdAt: now,
    updatedAt: now,
  };

  // Add UTM parameters if provided in the request data
  if (data.utmSource) userDocument.utmSource = data.utmSource;
  if (data.utmMedium) userDocument.utmMedium = data.utmMedium;
  if (data.utmCampaign) userDocument.utmCampaign = data.utmCampaign;

  // Add role-specific fields
  if (validatedData.role === 'funder') {
    userDocument.organizationName = validatedData.organizationName;
    userDocument.organizationType = validatedData.organizationType;
    userDocument.industry = validatedData.industry;
    userDocument.areasOfInterest = validatedData.areasOfInterest;
    userDocument.esgProfile = {
      industry: validatedData.industry,
      interests: validatedData.areasOfInterest,
    };
  } else if (validatedData.role === 'owner') {
    userDocument.organizationName = validatedData.organizationName;
    userDocument.organizationRegNumber = validatedData.organizationRegNumber;
    userDocument.organizationType = validatedData.organizationType;
  } else if (validatedData.role === 'auditor') {
    userDocument.qualifications = validatedData.qualifications;
    userDocument.yearsOfExperience = validatedData.yearsOfExperience;
    userDocument.specializations = validatedData.specializations;
  }

  // ─── Write Firestore Document (with orphaned auth cleanup) ───────────────────

  try {
    await db.collection('users').doc(userId).set(userDocument);
  } catch (firestoreError: unknown) {
    // Orphaned auth account cleanup: delete the Auth account if Firestore write fails
    try {
      await auth.deleteUser(userId);
    } catch (deleteError: unknown) {
      // Log but don't throw — the primary error is the Firestore failure
      logger.error('Failed to clean up orphaned auth account', { userId });
    }

    throw new HttpsError(
      'internal',
      'Registration could not be completed. Please try again.',
      {
        code: 'INTERNAL',
        message: 'Registration could not be completed. Please try again.',
      }
    );
  }

  // ─── Return Success ──────────────────────────────────────────────────────────

  return {
    success: true,
    data: { userId },
  };
});
