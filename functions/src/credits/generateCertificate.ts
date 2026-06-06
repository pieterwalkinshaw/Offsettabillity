/**
 * Generate Certificate Cloud Function
 *
 * Firestore-triggered function that generates a PDF certificate
 * when a purchaseTransaction status changes to 'confirmed'.
 *
 * Flow:
 * 1. Detect status change to 'confirmed'
 * 2. Read transaction, funder, and project data
 * 3. Generate unique certificate ID (16-char alphanumeric)
 * 4. Render PDF using pdfkit with required layout
 * 5. Upload PDF to Cloud Storage at certificates/{funderId}/{transactionId}.pdf
 * 6. Create certificates Firestore document with metadata
 * 7. Update the purchase transaction with the certificateId
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.6
 */

import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import PDFDocument from 'pdfkit';
import { generateCertificateId, buildStoragePath } from '../../../shared/creditUtils';
import type { PurchaseTransaction, Certificate } from '../../../shared/types';

const USERS_COLLECTION = 'users';
const PURCHASE_TRANSACTIONS_COLLECTION = 'purchaseTransactions';
const CERTIFICATES_COLLECTION = 'certificates';

/**
 * Render the certificate PDF and return it as a Buffer.
 */
function renderCertificatePDF(params: {
  certificateId: string;
  funderOrganisationName: string;
  purchaseDate: string;
  tonnageOffset: number;
  projectTitle: string;
  projectLocation: string;
  transactionId: string;
  generatedAt: string;
}): Promise<Buffer> {
  const {
    certificateId,
    funderOrganisationName,
    purchaseDate,
    tonnageOffset,
    projectTitle,
    projectLocation,
    transactionId,
    generatedAt,
  } = params;

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 60, size: 'A4' });

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err: Error) => reject(err));

    // ─── 1. Header — Offsettable logo text + "Carbon Credit Certificate" title ──
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .fillColor('#2d7a3a')
      .text('Offsettable', { align: 'center' });

    doc.moveDown(0.5);

    doc
      .fontSize(24)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text('Carbon Credit Certificate', { align: 'center' });

    doc.moveDown(1);

    // Horizontal line below header
    const lineY = doc.y;
    doc
      .moveTo(60, lineY)
      .lineTo(535, lineY)
      .strokeColor('#2d7a3a')
      .lineWidth(2)
      .stroke();

    doc.moveDown(1.5);

    // ─── 2. Certificate ID — Unique 16-char alphanumeric ────────────────────────
    doc
      .fontSize(11)
      .font('Helvetica')
      .fillColor('#555555')
      .text('Certificate ID', { align: 'left' });

    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text(certificateId);

    doc.moveDown(1.5);

    // ─── 3. Funder details — Organisation name, purchase date ───────────────────
    doc
      .fontSize(11)
      .font('Helvetica')
      .fillColor('#555555')
      .text('Issued To');

    doc
      .fontSize(13)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text(funderOrganisationName);

    doc.moveDown(0.5);

    const formattedPurchaseDate = new Date(purchaseDate).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    doc
      .fontSize(11)
      .font('Helvetica')
      .fillColor('#555555')
      .text('Purchase Date');

    doc
      .fontSize(12)
      .font('Helvetica')
      .fillColor('#000000')
      .text(formattedPurchaseDate);

    doc.moveDown(1.5);

    // ─── 4. Offset details — Tonnage ────────────────────────────────────────────
    doc
      .fontSize(11)
      .font('Helvetica')
      .fillColor('#555555')
      .text('Carbon Offset');

    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .fillColor('#2d7a3a')
      .text(`${tonnageOffset.toFixed(2)} metric tons CO₂e avoided`);

    doc.moveDown(1.5);
    doc.fillColor('#000000');

    // ─── 5. Project details — Title, location, verification badge ───────────────
    doc
      .fontSize(11)
      .font('Helvetica')
      .fillColor('#555555')
      .text('Source Project');

    doc
      .fontSize(13)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text(projectTitle);

    doc
      .fontSize(11)
      .font('Helvetica')
      .fillColor('#333333')
      .text(projectLocation);

    doc.moveDown(0.5);

    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#2d7a3a')
      .text('✓ Verified Project');

    doc.moveDown(1.5);
    doc.fillColor('#000000');

    // ─── 6. Verification reference — Link to project page on platform ───────────
    doc
      .fontSize(11)
      .font('Helvetica')
      .fillColor('#555555')
      .text('Verification Reference');

    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#0066cc')
      .text(`Transaction: ${transactionId}`, {
        link: `https://offsettable.co.za/credits?view=confirm&txn=${transactionId}`,
      });

    doc.moveDown(2);
    doc.fillColor('#000000');

    // ─── 7. Footer — "Verified by Offsettable" + generation timestamp ───────────
    // Horizontal line above footer
    const footerLineY = doc.y;
    doc
      .moveTo(60, footerLineY)
      .lineTo(535, footerLineY)
      .strokeColor('#cccccc')
      .lineWidth(1)
      .stroke();

    doc.moveDown(0.8);

    const formattedGeneratedAt = new Date(generatedAt).toLocaleString('en-ZA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#888888')
      .text(`Verified by Offsettable | Generated: ${formattedGeneratedAt}`, { align: 'center' });

    // Finalize
    doc.end();
  });
}

