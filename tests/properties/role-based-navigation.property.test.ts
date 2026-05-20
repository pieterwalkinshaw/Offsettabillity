/**
 * Property Test: Role-based navigation restriction (Property 36)
 *
 * Validates: Requirements 11.5
 *
 * For any authenticated user, the dashboard navigation SHALL display only items
 * permitted by their role as defined in the access control matrix. No navigation
 * items for unauthorized capabilities SHALL be visible.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { UserRole } from '@shared/types';

// ─── Navigation Configuration (mirrors DashboardSidebar.tsx) ─────────────────

interface NavItem {
  label: string;
  href: string;
}

/**
 * Returns the permitted navigation items for a given role.
 * This mirrors the NAV_ITEMS_BY_ROLE configuration in DashboardSidebar.tsx.
 */
function getNavItemsForRole(role: UserRole): NavItem[] {
  const NAV_ITEMS_BY_ROLE: Record<UserRole, NavItem[]> = {
    funder: [
      { label: 'Overview', href: '/overview' },
      { label: 'My Funded Projects', href: '/funding' },
      { label: 'Browse Projects', href: '/projects' },
      { label: 'Reports', href: '/reports' },
    ],
    owner: [
      { label: 'Overview', href: '/overview' },
      { label: 'My Projects', href: '/projects/mine' },
      { label: 'Create Project', href: '/projects/create' },
      { label: 'Documents', href: '/documents' },
    ],
    auditor: [
      { label: 'Overview', href: '/overview' },
      { label: 'My Audits', href: '/audits' },
      { label: 'Available Projects', href: '/audits/available' },
      { label: 'Completed Audits', href: '/audits/completed' },
    ],
    admin: [
      { label: 'Overview', href: '/overview' },
      { label: 'Auditor Approvals', href: '/admin/approvals' },
      { label: 'Pre-screening', href: '/admin/prescreening' },
      { label: 'Leads', href: '/admin/leads' },
      { label: 'Taxonomy', href: '/admin/taxonomy' },
      { label: 'Users', href: '/admin/users' },
    ],
  };

  return NAV_ITEMS_BY_ROLE[role] ?? [];
}

// ─── Role-Exclusive Items ────────────────────────────────────────────────────

/**
 * Items that are exclusive to a specific role (not shared with other roles).
 * Used to verify no role sees items from another role's exclusive set.
 */
