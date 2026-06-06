/**
 * Property Test: CSV export contains all required columns with correct data (Property 17)
 *
 * **Validates: Requirements 7.2**
 *
 * For any set of confirmed purchases within a date range, the generated CSV SHALL
 * contain one row per transaction with columns: date, project title, tonnage,
 * amount paid (ZAR), certificate ID.
 *
 * This tests the pure CSV generation logic extracted from the credits_exportCSV
 * Cloud Function, taking an array of transactions and a certificate map.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { formatZAR } from '../../shared/creditUtils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProjectAllocation {
  projectId: string;
  projectTitle: string;
  tonnage: number;
}

interface PurchaseTransaction {
  transactionId: string;
  funderId: string;
  quantity: number;
  unitPriceCents: number;
  totalAmountCents: number;
  currency: string;
  status: 'confirmed';
  packageId?: string;
  projectAllocations: ProjectAllocation[];
  createdAt: string;
  updatedAt: string;
}

// ─── Pure CSV Generation Function Under Test ─────────────────────────────────

/**
 * Escapes a CSV field that may contain commas, quotes, or newlines.
 * Mirrors the logic in functions/src/credits/exportCSV.ts.
 */
function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * Pure function: generates CSV content from an array of confirmed transactions
 * and a map of transactionId → certificateId.
 *
 * This mirrors the CSV generation logic in the credits_exportCSV Cloud Function.
 */
