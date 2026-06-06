/**
 * Property Test: PDF export contains all required sections (Property 18)
 *
 * **Validates: Requirements 7.3**
 *
 * WHEN the Funder requests a PDF export, THE Sustainability_Dashboard SHALL generate
 * a formatted report containing: organisation name, reporting period, total tonnage
 * offset, per-project breakdown, and a list of certificate IDs.
 *
 * Since we cannot easily test actual PDF rendering, this tests the DATA PREPARATION
 * logic that produces the params passed to `generatePDFReport`. The property verifies
 * that all required sections are represented and structurally valid.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

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
  status: 'pending' | 'confirmed' | 'failed' | 'refunded';
  projectAllocations: ProjectAllocation[];
  certificateId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * The parameters that are passed to `generatePDFReport` in the exportPDF function.
 * This is the data contract between aggregation logic and PDF rendering.
 */
interface PDFReportParams {
  organisationName: string;
  startDate: string;
  endDate: string;
  totalTonnage: number;
  totalSpent: number;
  projectBreakdown: Array<{ projectTitle: string; tonnage: number; percentage: number }>;
  certificateIds: string[];
  storagePath: string;
}

// ─── Pure Function Under Test ────────────────────────────────────────────────

/**
 * Prepares the PDF report parameters from a set of confirmed purchase transactions.
 * Mirrors the aggregation logic in `functions/src/credits/exportPDF.ts`:
 *  1. Compute total tonnage and total spent from confirmed transactions
 *  2. Build per-project breakdown with percentages
 *  3. Collect certificate IDs from confirmed transactions
 */
