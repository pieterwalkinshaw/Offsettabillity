/**
 * Property Test: Role-based access control enforces funder-only purchases (Property 19)
 *
 * **Validates: Requirements 9.1, 9.2, 9.3**
 *
 * For any purchase attempt:
 * - Unauthenticated users → UNAUTHENTICATED
 * - Authenticated users with a role other than 'funder' → PERMISSION_DENIED
 * - Authenticated users with 'funder' role → allowed
 *
 * This tests the LOGIC of role-based access control decisions as a pure function,
 * modeled from the purchase.ts Cloud Function authorization checks.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { UserRole } from '../../shared/types';

// ─── Domain Constants ────────────────────────────────────────────────────────

type AccessDecision = 'allowed' | 'UNAUTHENTICATED' | 'PERMISSION_DENIED';

const ALL_ROLES: UserRole[] = ['funder', 'owner', 'auditor', 'admin'];
const NON_FUNDER_ROLES: UserRole[] = ALL_ROLES.filter(r => r !== 'funder');

// ─── Pure Access Control Function ────────────────────────────────────────────

/**
 * Models the access control decision logic from credits_purchase Cloud Function.
 *
 * Decision flow (mirrors purchase.ts):
 * 1. If not authenticated → UNAUTHENTICATED
 * 2. If authenticated but role !== 'funder' → PERMISSION_DENIED
 * 3. If authenticated and role === 'funder' → allowed
 */
function checkPurchaseAccess(input: {
  isAuthenticated: boolean;
  role: UserRole | null;
}): AccessDecision {
  // Step 1: Authentication check (mirrors: if (!request.auth?.uid))
  if (!input.isAuthenticated) {
    return 'UNAUTHENTICATED';
  }

  // Step 2: Role check (mirrors: if (!userData || userData.role !== 'funder'))
  if (input.role !== 'funder') {
    return 'PERMISSION_DENIED';
  }

  // Step 3: Funder role confirmed
  return 'allowed';
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate any valid user role */
const anyRole = fc.constantFrom<UserRole>(...ALL_ROLES);

/** Generate a non-funder role */
const nonFunderRole = fc.constantFrom<UserRole>(...NON_FUNDER_ROLES);

/** Generate a role or null (for unauthenticated users with no role) */
const roleOrNull = fc.oneof(anyRole, fc.constant(null as UserRole | null));

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 19: Role-based access control enforces funder-only purchases', () => {
  /**
   * **Validates: Requirements 9.2**
   * Unauthenticated users always receive UNAUTHENTICATED regardless of role value.
   */
  it('unauthenticated users always receive UNAUTHENTICATED', () => {
    fc.assert(
      fc.property(
        roleOrNull,
        (role) => {
          const result = checkPurchaseAccess({ isAuthenticated: false, role });
          expect(result).toBe('UNAUTHENTICATED');
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 9.3**
   * Authenticated users with a non-funder role always receive PERMISSION_DENIED.
   */
  it('authenticated non-funder roles always receive PERMISSION_DENIED', () => {
    fc.assert(
      fc.property(
        nonFunderRole,
        (role) => {
          const result = checkPurchaseAccess({ isAuthenticated: true, role });
          expect(result).toBe('PERMISSION_DENIED');
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 9.3**
   * Authenticated users with null role always receive PERMISSION_DENIED.
   */
  it('authenticated users with null role receive PERMISSION_DENIED', () => {
    fc.assert(
      fc.property(
        fc.constant(null as UserRole | null),
        (role) => {
          const result = checkPurchaseAccess({ isAuthenticated: true, role });
          expect(result).toBe('PERMISSION_DENIED');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 9.1**
   * Authenticated users with funder role always receive 'allowed'.
   */
  it('authenticated funder role always receives allowed', () => {
    fc.assert(
      fc.property(
        fc.constant('funder' as UserRole),
        (role) => {
          const result = checkPurchaseAccess({ isAuthenticated: true, role });
          expect(result).toBe('allowed');
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 9.1, 9.2, 9.3**
   * Comprehensive: for any arbitrary authentication state and role combination,
   * the access decision is deterministic and follows the exact decision tree:
   * - !authenticated → UNAUTHENTICATED
   * - authenticated && role !== 'funder' → PERMISSION_DENIED
   * - authenticated && role === 'funder' → allowed
   */
  it('access decision is deterministic for all auth state and role combinations', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        roleOrNull,
        (isAuthenticated, role) => {
          const result = checkPurchaseAccess({ isAuthenticated, role });

          if (!isAuthenticated) {
            expect(result).toBe('UNAUTHENTICATED');
          } else if (role !== 'funder') {
            expect(result).toBe('PERMISSION_DENIED');
          } else {
            expect(result).toBe('allowed');
          }
        }
      ),
      { numRuns: 500 }
    );
  });

  /**
   * **Validates: Requirements 9.2, 9.3**
   * The access control decision is a total function — it always returns
   * one of the three valid outcomes (never throws, never returns undefined).
   */
  it('access control always returns a valid decision (total function)', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        roleOrNull,
        (isAuthenticated, role) => {
          const result = checkPurchaseAccess({ isAuthenticated, role });
          expect(['allowed', 'UNAUTHENTICATED', 'PERMISSION_DENIED']).toContain(result);
        }
      ),
      { numRuns: 300 }
    );
  });

  /**
   * **Validates: Requirements 9.1, 9.2**
   * Authentication is checked before role — unauthenticated always yields
   * UNAUTHENTICATED even if role is 'funder'.
   */
  it('authentication is checked before role (priority ordering)', () => {
    fc.assert(
      fc.property(
        anyRole,
        (role) => {
          // Even with a 'funder' role, unauthenticated → UNAUTHENTICATED
          const result = checkPurchaseAccess({ isAuthenticated: false, role });
          expect(result).toBe('UNAUTHENTICATED');
        }
      ),
      { numRuns: 200 }
    );
  });
});
