'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/auth/AuthContext';
import { ProtectedRoute } from '@/lib/auth/ProtectedRoute';
import type {
  User,
  Project,
  Lead,
  LeadStatus,
  VerificationStatus,
  UserRole,
  FundingTransaction,
} from '@shared/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SectionState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

interface LeadPipelineSummary {
  new: number;
  contacted: number;
  qualified: number;
  converted: number;
  lost: number;
}

interface PlatformMetrics {
  usersByRole: Record<UserRole, number>;
  projectsByStatus: Record<string, number>;
  totalFundingRaised: number;
  leadsThisMonth: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const LEAD_STATUSES: LeadStatus[] = ['new', 'contacted', 'qualified', 'converted', 'lost'];

const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-yellow-100 text-yellow-700',
  qualified: 'bg-purple-100 text-purple-700',
  converted: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-700',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatZARCents(cents: number): string {
  const rands = cents / 100;
  return `R ${rands.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getStartOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

// ─── Skeleton Components ─────────────────────────────────────────────────────

function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-gray-100 animate-pulse">
      <div className="h-4 w-32 bg-gray-200 rounded" />
      <div className="h-4 w-24 bg-gray-200 rounded" />
      <div className="h-4 w-20 bg-gray-200 rounded ml-auto" />
    </div>
  );
}

function MetricCardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm animate-pulse">
      <div className="h-3 w-24 bg-gray-200 rounded mb-3" />
      <div className="h-7 w-16 bg-gray-200 rounded" />
    </div>
  );
}

function PipelineSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="h-3 w-16 bg-gray-200 rounded mb-2" />
          <div className="h-6 w-10 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  );
}

// ─── Error Component ─────────────────────────────────────────────────────────

function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-red-500 shrink-0" aria-hidden="true">⚠️</span>
        <p className="text-sm text-red-700 truncate">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="shrink-0 px-3 py-1.5 text-sm font-medium text-red-700 border border-red-300 rounded-lg hover:bg-red-100 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
      >
        Retry
      </button>
    </div>
  );
}

// ─── Empty State Component ───────────────────────────────────────────────────

function EmptyState({ icon, title, description }: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center py-8 px-4">
      <div className="text-4xl mb-3" aria-hidden="true">{icon}</div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-foreground/60 mt-1">{description}</p>
    </div>
  );
}

// ─── Admin Dashboard Component ───────────────────────────────────────────────

function AdminDashboard() {
  const { userProfile } = useAuth();

  // Section states
  const [pendingAuditors, setPendingAuditors] = useState<SectionState<User[]>>({
    data: [],
    loading: true,
    error: null,
  });
  const [pendingProjects, setPendingProjects] = useState<SectionState<Project[]>>({
    data: [],
    loading: true,
    error: null,
  });
  const [leadPipeline, setLeadPipeline] = useState<SectionState<LeadPipelineSummary>>({
    data: { new: 0, contacted: 0, qualified: 0, converted: 0, lost: 0 },
    loading: true,
    error: null,
  });
  const [platformMetrics, setPlatformMetrics] = useState<SectionState<PlatformMetrics>>({
    data: {
      usersByRole: { funder: 0, owner: 0, auditor: 0, admin: 0 },
      projectsByStatus: {},
      totalFundingRaised: 0,
      leadsThisMonth: 0,
    },
    loading: true,
    error: null,
  });

  // ─── Fetch Pending Auditor Approvals ─────────────────────────────────────

  const fetchPendingAuditors = useCallback(async () => {
    setPendingAuditors((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const q = query(
        collection(db, 'users'),
        where('role', '==', 'auditor'),
        where('isApproved', '==', false)
      );
      const snapshot = await getDocs(q);
      const auditors = snapshot.docs.map((doc) => doc.data() as User);

      setPendingAuditors({ data: auditors, loading: false, error: null });
    } catch {
      setPendingAuditors((prev) => ({
        ...prev,
        loading: false,
        error: 'Failed to load pending auditor approvals.',
      }));
    }
  }, []);

  // ─── Fetch Projects Awaiting Pre-screening ───────────────────────────────

  const fetchPendingProjects = useCallback(async () => {
    setPendingProjects((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const q = query(
        collection(db, 'projects'),
        where('verificationStatus', '==', 'submitted'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const projects = snapshot.docs.map((doc) => doc.data() as Project);

      setPendingProjects({ data: projects, loading: false, error: null });
    } catch {
      setPendingProjects((prev) => ({
        ...prev,
        loading: false,
        error: 'Failed to load projects awaiting pre-screening.',
      }));
    }
  }, []);

  // ─── Fetch Lead Pipeline Summary ─────────────────────────────────────────

  const fetchLeadPipeline = useCallback(async () => {
    setLeadPipeline((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const snapshot = await getDocs(collection(db, 'leads'));
      const leads = snapshot.docs.map((doc) => doc.data() as Lead);

      const summary: LeadPipelineSummary = {
        new: 0,
        contacted: 0,
        qualified: 0,
        converted: 0,
        lost: 0,
      };

      leads.forEach((lead) => {
        if (lead.status in summary) {
          summary[lead.status as keyof LeadPipelineSummary]++;
        }
      });

      setLeadPipeline({ data: summary, loading: false, error: null });
    } catch {
      setLeadPipeline((prev) => ({
        ...prev,
        loading: false,
        error: 'Failed to load lead pipeline.',
      }));
    }
  }, []);

  // ─── Fetch Platform Metrics ──────────────────────────────────────────────

  const fetchPlatformMetrics = useCallback(async () => {
    setPlatformMetrics((prev) => ({ ...prev, loading: true, error: null }));

    try {
      // Users by role
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersByRole: Record<UserRole, number> = { funder: 0, owner: 0, auditor: 0, admin: 0 };
      usersSnapshot.docs.forEach((doc) => {
        const user = doc.data() as User;
        if (user.role in usersByRole) {
          usersByRole[user.role]++;
        }
      });

      // Projects by status
      const projectsSnapshot = await getDocs(collection(db, 'projects'));
      const projectsByStatus: Record<string, number> = {};
      projectsSnapshot.docs.forEach((doc) => {
        const project = doc.data() as Project;
        const status = project.verificationStatus;
        projectsByStatus[status] = (projectsByStatus[status] || 0) + 1;
      });

      // Total funding raised (sum of confirmed transactions)
      const fundingQuery = query(
        collection(db, 'funding'),
        where('status', '==', 'confirmed')
      );
      const fundingSnapshot = await getDocs(fundingQuery);
      let totalFundingRaised = 0;
      fundingSnapshot.docs.forEach((doc) => {
        const tx = doc.data() as FundingTransaction;
        totalFundingRaised += tx.amount;
      });

      // Leads this month
      const startOfMonth = getStartOfCurrentMonth();
      const leadsQuery = query(
        collection(db, 'leads'),
        where('createdAt', '>=', startOfMonth.toISOString())
      );
      let leadsThisMonth = 0;
      try {
        const leadsSnapshot = await getDocs(leadsQuery);
        leadsThisMonth = leadsSnapshot.size;
      } catch {
        // Fallback: if createdAt is stored as Timestamp, try with Timestamp
        const leadsQueryTs = query(
          collection(db, 'leads'),
          where('createdAt', '>=', Timestamp.fromDate(startOfMonth))
        );
        const leadsSnapshot = await getDocs(leadsQueryTs);
        leadsThisMonth = leadsSnapshot.size;
      }

      setPlatformMetrics({
        data: { usersByRole, projectsByStatus, totalFundingRaised, leadsThisMonth },
        loading: false,
        error: null,
      });
    } catch {
      setPlatformMetrics((prev) => ({
        ...prev,
        loading: false,
        error: 'Failed to load platform metrics.',
      }));
    }
  }, []);

  // ─── Initial Data Fetch ──────────────────────────────────────────────────

  useEffect(() => {
    if (userProfile) {
      fetchPendingAuditors();
      fetchPendingProjects();
      fetchLeadPipeline();
      fetchPlatformMetrics();
    }
  }, [userProfile, fetchPendingAuditors, fetchPendingProjects, fetchLeadPipeline, fetchPlatformMetrics]);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-foreground/60 mt-1">
            Welcome back{userProfile?.name ? `, ${userProfile.name}` : ''}. Platform overview at a glance.
          </p>
        </div>

        {/* Section 1: Pending Auditor Approvals */}
        <section aria-labelledby="pending-auditors-heading" className="mb-8">
          <h2 id="pending-auditors-heading" className="text-lg font-semibold text-foreground mb-4">
            Pending Auditor Approvals
          </h2>

          {pendingAuditors.loading ? (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              {Array.from({ length: 3 }).map((_, i) => (
                <TableRowSkeleton key={i} />
              ))}
            </div>
          ) : pendingAuditors.error ? (
            <SectionError
              message={pendingAuditors.error}
              onRetry={fetchPendingAuditors}
            />
          ) : pendingAuditors.data.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <EmptyState
                icon="✅"
                title="All auditors approved"
                description="No pending auditor approvals at this time."
              />
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-4 py-3 font-medium text-foreground/70">Name</th>
                      <th className="text-left px-4 py-3 font-medium text-foreground/70">Email</th>
                      <th className="text-left px-4 py-3 font-medium text-foreground/70">Country</th>
                      <th className="text-left px-4 py-3 font-medium text-foreground/70">Registered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingAuditors.data.map((auditor) => (
                      <tr key={auditor.userId} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{auditor.name}</td>
                        <td className="px-4 py-3 text-foreground/70">{auditor.email}</td>
                        <td className="px-4 py-3 text-foreground/70">{auditor.country}</td>
                        <td className="px-4 py-3 text-foreground/70">
                          {auditor.createdAt ? new Date(auditor.createdAt).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* Section 2: Projects Awaiting Pre-screening */}
        <section aria-labelledby="pending-projects-heading" className="mb-8">
          <h2 id="pending-projects-heading" className="text-lg font-semibold text-foreground mb-4">
            Projects Awaiting Pre-screening
          </h2>

          {pendingProjects.loading ? (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              {Array.from({ length: 3 }).map((_, i) => (
                <TableRowSkeleton key={i} />
              ))}
            </div>
          ) : pendingProjects.error ? (
            <SectionError
              message={pendingProjects.error}
              onRetry={fetchPendingProjects}
            />
          ) : pendingProjects.data.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <EmptyState
                icon="📋"
                title="No projects awaiting review"
                description="All submitted projects have been pre-screened."
              />
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-4 py-3 font-medium text-foreground/70">Title</th>
                      <th className="text-left px-4 py-3 font-medium text-foreground/70">Category</th>
                      <th className="text-left px-4 py-3 font-medium text-foreground/70">Location</th>
                      <th className="text-left px-4 py-3 font-medium text-foreground/70">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingProjects.data.map((project) => (
                      <tr key={project.projectId} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground max-w-[200px] truncate">
                          {project.title}
                        </td>
                        <td className="px-4 py-3 text-foreground/70 capitalize">
                          {project.category.replace(/-/g, ' ')}
                        </td>
                        <td className="px-4 py-3 text-foreground/70">
                          {project.location?.country || '—'}
                        </td>
                        <td className="px-4 py-3 text-foreground/70">
                          {project.createdAt ? new Date(project.createdAt).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* Section 3: Lead Pipeline Summary */}
        <section aria-labelledby="lead-pipeline-heading" className="mb-8">
          <h2 id="lead-pipeline-heading" className="text-lg font-semibold text-foreground mb-4">
            Lead Pipeline
          </h2>

          {leadPipeline.loading ? (
            <PipelineSkeleton />
          ) : leadPipeline.error ? (
            <SectionError
              message={leadPipeline.error}
              onRetry={fetchLeadPipeline}
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {LEAD_STATUSES.map((status) => (
                <div
                  key={status}
                  className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${LEAD_STATUS_COLORS[status]}`}>
                    {status}
                  </span>
                  <p className="text-2xl font-bold text-foreground mt-2">
                    {leadPipeline.data[status]}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 4: Platform Metrics */}
        <section aria-labelledby="platform-metrics-heading">
          <h2 id="platform-metrics-heading" className="text-lg font-semibold text-foreground mb-4">
            Platform Metrics
          </h2>

          {platformMetrics.loading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <MetricCardSkeleton key={i} />
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <MetricCardSkeleton key={i} />
                ))}
              </div>
            </div>
          ) : platformMetrics.error ? (
            <SectionError
              message={platformMetrics.error}
              onRetry={fetchPlatformMetrics}
            />
          ) : (
            <div className="space-y-6">
              {/* Users by Role */}
              <div>
                <h3 className="text-sm font-medium text-foreground/70 mb-3">Users by Role</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(Object.entries(platformMetrics.data.usersByRole) as [UserRole, number][]).map(
                    ([role, count]) => (
                      <div
                        key={role}
                        className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                      >
                        <p className="text-xs text-foreground/60 capitalize mb-1">{role}s</p>
                        <p className="text-xl font-bold text-foreground">{count}</p>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Projects by Status */}
              <div>
                <h3 className="text-sm font-medium text-foreground/70 mb-3">Projects by Status</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {Object.entries(platformMetrics.data.projectsByStatus).map(
                    ([status, count]) => (
                      <div
                        key={status}
                        className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                      >
                        <p className="text-xs text-foreground/60 capitalize mb-1">
                          {status.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xl font-bold text-foreground">{count}</p>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Summary Metrics */}
              <div>
                <h3 className="text-sm font-medium text-foreground/70 mb-3">Summary</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <p className="text-xs text-foreground/60 mb-1">Total Funding Raised</p>
                    <p className="text-2xl font-bold text-primary-700">
                      {formatZARCents(platformMetrics.data.totalFundingRaised)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <p className="text-xs text-foreground/60 mb-1">Leads This Month</p>
                    <p className="text-2xl font-bold text-primary-700">
                      {platformMetrics.data.leadsThisMonth}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ─── Page Export (Wrapped in ProtectedRoute) ─────────────────────────────────

export default function AdminOverviewPage() {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <AdminDashboard />
    </ProtectedRoute>
  );
}