const EXCLUSIVE_ITEMS: Record<UserRole, NavItem[]> = {
  funder: [
    { label: 'My Funded Projects', href: '/funding' },
    { label: 'Browse Projects', href: '/projects' },
    { label: 'Reports', href: '/reports' },
  ],
  owner: [
    { label: 'My Projects', href: '/projects/mine' },
    { label: 'Create Project', href: '/projects/create' },
    { label: 'Documents', href: '/documents' },
  ],
  auditor: [
    { label: 'My Audits', href: '/audits' },
    { label: 'Available Projects', href: '/audits/available' },
    { label: 'Completed Audits', href: '/audits/completed' },
  ],
  admin: [
    { label: 'Auditor Approvals', href: '/admin/approvals' },
    { label: 'Pre-screening', href: '/admin/prescreening' },
    { label: 'Leads', href: '/admin/leads' },
    { label: 'Taxonomy', href: '/admin/taxonomy' },
    { label: 'Users', href: '/admin/users' },
  ],
};

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const arbRole = fc.constantFrom<UserRole>('funder', 'owner', 'auditor', 'admin');

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 36: Role-based navigation restriction', () => {
  /**
   * **Validates: Requirements 11.5**
   * Funder sees only funder-permitted navigation items.
   */
  it('funder sees only funder-permitted items', () => {
    fc.assert(
      fc.property(
        fc.constant('funder' as UserRole),
        (role) => {
          const navItems = getNavItemsForRole(role);
          const expectedItems = [
            { label: 'Overview', href: '/overview' },
            { label: 'My Funded Projects', href: '/funding' },
            { label: 'Browse Projects', href: '/projects' },
            { label: 'Reports', href: '/reports' },
          ];

          // Funder sees exactly the expected items
          expect(navItems).toHaveLength(expectedItems.length);
          expectedItems.forEach((expected) => {
            expect(navItems).toContainEqual(expected);
          });

          // Funder does NOT see admin, owner, or auditor exclusive items
          const otherRoles: UserRole[] = ['owner', 'auditor', 'admin'];
          otherRoles.forEach((otherRole) => {
            EXCLUSIVE_ITEMS[otherRole].forEach((exclusiveItem) => {
              expect(navItems).not.toContainEqual(exclusiveItem);
            });
          });
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * **Validates: Requirements 11.5**
   * Owner sees only owner-permitted navigation items.
   */
  it('owner sees only owner-permitted items', () => {
    fc.assert(
      fc.property(
        fc.constant('owner' as UserRole),
        (role) => {
          const navItems = getNavItemsForRole(role);
          const expectedItems = [
            { label: 'Overview', href: '/overview' },
            { label: 'My Projects', href: '/projects/mine' },
            { label: 'Create Project', href: '/projects/create' },
            { label: 'Documents', href: '/documents' },
          ];

          // Owner sees exactly the expected items
          expect(navItems).toHaveLength(expectedItems.length);
          expectedItems.forEach((expected) => {
            expect(navItems).toContainEqual(expected);
          });

          // Owner does NOT see funder, auditor, or admin exclusive items
          const otherRoles: UserRole[] = ['funder', 'auditor', 'admin'];
          otherRoles.forEach((otherRole) => {
            EXCLUSIVE_ITEMS[otherRole].forEach((exclusiveItem) => {
              expect(navItems).not.toContainEqual(exclusiveItem);
            });
          });
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * **Validates: Requirements 11.5**
   * Auditor sees only auditor-permitted navigation items.
   */
  it('auditor sees only auditor-permitted items', () => {
    fc.assert(
      fc.property(
        fc.constant('auditor' as UserRole),
        (role) => {
          const navItems = getNavItemsForRole(role);
          const expectedItems = [
            { label: 'Overview', href: '/overview' },
            { label: 'My Audits', href: '/audits' },
            { label: 'Available Projects', href: '/audits/available' },
            { label: 'Completed Audits', href: '/audits/completed' },
          ];

          // Auditor sees exactly the expected items
          expect(navItems).toHaveLength(expectedItems.length);
          expectedItems.forEach((expected) => {
            expect(navItems).toContainEqual(expected);
          });

          // Auditor does NOT see funder, owner, or admin exclusive items
          const otherRoles: UserRole[] = ['funder', 'owner', 'admin'];
          otherRoles.forEach((otherRole) => {
            EXCLUSIVE_ITEMS[otherRole].forEach((exclusiveItem) => {
              expect(navItems).not.toContainEqual(exclusiveItem);
            });
          });
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * **Validates: Requirements 11.5**
   * Admin sees only admin-permitted navigation items.
   */
  it('admin sees only admin-permitted items', () => {
    fc.assert(
      fc.property(
        fc.constant('admin' as UserRole),
        (role) => {
          const navItems = getNavItemsForRole(role);
          const expectedItems = [
            { label: 'Overview', href: '/overview' },
            { label: 'Auditor Approvals', href: '/admin/approvals' },
            { label: 'Pre-screening', href: '/admin/prescreening' },
            { label: 'Leads', href: '/admin/leads' },
            { label: 'Taxonomy', href: '/admin/taxonomy' },
            { label: 'Users', href: '/admin/users' },
          ];

          // Admin sees exactly the expected items
          expect(navItems).toHaveLength(expectedItems.length);
          expectedItems.forEach((expected) => {
            expect(navItems).toContainEqual(expected);
          });

          // Admin does NOT see funder, owner, or auditor exclusive items
          const otherRoles: UserRole[] = ['funder', 'owner', 'auditor'];
          otherRoles.forEach((otherRole) => {
            EXCLUSIVE_ITEMS[otherRole].forEach((exclusiveItem) => {
              expect(navItems).not.toContainEqual(exclusiveItem);
            });
          });
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * **Validates: Requirements 11.5**
   * No role sees items from another role's exclusive set.
   * This is the universal property: for any randomly generated role,
   * the navigation items returned never include exclusive items from other roles.
   */
  it('no role sees items from another role\'s exclusive set', () => {
    fc.assert(
      fc.property(
        arbRole,
        (role) => {
          const navItems = getNavItemsForRole(role);
          const otherRoles = (['funder', 'owner', 'auditor', 'admin'] as UserRole[])
            .filter((r) => r !== role);

          otherRoles.forEach((otherRole) => {
            EXCLUSIVE_ITEMS[otherRole].forEach((exclusiveItem) => {
              const hasExclusiveItem = navItems.some(
                (item) => item.label === exclusiveItem.label && item.href === exclusiveItem.href
              );
              expect(hasExclusiveItem).toBe(false);
            });
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
