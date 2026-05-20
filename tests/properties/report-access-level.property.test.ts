/**
 * Property Test: Report access level enforcement (Property 30)
 *
 * Validates: Requirements 9.2, 9.3
 *
 * For any report with accessLevel "public", all users (including unauthenticated)
 * SHALL have access. For accessLevel "gated", access SHALL require email submission
 * and lead capture. For accessLevel "private", only the funding funder and admin
 * roles SHALL have access.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { ReportAccessLevel, UserRole } from '../../shared/types';

// ─── Domain Constants ────────────────────────────────────────────────────────

const ALL_ACCESS_LEVELS: ReportAccessLevel[] = ['public', 'gated', 'private'];
const ALL_ROLES: (UserRole | 'unauthenticated')[] = ['funder', 'owner', 'auditor', 'admin', 'unauthenticated'];
const PRIVATE_ALLOWED_ROLES: (UserRole | 'unauthenticated')[] = ['funder', 'admin'];
const PRIVATE_DENIED_ROLES: (UserRole | 'unauthenticated')[] = ['owner', 'auditor', 'unauthenticated'];

// ─── Helper Function ─────────────────────────────────────────────────────────

/**
 * Determines whether a user can access a report based on its access level.
 *
 * Rules:
 * - "public": all users (including unauthenticated) have access
 * - "gated": access requires email submission (hasEmail must be true)
 * - "private": only the funder who funded the project (hasFundedProject=true)
 *   and admin roles have access
 *
 * @param accessLevel - The report's access level
 * @param userRole - The user's role (or 'unauthenticated')
 * @param hasFundedProject - Whether the user has funded the specific project
 * @param hasEmail - Whether the user has submitted an email (for gated access)
 * @returns true if access is granted, false otherwise
 */
function canAccessReport(
  accessLevel: ReportAccessLevel,
  userRole: UserRole | 'unauthenticated',
  hasFundedProject: boolean,
  hasEmail: boolean
): boolean {
  switch (accessLevel) {
    case 'public':
      // Public reports are accessible to everyone
      return true;

    case 'gated':
      // Gated reports require email submission for lead capture
      return hasEmail;

    case 'private':
      // Private reports: only admin or funder who funded the project
      if (userRole === 'admin') return true;
      if (userRole === 'funder' && hasFundedProject) return true;
      return false;

    default:
      return false;
  }
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate any access level */
const anyAccessLevel = fc.constantFrom<ReportAccessLevel>(...ALL_ACCESS_LEVELS);

/** Generate any user role (including unauthenticated) */
const anyRole = fc.constantFrom<UserRole | 'unauthenticated'>(...ALL_ROLES);

/** Generate a role that is allowed for private reports */
const privateAllowedRole = fc.constantFrom<UserRole | 'unauthenticated'>(...PRIVATE_ALLOWED_ROLES);

/** Generate a role that is denied for private reports */
const privateDeniedRole = fc.constantFrom<UserRole | 'unauthenticated'>(...PRIVATE_DENIED_ROLES);

/** Generate a valid email string */
const validEmail = fc.emailAddress();

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 30: Report access level enforcement', () => {
  /**
   * **Validates: Requirements 9.2**
   * Public reports: all users can access regardless of role, funding status, or email
   */
  it('public reports are accessible to all users including unauthenticated', () => {
    fc.assert(
      fc.property(
        anyRole,
        fc.boolean(),
        fc.boolean(),
        (role, hasFundedProject, hasEmail) => {
          const result = canAccessReport('public', role, hasFundedProject, hasEmail);
          expect(result).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 9.3**
   * Gated reports: access granted when email is provided
   */
  it('gated reports grant access when email is provided', () => {
    fc.assert(
      fc.property(
        anyRole,
        fc.boolean(),
        (role, hasFundedProject) => {
          const result = canAccessReport('gated', role, hasFundedProject, true);
          expect(result).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 9.3**
   * Gated reports: access denied when email is NOT provided
   */
  it('gated reports deny access when email is not provided', () => {
    fc.assert(
      fc.property(
        anyRole,
        fc.boolean(),
        (role, hasFundedProject) => {
          const result = canAccessReport('gated', role, hasFundedProject, false);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 9.2**
   * Private reports: funder who funded the project can access
   */
  it('private reports grant access to funder who funded the project', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (hasEmail) => {
          const result = canAccessReport('private', 'funder', true, hasEmail);
          expect(result).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 9.2**
   * Private reports: admin can always access
   */
  it('private reports grant access to admin role', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        (hasFundedProject, hasEmail) => {
          const result = canAccessReport('private', 'admin', hasFundedProject, hasEmail);
          expect(result).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 9.2**
   * Private reports: funder who has NOT funded the project is denied
   */
  it('private reports deny access to funder who has not funded the project', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (hasEmail) => {
          const result = canAccessReport('private', 'funder', false, hasEmail);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 9.2**
   * Private reports: owner, auditor, and unauthenticated users are denied
   */
  it('private reports deny access to owner, auditor, and unauthenticated users', () => {
    fc.assert(
      fc.property(
        privateDeniedRole,
        fc.boolean(),
        fc.boolean(),
        (role, hasFundedProject, hasEmail) => {
          const result = canAccessReport('private', role, hasFundedProject, hasEmail);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 9.2, 9.3**
   * Comprehensive: for any random combination of access level, role, funding status,
   * and email status, the canAccessReport function returns the correct result based
   * on the access level enforcement rules.
   */
  it('enforces correct access for any combination of access level, role, funding, and email', () => {
    fc.assert(
      fc.property(
        anyAccessLevel,
        anyRole,
        fc.boolean(),
        fc.boolean(),
        (accessLevel, role, hasFundedProject, hasEmail) => {
          const result = canAccessReport(accessLevel, role, hasFundedProject, hasEmail);

          // Compute expected result independently
          let expected: boolean;
          if (accessLevel === 'public') {
            expected = true;
          } else if (accessLevel === 'gated') {
            expected = hasEmail;
          } else {
            // private
            expected = role === 'admin' || (role === 'funder' && hasFundedProject);
          }

          expect(result).toBe(expected);
        }
      ),
      { numRuns: 500 }
    );
  });
});
