'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  onIdTokenChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/config';
import type { User, UserRole } from '@shared/types';

export interface UserProfile {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  isApproved: boolean;
  organizationName?: string;
  country: string;
}

interface AuthContextValue {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const userDoc = await getDoc(doc(db, 'users', uid));
  if (!userDoc.exists()) return null;

  const data = userDoc.data() as User;
  return {
    userId: data.userId,
    email: data.email,
    name: data.name,
    role: data.role,
    isApproved: data.isApproved,
    organizationName: data.organizationName,
    country: data.country,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Listen for auth state changes and token refreshes
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        try {
          const profile = await fetchUserProfile(firebaseUser.uid);
          setUserProfile(profile);
        } catch {
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Login failed. Please try again.';
      // Map Firebase error codes to user-friendly messages
      if (message.includes('auth/invalid-credential') || message.includes('auth/wrong-password') || message.includes('auth/user-not-found')) {
        setError('Invalid email or password.');
      } else if (message.includes('auth/too-many-requests')) {
        setError('Too many failed attempts. Please try again later.');
      } else if (message.includes('auth/user-disabled')) {
        setError('This account has been disabled.');
      } else {
        setError('Login failed. Please try again.');
      }
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    setUserProfile(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, userProfile, loading, error, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