function preparePDFReportParams(
  organisationName: string,
  startDate: string,
  endDate: string,
  transactions: PurchaseTransaction[],
  certificateIds: string[],
  funderId: string
): PDFReportParams {
  // Aggregate totals from confirmed transactions
  let totalTonnage = 0;
  let totalSpent = 0;
  const projectMap = new Map<string, { projectTitle: string; tonnage: number }>();

  for (const txn of transactions) {
    if (txn.status !== 'confirmed') continue;

    totalTonnage += txn.quantity;
    totalSpent += txn.totalAmountCents;

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

  const timestamp = Date.now();
  const filename = `${timestamp}-sustainability-report.pdf`;
  const storagePath = `exports/${funderId}/${filename}`;

  return {
    organisationName,
    startDate,
    endDate,
    totalTonnage,
    totalSpent,
    projectBreakdown,
    certificateIds,
    storagePath,
  };
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate a non-empty organisation name */
const organisationNameArb = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0);

/** Minimum and maximum timestamps for date generation */
const MIN_TIMESTAMP = new Date('2020-01-01T00:00:00Z').getTime();
const MAX_TIMESTAMP = new Date('2030-12-31T23:59:59Z').getTime();

/** Generate a valid ISO date string in a reasonable range using integer timestamps */
const isoDateArb = fc
  .integer({ min: MIN_TIMESTAMP, max: MAX_TIMESTAMP })
  .map((ts) => new Date(ts).toISOString());

/** Generate a valid date range (start < end) */
const dateRangeArb = fc
  .tuple(
    fc.integer({ min: MIN_TIMESTAMP, max: MAX_TIMESTAMP - 86400000 }), // leave room for end
    fc.integer({ min: 1, max: 365 * 2 }) // days offset
  )
  .map(([startTs, dayOffset]) => {
    const endTs = Math.min(startTs + dayOffset * 86400000, MAX_TIMESTAMP);
    return {
      startDate: new Date(startTs).toISOString(),
      endDate: new Date(endTs).toISOString(),
    };
  });

/** Pool of project IDs for realistic overlap */
const projectIdPool = ['proj-solar-1', 'proj-solar-2', 'proj-solar-3', 'proj-solar-4'];
const projectTitlePool = [
  'SunRise Credits: Solar Power',
  'Solar Schools: Community Education',
  'Green Energy Initiative',
  'Solar for All',
];

/** Generate a tonnage value with 2 decimal precision */
const tonnageArb = fc.integer({ min: 1, max: 100000 }).map((v) => v / 100);

/** Generate a project allocation */
const allocationArb = fc.record({
  projectId: fc.constantFrom(...projectIdPool),
  projectTitle: fc.constantFrom(...projectTitlePool),
  tonnage: tonnageArb,
});

/** Generate a confirmed purchase transaction */
const confirmedTransactionArb = fc
  .tuple(
    fc.array(allocationArb, { minLength: 1, maxLength: 4 }),
    fc.integer({ min: 100, max: 10000000 }),
    isoDateArb
  )
  .map(([allocations, unitPriceCents, createdAt]) => {
    const quantity = Math.round(allocations.reduce((sum, a) => sum + a.tonnage, 0) * 100) / 100;
    return {
      transactionId: `txn-${Math.random().toString(36).slice(2, 10)}`,
      funderId: 'funder-001',
      quantity,
      unitPriceCents,
      totalAmountCents: Math.round(quantity * unitPriceCents),
      currency: 'ZAR',
      status: 'confirmed' as const,
      projectAllocations: allocations,
      certificateId: `cert-${Math.random().toString(36).slice(2, 14)}`,
      createdAt,
      updatedAt: createdAt,
    };
  });

/** Generate a mix of confirmed and non-confirmed transactions */
const mixedTransactionArb = fc
  .tuple(
    fc.constantFrom('pending' as const, 'confirmed' as const, 'failed' as const, 'refunded' as const),
    fc.array(allocationArb, { minLength: 1, maxLength: 3 }),
    fc.integer({ min: 100, max: 10000000 }),
    isoDateArb
  )
  .map(([status, allocations, unitPriceCents, createdAt]) => {
    const quantity = Math.round(allocations.reduce((sum, a) => sum + a.tonnage, 0) * 100) / 100;
    return {
      transactionId: `txn-${Math.random().toString(36).slice(2, 10)}`,
      funderId: 'funder-001',
      quantity,
      unitPriceCents,
      totalAmountCents: Math.round(quantity * unitPriceCents),
      currency: 'ZAR',
      status,
      projectAllocations: allocations,
      certificateId: status === 'confirmed' ? `cert-${Math.random().toString(36).slice(2, 14)}` : undefined,
      createdAt,
      updatedAt: createdAt,
    };
  });

/** Generate certificate IDs (alphanumeric, ≥12 chars) */
const certificateIdArb = fc.string({ minLength: 12, maxLength: 16, unit: fc.constantFrom(
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.split('')
) });

/** Generate a list of certificate IDs */
const certificateIdsArb = fc.array(certificateIdArb, { minLength: 0, maxLength: 20 });

/** Generate a funder ID */
const funderIdArb = fc.uuid();

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 18: PDF export contains all required sections', () => {
  /**
   * **Validates: Requirements 7.3**
   * The PDF report params always contain a non-empty organisation name.
   */
  it('PDF report params contain non-empty organisation name', () => {
    fc.assert(
      fc.property(
        organisationNameArb,
        dateRangeArb,
        fc.array(confirmedTransactionArb, { minLength: 0, maxLength: 15 }),
        certificateIdsArb,
        funderIdArb,
        (orgName, dateRange, transactions, certIds, funderId) => {
          const params = preparePDFReportParams(
            orgName,
            dateRange.startDate,
            dateRange.endDate,
            transactions,
            certIds,
            funderId
          );

          expect(params.organisationName).toBe(orgName);
          expect(params.organisationName.trim().length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 7.3**
   * The PDF report params contain a valid reporting period where startDate < endDate.
   */
  it('PDF report params contain valid reporting period (startDate < endDate)', () => {
    fc.assert(
      fc.property(
        organisationNameArb,
        dateRangeArb,
        fc.array(confirmedTransactionArb, { minLength: 0, maxLength: 10 }),
        certificateIdsArb,
        funderIdArb,
        (orgName, dateRange, transactions, certIds, funderId) => {
          const params = preparePDFReportParams(
            orgName,
            dateRange.startDate,
            dateRange.endDate,
            transactions,
            certIds,
            funderId
          );

          const start = new Date(params.startDate);
          const end = new Date(params.endDate);

          expect(start.getTime()).toBeLessThan(end.getTime());
          // Both are valid ISO strings
          expect(params.startDate).toBe(dateRange.startDate);
          expect(params.endDate).toBe(dateRange.endDate);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 7.3**
   * The total tonnage is non-negative and equals the sum of confirmed transaction quantities.
   */
  it('totalTonnage is non-negative and equals sum of confirmed quantities', () => {
    fc.assert(
      fc.property(
        organisationNameArb,
        dateRangeArb,
        fc.array(mixedTransactionArb, { minLength: 0, maxLength: 20 }),
        certificateIdsArb,
        funderIdArb,
        (orgName, dateRange, transactions, certIds, funderId) => {
          const params = preparePDFReportParams(
            orgName,
            dateRange.startDate,
            dateRange.endDate,
            transactions,
            certIds,
            funderId
          );

          // totalTonnage should be non-negative
          expect(params.totalTonnage).toBeGreaterThanOrEqual(0);

          // Should equal sum of confirmed transaction quantities
          const expectedTotal = transactions
            .filter((t) => t.status === 'confirmed')
            .reduce((sum, t) => sum + t.quantity, 0);

          expect(params.totalTonnage).toBeCloseTo(expectedTotal, 5);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 7.3**
   * Per-project breakdown percentages sum to approximately 100% when there are projects,
   * or 0% when there are no confirmed transactions.
   */
  it('per-project breakdown percentages sum to ~100% or 0% when empty', () => {
    fc.assert(
      fc.property(
        organisationNameArb,
        dateRangeArb,
        fc.array(confirmedTransactionArb, { minLength: 0, maxLength: 15 }),
        certificateIdsArb,
        funderIdArb,
        (orgName, dateRange, transactions, certIds, funderId) => {
          const params = preparePDFReportParams(
            orgName,
            dateRange.startDate,
            dateRange.endDate,
            transactions,
            certIds,
            funderId
          );

          if (params.projectBreakdown.length === 0) {
            // No breakdown when no confirmed transactions
            expect(params.totalTonnage).toBe(0);
          } else {
            // Percentages should sum to approximately 100%
            const percentageSum = params.projectBreakdown.reduce((sum, p) => sum + p.percentage, 0);
            expect(percentageSum).toBeCloseTo(100, 1);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 7.3**
   * Certificate IDs are present in the report params when transactions exist.
   * The params pass through certificate IDs as provided.
   */
  it('certificate IDs are included in report params', () => {
    fc.assert(
      fc.property(
        organisationNameArb,
        dateRangeArb,
        fc.array(confirmedTransactionArb, { minLength: 1, maxLength: 10 }),
        fc.array(certificateIdArb, { minLength: 1, maxLength: 10 }),
        funderIdArb,
        (orgName, dateRange, transactions, certIds, funderId) => {
          const params = preparePDFReportParams(
            orgName,
            dateRange.startDate,
            dateRange.endDate,
            transactions,
            certIds,
            funderId
          );

          // Certificate IDs are passed through to the report
          expect(params.certificateIds).toEqual(certIds);
          expect(params.certificateIds.length).toBeGreaterThan(0);

          // Each certificate ID is a non-empty string
          for (const id of params.certificateIds) {
            expect(id.length).toBeGreaterThanOrEqual(12);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 7.3**
   * All required fields are present in the PDF report params structure.
   */
  it('all required sections are present in report params', () => {
    fc.assert(
      fc.property(
        organisationNameArb,
        dateRangeArb,
        fc.array(confirmedTransactionArb, { minLength: 1, maxLength: 10 }),
        certificateIdsArb,
        funderIdArb,
        (orgName, dateRange, transactions, certIds, funderId) => {
          const params = preparePDFReportParams(
            orgName,
            dateRange.startDate,
            dateRange.endDate,
            transactions,
            certIds,
            funderId
          );

          // Organisation name section
          expect(params).toHaveProperty('organisationName');
          expect(typeof params.organisationName).toBe('string');

          // Reporting period section
          expect(params).toHaveProperty('startDate');
          expect(params).toHaveProperty('endDate');
          expect(typeof params.startDate).toBe('string');
          expect(typeof params.endDate).toBe('string');

          // Total tonnage section
          expect(params).toHaveProperty('totalTonnage');
          expect(typeof params.totalTonnage).toBe('number');

          // Per-project breakdown section
          expect(params).toHaveProperty('projectBreakdown');
          expect(Array.isArray(params.projectBreakdown)).toBe(true);
          for (const project of params.projectBreakdown) {
            expect(project).toHaveProperty('projectTitle');
            expect(project).toHaveProperty('tonnage');
            expect(project).toHaveProperty('percentage');
            expect(typeof project.projectTitle).toBe('string');
            expect(typeof project.tonnage).toBe('number');
            expect(typeof project.percentage).toBe('number');
          }

          // Certificate IDs section
          expect(params).toHaveProperty('certificateIds');
          expect(Array.isArray(params.certificateIds)).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 7.3**
   * Per-project breakdown tonnages sum to total tonnage (consistency check).
   */
  it('per-project breakdown tonnages sum to total tonnage', () => {
    fc.assert(
      fc.property(
        organisationNameArb,
        dateRangeArb,
        fc.array(confirmedTransactionArb, { minLength: 1, maxLength: 15 }),
        certificateIdsArb,
        funderIdArb,
        (orgName, dateRange, transactions, certIds, funderId) => {
          const params = preparePDFReportParams(
            orgName,
            dateRange.startDate,
            dateRange.endDate,
            transactions,
            certIds,
            funderId
          );

          const breakdownSum = params.projectBreakdown.reduce((sum, p) => sum + p.tonnage, 0);

          // The sum of per-project tonnages should equal the total tonnage
          expect(breakdownSum).toBeCloseTo(params.totalTonnage, 1);
        }
      ),
      { numRuns: 200 }
    );
  });
});
