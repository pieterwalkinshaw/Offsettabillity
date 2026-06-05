'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/auth/AuthContext';
import type { Project, Audit, VerificationBadge } from '@shared/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SectionState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

interface PendingActions {
  draftsNeedingSubmission: number;
  submittedAwaitingPrescreen: number;
  unresolvedAuditFindings: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BADGE_STYLES: Record<VerificationBadge, { bg: string; text: string }> = {
  None: { bg: 'bg-gray-100', text: 'text-gray-600' },
  Verified: { bg: 'bg-blue-100', text: 'text-blue-700' },
  'Verified+': { bg: 'bg-green-100', text: 'text-green-700' },
  'Premium Assured': { bg: 'bg-amber-100', text: 'text-amber-700' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatZARCents(cents: number): string {
  const rands = cents / 100;
  return `R ${rands.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function getFundingPercentage(raised: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.min(Math.round((raised / goal) * 100), 100);
}

// ─── Skeleton Components ─────────────────────────────────────────────────────

function ProjectRowSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border-b border-gray-100 last:border-b-0 animate-pulse">
      <div className="flex-1 min-w-0">
        <div className="h-4 w-3/4 bg-gray-200 rounded mb-2" />
        <div className="h-3 w-1/3 bg-gray-200 rounded" />
      </div>
      <div className="flex items-center gap-3 sm:w-48">
        <div className="h-5 w-16 bg-gray-200 rounded-full" />
        <div className="flex-1 h-2 bg-gray-100 rounded-full" />
      </div>
    </div>
  );
}

function PendingActionsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-pulse">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="h-3 w-24 bg-gray-200 rounded mb-3" />
          <div className="h-8 w-12 bg-gray-200 rounded" />
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

function EmptyState({ icon, title, description, actionLabel, actionHref }: {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="text-center py-10 px-4">
      <div className="text-4xl mb-3" aria-hidden="true">{icon}</div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-foreground/60 mt-1 mb-4">{description}</p>
      {actionLabel && actionHref && (
        <a
          href={actionHref}
          className="inline-block px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          {actionLabel}
        </a>
      )}
    </div>
  );
}

// ─── Owner Dashboard Component ───────────────────────────────────────────────

export function OwnerDashboard() {
  const { user, userProfile } = useAuth();

  // Section states
  const [projects, setProjects] = useState<SectionState<Project[]>>({
    data: [],
    loading: true,
    error: null,
  });
  const [pendingActions, setPendingActions] = useState<SectionState<PendingActions>>({
    data: { draftsNeedingSubmission: 0, submittedAwaitingPrescreen: 0, unresolvedAuditFindings: 0 },
    loading: true,
    error: null,
  });

  // ─── Fetch Owner Projects ────────────────────────────────────────────────

  const fetchProjects = useCallback(async () => {
    if (!user) return;

    setProjects((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const projectsQuery = query(
        collection(db, 'projects'),
        where('ownerId', '==', user.uid),
        orderBy('updatedAt', 'desc')
      );

      const snapshot = await getDocs(projectsQuery);
      const projectList = snapshot.docs.map((doc) => doc.data() as Project);

      setProjects({ data: projectList, loading: false, error: null });
    } catch {
      setProjects((prev) => ({
        ...prev,
        loading: false,
        error: 'Failed to load your projects.',
      }));
    }
  }, [user]);

  // ─── Fetch Pending Actions ───────────────────────────────────────────────

  const fetchPendingActions = useCallback(async () => {
    if (!user) return;

    setPendingActions((prev) => ({ ...prev, loading: true, error: null }));

    try {
      // Get all owner projects to compute pending actions
      const projectsQuery = query(
        collection(db, 'projects'),
        where('ownerId', '==', user.uid)
      );
      const projectSnapshot = await getDocs(projectsQuery);
      const ownerProjects = projectSnapshot.docs.map((doc) => doc.data() as Project);

      // Count drafts needing submission
      const draftsNeedingSubmission = ownerProjects.filter(
        (p) => p.verificationStatus === 'draft'
      ).length;

      // Count submitted awaiting pre-screening
      const submittedAwaitingPrescreen = ownerProjects.filter(
        (p) => p.verificationStatus === 'submitted'
      ).length;

      // Count projects with unresolved audit findings
      // Query audits for owner's projects that have recommendation 'conditional' or 'reject'
      let unresolvedAuditFindings = 0;

      const projectIds = ownerProjects.map((p) => p.projectId);
      if (projectIds.length > 0) {
        // Firestore 'in' queries support up to 30 items, batch if needed
        const batches = [];
        for (let i = 0; i < projectIds.length; i += 30) {
          batches.push(projectIds.slice(i, i + 30));
        }

        for (const batch of batches) {
          const auditsQuery = query(
            collection(db, 'audits'),
            where('projectId', 'in', batch),
            where('status', '==', 'completed')
          );
          const auditsSnapshot = await getDocs(auditsQuery);
          const audits = auditsSnapshot.docs.map((doc) => doc.data() as Audit);

          // Count projects that have at least one audit with 'conditional' or 'reject' recommendation
          const projectsWithFindings = new Set(
            audits
              .filter((a) => a.recommendation === 'conditional' || a.recommendation === 'reject')
              .map((a) => a.projectId)
          );
          unresolvedAuditFindings += projectsWithFindings.size;
        }
      }

      setPendingActions({
        data: { draftsNeedingSubmission, submittedAwaitingPrescreen, unresolvedAuditFindings },
        loading: false,
        error: null,
      });
    } catch {
      setPendingActions((prev) => ({
        ...prev,
        loading: false,
        error: 'Failed to load pending actions.',
      }));
    }
  }, [user]);

  // ─── Initial Data Fetch ──────────────────────────────────────────────────

  useEffect(() => {
    if (user && userProfile) {
      fetchProjects();
      fetchPendingActions();
    }
  }, [user, userProfile, fetchProjects, fetchPendingActions]);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-foreground/60 mt-1">
            Welcome back{userProfile?.name ? `, ${userProfile.name}` : ''}. Here&apos;s your project overview.
          </p>
        </div>

        {/* Section 1: Pending Actions */}
        <section aria-labelledby="pending-actions-heading" className="mb-8">
          <h2 id="pending-actions-heading" className="text-lg font-semibold text-foreground mb-4">
            Pending Actions
          </h2>

          {pendingActions.loading ? (
            <PendingActionsSkeleton />
          ) : pendingActions.error ? (
            <SectionError
              message={pendingActions.error}
              onRetry={fetchPendingActions}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-foreground/60 mb-1">Drafts needing submission</p>
                <p className="text-3xl font-bold text-amber-600">
                  {pendingActions.data.draftsNeedingSubmission}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-foreground/60 mb-1">Awaiting pre-screening</p>
                <p className="text-3xl font-bold text-blue-600">
                  {pendingActions.data.submittedAwaitingPrescreen}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-foreground/60 mb-1">Unresolved audit findings</p>
                <p className="text-3xl font-bold text-red-600">
                  {pendingActions.data.unresolvedAuditFindings}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Section 2: My Projects */}
        <section aria-labelledby="my-projects-heading">
          <h2 id="my-projects-heading" className="text-lg font-semibold text-foreground mb-4">
            My Projects
          </h2>

          {projects.loading ? (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm divide-y divide-gray-100">
              {Array.from({ length: 4 }).map((_, i) => (
                <ProjectRowSkeleton key={i} />
              ))}
            </div>
          ) : projects.error ? (
            <SectionError
              message={projects.error}
              onRetry={fetchProjects}
            />
          ) : projects.data.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <EmptyState
                icon="📋"
                title="No projects yet"
                description="Submit your first project to start the verification process and attract funding."
                actionLabel="Create Project"
                actionHref="/projects/new"
              />
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm divide-y divide-gray-100">
              {projects.data.map((project) => (
                <OwnerProjectRow key={project.projectId} project={project} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ─── Project Row Component ───────────────────────────────────────────────────

function OwnerProjectRow({ project }: { project: Project }) {
  const {
    projectId,
    title,
    verificationStatus,
    verificationBadge,
    fundingGoal,
    fundingRaised,
  } = project;

  const badgeStyle = BADGE_STYLES[verificationBadge];
  const fundingPct = getFundingPercentage(fundingRaised, fundingGoal);

  return (
    <a
      href={`/project?id=${projectId}`}
      className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-inset"
      aria-label={`View project: ${title}`}
    >
      {/* Project Info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-foreground truncate">{title}</h3>
        <div className="flex items-center gap-2 mt-1">
          <StatusPill status={verificationStatus} />
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeStyle.bg} ${badgeStyle.text}`}
          >
            {verificationBadge}
          </span>
        </div>
      </div>

      {/* Funding Progress */}
      <div className="sm:w-56 flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs text-foreground/60 mb-1">
            <span>{formatZARCents(fundingRaised)}</span>
            <span>{fundingPct}%</span>
          </div>
          <div
            className="h-2 rounded-full bg-gray-100 overflow-hidden"
            role="progressbar"
            aria-valuenow={fundingPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Funding progress: ${fundingPct}% of ${formatZARCents(fundingGoal)}`}
          >
            <div
              className="h-full rounded-full bg-primary-500 transition-all duration-300"
              style={{ width: `${fundingPct}%` }}
            />
          </div>
        </div>
      </div>
    </a>
  );
}

// ─── Status Pill Component ───────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string }> = {
    draft: { bg: 'bg-gray-100', text: 'text-gray-700' },
    submitted: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
    prescreened: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
    pending_audit: { bg: 'bg-purple-100', text: 'text-purple-700' },
    verified: { bg: 'bg-blue-100', text: 'text-blue-700' },
    live: { bg: 'bg-green-100', text: 'text-green-700' },
    funded: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  };

  const style = styles[status] ?? { bg: 'bg-gray-100', text: 'text-gray-700' };
  const displayLabel = status.replace(/_/g, ' ');

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${style.bg} ${style.text}`}
    >
      {displayLabel}
    </span>
  );
}
