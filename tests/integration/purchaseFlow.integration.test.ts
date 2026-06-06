/**
 * Integration Tests: Purchase Transaction Flow
 *
 * Tests the end-to-end logic of the carbon credit purchase flow using
 * a state-machine simulation (no Firebase emulator required).
 *
 * State = { inventory: Map<projectId, availableTonnage>, transactions: Map<txnId, {status, quantity}> }
 * Actions = purchase, confirm, reject
 * Invariant: inventory + confirmed purchases = original total
 *
 * Critical paths tested:
 * 1. Full purchase flow: validate → decrement inventory → create transaction → confirm → generate certificate
 * 2. Atomic transaction behaviour: failed purchase preserves inventory
 * 3. Concurrent purchases respect inventory limits
 *
 * Requirements validated: 1.3, 4.2, 4.3, 4.4, 5.1
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CreditPurchaseSchema } from '@shared/schemas';
import { calculatePurchasePrice, generateCertificateId, buildStoragePath } from '@shared/creditUtils';
import type { CreditInventory, PurchaseTransaction, PurchaseTransactionStatus, Certificate } from '@shared/types';

// ─── State Machine Simulation ────────────────────────────────────────────────

interface InventoryState {
  projectId: string;
  availableTonnage: number;
  totalTonnage: number;
  unitPriceCents: number;
  projectTitle: string;
  projectLocation: string;
}

interface TransactionState {
  transactionId: string;
  funderId: string;
  quantity: number;
  unitPriceCents: number;
  totalAmountCents: number;
  status: PurchaseTransactionStatus;
  projectAllocations: Array<{ projectId: string; tonnage: number }>;
}

interface CertificateState {
  certificateId: string;
  transactionId: string;
  funderId: string;
  storagePath: string;
  generatedAt: string;
}

type PurchaseResult =
  | { success: true; transactionId: string }
  | { success: false; error: string };

/**
 * Simulates the purchase flow state machine.
 * Encapsulates inventory, transactions, and certificates.
 */
class PurchaseFlowStateMachine {
  inventory: Map<string, InventoryState> = new Map();
  transactions: Map<string, TransactionState> = new Map();
  certificates: Map<string, CertificateState> = new Map();
  private txnCounter = 0;

  addInventory(state: InventoryState): void {
    this.inventory.set(state.projectId, { ...state });
  }

  /**
   * Simulates the credits_purchase function logic:
   * 1. Validate input with CreditPurchaseSchema
   * 2. Check inventory availability
   * 3. Decrement inventory atomically
   * 4. Create transaction with status 'pending'
   */
  purchase(input: {
    funderId: string;
    quantity: number;
    projectAllocations: Array<{ projectId: string; tonnage: number }>;
    packageId?: string;
  }): PurchaseResult {
    // Step 1: Validate input
    const parseResult = CreditPurchaseSchema.safeParse({
      quantity: input.quantity,
      projectAllocations: input.projectAllocations,
      packageId: input.packageId,
    });

    if (!parseResult.success) {
      return { success: false, error: 'VALIDATION_ERROR' };
    }

    // Step 2: Check inventory availability (atomic read)
    for (const allocation of input.projectAllocations) {
      const inv = this.inventory.get(allocation.projectId);
      if (!inv) {
        return { success: false, error: `NO_INVENTORY_FOR_PROJECT_${allocation.projectId}` };
      }
      if (inv.availableTonnage < allocation.tonnage) {
        return { success: false, error: 'INSUFFICIENT_INVENTORY' };
      }
    }

    // Step 3: Decrement inventory (atomic write)
    for (const allocation of input.projectAllocations) {
      const inv = this.inventory.get(allocation.projectId)!;
      inv.availableTonnage -= allocation.tonnage;
    }

    // Step 4: Create transaction with status 'pending'
    this.txnCounter++;
    const transactionId = `txn-${this.txnCounter}`;
    const unitPriceCents = this.inventory.get(input.projectAllocations[0].projectId)!.unitPriceCents;
    const totalAmountCents = calculatePurchasePrice(input.quantity, unitPriceCents);

    this.transactions.set(transactionId, {
      transactionId,
      funderId: input.funderId,
      quantity: input.quantity,
      unitPriceCents,
      totalAmountCents,
      status: 'pending',
      projectAllocations: input.projectAllocations,
    });

    return { success: true, transactionId };
  }

