/**
 * Document Upload Cloud Function
 *
 * Callable function that validates document metadata before upload,
 * generates a signed upload URL, and records the document path in the
 * project's documents array after successful upload.
 *
 * Validates: Requirements 2.6, 2.9
 *
 * Validation rules:
 * - File type: PDF, PNG, JPEG only (application/pdf, image/png, image/jpeg)
 * - File size: ≤ 5 MB (5,242,880 bytes)
 * - Document count: max 10 per project
 * - Caller must be the project owner
 *
 * On failure, existing documents remain unchanged and a specific error reason is returned.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import type { ApiResponse } from '../../../shared/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_DOCUMENTS_PER_PROJECT = 10;

// ─── Helper: Verify caller is the project owner ─────────────────────────────

async function verifyProjectOwner(
  auth: { uid: string; token: Record<string, unknown> } | undefined,
  projectId: string
): Promise<{ uid: string; projectData: FirebaseFirestore.DocumentData }> {
  if (!auth || !auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  const db = getFirestore();
  const projectDoc = await db.collection('projects').doc(projectId).get();

  if (!projectDoc.exists) {
    throw new HttpsError('not-found', 'Project not found.', {
      code: 'NOT_FOUND',
      message: `Project with ID '${projectId}' does not exist.`,
    } as unknown as Record<string, unknown>);
  }

  const projectData = projectDoc.data()!;

  if (projectData.ownerId !== auth.uid) {
    throw new HttpsError('permission-denied', 'Only the project owner can upload documents.', {
      code: 'PERMISSION_DENIED',
      message: 'You do not have permission to upload documents to this project.',
    } as unknown as Record<string, unknown>);
  }

  return { uid: auth.uid, projectData };
}

// ─── Main Function ───────────────────────────────────────────────────────────

/**
 * projects_uploadDocument
 *
 * Accepts file metadata, validates constraints, generates a signed upload URL,
 * and after upload confirmation, records the storage path in the project's documents array.
 *
 * Request data:
 * - projectId: string — the project to upload to
 * - fileName: string — original file name
 * - fileType: string — MIME type (application/pdf, image/png, image/jpeg)
 * - fileSize: number — file size in bytes
 *
 * Response:
 * - success: true with uploadUrl and storagePath
 * - or throws HttpsError with specific error reason
 */
export const projects_uploadDocument = onCall(
  async (request): Promise<ApiResponse<{ uploadUrl: string; storagePath: string }>> => {
    const { data } = request;

    // ─── Validate request data structure ─────────────────────────────────────

    if (!data || typeof data !== 'object') {
      throw new HttpsError('invalid-argument', 'Request data is required.', {
        code: 'VALIDATION_ERROR',
        message: 'Request data is required.',
      } as unknown as Record<string, unknown>);
    }

    const { projectId, fileName, fileType, fileSize } = data as {
      projectId?: string;
      fileName?: string;
      fileType?: string;
      fileSize?: number;
    };

    // Validate required fields
    const fieldErrors: Record<string, string> = {};

    if (!projectId || typeof projectId !== 'string') {
      fieldErrors.projectId = 'Project ID is required.';
    }
    if (!fileName || typeof fileName !== 'string') {
      fieldErrors.fileName = 'File name is required.';
    }
    if (!fileType || typeof fileType !== 'string') {
      fieldErrors.fileType = 'File type is required.';
    }
    if (fileSize === undefined || fileSize === null || typeof fileSize !== 'number') {
      fieldErrors.fileSize = 'File size is required.';
    }

    if (Object.keys(fieldErrors).length > 0) {
      throw new HttpsError('invalid-argument', 'Validation failed.', {
        code: 'VALIDATION_ERROR',
        message: 'Missing required fields.',
        fields: fieldErrors,
      } as unknown as Record<string, unknown>);
    }

    // ─── Validate file type ──────────────────────────────────────────────────

    if (!ALLOWED_MIME_TYPES.includes(fileType!)) {
      throw new HttpsError('invalid-argument', 'Unsupported file type.', {
        code: 'VALIDATION_ERROR',
        message: `File type '${fileType}' is not supported. Allowed types: PDF, PNG, JPEG.`,
        fields: { fileType: 'Only PDF, PNG, and JPEG files are accepted.' },
      } as unknown as Record<string, unknown>);
    }

    // ─── Validate file size ──────────────────────────────────────────────────

    if (fileSize! <= 0) {
      throw new HttpsError('invalid-argument', 'File size must be greater than 0.', {
        code: 'VALIDATION_ERROR',
        message: 'File size must be greater than 0.',
        fields: { fileSize: 'File size must be greater than 0.' },
      } as unknown as Record<string, unknown>);
    }

    if (fileSize! > MAX_FILE_SIZE_BYTES) {
      throw new HttpsError('invalid-argument', 'File size exceeds 5 MB limit.', {
        code: 'VALIDATION_ERROR',
        message: `File size ${fileSize} bytes exceeds the maximum allowed size of 5 MB (${MAX_FILE_SIZE_BYTES} bytes).`,
        fields: { fileSize: 'File size must not exceed 5 MB.' },
      } as unknown as Record<string, unknown>);
    }

    // ─── Verify caller is the project owner ──────────────────────────────────

    const { projectData } = await verifyProjectOwner(request.auth, projectId!);

    // ─── Validate document count ─────────────────────────────────────────────

    const currentDocuments: string[] = projectData.documents || [];

    if (currentDocuments.length >= MAX_DOCUMENTS_PER_PROJECT) {
      throw new HttpsError('failed-precondition', 'Maximum document limit reached.', {
        code: 'VALIDATION_ERROR',
        message: `Project already has ${MAX_DOCUMENTS_PER_PROJECT} documents. Remove an existing document before uploading a new one.`,
        fields: { documents: `Maximum of ${MAX_DOCUMENTS_PER_PROJECT} documents per project.` },
      } as unknown as Record<string, unknown>);
    }

    // ─── Generate storage path and signed upload URL ─────────────────────────

    // Sanitize file name: remove path separators and limit length
    const sanitizedFileName = fileName!
      .replace(/[/\\]/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 100);

    // Add timestamp to prevent collisions
    const timestamp = Date.now();
    const storagePath = `projects/${projectId}/documents/${timestamp}_${sanitizedFileName}`;

    const storage = getStorage();
    const bucket = storage.bucket();
    const file = bucket.file(storagePath);

    // Generate a signed URL for upload (valid for 15 minutes)
    const [uploadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType: fileType!,
      extensionHeaders: {
        'x-goog-content-length-range': `0,${MAX_FILE_SIZE_BYTES}`,
      },
    });

    // ─── Record the document path in the project's documents array ───────────

    const db = getFirestore();
    await db.collection('projects').doc(projectId!).update({
      documents: FieldValue.arrayUnion(storagePath),
      updatedAt: new Date().toISOString(),
    });

    // ─── Return success ──────────────────────────────────────────────────────

    return {
      success: true,
      data: {
        uploadUrl,
        storagePath,
      },
    };
  }
);

