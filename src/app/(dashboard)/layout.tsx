'use client';

import type { ReactNode } from 'react';
import { ProtectedRoute } from '@/lib/auth/ProtectedRoute';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';

/**
 * Dashboard layout — wraps all authenticated dashboard pages with:
 * 1. ProtectedRoute (redirects unauthenticated users to /login)
 * 2. DashboardSidebar (role-based navigation)
 * 3. Responsive main content area
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <DashboardSidebar />

        {/* Main content area — offset for sidebar on desktop, offset for top bar on mobile */}
        <main className="lg:pl-64 pt-14 lg:pt-0 min-h-screen">
          {children}
        </main>
      </div>
    </ProtectedRoute>
  );
}
