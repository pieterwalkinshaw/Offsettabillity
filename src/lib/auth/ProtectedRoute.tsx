'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthContext';
import type { UserRole } from '@shared/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Roles allowed to access this route. If empty/undefined, any authenticated user can access. */
  allowedRoles?: UserRole[];
}

/**
 * Wrapper component that enforces authentication and role-based access.
 *
 * - Redirects unauthenticated users to /login
 * - Redirects users without the required role to /overview
 * - Shows a loading skeleton while auth state is resolving
 */
export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    if (allowedRoles && allowedRoles.length > 0 && userProfile) {
      if (!allowedRoles.includes(userProfile.role)) {
        router.replace('/overview');
      }
    }
  }, [user, userProfile, loading, allowedRoles, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="space-y-4 w-full max-w-md px-4">
          <div className="h-8 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
          <div className="h-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (allowedRoles && allowedRoles.length > 0 && userProfile) {
    if (!allowedRoles.includes(userProfile.role)) {
      return null;
    }
  }

  return <>{children}</>;
}