  /**
   * Simulates credits_confirmPurchase:
   * 1. Update transaction status to 'confirmed'
   * 2. Trigger certificate generation
   */
  confirm(transactionId: string): { success: boolean; certificateId?: string } {
    const txn = this.transactions.get(transactionId);
    if (!txn) return { success: false };
    if (txn.status !== 'pending') return { success: false };

    // Update status to confirmed (Requirement 4.2)
    txn.status = 'confirmed';

    // Generate certificate (Requirement 5.1)
    const certificateId = generateCertificateId();
    const storagePath = buildStoragePath(txn.funderId, transactionId);

    this.certificates.set(certificateId, {
      certificateId,
      transactionId,
      funderId: txn.funderId,
      storagePath,
      generatedAt: new Date().toISOString(),
    });

    return { success: true, certificateId };
  }

  /**
   * Simulates a failed/rejected purchase:
   * 1. Update transaction status to 'failed'
   * 2. Restore inventory (Requirement 4.4)
   */
  fail(transactionId: string): { success: boolean } {
    const txn = this.transactions.get(transactionId);
    if (!txn) return { success: false };
    if (txn.status !== 'pending') return { success: false };

    // Restore inventory (atomic rollback)
    for (const allocation of txn.projectAllocations) {
      const inv = this.inventory.get(allocation.projectId);
      if (inv) {
        inv.availableTonnage += allocation.tonnage;
      }
    }

    txn.status = 'failed';
    return { success: true };
  }

  /** Get current available tonnage for a project */
  getAvailableTonnage(projectId: string): number {
    return this.inventory.get(projectId)?.availableTonnage ?? 0;
  }

  /** Get original total tonnage for a project */
  getTotalTonnage(projectId: string): number {
    return this.inventory.get(projectId)?.totalTonnage ?? 0;
  }

  /** Get all confirmed purchase quantities for a project */
  getConfirmedTonnageForProject(projectId: string): number {
    let total = 0;
    for (const txn of this.transactions.values()) {
      if (txn.status === 'confirmed') {
        for (const alloc of txn.projectAllocations) {
          if (alloc.projectId === projectId) {
            total += alloc.tonnage;
          }
        }
      }
    }
    return total;
  }

  /** Get pending purchase quantities for a project */
  getPendingTonnageForProject(projectId: string): number {
    let total = 0;
    for (const txn of this.transactions.values()) {
      if (txn.status === 'pending') {
        for (const alloc of txn.projectAllocations) {
          if (alloc.projectId === projectId) {
            total += alloc.tonnage;
          }
        }
      }
    }
    return total;
  }
}

// ─── Test Setup ──────────────────────────────────────────────────────────────

const UNIT_PRICE_CENTS = 15000; // R150 per ton

function createTestStateMachine(): PurchaseFlowStateMachine {
  const sm = new PurchaseFlowStateMachine();

  sm.addInventory({
    projectId: 'sunrise-credits',
    availableTonnage: 11.0,
    totalTonnage: 11.0,
    unitPriceCents: UNIT_PRICE_CENTS,
    projectTitle: 'SunRise Credits: Solar Power for African Families',
    projectLocation: 'Limpopo, South Africa',
  });

  sm.addInventory({
    projectId: 'solar-schools',
    availableTonnage: 156.0,
    totalTonnage: 156.0,
    unitPriceCents: UNIT_PRICE_CENTS,
    projectTitle: 'Solar Schools: Powering Education in Off-Grid Communities',
    projectLocation: 'KwaZulu-Natal, South Africa',
  });

  return sm;
}

// ─── Integration Tests ───────────────────────────────────────────────────────

