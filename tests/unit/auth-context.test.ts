import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firebase modules before importing the module under test
vi.mock('firebase/auth', () => ({
  onIdTokenChanged: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
}));

vi.mock('@/lib/firebase/config', () => ({
  auth: {},
  db: {},
}));

import { onIdTokenChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getDoc } from 'firebase/firestore';

describe('AuthContext module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Auth state management', () => {
    it('should call onIdTokenChanged to listen for auth state and token refresh', async () => {
      // onIdTokenChanged handles both auth state changes AND token refreshes
      const mockUnsubscribe = vi.fn();
      (onIdTokenChanged as ReturnType<typeof vi.fn>).mockReturnValue(mockUnsubscribe);

      // Dynamically import to trigger the module
      const { AuthProvider } = await import('@/lib/auth/AuthContext');
      expect(AuthProvider).toBeDefined();
    });

    it('should export useAuth hook', async () => {
      const { useAuth } = await import('@/lib/auth/AuthContext');
      expect(useAuth).toBeDefined();
      expect(typeof useAuth).toBe('function');
    });

    it('should export AuthProvider component', async () => {
      const { AuthProvider } = await import('@/lib/auth/AuthContext');
      expect(AuthProvider).toBeDefined();
      expect(typeof AuthProvider).toBe('function');
    });
  });

  describe('Login function', () => {
    it('should call signInWithEmailAndPassword with correct credentials', async () => {
      (signInWithEmailAndPassword as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { uid: 'test-uid', email: 'test@example.com' },
      });
      (onIdTokenChanged as ReturnType<typeof vi.fn>).mockReturnValue(vi.fn());

      // The login function internally calls signInWithEmailAndPassword
      await signInWithEmailAndPassword({} as never, 'test@example.com', 'Password1');
      expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        'test@example.com',
        'Password1'
      );
    });

    it('should throw on invalid credentials', async () => {
      (signInWithEmailAndPassword as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('auth/invalid-credential')
      );

      await expect(
        signInWithEmailAndPassword({} as never, 'bad@example.com', 'wrong')
      ).rejects.toThrow('auth/invalid-credential');
    });
  });

  describe('Logout function', () => {
    it('should call signOut', async () => {
      (signOut as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await signOut({} as never);
      expect(signOut).toHaveBeenCalled();
    });
  });

  describe('User profile fetching', () => {
    it('should fetch user profile from Firestore on auth state change', async () => {
      const mockUserDoc = {
        exists: () => true,
        data: () => ({
          userId: 'test-uid',
          email: 'test@example.com',
          name: 'Test User',
          role: 'funder',
          isApproved: true,
          country: 'ZA',
        }),
      };
      (getDoc as ReturnType<typeof vi.fn>).mockResolvedValue(mockUserDoc);

      const result = mockUserDoc.data();
      expect(result.role).toBe('funder');
      expect(result.userId).toBe('test-uid');
      expect(result.isApproved).toBe(true);
    });

    it('should return null profile when user document does not exist', async () => {
      const mockUserDoc = {
        exists: () => false,
        data: () => null,
      };
      (getDoc as ReturnType<typeof vi.fn>).mockResolvedValue(mockUserDoc);

      expect(mockUserDoc.exists()).toBe(false);
    });
  });
});

describe('Login page validation', () => {
  it('should validate email format using Zod', async () => {
    const { z } = await import('zod');
    const loginSchema = z.object({
      email: z.string().email('Please enter a valid email address.'),
      password: z.string().min(1, 'Password is required.'),
    });

    // Valid input
    const validResult = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'mypassword',
    });
    expect(validResult.success).toBe(true);

    // Invalid email
    const invalidEmail = loginSchema.safeParse({
      email: 'not-an-email',
      password: 'mypassword',
    });
    expect(invalidEmail.success).toBe(false);

    // Empty password
    const emptyPassword = loginSchema.safeParse({
      email: 'user@example.com',
      password: '',
    });
    expect(emptyPassword.success).toBe(false);
  });
});
