/**
 * Property Test: Role-based access control enforcement (Property 38)
 *
 * Validates: Requirements 13.1, 13.2, 13.3
 *
 * For any Firestore operation on a protected collection, the system SHALL:
 * - reject unauthenticated requests with UNAUTHENTICATED error
 * - reject authenticated requests from users whose role does not have permission
 *   (per the access control matrix) with PERMISSION_DENIED error
 * - permit requests only when the user's role grants access to the requested
 *   operation on the requested resource
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ─── Types ───────────────────────────────────────────────────────────────────

type Role = 'funder' | 'owner' | 'auditor' | 'admin' | 'unauthenticated';

type Resource = 'users' | 'projects' | 'audits' | 'leads' | 'taxonomy' | 'funding' | 'reports';

type Operation = 'read' | 'create' | 'update' | 'delete';

type AccessResult = 'ALLOW' | 'PERMISSION_DENIED' | 'UNAUTHENTICATED';

interface AccessContext {
  /** The user's role (or unauthenticated) */
  role: Role;
  /** The user's UID (null if unauthenticated) */
  userId: string | null;
  /** Whether the user owns the resource being accessed */
  isResourceOwner: boolean;
  /** Whether the project is public (verified/live/funded) */
  isPublicProject: boolean;
  /** Whether the project is in draft status */
  isDraftProject: boolean;
  /** Whether the user is the assigned auditor for an audit */
  isAssignedAuditor: boolean;
  /** Whether the user is the funder for a funding transaction */
  isTransactionFunder: boolean;
  /** Whether the report has public access level */
  isPublicReport: boolean;
  /** Whether the report has gated access level (and user is authenticated) */
  isGatedReport: boolean;
  /** Whether the user is the project owner for an audit/funding resource */
  isProjectOwnerForResource: boolean;
}

// ─── Access Control Logic (mirrors Firestore Security Rules) ─────────────────

/**
 * Evaluates whether a given role + resource + operation combination is allowed
 * based on the Firestore security rules defined in firestore.rules.
 *
 * This function implements the same logic as the Firestore security rules
 * to enable property-based testing without requiring the Firebase emulator.
 */
function evaluateAccess(
  resource: Resource,
  operation: Operation,
  context: AccessContext
): AccessResult {
  // Unauthenticated users can only access specific public resources
  if (context.role === 'unauthenticated') {
    return evaluateUnauthenticatedAccess(resource, operation, context);
  }

  // Admin has full access to everything
  if (context.role === 'admin') {
    return 'ALLOW';
  }

  // Authenticated users — evaluate per resource
  switch (resource) {
    case 'users':
      return evaluateUsersAccess(operation, context);
    case 'projects':
      return evaluateProjectsAccess(operation, context);
    case 'audits':
      return evaluateAuditsAccess(operation, context);
    case 'leads':
      return evaluateLeadsAccess();
    case 'taxonomy':
      return evaluateTaxonomyAccess(operation);
    case 'funding':
      return evaluateFundingAccess(operation, context);
    case 'reports':
      return evaluateReportsAccess(operation, context);
  }
}

function evaluateUnauthenticatedAccess(
  resource: Resource,
  operation: Operation,
  context: AccessContext
): AccessResult {
  // Taxonomy: public read allowed (allow read: if true)
  if (resource === 'taxonomy' && operation === 'read') {
    return 'ALLOW';
  }

  // Projects: public read allowed for verified/live/funded projects
  if (resource === 'projects' && operation === 'read' && context.isPublicProject) {
    return 'ALLOW';
  }

  // Reports: public reports can be read by anyone
  if (resource === 'reports' && operation === 'read' && context.isPublicReport) {
    return 'ALLOW';
  }

  // All other access by unauthenticated users is denied
  return 'UNAUTHENTICATED';
}

function evaluateUsersAccess(
  operation: Operation,
  context: AccessContext
): AccessResult {
  // Users: read own profile (or admin, handled above)
  if (operation === 'read' && context.isResourceOwner) {
    return 'ALLOW';
  }
  // Users: write own profile only
  if ((operation === 'create' || operation === 'update' || operation === 'delete') &&
      context.isResourceOwner) {
    return 'ALLOW';
  }
  return 'PERMISSION_DENIED';
}