/**
 * projects_confirmDocumentUpload
 *
 * Called after a client successfully uploads a file to the signed URL.
 * Verifies the file exists in Cloud Storage and is within size limits.
 * If the file doesn't exist or exceeds limits, removes the path from the documents array.
 *
 * Request data:
 * - projectId: string
 * - storagePath: string — the path returned from uploadDocument
 */
export const projects_confirmDocumentUpload = onCall(
  async (request): Promise<ApiResponse<{ confirmed: boolean; storagePath: string }>> => {
    const { data } = request;

    if (!data || typeof data !== 'object') {
      throw new HttpsError('invalid-argument', 'Request data is required.');
    }

    const { projectId, storagePath } = data as {
      projectId?: string;
      storagePath?: string;
    };

    if (!projectId || typeof projectId !== 'string') {
      throw new HttpsError('invalid-argument', 'Project ID is required.');
    }
    if (!storagePath || typeof storagePath !== 'string') {
      throw new HttpsError('invalid-argument', 'Storage path is required.');
    }

    // Verify caller is the project owner
    await verifyProjectOwner(request.auth, projectId);

    // Verify the file exists in Cloud Storage
    const storage = getStorage();
    const bucket = storage.bucket();
    const file = bucket.file(storagePath);

    const [exists] = await file.exists();

    if (!exists) {
      // Remove the path from the project's documents array (rollback)
      const db = getFirestore();
      await db.collection('projects').doc(projectId).update({
        documents: FieldValue.arrayRemove(storagePath),
        updatedAt: new Date().toISOString(),
      });

      throw new HttpsError('failed-precondition', 'File upload was not completed.', {
        code: 'VALIDATION_ERROR',
        message: 'The file was not found in storage. Upload may have failed.',
      } as unknown as Record<string, unknown>);
    }

    // Verify file size
    const [metadata] = await file.getMetadata();
    const actualSize = Number(metadata.size);

    if (actualSize > MAX_FILE_SIZE_BYTES) {
      // Delete the oversized file and remove from documents array
      await file.delete();
      const db = getFirestore();
      await db.collection('projects').doc(projectId).update({
        documents: FieldValue.arrayRemove(storagePath),
        updatedAt: new Date().toISOString(),
      });

      throw new HttpsError('invalid-argument', 'Uploaded file exceeds 5 MB limit.', {
        code: 'VALIDATION_ERROR',
        message: `Uploaded file is ${actualSize} bytes, which exceeds the 5 MB limit.`,
        fields: { fileSize: 'File size must not exceed 5 MB.' },
      } as unknown as Record<string, unknown>);
    }

    return {
      success: true,
      data: {
        confirmed: true,
        storagePath,
      },
    };
  }
);