/**
 * Firestore-triggered function: generates a PDF certificate when a
 * purchaseTransaction document's status changes to 'confirmed'.
 */
export const credits_generateCertificate = onDocumentUpdated(
  'purchaseTransactions/{transactionId}',
  async (event) => {
    // Get before and after data
    const beforeData = event.data?.before.data() as PurchaseTransaction | undefined;
    const afterData = event.data?.after.data() as PurchaseTransaction | undefined;

    if (!beforeData || !afterData) {
      return;
    }

    // Only trigger when status changes TO 'confirmed'
    if (beforeData.status === 'confirmed' || afterData.status !== 'confirmed') {
      return;
    }

    const transactionId = afterData.transactionId;
    const funderId = afterData.funderId;

    const db = getFirestore();

    // 1. Read funder user document for organisation name
    const funderDoc = await db.collection(USERS_COLLECTION).doc(funderId).get();
    const funderData = funderDoc.data();

    if (!funderData) {
      console.error(`Funder not found: ${funderId}`);
      return;
    }

    const funderOrganisationName = funderData.organizationName || funderData.name || 'Unknown Organisation';

    // 2. Get project details from first allocation (primary project)
    const primaryAllocation = afterData.projectAllocations[0];
    const projectTitle = primaryAllocation?.projectTitle || 'Unknown Project';
    let projectLocation = '';

    if (primaryAllocation?.projectId) {
      const projectDoc = await db.collection('projects').doc(primaryAllocation.projectId).get();
      const projectData = projectDoc.data();
      if (projectData?.location) {
        projectLocation = projectData.location.address || '';
      }
    }

    // Fallback: if no location from project doc, try credit inventory
    if (!projectLocation && primaryAllocation?.projectId) {
      const inventoryQuery = await db
        .collection('creditInventory')
        .where('projectId', '==', primaryAllocation.projectId)
        .limit(1)
        .get();

      if (!inventoryQuery.empty) {
        const inventoryData = inventoryQuery.docs[0].data();
        projectLocation = inventoryData.projectLocation || '';
      }
    }

    // 3. Generate unique certificate ID
    const certificateId = generateCertificateId();
    const generatedAt = new Date().toISOString();

    // 4. Render PDF
    const pdfBuffer = await renderCertificatePDF({
      certificateId,
      funderOrganisationName,
      purchaseDate: afterData.createdAt,
      tonnageOffset: afterData.quantity,
      projectTitle,
      projectLocation,
      transactionId,
      generatedAt,
    });

    // 5. Upload PDF to Cloud Storage at certificates/{funderId}/{transactionId}.pdf
    const storagePath = buildStoragePath(funderId, transactionId);
    const bucket = getStorage().bucket();
    const file = bucket.file(storagePath);

    await file.save(pdfBuffer, {
      metadata: {
        contentType: 'application/pdf',
      },
    });

    // 6. Create certificates Firestore document with metadata
    const certificateData: Certificate = {
      certificateId,
      transactionId,
      funderId,
      funderOrganisationName,
      tonnageOffset: afterData.quantity,
      projectTitle,
      projectLocation,
      storagePath,
      generatedAt,
    };

    await db.collection(CERTIFICATES_COLLECTION).doc(certificateId).set(certificateData);

    // 7. Update the purchase transaction with the certificateId
    await db.collection(PURCHASE_TRANSACTIONS_COLLECTION).doc(transactionId).update({
      certificateId,
      updatedAt: new Date().toISOString(),
    });
  }
);