function evaluateProjectsAccess(
  operation: Operation,
  context: AccessContext
): AccessResult {
  switch (operation) {
    case 'read':
      // Public projects (verified/live/funded) readable by anyone authenticated
      // Owner can read their own projects regardless of status
      if (context.isPublicProject || context.isResourceOwner) {
        return 'ALLOW';
      }
      return 'PERMISSION_DENIED';

    case 'create':
      // Any authenticated user can create a project (ownerId must match auth.uid)
      // In practice, the rule checks request.resource.data.ownerId == request.auth.uid
      // which means the creator must set themselves as owner
      return 'ALLOW';

    case 'update':
      // Owner can update only if project is in draft status
      if (context.isResourceOwner && context.isDraftProject) {
        return 'ALLOW';
      }
      return 'PERMISSION_DENIED';

    case 'delete':
      // Only admin can delete (handled above)
      return 'PERMISSION_DENIED';
  }
}

function evaluateAuditsAccess(
  operation: Operation,
  context: AccessContext
): AccessResult {
  switch (operation) {
    case 'read':
      // Assigned auditor, project owner for audit, or admin (admin handled above)
      if (context.isAssignedAuditor || context.isProjectOwnerForResource) {
        return 'ALLOW';
      }
      return 'PERMISSION_DENIED';

    case 'create':
      // Only admin can create audits (handled above)
      return 'PERMISSION_DENIED';

    case 'update':
      // Assigned auditor or admin (admin handled above)
      if (context.isAssignedAuditor) {
        return 'ALLOW';
      }
      return 'PERMISSION_DENIED';

    case 'delete':
      // Only admin can delete (handled above)
      return 'PERMISSION_DENIED';
  }
}

function evaluateLeadsAccess(): AccessResult {
  // Only admin can read/write leads (admin handled above)
  // Public writes go through Cloud Function, not direct Firestore access
  return 'PERMISSION_DENIED';
}

function evaluateTaxonomyAccess(operation: Operation): AccessResult {
  // Public read (anyone, including authenticated non-admin)
  if (operation === 'read') {
    return 'ALLOW';
  }
  // Only admin can write (admin handled above)
  return 'PERMISSION_DENIED';
}

function evaluateFundingAccess(
  operation: Operation,
  context: AccessContext
): AccessResult {
  switch (operation) {
    case 'read':
      // Funder (transaction owner) or project owner for funding can read
      if (context.isTransactionFunder || context.isProjectOwnerForResource) {
        return 'ALLOW';
      }
      return 'PERMISSION_DENIED';

    case 'create':
      // Authenticated user can create funding (funderId must match auth.uid)
      // The rule checks request.resource.data.funderId == request.auth.uid
      return 'ALLOW';

    case 'update':
      // Only admin can update (handled above)
      return 'PERMISSION_DENIED';

    case 'delete':
      // Only admin can delete (handled above)
      return 'PERMISSION_DENIED';
  }
}

