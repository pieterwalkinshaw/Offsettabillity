/**
 * Credits Export PDF Cloud Function
 *
 * Generates a formatted PDF sustainability report for a date range.
 * - Requires 'funder' or 'admin' role
 * - Validates date range with ExportDateRangeSchema
 * - Generates PDF containing: organisation name, reporting period, total tonnage,
 *   per-project breakdown, and certificate IDs list
 * - Stores PDF in Cloud Storage and returns a signed download URL
 *
 * Requirements validated: 7.1, 7.3, 7.4
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { ExportDateRangeSchema } from '../../../shared/schemas';
import type { ApiResponse } from '../../../shared/types';
import PDFDocument from 'pdfkit';

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
 * Format cents as ZAR display string.
 */
function formatZAR(cents: number): string {
  return `R ${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
}

/**
 * Generate and upload the PDF sustainability report to Cloud Storage.
 * Returns the storage path.
 */
async function generatePDFReport(params: {
  organisationName: string;
  startDate: string;
  endDate: string;
  totalTonnage: number;
  totalSpent: number;
  projectBreakdown: Array<{ projectTitle: string; tonnage: number; percentage: number }>;
  certificateIds: string[];
  storagePath: string;
}): Promise<void> {
  const { organisationName, startDate, endDate, totalTonnage, totalSpent, projectBreakdown, certificateIds, storagePath } = params;

  const bucket = getStorage().bucket();
  const file = bucket.file(storagePath);
  const writeStream = file.createWriteStream({
    metadata: {
      contentType: 'application/pdf',
    },
  });

  return new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    doc.pipe(writeStream);

    // ─── Header ───────────────────────────────────────────────────────────────
    doc
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('Sustainability Report', { align: 'center' });

    doc.moveDown(0.5);

    doc
      .fontSize(12)
      .font('Helvetica')
      .text('Offsettable Carbon Credit Platform', { align: 'center' });

    doc.moveDown(1.5);

    // ─── Organisation Name ────────────────────────────────────────────────────
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('Organisation');

    doc
      .fontSize(12)
      .font('Helvetica')
      .text(organisationName);

    doc.moveDown(1);

    // ─── Reporting Period ─────────────────────────────────────────────────────
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('Reporting Period');

    const formattedStart = new Date(startDate).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const formattedEnd = new Date(endDate).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    doc
      .fontSize(12)
      .font('Helvetica')
      .text(`${formattedStart} — ${formattedEnd}`);

    doc.moveDown(1);

    // ─── Total Tonnage Offset ─────────────────────────────────────────────────
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('Total Carbon Offset');

    doc
      .fontSize(12)
      .font('Helvetica')
      .text(`${totalTonnage.toFixed(2)} metric tons CO₂e`);

    doc
      .fontSize(10)
      .fillColor('#555555')
      .text(`Total investment: ${formatZAR(totalSpent)}`);

    doc.fillColor('#000000');
    doc.moveDown(1.5);

    // ─── Per-Project Breakdown ────────────────────────────────────────────────
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('Per-Project Breakdown');

    doc.moveDown(0.5);

    if (projectBreakdown.length === 0) {
      doc.fontSize(12).font('Helvetica').text('No project data for this period.');
    } else {
      // Table header
      const tableTop = doc.y;
      const col1X = 50;
      const col2X = 320;
      const col3X = 420;

      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Project', col1X, tableTop, { width: 260 });
      doc.text('Tonnage', col2X, tableTop, { width: 80 });
      doc.text('% of Total', col3X, tableTop, { width: 80 });

      doc.moveDown(0.3);

      // Draw a line below header
      const lineY = doc.y;
      doc
        .moveTo(col1X, lineY)
        .lineTo(500, lineY)
        .stroke();

      doc.moveDown(0.3);

      // Table rows
      doc.fontSize(10).font('Helvetica');
      for (const project of projectBreakdown) {
        const rowY = doc.y;
        doc.text(project.projectTitle, col1X, rowY, { width: 260 });
        doc.text(project.tonnage.toFixed(2), col2X, rowY, { width: 80 });
        doc.text(`${project.percentage.toFixed(1)}%`, col3X, rowY, { width: 80 });
        doc.moveDown(0.5);
      }
    }

    doc.moveDown(1.5);

    // ─── Certificate IDs List ─────────────────────────────────────────────────
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('Certificate IDs');

    doc.moveDown(0.5);

    if (certificateIds.length === 0) {
      doc.fontSize(12).font('Helvetica').text('No certificates issued for this period.');
    } else {
      doc.fontSize(10).font('Helvetica');
      for (const certId of certificateIds) {
        doc.text(`• ${certId}`);
      }
    }

    doc.moveDown(2);

    // ─── Footer ───────────────────────────────────────────────────────────────
    doc
      .fontSize(9)
      .fillColor('#888888')
      .text(`Generated by Offsettable on ${new Date().toLocaleDateString('en-ZA')}`, {
        align: 'center',
      });

    doc.fillColor('#000000');

    // Finalize
    doc.end();

    writeStream.on('finish', () => resolve());
    writeStream.on('error', (err) => reject(err));
  });
}

/**
 * Export PDF sustainability report for a date range.
 *
 * Requires 'funder' or 'admin' role.
 * Validates input with ExportDateRangeSchema.
 * Generates formatted PDF report and stores in Cloud Storage.
 * Returns download URL and filename.
 */
export const credits_exportPDF = onCall(async (request): Promise<ApiResponse<{ downloadUrl: string; filename: string }>> => {
  // 1. Auth & role verification
  const { uid, role } = await verifyFunderOrAdmin(request.auth);

  // 2. Validate input with Zod schema
  const parseResult = ExportDateRangeSchema.safeParse(request.data);
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

  const { startDate, endDate } = parseResult.data;
  const db = getFirestore();

  // 3. Get user organisation name
  const userDoc = await db.collection(USERS_COLLECTION).doc(uid).get();
  const userData = userDoc.data();
  const organisationName = userData?.organizationName || userData?.name || 'Unknown Organisation';

  // 4. Query confirmed purchases within date range
  let query: FirebaseFirestore.Query = db
    .collection(PURCHASE_TRANSACTIONS_COLLECTION)
    .where('status', '==', 'confirmed')
    .where('createdAt', '>=', startDate)
    .where('createdAt', '<=', endDate);

  // Funder sees only own records; admin sees all
  if (role === 'funder') {
    query = query.where('funderId', '==', uid);
  }

  const transactionsSnapshot = await query.get();

  // 5. Aggregate data
  let totalTonnage = 0;
  let totalSpent = 0;
  const projectMap = new Map<string, { projectTitle: string; tonnage: number }>();
  const transactionIds: string[] = [];

  for (const doc of transactionsSnapshot.docs) {
    const txn = doc.data();
    totalTonnage += txn.quantity;
    totalSpent += txn.totalAmountCents;
    transactionIds.push(txn.transactionId);

    // Aggregate per-project breakdown
    if (Array.isArray(txn.projectAllocations)) {
      for (const alloc of txn.projectAllocations) {
        const existing = projectMap.get(alloc.projectId);
        if (existing) {
          existing.tonnage += alloc.tonnage;
        } else {
          projectMap.set(alloc.projectId, {
            projectTitle: alloc.projectTitle || alloc.projectId,
            tonnage: alloc.tonnage,
          });
        }
      }
    }
  }

  // Build per-project breakdown with percentages
  const projectBreakdown = Array.from(projectMap.values()).map((p) => ({
    projectTitle: p.projectTitle,
    tonnage: p.tonnage,
    percentage: totalTonnage > 0 ? (p.tonnage / totalTonnage) * 100 : 0,
  }));

  // 6. Fetch certificate IDs for the transactions in this period
  const certificateIds: string[] = [];
  if (transactionIds.length > 0) {
    // Firestore 'in' queries are limited to 30 items — batch if needed
    const batchSize = 30;
    for (let i = 0; i < transactionIds.length; i += batchSize) {
      const batch = transactionIds.slice(i, i + batchSize);
      const certQuery = await db
        .collection(CERTIFICATES_COLLECTION)
        .where('transactionId', 'in', batch)
        .get();

      for (const certDoc of certQuery.docs) {
        const certData = certDoc.data();
        if (certData.certificateId) {
          certificateIds.push(certData.certificateId);
        }
      }
    }
  }

  // 7. Generate PDF and upload to Cloud Storage
  const timestamp = Date.now();
  const filename = `${timestamp}-sustainability-report.pdf`;
  const storagePath = `exports/${uid}/${filename}`;

  await generatePDFReport({
    organisationName,
    startDate,
    endDate,
    totalTonnage,
    totalSpent,
    projectBreakdown,
    certificateIds,
    storagePath,
  });

  // 8. Generate a signed download URL (valid for 1 hour)
  const bucket = getStorage().bucket();
  const file = bucket.file(storagePath);
  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 60 * 60 * 1000, // 1 hour
  });

  return {
    success: true,
    data: {
      downloadUrl: signedUrl,
      filename,
    },
  };
});
