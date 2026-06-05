'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FolderKanban,
  Search,
  FileBarChart,
  PlusCircle,
  FileText,
  ClipboardCheck,
  CheckCircle2,
  ShieldCheck,
  Filter,
  Users,
  Tag,
  Menu,
  X,
  LogOut,
  Settings,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import type { UserRole } from '@shared/types';

// ─── Navigation Configuration ────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS_BY_ROLE: Record<UserRole, NavItem[]> = {
  funder: [
    { label: 'Overview', href: '/overview', icon: LayoutDashboard },
    { label: 'My Funded Projects', href: '/funding', icon: FolderKanban },
    { label: 'Browse Projects', href: '/projects', icon: Search },
    { label: 'Reports', href: '/reports', icon: FileBarChart },
  ],
  owner: [
    { label: 'Overview', href: '/overview', icon: LayoutDashboard },
    { label: 'My Projects', href: '/projects/mine', icon: FolderKanban },
    { label: 'Create Project', href: '/projects/create', icon: PlusCircle },
    { label: 'Documents', href: '/documents', icon: FileText },
  ],
  auditor: [
    { label: 'Overview', href: '/overview', icon: LayoutDashboard },
    { label: 'My Audits', href: '/audits', icon: ClipboardCheck },
    { label: 'Available Projects', href: '/audits/available', icon: Search },
    { label: 'Completed Audits', href: '/audits/completed', icon: CheckCircle2 },
  ],
  admin: [
    { label: 'Overview', href: '/overview/admin', icon: LayoutDashboard },
    { label: 'Pre-screening', href: '/admin/prescreening', icon: Filter },
    { label: 'Leads', href: '/admin/leads', icon: Users },
    { label: 'Users', href: '/admin/users', icon: Users },
    { label: 'Taxonomy', href: '/dashboard/admin/taxonomy', icon: Tag },
  ],
};

// ─── DashboardSidebar Component ──────────────────────────────────────────────

export function DashboardSidebar() {
  const { userProfile, logout } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleMobile = useCallback(() => {
    setMobileOpen((prev) => !prev);
  }, []);

  const closeMobile = useCallback(() => {
    setMobileOpen(false);
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  if (!userProfile) return null;

  const navItems = NAV_ITEMS_BY_ROLE[userProfile.role] ?? [];

  function isActive(href: string): boolean {
    // Exact match for overview, prefix match for others
    if (href === '/overview') {
      return pathname === '/overview';
    }
    return pathname.startsWith(href);
  }

  // ─── Sidebar Content (shared between desktop and mobile) ─────────────────

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="flex items-center gap-2 px-4 py-5 border-b border-gray-200">
        <a href="/" className="flex items-center gap-2">
        <svg
          className="h-7 w-7 text-primary-600 shrink-0"
          viewBox="0 0 32 32"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2.5" />
          <path
            d="M10 16l4 4 8-8"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="text-lg font-bold text-primary-700">Offsettabillity</span>
        </a>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Dashboard navigation">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMobile}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${active
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-foreground/70 hover:bg-gray-100 hover:text-foreground'
                }
              `}
              aria-current={active ? 'page' : undefined}
            >
              <Icon
                className={`h-5 w-5 shrink-0 ${active ? 'text-primary-600' : 'text-foreground/50'}`}
                aria-hidden="true"
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User info + Settings + Logout */}
      <div className="border-t border-gray-200 px-4 py-4">
        <div className="mb-3">
          <p className="text-sm font-medium text-foreground truncate">
            {userProfile.name}
          </p>
          <p className="text-xs text-foreground/50 capitalize">
            {userProfile.role}
          </p>
        </div>
        <Link
          href="/settings"
          onClick={closeMobile}
          className={`
            flex items-center gap-2 w-full px-3 py-2 text-sm font-medium rounded-lg transition-colors
            ${pathname === '/settings'
              ? 'bg-primary-50 text-primary-700'
              : 'text-foreground/70 hover:bg-gray-100 hover:text-foreground'
            }
          `}
          aria-current={pathname === '/settings' ? 'page' : undefined}
        >
          <Settings className="h-4 w-4" aria-hidden="true" />
          Settings
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-foreground/70 rounded-lg hover:bg-gray-100 hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Log out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between h-14 px-4 bg-white border-b border-gray-200">
        <a href="/" className="flex items-center gap-2">
          <svg
            className="h-6 w-6 text-primary-600"
            viewBox="0 0 32 32"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2.5" />
            <path
              d="M10 16l4 4 8-8"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-base font-bold text-primary-700">Offsettabillity</span>
        </a>
        <button
          type="button"
          onClick={toggleMobile}
          className="inline-flex items-center justify-center rounded-lg p-2 text-foreground/70 hover:bg-gray-100 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
          aria-expanded={mobileOpen}
          aria-controls="mobile-sidebar"
          aria-label={mobileOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {mobileOpen ? (
            <X className="h-6 w-6" aria-hidden="true" />
          ) : (
            <Menu className="h-6 w-6" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/30"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar drawer */}
      <aside
        id="mobile-sidebar"
        className={`
          lg:hidden fixed top-14 left-0 bottom-0 z-40 w-64 bg-white border-r border-gray-200
          transform transition-transform duration-200 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        aria-label="Dashboard sidebar"
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:border-r lg:border-gray-200 lg:bg-white"
        aria-label="Dashboard sidebar"
      >
        {sidebarContent}
      </aside>
    </>
  );
}