function evaluateReportsAccess(
  operation: Operation,
  context: AccessContext
): AccessResult {
  if (operation === 'read') {
    // Public reports readable by anyone authenticated
    if (context.isPublicReport) {
      return 'ALLOW';
    }
    // Gated reports readable by authenticated users
    if (context.isGatedReport) {
      return 'ALLOW';
    }
    return 'PERMISSION_DENIED';
  }
  // Only admin can write reports (handled above)
  return 'PERMISSION_DENIED';
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate a random role (including unauthenticated) */
const arbRole = fc.constantFrom<Role>(
  'funder', 'owner', 'auditor', 'admin', 'unauthenticated'
);

/** Generate a random authenticated role (excluding unauthenticated) */
const arbAuthenticatedRole = fc.constantFrom<Role>(
  'funder', 'owner', 'auditor', 'admin'
);

/** Generate a random non-admin authenticated role */
const arbNonAdminRole = fc.constantFrom<Role>(
  'funder', 'owner', 'auditor'
);

/** Generate a random resource */
const arbResource = fc.constantFrom<Resource>(
  'users', 'projects', 'audits', 'leads', 'taxonomy', 'funding', 'reports'
);

/** Generate a random operation */
const arbOperation = fc.constantFrom<Operation>(
  'read', 'create', 'update', 'delete'
);

/** Generate a random user ID */
const arbUserId = fc.stringMatching(/^[a-zA-Z0-9]{10,20}$/);

/** Generate a random access context */
const arbContext = fc.record({
  role: arbRole,
  userId: fc.option(arbUserId, { nil: null }),
  isResourceOwner: fc.boolean(),
  isPublicProject: fc.boolean(),
  isDraftProject: fc.boolean(),
  isAssignedAuditor: fc.boolean(),
  isTransactionFunder: fc.boolean(),
  isPublicReport: fc.boolean(),
  isGatedReport: fc.boolean(),
  isProjectOwnerForResource: fc.boolean(),
}).map(ctx => {
  // Ensure consistency: unauthenticated users have no userId
  if (ctx.role === 'unauthenticated') {
    return { ...ctx, userId: null };
  }
  // Ensure authenticated users have a userId
  if (ctx.userId === null) {
    return { ...ctx, userId: 'user_' + Math.random().toString(36).slice(2, 12) };
  }
  return ctx;
});

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 38: Role-based access control enforcement', () => {
  /**
   * **Validates: Requirements 13.2**
   * Unauthenticated requests to protected resources are rejected with UNAUTHENTICATED.
   */
  it('unauthenticated requests to protected resources return UNAUTHENTICATED', () => {
    fc.assert(
      fc.property(
        arbResource,
        arbOperation,
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        (resource, operation, isPublicProject, isPublicReport, isGatedReport) => {
          const context: AccessContext = {
            role: 'unauthenticated',
            userId: null,
            isResourceOwner: false,
            isPublicProject,
            isDraftProject: false,
            isAssignedAuditor: false,
            isTransactionFunder: false,
            isPublicReport,
            isGatedReport: false, // Gated requires auth
            isProjectOwnerForResource: false,
          };

          const result = evaluateAccess(resource, operation, context);

          // Only specific public reads should be allowed
          const isAllowedPublicAccess =
            (resource === 'taxonomy' && operation === 'read') ||
            (resource === 'projects' && operation === 'read' && isPublicProject) ||
            (resource === 'reports' && operation === 'read' && isPublicReport);

          if (isAllowedPublicAccess) {
            expect(result).toBe('ALLOW');
          } else {
            expect(result).toBe('UNAUTHENTICATED');
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 13.1**
   * Admin role has full access to all resources and operations.
   */
  it('admin role has full access to all resources and operations', () => {
    fc.assert(
      fc.property(
        arbResource,
        arbOperation,
        (resource, operation) => {
          const context: AccessContext = {
            role: 'admin',
            userId: 'admin_user_123',
            isResourceOwner: false,
            isPublicProject: false,
            isDraftProject: false,
            isAssignedAuditor: false,
            isTransactionFunder: false,
            isPublicReport: false,
            isGatedReport: false,
            isProjectOwnerForResource: false,
          };

          const result = evaluateAccess(resource, operation, context);
          expect(result).toBe('ALLOW');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 13.3**
   * Non-admin users cannot access leads collection (admin-only resource).
   */
  it('non-admin users are denied access to leads collection', () => {
    fc.assert(
      fc.property(
        arbNonAdminRole,
        arbOperation,
        arbUserId,
        (role, operation, userId) => {
          const context: AccessContext = {
            role,
            userId,
            isResourceOwner: false,
            isPublicProject: false,
            isDraftProject: false,
            isAssignedAuditor: false,
            isTransactionFunder: false,
            isPublicReport: false,
            isGatedReport: false,
            isProjectOwnerForResource: false,
          };

          const result = evaluateAccess('leads', operation, context);
          expect(result).toBe('PERMISSION_DENIED');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 13.1**
   * Taxonomy is publicly readable by all authenticated users.
   */
  it('taxonomy read is allowed for all authenticated users', () => {
    fc.assert(
      fc.property(
        arbAuthenticatedRole,
        arbUserId,
        (role, userId) => {
          const context: AccessContext = {
            role,
            userId,
            isResourceOwner: false,
            isPublicProject: false,
            isDraftProject: false,
            isAssignedAuditor: false,
            isTransactionFunder: false,
            isPublicReport: false,
            isGatedReport: false,
            isProjectOwnerForResource: false,
          };

          const result = evaluateAccess('taxonomy', 'read', context);
          expect(result).toBe('ALLOW');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 13.3**
   * Non-admin users cannot write to taxonomy.
   */
  it('non-admin users cannot write to taxonomy', () => {
    const writeOps = fc.constantFrom<Operation>('create', 'update', 'delete');

    fc.assert(
      fc.property(
        arbNonAdminRole,
        writeOps,
        arbUserId,
        (role, operation, userId) => {
          const context: AccessContext = {
            role,
            userId,
            isResourceOwner: false,
            isPublicProject: false,
            isDraftProject: false,
            isAssignedAuditor: false,
            isTransactionFunder: false,
            isPublicReport: false,
            isGatedReport: false,
            isProjectOwnerForResource: false,
          };

          const result = evaluateAccess('taxonomy', operation, context);
          expect(result).toBe('PERMISSION_DENIED');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 13.1, 13.3**
   * Users can only read their own profile (non-admin).
   */
  it('non-admin users can only read their own user profile', () => {
    fc.assert(
      fc.property(
        arbNonAdminRole,
        arbUserId,
        fc.boolean(),
        (role, userId, isResourceOwner) => {
          const context: AccessContext = {
            role,
            userId,
            isResourceOwner,
            isPublicProject: false,
            isDraftProject: false,
            isAssignedAuditor: false,
            isTransactionFunder: false,
            isPublicReport: false,
            isGatedReport: false,
            isProjectOwnerForResource: false,
          };

          const result = evaluateAccess('users', 'read', context);

          if (isResourceOwner) {
            expect(result).toBe('ALLOW');
          } else {
            expect(result).toBe('PERMISSION_DENIED');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 13.1, 13.3**
   * Project owners can read their own projects regardless of status.
   * Public projects are readable by any authenticated user.
   */
  it('project read access follows ownership and public status rules', () => {
    fc.assert(
      fc.property(
        arbNonAdminRole,
        arbUserId,
        fc.boolean(),
        fc.boolean(),
        (role, userId, isResourceOwner, isPublicProject) => {
          const context: AccessContext = {
            role,
            userId,
            isResourceOwner,
            isPublicProject,
            isDraftProject: false,
            isAssignedAuditor: false,
            isTransactionFunder: false,
            isPublicReport: false,
            isGatedReport: false,
            isProjectOwnerForResource: false,
          };

          const result = evaluateAccess('projects', 'read', context);

          if (isResourceOwner || isPublicProject) {
            expect(result).toBe('ALLOW');
          } else {
            expect(result).toBe('PERMISSION_DENIED');
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 13.1, 13.3**
   * Project updates are only allowed for owners of draft projects.
   * Non-owners or non-draft projects are denied.
   */
  it('project update requires ownership AND draft status', () => {
    fc.assert(
      fc.property(
        arbNonAdminRole,
        arbUserId,
        fc.boolean(),
        fc.boolean(),
        (role, userId, isResourceOwner, isDraftProject) => {
          const context: AccessContext = {
            role,
            userId,
            isResourceOwner,
            isPublicProject: false,
            isDraftProject,
            isAssignedAuditor: false,
            isTransactionFunder: false,
            isPublicReport: false,
            isGatedReport: false,
            isProjectOwnerForResource: false,
          };

          const result = evaluateAccess('projects', 'update', context);

          if (isResourceOwner && isDraftProject) {
            expect(result).toBe('ALLOW');
          } else {
            expect(result).toBe('PERMISSION_DENIED');
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 13.3**
   * Only admin can delete projects (non-admin always denied).
   */
  it('non-admin users cannot delete projects', () => {
    fc.assert(
      fc.property(
        arbNonAdminRole,
        arbUserId,
        (role, userId) => {
          const context: AccessContext = {
            role,
            userId,
            isResourceOwner: true, // Even owners can't delete
            isPublicProject: false,
            isDraftProject: true,
            isAssignedAuditor: false,
            isTransactionFunder: false,
            isPublicReport: false,
            isGatedReport: false,
            isProjectOwnerForResource: false,
          };

          const result = evaluateAccess('projects', 'delete', context);
          expect(result).toBe('PERMISSION_DENIED');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 13.1, 13.3**
   * Audit read access requires being the assigned auditor or project owner.
   */
  it('audit read requires assigned auditor or project owner relationship', () => {
    fc.assert(
      fc.property(
        arbNonAdminRole,
        arbUserId,
        fc.boolean(),
        fc.boolean(),
        (role, userId, isAssignedAuditor, isProjectOwnerForResource) => {
          const context: AccessContext = {
            role,
            userId,
            isResourceOwner: false,
            isPublicProject: false,
            isDraftProject: false,
            isAssignedAuditor,
            isTransactionFunder: false,
            isPublicReport: false,
            isGatedReport: false,
            isProjectOwnerForResource,
          };

          const result = evaluateAccess('audits', 'read', context);

          if (isAssignedAuditor || isProjectOwnerForResource) {
            expect(result).toBe('ALLOW');
          } else {
            expect(result).toBe('PERMISSION_DENIED');
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 13.3**
   * Only assigned auditors can update audits (non-admin).
   */
  it('audit update requires assigned auditor status', () => {
    fc.assert(
      fc.property(
        arbNonAdminRole,
        arbUserId,
        fc.boolean(),
        (role, userId, isAssignedAuditor) => {
          const context: AccessContext = {
            role,
            userId,
            isResourceOwner: false,
            isPublicProject: false,
            isDraftProject: false,
            isAssignedAuditor,
            isTransactionFunder: false,
            isPublicReport: false,
            isGatedReport: false,
            isProjectOwnerForResource: false,
          };

          const result = evaluateAccess('audits', 'update', context);

          if (isAssignedAuditor) {
            expect(result).toBe('ALLOW');
          } else {
            expect(result).toBe('PERMISSION_DENIED');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 13.3**
   * Non-admin users cannot create audits.
   */
  it('non-admin users cannot create audits', () => {
    fc.assert(
      fc.property(
        arbNonAdminRole,
        arbUserId,
        (role, userId) => {
          const context: AccessContext = {
            role,
            userId,
            isResourceOwner: false,
            isPublicProject: false,
            isDraftProject: false,
            isAssignedAuditor: true, // Even assigned auditors can't create
            isTransactionFunder: false,
            isPublicReport: false,
            isGatedReport: false,
            isProjectOwnerForResource: false,
          };

          const result = evaluateAccess('audits', 'create', context);
          expect(result).toBe('PERMISSION_DENIED');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 13.1, 13.3**
   * Funding read access requires being the funder or project owner.
   */
  it('funding read requires funder or project owner relationship', () => {
    fc.assert(
      fc.property(
        arbNonAdminRole,
        arbUserId,
        fc.boolean(),
        fc.boolean(),
        (role, userId, isTransactionFunder, isProjectOwnerForResource) => {
          const context: AccessContext = {
            role,
            userId,
            isResourceOwner: false,
            isPublicProject: false,
            isDraftProject: false,
            isAssignedAuditor: false,
            isTransactionFunder,
            isPublicReport: false,
            isGatedReport: false,
            isProjectOwnerForResource,
          };

          const result = evaluateAccess('funding', 'read', context);

          if (isTransactionFunder || isProjectOwnerForResource) {
            expect(result).toBe('ALLOW');
          } else {
            expect(result).toBe('PERMISSION_DENIED');
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 13.1**
   * Any authenticated user can create funding (funderId must match).
   */
  it('any authenticated user can create funding transactions', () => {
    fc.assert(
      fc.property(
        arbAuthenticatedRole,
        arbUserId,
        (role, userId) => {
          const context: AccessContext = {
            role,
            userId,
            isResourceOwner: false,
            isPublicProject: false,
            isDraftProject: false,
            isAssignedAuditor: false,
            isTransactionFunder: false,
            isPublicReport: false,
            isGatedReport: false,
            isProjectOwnerForResource: false,
          };

          const result = evaluateAccess('funding', 'create', context);
          expect(result).toBe('ALLOW');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 13.3**
   * Non-admin users cannot update or delete funding transactions.
   */
  it('non-admin users cannot update or delete funding transactions', () => {
    const writeOps = fc.constantFrom<Operation>('update', 'delete');

    fc.assert(
      fc.property(
        arbNonAdminRole,
        writeOps,
        arbUserId,
        (role, operation, userId) => {
          const context: AccessContext = {
            role,
            userId,
            isResourceOwner: false,
            isPublicProject: false,
            isDraftProject: false,
            isAssignedAuditor: false,
            isTransactionFunder: true, // Even the funder can't update/delete
            isPublicReport: false,
            isGatedReport: false,
            isProjectOwnerForResource: false,
          };

          const result = evaluateAccess('funding', operation, context);
          expect(result).toBe('PERMISSION_DENIED');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 13.1, 13.3**
   * Report read access depends on access level (public/gated).
   */
  it('report read access follows access level rules', () => {
    fc.assert(
      fc.property(
        arbNonAdminRole,
        arbUserId,
        fc.boolean(),
        fc.boolean(),
        (role, userId, isPublicReport, isGatedReport) => {
          const context: AccessContext = {
            role,
            userId,
            isResourceOwner: false,
            isPublicProject: false,
            isDraftProject: false,
            isAssignedAuditor: false,
            isTransactionFunder: false,
            isPublicReport,
            isGatedReport,
            isProjectOwnerForResource: false,
          };

          const result = evaluateAccess('reports', 'read', context);

          if (isPublicReport || isGatedReport) {
            expect(result).toBe('ALLOW');
          } else {
            expect(result).toBe('PERMISSION_DENIED');
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 13.3**
   * Non-admin users cannot write to reports.
   */
  it('non-admin users cannot write to reports', () => {
    const writeOps = fc.constantFrom<Operation>('create', 'update', 'delete');

    fc.assert(
      fc.property(
        arbNonAdminRole,
        writeOps,
        arbUserId,
        (role, operation, userId) => {
          const context: AccessContext = {
            role,
            userId,
            isResourceOwner: false,
            isPublicProject: false,
            isDraftProject: false,
            isAssignedAuditor: false,
            isTransactionFunder: false,
            isPublicReport: false,
            isGatedReport: false,
            isProjectOwnerForResource: false,
          };

          const result = evaluateAccess('reports', operation, context);
          expect(result).toBe('PERMISSION_DENIED');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 13.1, 13.2, 13.3**
   * Comprehensive property: for any random role + resource + operation combination,
   * the evaluateAccess function returns a consistent result that matches the
   * access control matrix.
   */
  it('all role/resource/operation combinations produce consistent access decisions', () => {
    fc.assert(
      fc.property(
        arbResource,
        arbOperation,
        arbContext,
        (resource, operation, context) => {
          const result = evaluateAccess(resource, operation, context);

          // Result must be one of the three valid outcomes
          expect(['ALLOW', 'PERMISSION_DENIED', 'UNAUTHENTICATED']).toContain(result);

          // Unauthenticated users never get PERMISSION_DENIED (they get UNAUTHENTICATED)
          if (context.role === 'unauthenticated' && result !== 'ALLOW') {
            expect(result).toBe('UNAUTHENTICATED');
          }

          // Authenticated users never get UNAUTHENTICATED
          if (context.role !== 'unauthenticated') {
            expect(result).not.toBe('UNAUTHENTICATED');
          }

          // Admin always gets ALLOW
          if (context.role === 'admin') {
            expect(result).toBe('ALLOW');
          }
        }
      ),
      { numRuns: 500 }
    );
  });
});
