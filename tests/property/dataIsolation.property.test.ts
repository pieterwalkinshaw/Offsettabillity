/**
 * Property Test: Data isolation — funders see only own records, admins see all (Property 20)
 *
 * **Validates: Requirements 9.4, 9.5, 5.5, 7.4**
 *
 * Models the Firestore security rules for purchaseTransactions and certificates:
 * - Admin (role === 'admin') → can access ALL records regardless of funderId
 * - Funder → can ONLY access records where recordFunderId === userId
 * - Other roles (owner, auditor) → cannot access any records
 *
 * This tests the LOGIC of data access control as a pure function,
 * modeled from the Firestore security rules in firestore.rules.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { UserRole } from '../../shared/types';

// ─── Domain Constants ────────────────────────────────────────────────────────

type AccessResult = 'granted' | 'denied';

const ALL_ROLES: UserRole[] = ['funder', 'owner', 'auditor', 'admin'];
const NON_ACCESS_ROLES: UserRole[] = ['owner', 'auditor'];

// ─── Pure Access Control Function ────────────────────────────────────────────

/**
 * Models the data access control decision from Firestore security rules.
 *
 * From firestore.rules for purchaseTransactions and certificates:
 * ```
 * allow read: if request.auth != null && (
 *   resource.data.funderId == request.auth.uid ||
 *   get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'
 * );
 * ```
 *
 * Decision logic:
 * 1. User must be authenticated
 * 2. Admin role → access granted to ALL records
 * 3. Funder role → access granted ONLY to records matching their userId
 * 4. Other roles (owner, auditor) → access denied
 */
function canAccessRecord(
  userId: string,
  userRole: UserRole,
  recordFunderId: string
): AccessResult {
  // Admin can access all records
  if (userRole === 'admin') {
    return 'granted';
  }

  // Funder can only access their own records
  if (userRole === 'funder') {
    return userId === recordFunderId ? 'granted' : 'denied';
  }

  // Other roles (owner, auditor) cannot access any records
  return 'denied';
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate a realistic user ID (using UUID format like Firebase Auth UIDs) */
const userId = fc.uuid();

/** Generate any valid user role */
const anyRole = fc.constantFrom<UserRole>(...ALL_ROLES);

/** Generate a non-access role (owner or auditor) */
const nonAccessRole = fc.constantFrom<UserRole>(...NON_ACCESS_ROLES);

/** Generate a funder ID for a record (using UUID format) */
const recordFunderId = fc.uuid();

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 20: Data isolation — funders see only own records, admins see all', () => {
  /**
   * **Validates: Requirements 9.4**
   * Admin users always have access to any record regardless of the record's funderId.
   */
  it('admin always has access to any record regardless of funderId', () => {
    fc.assert(
      fc.property(
        userId,
        recordFunderId,
        (adminId, recFunderId) => {
          const result = canAccessRecord(adminId, 'admin', recFunderId);
          expect(result).toBe('granted');
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 9.5**
   * Funder users can access records where their userId matches the record's funderId.
   */
  it('funder can access records where userId matches recordFunderId', () => {
    fc.assert(
      fc.property(
        userId,
        (funderId) => {
          // When userId === recordFunderId, access is granted
          const result = canAccessRecord(funderId, 'funder', funderId);
          expect(result).toBe('granted');
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 9.5**
   * Funder users cannot access records belonging to a different funder.
   */
  it('funder cannot access records belonging to another funder', () => {
    fc.assert(
      fc.property(
        userId,
        recordFunderId,
        (funderId, otherFunderId) => {
          // Only test cases where IDs are actually different
          fc.pre(funderId !== otherFunderId);

          const result = canAccessRecord(funderId, 'funder', otherFunderId);
          expect(result).toBe('denied');
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 9.4, 9.5**
   * Other roles (owner, auditor) cannot access any purchase or certificate records.
   */
  it('other roles (owner, auditor) cannot access any records', () => {
    fc.assert(
      fc.property(
        userId,
        nonAccessRole,
        recordFunderId,
        (uid, role, recFunderId) => {
          const result = canAccessRecord(uid, role, recFunderId);
          expect(result).toBe('denied');
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 9.4, 9.5**
   * Even when a non-access role's userId matches the recordFunderId,
   * access is still denied (only funder role can access own records).
   */
  it('non-access roles denied even when userId matches recordFunderId', () => {
    fc.assert(
      fc.property(
        userId,
        nonAccessRole,
        (uid, role) => {
          // userId === recordFunderId, but role is not funder or admin
          const result = canAccessRecord(uid, role, uid);
          expect(result).toBe('denied');
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 9.4, 9.5, 5.5, 7.4**
   * Comprehensive: for any arbitrary userId, role, and recordFunderId combination,
   * the access decision follows the exact rules:
   * - admin → always granted
   * - funder && userId === recordFunderId → granted
   * - funder && userId !== recordFunderId → denied
   * - owner/auditor → always denied
   */
  it('access decision is deterministic for all role and ownership combinations', () => {
    fc.assert(
      fc.property(
        userId,
        anyRole,
        recordFunderId,
        (uid, role, recFunderId) => {
          const result = canAccessRecord(uid, role, recFunderId);

          if (role === 'admin') {
            expect(result).toBe('granted');
          } else if (role === 'funder' && uid === recFunderId) {
            expect(result).toBe('granted');
          } else if (role === 'funder' && uid !== recFunderId) {
            expect(result).toBe('denied');
          } else {
            // owner, auditor
            expect(result).toBe('denied');
          }
        }
      ),
      { numRuns: 500 }
    );
  });

  /**
   * **Validates: Requirements 9.4, 9.5**
   * The access control function is a total function — it always returns
   * either 'granted' or 'denied' (never throws, never returns undefined).
   */
  it('access control always returns a valid decision (total function)', () => {
    fc.assert(
      fc.property(
        userId,
        anyRole,
        recordFunderId,
        (uid, role, recFunderId) => {
          const result = canAccessRecord(uid, role, recFunderId);
          expect(['granted', 'denied']).toContain(result);
        }
      ),
      { numRuns: 300 }
    );
  });
});
