/**
 * Credit Package Management Cloud Functions
 *
 * Admin-only callable functions for managing carbon credit packages.
 * - credits_packageCreate: Create a new credit package
 * - credits_packageUpdate: Update an existing credit package
 * - credits_packageDeactivate: Set a package's isActive to false
 *
 * All functions require 'admin' role and validate input with CreditPackageSchema.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { CreditPackageSchema } from '../../../shared/schemas';
import type { ApiResponse, CreditPackage } from '../../../shared/types';

const PACKAGES_COLLECTION = 'creditPackages';

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
 * Create a new credit package.
 *
 * Requires 'admin' role.
 * Validates input with CreditPackageSchema.
 * Auto-generates packageId and sets timestamps.
 */
export const credits_packageCreate = onCall(async (request): Promise<ApiResponse<CreditPackage>> => {
  await verifyAdmin(request.auth);

  // Validate input with Zod schema
  const parseResult = CreditPackageSchema.safeParse(request.data);
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
  const packageRef = db.collection(PACKAGES_COLLECTION).doc();
  const packageId = packageRef.id;

  // Calculate discount percentage (relative to a standard unit price is not known at creation,
  // so we store 0 — the frontend/admin can set it based on inventory unit price)
  const now = new Date().toISOString();

  const packageData: Omit<CreditPackage, 'discountPercentage'> & { discountPercentage: number } = {
    packageId,
    name: input.name,
    tier: input.tier,
    tonnage: input.tonnage,
    priceCents: input.priceCents,
    discountPercentage: 0, // Calculated on read based on current unit price
    isActive: input.isActive,
    sortOrder: input.sortOrder,
    createdAt: now,
    updatedAt: now,
  };

  await packageRef.set(packageData);

  return {
    success: true,
    data: packageData,
  };
});

/**
 * Update an existing credit package.
 *
 * Requires 'admin' role.
 * Validates input with CreditPackageSchema.
 * Requires 'packageId' to identify the package to update.
 */
export const credits_packageUpdate = onCall(async (request): Promise<ApiResponse<CreditPackage>> => {
  await verifyAdmin(request.auth);

  const data = request.data;

  // The 'packageId' field is required to identify which package to update
  if (!data || typeof data.packageId !== 'string' || !data.packageId.trim()) {
    throw new HttpsError('invalid-argument', 'Package ID is required.', {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Package ID is required.',
        fields: { packageId: 'packageId is required to identify the package to update.' },
      },
    } as unknown as Record<string, unknown>);
  }

  // Validate the package fields with CreditPackageSchema
  const parseResult = CreditPackageSchema.safeParse(data);
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
  const packageId = data.packageId as string;
  const db = getFirestore();
  const packageRef = db.collection(PACKAGES_COLLECTION).doc(packageId);

  // Verify the package exists
  const existingDoc = await packageRef.get();
  if (!existingDoc.exists) {
    throw new HttpsError('not-found', `Package with ID '${packageId}' not found.`, {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Credit package with ID '${packageId}' does not exist.`,
      },
    } as unknown as Record<string, unknown>);
  }

  const now = new Date().toISOString();

  const updateData: Record<string, unknown> = {
    name: input.name,
    tier: input.tier,
    tonnage: input.tonnage,
    priceCents: input.priceCents,
    isActive: input.isActive,
    sortOrder: input.sortOrder,
    updatedAt: now,
  };

  await packageRef.update(updateData);

  // Read back the updated document for the response
  const updatedDoc = await packageRef.get();
  const updatedData = updatedDoc.data()!;

  const creditPackage: CreditPackage = {
    packageId: updatedData.packageId,
    name: updatedData.name,
    tier: updatedData.tier,
    tonnage: updatedData.tonnage,
    priceCents: updatedData.priceCents,
    discountPercentage: updatedData.discountPercentage ?? 0,
    isActive: updatedData.isActive,
    sortOrder: updatedData.sortOrder,
    createdAt: updatedData.createdAt,
    updatedAt: updatedData.updatedAt,
  };

  return {
    success: true,
    data: creditPackage,
  };
});

/**
 * Deactivate a credit package (set isActive to false).
 *
 * Requires 'admin' role.
 * Requires 'packageId' to identify the package to deactivate.
 */
export const credits_packageDeactivate = onCall(async (request): Promise<ApiResponse<CreditPackage>> => {
  await verifyAdmin(request.auth);

  const data = request.data;

  // The 'packageId' field is required
  if (!data || typeof data.packageId !== 'string' || !data.packageId.trim()) {
    throw new HttpsError('invalid-argument', 'Package ID is required.', {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Package ID is required.',
        fields: { packageId: 'packageId is required to identify the package to deactivate.' },
      },
    } as unknown as Record<string, unknown>);
  }

  const packageId = data.packageId as string;
  const db = getFirestore();
  const packageRef = db.collection(PACKAGES_COLLECTION).doc(packageId);

  // Verify the package exists
  const existingDoc = await packageRef.get();
  if (!existingDoc.exists) {
    throw new HttpsError('not-found', `Package with ID '${packageId}' not found.`, {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Credit package with ID '${packageId}' does not exist.`,
      },
    } as unknown as Record<string, unknown>);
  }

  const now = new Date().toISOString();

  await packageRef.update({
    isActive: false,
    updatedAt: now,
  });

  // Read back the updated document for the response
  const updatedDoc = await packageRef.get();
  const updatedData = updatedDoc.data()!;

  const creditPackage: CreditPackage = {
    packageId: updatedData.packageId,
    name: updatedData.name,
    tier: updatedData.tier,
    tonnage: updatedData.tonnage,
    priceCents: updatedData.priceCents,
    discountPercentage: updatedData.discountPercentage ?? 0,
    isActive: updatedData.isActive,
    sortOrder: updatedData.sortOrder,
    createdAt: updatedData.createdAt,
    updatedAt: updatedData.updatedAt,
  };

  return {
    success: true,
    data: creditPackage,
  };
});
