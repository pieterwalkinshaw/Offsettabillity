'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthContext';

interface RedirectIfAuthenticatedProps {
  children: React.ReactNode;
}

/**
 * Wrapper for auth pages (login, register) that redirects
 * already-authenticated users to the dashboard.
 */
export function RedirectIfAuthenticated({ children }: RedirectIfAuthenticatedProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/overview');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return <>{children}</>;
}