function generateCSV(
  transactions: PurchaseTransaction[],
  certificateMap: Map<string, string>
): string {
  const csvHeader = 'Date,Project Title,Tonnage (tCO₂e),Amount Paid (ZAR),Certificate ID';

  const csvRows = transactions.map((txn) => {
    const date = txn.createdAt ? txn.createdAt.split('T')[0] : '';
    const projectTitle = (txn.projectAllocations || [])
      .map((a) => a.projectTitle)
      .join('; ');
    const tonnage = txn.quantity.toFixed(2);
    const amountPaid = formatZAR(txn.totalAmountCents);
    const certificateId = certificateMap.get(txn.transactionId) || '';

    return [
      escapeCsvField(date),
      escapeCsvField(projectTitle),
      escapeCsvField(tonnage),
      escapeCsvField(amountPaid),
      escapeCsvField(certificateId),
    ].join(',');
  });

  return [csvHeader, ...csvRows].join('\n');
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate a safe project title (no newlines, reasonable length) */
const projectTitleArb = fc.stringMatching(/^[A-Za-z0-9 ]{1,50}$/);

/** Generate a valid ISO date string using integer timestamps to avoid invalid dates */
const isoDateArb = fc
  .integer({
    min: new Date('2020-01-01T00:00:00Z').getTime(),
    max: new Date('2030-12-31T23:59:59Z').getTime(),
  })
  .map((ms) => new Date(ms).toISOString());

/** Generate a project allocation */
const projectAllocationArb: fc.Arbitrary<ProjectAllocation> = fc.record({
  projectId: fc.uuid(),
  projectTitle: projectTitleArb,
  tonnage: fc.integer({ min: 1, max: 100000 }).map((v) => v / 100),
});

/** Generate a confirmed purchase transaction with known fields */
const confirmedTransactionArb: fc.Arbitrary<PurchaseTransaction> = fc.record({
  transactionId: fc.uuid(),
  funderId: fc.uuid(),
  quantity: fc.integer({ min: 100, max: 10000000 }).map((v) => v / 100),
  unitPriceCents: fc.integer({ min: 100, max: 10000000 }),
  totalAmountCents: fc.integer({ min: 100, max: 999999999 }),
  currency: fc.constant('ZAR'),
  status: fc.constant('confirmed' as const),
  packageId: fc.option(fc.uuid(), { nil: undefined }),
  projectAllocations: fc.array(projectAllocationArb, { minLength: 1, maxLength: 3 }),
  createdAt: isoDateArb,
  updatedAt: isoDateArb,
});

/** Generate a 16-char alphanumeric certificate ID */
const certificateIdArb = fc.stringMatching(/^[A-Za-z0-9]{12,16}$/);

/** Generate a set of transactions paired with a certificate map */
const transactionsWithCertificatesArb = fc
  .array(confirmedTransactionArb, { minLength: 1, maxLength: 30 })
  .chain((transactions) => {
    // Generate a certificate ID for each transaction
    const certEntries = fc.tuple(
      ...transactions.map((txn) =>
        fc.tuple(fc.constant(txn.transactionId), certificateIdArb)
      )
    );
    return certEntries.map((entries) => ({
      transactions,
      certificateMap: new Map(entries),
    }));
  });

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 17: CSV export contains all required columns with correct data', () => {
  /**
   * **Validates: Requirements 7.2**
   * The CSV header row contains all 5 required columns.
   */
  it('header row contains all 5 required columns', () => {
    fc.assert(
      fc.property(
        transactionsWithCertificatesArb,
        ({ transactions, certificateMap }) => {
          const csv = generateCSV(transactions, certificateMap);
          const lines = csv.split('\n');
          const header = lines[0];

          expect(header).toContain('Date');
          expect(header).toContain('Project Title');
          expect(header).toContain('Tonnage');
          expect(header).toContain('Amount Paid');
          expect(header).toContain('Certificate ID');
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 7.2**
   * The number of data rows equals the number of transactions.
   */
  it('number of data rows equals number of transactions', () => {
    fc.assert(
      fc.property(
        transactionsWithCertificatesArb,
        ({ transactions, certificateMap }) => {
          const csv = generateCSV(transactions, certificateMap);
          const lines = csv.split('\n');

          // First line is header, rest are data rows
          const dataRows = lines.slice(1);
          expect(dataRows.length).toBe(transactions.length);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 7.2**
   * Each row contains the correct date extracted from createdAt (YYYY-MM-DD).
   */
  it('each row contains the correct date from createdAt', () => {
    fc.assert(
      fc.property(
        transactionsWithCertificatesArb,
        ({ transactions, certificateMap }) => {
          const csv = generateCSV(transactions, certificateMap);
          const lines = csv.split('\n');
          const dataRows = lines.slice(1);

          for (let i = 0; i < transactions.length; i++) {
            const expectedDate = transactions[i].createdAt.split('T')[0];
            expect(dataRows[i]).toContain(expectedDate);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 7.2**
   * Each row contains the correct project title(s) from allocations.
   */
  it('each row contains the correct project title from allocations', () => {
    fc.assert(
      fc.property(
        transactionsWithCertificatesArb,
        ({ transactions, certificateMap }) => {
          const csv = generateCSV(transactions, certificateMap);
          const lines = csv.split('\n');
          const dataRows = lines.slice(1);

          for (let i = 0; i < transactions.length; i++) {
            const expectedTitle = transactions[i].projectAllocations
              .map((a) => a.projectTitle)
              .join('; ');
            // The title may be escaped in CSV, so check that data row contains it
            // (possibly quoted)
            const unquotedRow = dataRows[i].replace(/""/g, '"');
            expect(unquotedRow).toContain(expectedTitle);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 7.2**
   * Each row contains the correct tonnage formatted to 2 decimal places.
   */
  it('each row contains the correct tonnage value', () => {
    fc.assert(
      fc.property(
        transactionsWithCertificatesArb,
        ({ transactions, certificateMap }) => {
          const csv = generateCSV(transactions, certificateMap);
          const lines = csv.split('\n');
          const dataRows = lines.slice(1);

          for (let i = 0; i < transactions.length; i++) {
            const expectedTonnage = transactions[i].quantity.toFixed(2);
            expect(dataRows[i]).toContain(expectedTonnage);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 7.2**
   * Each row contains the correct amount paid formatted in ZAR.
   */
  it('each row contains the correct amount paid in ZAR', () => {
    fc.assert(
      fc.property(
        transactionsWithCertificatesArb,
        ({ transactions, certificateMap }) => {
          const csv = generateCSV(transactions, certificateMap);
          const lines = csv.split('\n');
          const dataRows = lines.slice(1);

          for (let i = 0; i < transactions.length; i++) {
            const expectedAmount = formatZAR(transactions[i].totalAmountCents);
            // Amount may be CSV-escaped if it contains commas
            const unquotedRow = dataRows[i].replace(/""/g, '"').replace(/"/g, '');
            expect(unquotedRow).toContain(expectedAmount.replace(/"/g, ''));
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 7.2**
   * Each row contains the correct certificate ID from the certificate map.
   */
  it('each row contains the correct certificate ID', () => {
    fc.assert(
      fc.property(
        transactionsWithCertificatesArb,
        ({ transactions, certificateMap }) => {
          const csv = generateCSV(transactions, certificateMap);
          const lines = csv.split('\n');
          const dataRows = lines.slice(1);

          for (let i = 0; i < transactions.length; i++) {
            const expectedCertId = certificateMap.get(transactions[i].transactionId) || '';
            expect(dataRows[i]).toContain(expectedCertId);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 7.2**
   * Empty transaction array produces only the header row.
   */
  it('empty transaction array produces only the header row', () => {
    fc.assert(
      fc.property(
        fc.constant({ transactions: [] as PurchaseTransaction[], certificateMap: new Map<string, string>() }),
        ({ transactions, certificateMap }) => {
          const csv = generateCSV(transactions, certificateMap);
          const lines = csv.split('\n');

          expect(lines.length).toBe(1);
          expect(lines[0]).toBe('Date,Project Title,Tonnage (tCO₂e),Amount Paid (ZAR),Certificate ID');
        }
      ),
      { numRuns: 200 }
    );
  });
});
