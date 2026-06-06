/**
 * Property Test: Per-project breakdown sums to total offset (Property 16)
 *
 * **Validates: Requirements 6.3**
 *
 * For any funder's confirmed purchases, the per-project tonnage breakdown
 * SHALL sum to the same total as the overall CO₂e offset, and each project's
 * attributed tonnage SHALL equal the sum of allocations to that project across
 * all confirmed transactions.
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
  createdAt: string;
  updatedAt: string;
}

interface ProjectBreakdown {
  projectId: string;
  projectTitle: string;
  tonnage: number;
}

// ─── Pure Function Under Test ────────────────────────────────────────────────

/**
 * Builds per-project breakdown from confirmed transactions.
 * Mirrors the `buildProjectBreakdown` logic in the sustainability dashboard.
 * Aggregates tonnage by projectId across all transactions' projectAllocations.
 */
function buildProjectBreakdown(transactions: PurchaseTransaction[]): ProjectBreakdown[] {
  const projectMap = new Map<string, { projectTitle: string; tonnage: number }>();

  for (const txn of transactions) {
    for (const alloc of txn.projectAllocations) {
      const existing = projectMap.get(alloc.projectId);
      if (existing) {
        existing.tonnage += alloc.tonnage;
      } else {
        projectMap.set(alloc.projectId, {
          projectTitle: alloc.projectTitle,
          tonnage: alloc.tonnage,
        });
      }
    }
  }

  return Array.from(projectMap.entries()).map(([projectId, data]) => ({
    projectId,
    projectTitle: data.projectTitle,
    tonnage: Math.round(data.tonnage * 100) / 100,
  }));
}

/**
 * Computes the total CO₂e offset from confirmed transactions.
 * This is the sum of all transaction quantities.
 */
function computeTotalOffset(transactions: PurchaseTransaction[]): number {
  return transactions.reduce((sum, txn) => sum + txn.quantity, 0);
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Pool of project IDs to create realistic overlap across transactions */
const projectIdPool = ['proj-alpha', 'proj-beta', 'proj-gamma', 'proj-delta', 'proj-epsilon'];

/** Generate a tonnage value with 2 decimal precision */
const tonnageArb = fc.integer({ min: 1, max: 100000 }).map((v) => v / 100);

/** Generate a single project allocation from the project pool */
const allocationArb = fc.record({
  projectId: fc.constantFrom(...projectIdPool),
  projectTitle: fc.constantFrom(
    'Solar Alpha Project',
    'Solar Beta Project',
    'Solar Gamma Project',
    'Solar Delta Project',
    'Solar Epsilon Project'
  ),
  tonnage: tonnageArb,
});

/**
 * Generate a confirmed purchase transaction with consistent projectAllocations.
 * The transaction's quantity equals the sum of its allocation tonnages
 * (this is the data invariant maintained by the purchase system).
 */
const confirmedTransactionArb = fc
  .array(allocationArb, { minLength: 1, maxLength: 5 })
  .map((allocations) => {
    const quantity = Math.round(
      allocations.reduce((sum, a) => sum + a.tonnage, 0) * 100
    ) / 100;

    return {
      transactionId: `txn-${Math.random().toString(36).slice(2, 10)}`,
      funderId: 'funder-001',
      quantity,
      unitPriceCents: 15000,
      totalAmountCents: Math.round(quantity * 15000),
      currency: 'ZAR' as const,
      status: 'confirmed' as const,
      projectAllocations: allocations,
      createdAt: '2025-03-15T10:00:00Z',
      updatedAt: '2025-03-15T10:00:00Z',
    };
  });

/** Generate a list of confirmed transactions */
const transactionListArb = fc.array(confirmedTransactionArb, {
  minLength: 1,
  maxLength: 20,
});

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 16: Per-project breakdown sums to total offset', () => {
  /**
   * **Validates: Requirements 6.3**
   * The sum of per-project tonnages equals the total CO₂e offset
   * (sum of all transaction quantities).
   */
  it('sum of per-project tonnages equals total offset', () => {
    fc.assert(
      fc.property(transactionListArb, (transactions) => {
        const breakdown = buildProjectBreakdown(transactions);
        const breakdownTotal = breakdown.reduce((sum, p) => sum + p.tonnage, 0);

        const totalOffset = computeTotalOffset(transactions);

        // Both should equal (within floating point tolerance due to rounding)
        expect(breakdownTotal).toBeCloseTo(totalOffset, 1);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 6.3**
   * Each project's tonnage equals the sum of its allocations across all transactions.
   */
  it('each projects tonnage equals sum of its allocations across all transactions', () => {
    fc.assert(
      fc.property(transactionListArb, (transactions) => {
        const breakdown = buildProjectBreakdown(transactions);

        // Manually compute expected per-project totals
        const expectedMap = new Map<string, number>();
        for (const txn of transactions) {
          for (const alloc of txn.projectAllocations) {
            const current = expectedMap.get(alloc.projectId) || 0;
            expectedMap.set(alloc.projectId, current + alloc.tonnage);
          }
        }

        // Verify each project in breakdown matches expected
        for (const project of breakdown) {
          const expected = expectedMap.get(project.projectId) || 0;
          expect(project.tonnage).toBeCloseTo(expected, 1);
        }

        // Verify all projects with allocations appear in breakdown
        for (const [projectId] of expectedMap) {
          const found = breakdown.find((p) => p.projectId === projectId);
          expect(found).toBeDefined();
        }
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 6.3**
   * Empty transactions produce an empty breakdown with 0 total.
   */
  it('empty transactions produce empty breakdown with zero total', () => {
    fc.assert(
      fc.property(fc.constant([] as PurchaseTransaction[]), (transactions) => {
        const breakdown = buildProjectBreakdown(transactions);
        const totalOffset = computeTotalOffset(transactions);

        expect(breakdown).toHaveLength(0);
        expect(totalOffset).toBe(0);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 6.3**
   * Number of projects in breakdown never exceeds the number of distinct
   * project IDs across all allocations.
   */
  it('breakdown contains exactly one entry per distinct project', () => {
    fc.assert(
      fc.property(transactionListArb, (transactions) => {
        const breakdown = buildProjectBreakdown(transactions);

        // Collect all distinct project IDs from allocations
        const distinctProjects = new Set<string>();
        for (const txn of transactions) {
          for (const alloc of txn.projectAllocations) {
            distinctProjects.add(alloc.projectId);
          }
        }

        expect(breakdown.length).toBe(distinctProjects.size);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 6.3**
   * All tonnage values in the breakdown are positive (since all allocations
   * have positive tonnage).
   */
  it('all project tonnages in breakdown are positive', () => {
    fc.assert(
      fc.property(transactionListArb, (transactions) => {
        const breakdown = buildProjectBreakdown(transactions);

        for (const project of breakdown) {
          expect(project.tonnage).toBeGreaterThan(0);
        }
      }),
      { numRuns: 200 }
    );
  });
});
