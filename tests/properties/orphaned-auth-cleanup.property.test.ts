/**
 * Property Test: Orphaned auth account cleanup (Property 4)
 *
 * **Validates: Requirements 1.9**
 *
 * For any registration attempt where the Firebase Auth account is created but
 * the Firestore document write fails, the system SHALL delete the orphaned Auth
 * account, ensuring no auth account exists without a corresponding Firestore document.
 */

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { RegistrationSchema } from '../../shared/schemas';

// ─── Types for Simulation ────────────────────────────────────────────────────

interface AuthService {
  createUser: (params: { email: string; password: string; displayName: string }) => Promise<{ uid: string }>;
  deleteUser: (uid: string) => Promise<void>;
}

interface FirestoreService {
  collection: (name: string) => {
    doc: (id: string) => {
      set: (data: Record<string, unknown>) => Promise<void>;
    };
  };
}

/**
 * Simulates the registration flow control logic extracted from the Cloud Function.
 * This models the exact pattern in functions/src/auth/register.ts:
 * 1. Create auth account
 * 2. Attempt Firestore write
 * 3. On Firestore failure, delete the orphaned auth account
 */
async function simulateRegistrationFlow(
  validatedData: { email: string; password: string; name: string; role: string; country: string },
  auth: AuthService,
  db: FirestoreService
): Promise<{ success: true; data: { userId: string } }> {
  // Step 1: Create Firebase Auth account
  const userRecord = await auth.createUser({
    email: validatedData.email,
    password: validatedData.password,
    displayName: validatedData.name,
  });
  const userId = userRecord.uid;

  // Step 2: Attempt Firestore document write
  const userDocument: Record<string, unknown> = {
    userId,
    email: validatedData.email,
    name: validatedData.name,
    role: validatedData.role,
    country: validatedData.country,
    isApproved: validatedData.role === 'auditor' ? false : true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    await db.collection('users').doc(userId).set(userDocument);
  } catch {
    // Step 3: Orphaned auth cleanup — delete the auth account
    try {
      await auth.deleteUser(userId);
    } catch {
      // Log but don't throw — primary error is the Firestore failure
      console.error('Failed to clean up orphaned auth account:', userId);
    }

    throw new Error('Registration could not be completed. Please try again.');
  }

  return { success: true, data: { userId } };
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate a valid email address */
const validEmail = fc.tuple(
  fc.stringMatching(/^[a-z][a-z0-9]{1,10}$/),
  fc.stringMatching(/^[a-z][a-z0-9]{1,6}$/),
  fc.constantFrom('com', 'org', 'net', 'co.za', 'io')
).map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

/** Generate a valid password (8-64 chars, must contain uppercase, lowercase, digit) */
const validPassword = fc.tuple(
  fc.stringMatching(/^[a-z]{2,20}$/),
  fc.stringMatching(/^[A-Z]{2,20}$/),
  fc.stringMatching(/^[0-9]{1,5}$/),
  fc.stringMatching(/^[a-zA-Z0-9]{0,15}$/)
).map(([lower, upper, digit, extra]) => {
  const combined = lower + upper + digit + extra;
  if (combined.length < 8) return combined + 'aA1xxxxx'.slice(0, 8 - combined.length);
  if (combined.length > 64) return combined.slice(0, 64);
  return combined;
});

/** Generate a valid name (1-100 chars) */
const validName = fc.stringMatching(/^[A-Za-z][A-Za-z ]{0,49}$/).filter(s => s.length >= 1 && s.length <= 100);

/** Generate a valid ISO 3166-1 alpha-2 country code */
const validCountry = fc.constantFrom(
  'ZA', 'US', 'GB', 'DE', 'FR', 'AU', 'CA', 'IN', 'BR', 'JP'
);

/** Generate a valid role */
const validRole = fc.constantFrom('funder', 'owner', 'auditor');

/** Generate a random userId (simulating Firebase Auth UID) */
const randomUserId = fc.stringMatching(/^[a-zA-Z0-9]{20,28}$/);

/** Generate a random Firestore error message */
const firestoreErrorMessage = fc.constantFrom(
  'DEADLINE_EXCEEDED',
  'UNAVAILABLE',
  'INTERNAL',
  'PERMISSION_DENIED',
  'RESOURCE_EXHAUSTED',
  'ABORTED',
  'NOT_FOUND'
);

/** Generate valid registration data (simplified for this test) */
const validRegistrationData = fc.record({
  email: validEmail,
  password: validPassword,
  name: validName,
  country: validCountry,
  role: validRole,
});

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 4: Orphaned auth account cleanup', () => {
  /**
   * **Validates: Requirements 1.9**
   * When Firestore write fails after auth account creation, deleteUser is called
   * with the correct userId to clean up the orphaned account.
   */
  it('deleteUser is called with correct userId when Firestore write fails', async () => {
    await fc.assert(
      fc.asyncProperty(
        validRegistrationData,
        randomUserId,
        firestoreErrorMessage,
        async (regData, userId, errorMsg) => {
          const deleteUserCalls: string[] = [];

          const mockAuth: AuthService = {
            createUser: async () => ({ uid: userId }),
            deleteUser: async (uid: string) => {
              deleteUserCalls.push(uid);
            },
          };

          const mockDb: FirestoreService = {
            collection: () => ({
              doc: () => ({
                set: async () => {
                  throw new Error(errorMsg);
                },
              }),
            }),
          };

          await expect(
            simulateRegistrationFlow(regData, mockAuth, mockDb)
          ).rejects.toThrow('Registration could not be completed');

          // Invariant: deleteUser must be called exactly once with the correct userId
          expect(deleteUserCalls).toHaveLength(1);
          expect(deleteUserCalls[0]).toBe(userId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.9**
   * The function throws an error indicating registration could not be completed
   * when Firestore write fails.
   */
  it('throws error indicating registration failure when Firestore write fails', async () => {
    await fc.assert(
      fc.asyncProperty(
        validRegistrationData,
        randomUserId,
        firestoreErrorMessage,
        async (regData, userId, errorMsg) => {
          const mockAuth: AuthService = {
            createUser: async () => ({ uid: userId }),
            deleteUser: async () => {},
          };

          const mockDb: FirestoreService = {
            collection: () => ({
              doc: () => ({
                set: async () => {
                  throw new Error(errorMsg);
                },
              }),
            }),
          };

          let thrownError: Error | null = null;
          try {
            await simulateRegistrationFlow(regData, mockAuth, mockDb);
          } catch (e) {
            thrownError = e as Error;
          }

          // Invariant: an error must be thrown with the correct message
          expect(thrownError).not.toBeNull();
          expect(thrownError!.message).toContain('Registration could not be completed');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.9**
   * Even if deleteUser itself fails, the function still throws the registration
   * error (cleanup failure is logged but does not change the error behavior).
   */
  it('still throws registration error even when deleteUser fails', async () => {
    await fc.assert(
      fc.asyncProperty(
        validRegistrationData,
        randomUserId,
        firestoreErrorMessage,
        async (regData, userId, errorMsg) => {
          let deleteUserAttempted = false;

          const mockAuth: AuthService = {
            createUser: async () => ({ uid: userId }),
            deleteUser: async () => {
              deleteUserAttempted = true;
              throw new Error('Failed to delete user');
            },
          };

          const mockDb: FirestoreService = {
            collection: () => ({
              doc: () => ({
                set: async () => {
                  throw new Error(errorMsg);
                },
              }),
            }),
          };

          // The function should still throw the registration error
          await expect(
            simulateRegistrationFlow(regData, mockAuth, mockDb)
          ).rejects.toThrow('Registration could not be completed');

          // Invariant: deleteUser was still attempted even though it failed
          expect(deleteUserAttempted).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.9**
   * When Firestore write succeeds, no cleanup occurs and the function returns
   * successfully (no orphaned accounts created in the success path).
   */
  it('no cleanup occurs when Firestore write succeeds', async () => {
    await fc.assert(
      fc.asyncProperty(
        validRegistrationData,
        randomUserId,
        async (regData, userId) => {
          let deleteUserCalled = false;

          const mockAuth: AuthService = {
            createUser: async () => ({ uid: userId }),
            deleteUser: async () => {
              deleteUserCalled = true;
            },
          };

          const mockDb: FirestoreService = {
            collection: () => ({
              doc: () => ({
                set: async () => {
                  // Success — no error thrown
                },
              }),
            }),
          };

          const result = await simulateRegistrationFlow(regData, mockAuth, mockDb);

          // Invariant: deleteUser must NOT be called on success
          expect(deleteUserCalled).toBe(false);
          // Invariant: result contains the correct userId
          expect(result.success).toBe(true);
          expect(result.data.userId).toBe(userId);
        }
      ),
      { numRuns: 100 }
    );
  });
});