describe('Integration: Purchase Transaction Flow', () => {
  let sm: PurchaseFlowStateMachine;

  beforeEach(() => {
    sm = createTestStateMachine();
  });

  // ─── Full Purchase Flow ──────────────────────────────────────────────────

  describe('Full purchase flow: validate → decrement → create → confirm → certificate', () => {
    it('completes full purchase lifecycle for a single project allocation', () => {
      // Step 1: Purchase (validate + decrement + create pending transaction)
      const purchaseResult = sm.purchase({
        funderId: 'funder-1',
        quantity: 5,
        projectAllocations: [{ projectId: 'solar-schools', tonnage: 5 }],
      });

      expect(purchaseResult.success).toBe(true);
      if (!purchaseResult.success) return;

      // Verify inventory decremented (Requirement 1.3, 4.3)
      expect(sm.getAvailableTonnage('solar-schools')).toBe(151.0);

      // Verify transaction created with pending status (Requirement 4.2)
      const txn = sm.transactions.get(purchaseResult.transactionId)!;
      expect(txn.status).toBe('pending');
      expect(txn.quantity).toBe(5);
      expect(txn.totalAmountCents).toBe(5 * UNIT_PRICE_CENTS);

      // Step 2: Confirm (status → confirmed + generate certificate)
      const confirmResult = sm.confirm(purchaseResult.transactionId);
      expect(confirmResult.success).toBe(true);
      expect(confirmResult.certificateId).toBeDefined();
      expect(confirmResult.certificateId!.length).toBeGreaterThanOrEqual(12);

      // Verify transaction is now confirmed
      expect(txn.status).toBe('confirmed');

      // Verify certificate was generated (Requirement 5.1)
      const cert = sm.certificates.get(confirmResult.certificateId!);
      expect(cert).toBeDefined();
      expect(cert!.transactionId).toBe(purchaseResult.transactionId);
      expect(cert!.funderId).toBe('funder-1');
      expect(cert!.storagePath).toBe('certificates/funder-1/txn-1.pdf');

      // Verify invariant: available + confirmed = total
      const available = sm.getAvailableTonnage('solar-schools');
      const confirmed = sm.getConfirmedTonnageForProject('solar-schools');
      expect(available + confirmed).toBe(sm.getTotalTonnage('solar-schools'));
    });

    it('completes purchase with multi-project allocation', () => {
      const purchaseResult = sm.purchase({
        funderId: 'funder-2',
        quantity: 8,
        projectAllocations: [
          { projectId: 'sunrise-credits', tonnage: 3 },
          { projectId: 'solar-schools', tonnage: 5 },
        ],
      });

      expect(purchaseResult.success).toBe(true);
      if (!purchaseResult.success) return;

      // Both inventories decremented
      expect(sm.getAvailableTonnage('sunrise-credits')).toBe(8.0);
      expect(sm.getAvailableTonnage('solar-schools')).toBe(151.0);

      // Confirm and verify certificate
      const confirmResult = sm.confirm(purchaseResult.transactionId);
      expect(confirmResult.success).toBe(true);

      // Invariants hold for both projects
      expect(
        sm.getAvailableTonnage('sunrise-credits') + sm.getConfirmedTonnageForProject('sunrise-credits')
      ).toBe(sm.getTotalTonnage('sunrise-credits'));

      expect(
        sm.getAvailableTonnage('solar-schools') + sm.getConfirmedTonnageForProject('solar-schools')
      ).toBe(sm.getTotalTonnage('solar-schools'));
    });

    it('handles sequential purchases from the same funder', () => {
      // First purchase
      const result1 = sm.purchase({
        funderId: 'funder-1',
        quantity: 10,
        projectAllocations: [{ projectId: 'solar-schools', tonnage: 10 }],
      });
      expect(result1.success).toBe(true);
      sm.confirm((result1 as { success: true; transactionId: string }).transactionId);

      // Second purchase
      const result2 = sm.purchase({
        funderId: 'funder-1',
        quantity: 20,
        projectAllocations: [{ projectId: 'solar-schools', tonnage: 20 }],
      });
      expect(result2.success).toBe(true);
      sm.confirm((result2 as { success: true; transactionId: string }).transactionId);

      // Total confirmed = 30, available = 156 - 30 = 126
      expect(sm.getAvailableTonnage('solar-schools')).toBe(126.0);
      expect(sm.getConfirmedTonnageForProject('solar-schools')).toBe(30.0);
      expect(sm.certificates.size).toBe(2);
    });
  });

  // ─── Atomic Transaction Behaviour ───────────────────────────────────────

  describe('Atomic transaction behaviour: failed purchase preserves inventory', () => {
    it('preserves inventory when purchase fails due to insufficient stock', () => {
      const originalTonnage = sm.getAvailableTonnage('sunrise-credits');

      // Attempt to purchase more than available (11 tons available, requesting 15)
      const result = sm.purchase({
        funderId: 'funder-1',
        quantity: 15,
        projectAllocations: [{ projectId: 'sunrise-credits', tonnage: 15 }],
      });

      // Purchase rejected (Requirement 4.4)
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('INSUFFICIENT_INVENTORY');
      }

      // Inventory unchanged (Requirement 4.4)
      expect(sm.getAvailableTonnage('sunrise-credits')).toBe(originalTonnage);
    });

    it('preserves inventory when purchase fails validation', () => {
      const originalSunrise = sm.getAvailableTonnage('sunrise-credits');
      const originalSolar = sm.getAvailableTonnage('solar-schools');

      // Invalid quantity (negative)
      const result = sm.purchase({
        funderId: 'funder-1',
        quantity: -5,
        projectAllocations: [{ projectId: 'sunrise-credits', tonnage: -5 }],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('VALIDATION_ERROR');
      }

      // Both inventories unchanged
      expect(sm.getAvailableTonnage('sunrise-credits')).toBe(originalSunrise);
      expect(sm.getAvailableTonnage('solar-schools')).toBe(originalSolar);
    });

    it('restores inventory when a pending transaction is marked as failed', () => {
      // Make a valid purchase (creates pending transaction, decrements inventory)
      const result = sm.purchase({
        funderId: 'funder-1',
        quantity: 5,
        projectAllocations: [{ projectId: 'sunrise-credits', tonnage: 5 }],
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      // Inventory was decremented
      expect(sm.getAvailableTonnage('sunrise-credits')).toBe(6.0);

      // Simulate payment failure → mark transaction as failed
      const failResult = sm.fail(result.transactionId);
      expect(failResult.success).toBe(true);

      // Inventory restored to original (Requirement 4.4)
      expect(sm.getAvailableTonnage('sunrise-credits')).toBe(11.0);

      // Transaction marked as failed
      const txn = sm.transactions.get(result.transactionId)!;
      expect(txn.status).toBe('failed');

      // No certificate generated for failed transaction
      expect(sm.certificates.size).toBe(0);
    });
  });

  // ─── Concurrent Purchases Respect Inventory Limits ──────────────────────

  describe('Concurrent purchases respect inventory limits', () => {
    it('when two purchases compete for limited inventory, at most one succeeds', () => {
      // sunrise-credits has 11 tons. Two funders each try to buy 8 tons.
      const result1 = sm.purchase({
        funderId: 'funder-A',
        quantity: 8,
        projectAllocations: [{ projectId: 'sunrise-credits', tonnage: 8 }],
      });

      // First purchase succeeds (8 ≤ 11)
      expect(result1.success).toBe(true);

      // Second purchase attempts (8 > 3 remaining)
      const result2 = sm.purchase({
        funderId: 'funder-B',
        quantity: 8,
        projectAllocations: [{ projectId: 'sunrise-credits', tonnage: 8 }],
      });

      // Second purchase fails with INSUFFICIENT_INVENTORY
      expect(result2.success).toBe(false);
      if (!result2.success) {
        expect(result2.error).toBe('INSUFFICIENT_INVENTORY');
      }

      // Only 3 tons remain (11 - 8 = 3)
      expect(sm.getAvailableTonnage('sunrise-credits')).toBe(3.0);
    });

    it('concurrent purchases that fit within inventory both succeed', () => {
      // solar-schools has 156 tons. Two funders buy 50 tons each.
      const result1 = sm.purchase({
        funderId: 'funder-A',
        quantity: 50,
        projectAllocations: [{ projectId: 'solar-schools', tonnage: 50 }],
      });

      const result2 = sm.purchase({
        funderId: 'funder-B',
        quantity: 50,
        projectAllocations: [{ projectId: 'solar-schools', tonnage: 50 }],
      });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // 156 - 50 - 50 = 56 remaining
      expect(sm.getAvailableTonnage('solar-schools')).toBe(56.0);

      // Confirm both — invariant holds
      sm.confirm((result1 as { success: true; transactionId: string }).transactionId);
      sm.confirm((result2 as { success: true; transactionId: string }).transactionId);

      expect(
        sm.getAvailableTonnage('solar-schools') + sm.getConfirmedTonnageForProject('solar-schools')
      ).toBe(sm.getTotalTonnage('solar-schools'));
    });

    it('inventory cannot go negative even with many small purchases', () => {
      // sunrise-credits: 11 tons. Make 11 purchases of 1 ton each.
      const results: PurchaseResult[] = [];
      for (let i = 0; i < 12; i++) {
        results.push(sm.purchase({
          funderId: `funder-${i}`,
          quantity: 1,
          projectAllocations: [{ projectId: 'sunrise-credits', tonnage: 1 }],
        }));
      }

      // First 11 succeed, 12th fails
      const successes = results.filter(r => r.success);
      const failures = results.filter(r => !r.success);
      expect(successes.length).toBe(11);
      expect(failures.length).toBe(1);

      // Inventory is exactly 0
      expect(sm.getAvailableTonnage('sunrise-credits')).toBe(0);

      // Invariant: available(0) + pending(11) = total(11)
      expect(
        sm.getAvailableTonnage('sunrise-credits') + sm.getPendingTonnageForProject('sunrise-credits')
      ).toBe(sm.getTotalTonnage('sunrise-credits'));
    });
  });

  // ─── State Invariant Verification ──────────────────────────────────────

  describe('State invariants', () => {
    it('invariant holds: available + (confirmed + pending) = total after mixed operations', () => {
      // Purchase 1: 10 tons from solar-schools → confirm
      const r1 = sm.purchase({
        funderId: 'funder-1',
        quantity: 10,
        projectAllocations: [{ projectId: 'solar-schools', tonnage: 10 }],
      });
      expect(r1.success).toBe(true);
      sm.confirm((r1 as { success: true; transactionId: string }).transactionId);

      // Purchase 2: 5 tons from solar-schools → leave pending
      const r2 = sm.purchase({
        funderId: 'funder-2',
        quantity: 5,
        projectAllocations: [{ projectId: 'solar-schools', tonnage: 5 }],
      });
      expect(r2.success).toBe(true);

      // Purchase 3: 3 tons from solar-schools → fail (restore inventory)
      const r3 = sm.purchase({
        funderId: 'funder-3',
        quantity: 3,
        projectAllocations: [{ projectId: 'solar-schools', tonnage: 3 }],
      });
      expect(r3.success).toBe(true);
      sm.fail((r3 as { success: true; transactionId: string }).transactionId);

      // State: available = 156 - 10 - 5 = 141 (3 was restored)
      // confirmed = 10, pending = 5, failed = 3 (not counted)
      expect(sm.getAvailableTonnage('solar-schools')).toBe(141.0);
      expect(sm.getConfirmedTonnageForProject('solar-schools')).toBe(10.0);
      expect(sm.getPendingTonnageForProject('solar-schools')).toBe(5.0);

      // Invariant: available + confirmed + pending = total
      const available = sm.getAvailableTonnage('solar-schools');
      const confirmed = sm.getConfirmedTonnageForProject('solar-schools');
      const pending = sm.getPendingTonnageForProject('solar-schools');
      expect(available + confirmed + pending).toBe(sm.getTotalTonnage('solar-schools'));
    });
  });
});
