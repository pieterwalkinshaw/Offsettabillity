/**
 * Taxonomy Management Cloud Functions
 *
 * Admin-only callable functions for managing project taxonomy categories.
 * - taxonomy_create: Create a new taxonomy category
 * - taxonomy_update: Update an existing taxonomy category (including deactivation)
 *
 * Both functions require 'admin' role and validate input with TaxonomyCategorySchema.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { TaxonomyCategorySchema } from '../../../shared/schemas';
import type { ApiResponse, TaxonomyCategory } from '../../../shared/types';

const TAXONOMY_COLLECTION = 'taxonomy';

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
 * Create a new taxonomy category.
 *
 * Requires 'admin' role.
 * Validates input with TaxonomyCategorySchema.
 * Enforces unique ID constraint across active and inactive categories.
 */
export const taxonomy_create = onCall(async (request): Promise<ApiResponse<TaxonomyCategory>> => {
  await verifyAdmin(request.auth);

  // Validate input with Zod schema
  const parseResult = TaxonomyCategorySchema.safeParse(request.data);
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
  const categoryRef = db.collection(TAXONOMY_COLLECTION).doc(input.id);

  // Check ID uniqueness (across active and inactive categories)
  const existingDoc = await categoryRef.get();
  if (existingDoc.exists) {
    throw new HttpsError('already-exists', `Category with ID '${input.id}' already exists.`, {
      success: false,
      error: {
        code: 'ALREADY_EXISTS',
        message: `A taxonomy category with ID '${input.id}' already exists.`,
      },
    } as unknown as Record<string, unknown>);
  }

  // Build the category document
  const now = FieldValue.serverTimestamp();
  const categoryData: Record<string, unknown> = {
    id: input.id,
    name: input.name,
    primaryMetricLabel: input.primaryMetricLabel,
    isActive: input.isActive ?? true,
    sortOrder: input.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  };

  // Optional fields
  if (input.description !== undefined) {
    categoryData.description = input.description;
  }
  if (input.icon !== undefined) {
    categoryData.icon = input.icon;
  }
  if (input.sdgNumbers !== undefined) {
    categoryData.sdgNumbers = input.sdgNumbers;
  }

  // Write to Firestore
  await categoryRef.set(categoryData);

  // Read back the created document for the response
  const createdDoc = await categoryRef.get();
  const createdData = createdDoc.data()!;

  const category: TaxonomyCategory = {
    id: createdData.id,
    name: createdData.name,
    description: createdData.description,
    primaryMetricLabel: createdData.primaryMetricLabel,
    icon: createdData.icon,
    sdgNumbers: createdData.sdgNumbers,
    isActive: createdData.isActive,
    sortOrder: createdData.sortOrder,
  };

  return {
    success: true,
    data: category,
  };
});

/**
 * Update an existing taxonomy category.
 *
 * Requires 'admin' role.
 * Can update: name, description, icon, sdgNumbers, sortOrder, isActive, primaryMetricLabel.
 * Deactivation is done by setting isActive=false (prevents new project selection).
 */
export const taxonomy_update = onCall(async (request): Promise<ApiResponse<TaxonomyCategory>> => {
  await verifyAdmin(request.auth);

  const data = request.data;

  // The 'id' field is required to identify which category to update
  if (!data || typeof data.id !== 'string' || !data.id.trim()) {
    throw new HttpsError('invalid-argument', 'Category ID is required.', {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Category ID is required.',
        fields: { id: 'ID is required to identify the category to update.' },
      },
    } as unknown as Record<string, unknown>);
  }

  // Validate the full input with TaxonomyCategorySchema
  const parseResult = TaxonomyCategorySchema.safeParse(data);
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
  const categoryRef = db.collection(TAXONOMY_COLLECTION).doc(input.id);

  // Verify the category exists
  const existingDoc = await categoryRef.get();
  if (!existingDoc.exists) {
    throw new HttpsError('not-found', `Category with ID '${input.id}' not found.`, {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Taxonomy category with ID '${input.id}' does not exist.`,
      },
    } as unknown as Record<string, unknown>);
  }

  // Build the update payload
  const updateData: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  // Update allowed fields
  if (input.name !== undefined) {
    updateData.name = input.name;
  }
  if (input.description !== undefined) {
    updateData.description = input.description;
  }
  if (input.icon !== undefined) {
    updateData.icon = input.icon;
  }
  if (input.sdgNumbers !== undefined) {
    updateData.sdgNumbers = input.sdgNumbers;
  }
  if (input.sortOrder !== undefined) {
    updateData.sortOrder = input.sortOrder;
  }
  if (input.isActive !== undefined) {
    updateData.isActive = input.isActive;
  }
  if (input.primaryMetricLabel !== undefined) {
    updateData.primaryMetricLabel = input.primaryMetricLabel;
  }

  // Perform the update
  await categoryRef.update(updateData);

  // Read back the updated document
  const updatedDoc = await categoryRef.get();
  const updatedData = updatedDoc.data()!;

  const category: TaxonomyCategory = {
    id: updatedData.id,
    name: updatedData.name,
    description: updatedData.description,
    primaryMetricLabel: updatedData.primaryMetricLabel,
    icon: updatedData.icon,
    sdgNumbers: updatedData.sdgNumbers,
    isActive: updatedData.isActive,
    sortOrder: updatedData.sortOrder,
  };

  return {
    success: true,
    data: category,
  };
});
