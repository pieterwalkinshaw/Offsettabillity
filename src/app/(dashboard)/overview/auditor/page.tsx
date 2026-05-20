'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  doc,
  startAfter,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/auth/AuthContext';
import { ProtectedRoute } from '@/lib/auth/ProtectedRoute';
import type { Audit, Project, User } from '@shared/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const COMPLETED_AUDITS_PAGE_SIZE = 25;
const AVAILABLE_PROJECTS_LIMIT = 50;

// ─── Types ───────────────────────────────────────────────────────────────────

interface SectionState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ─── Skeleton Components ─────────────────────────────────────────────────────

function AuditCardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-5 w-16 bg-gray-200 rounded-full" />
        <div className="h-3 w-20 bg-gray-200 rounded" />
      </div>
      <div className="h-5 w-3/4 bg-gray-200 rounded mb-2" />
      <div className="h-3 w-1/2 bg-gray-200 rounded mb-3" />
      <div className="h-3 w-1/3 bg-gray-200 rounded" />
    </div>
  );
}

function ProjectCardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-3 w-20 bg-gray-200 rounded" />
        <div className="h-5 w-16 bg-gray-200 rounded-full" />
      </div>
      <div className="h-5 w-3/4 bg-gray-200 rounded mb-3" />
      <div className="space-y-1 mb-3">
        <div className="flex justify-between">
          <div className="h-3 w-16 bg-gray-200 rounded" />
          <div className="h-3 w-20 bg-gray-200 rounded" />
        </div>
        <div className="h-2 w-full bg-gray-100 rounded-full" />
      </div>
      <div className="h-3 w-24 bg-gray-200 rounded" />
    </div>
  );
}

// ─── Error Component ─────────────────────────────────────────────────────────

function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center justify-between gap-3"
      role="alert"
      aria-live="polite"
    >
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

// ─── Audit Status Badge ──────────────────────────────────────────────────────

function AuditStatusBadge({ status }: { status: Audit['status'] }) {
  const styles: Record<Audit['status'], { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending' },
    in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'In Progress' },
    completed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Completed' },
    rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' },
  };

  const style = styles[status];

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

// ─── Audit Card Component ────────────────────────────────────────────────────

function AuditCard({ audit, projectTitle }: { audit: Audit; projectTitle?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-primary-300 transition-all duration-200">
      <div className="flex items-center justify-between gap-2 mb-2">
        <AuditStatusBadge status={audit.status} />
        <span className="text-xs text-foreground/50">
          {formatDate(audit.createdAt)}
        </span>
      </div>
      <h3 className="text-base font-semibold text-foreground truncate mb-1">
        {projectTitle || `Project ${audit.projectId.slice(0, 8)}...`}
      </h3>
      {audit.methodology && (
        <p className="text-xs text-foreground/60 truncate mb-2">
          Methodology: {audit.methodology}
        </p>
      )}
      {audit.recommendation && (
        <p className="text-xs text-foreground/60">
          Recommendation: <span className="font-medium capitalize">{audit.recommendation}</span>
        </p>
      )}
      {audit.scoreContribution !== undefined && audit.status === 'completed' && (
        <p className="text-xs text-foreground/60 mt-1">
          Score contribution: <span className="font-medium">{audit.scoreContribution}/100</span>
        </p>
      )}
    </div>
  );
}

// ─── Available Project Card ──────────────────────────────────────────────────

function AvailableProjectCard({ project }: { project: Project }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-primary-300 transition-all duration-200">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs font-medium text-foreground/60 uppercase tracking-wide truncate">
          {project.category}
        </span>
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-700">
          Needs Audit
        </span>
      </div>
      <h3 className="text-base font-semibold text-foreground truncate mb-2">
        {project.title}
      </h3>
      <p className="text-xs text-foreground/60 line-clamp-2 mb-3">
        {project.description}
      </p>
      <div className="flex items-center justify-between text-xs text-foreground/50">
        <span>{project.location.country}</span>
        <span>Score: {project.verificationScore}/100</span>
      </div>
    </div>
  );
}

// ─── Auditor Dashboard Component ─────────────────────────────────────────────

function AuditorDashboard() {
  const { user, userProfile } = useAuth();

  // Section states
  const [assignedAudits, setAssignedAudits] = useState<SectionState<{ audit: Audit; projectTitle?: string }[]>>({
    data: [],
    loading: true,
    error: null,
  });
  const [availableProjects, setAvailableProjects] = useState<SectionState<Project[]>>({
    data: [],
    loading: true,
    error: null,
  });
  const [completedAudits, setCompletedAudits] = useState<SectionState<{ audit: Audit; projectTitle?: string }[]>>({
    data: [],
    loading: true,
    error: null,
  });

  // Pagination state for completed audits
  const [lastCompletedDoc, setLastCompletedDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMoreCompleted, setHasMoreCompleted] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  // ─── Fetch Project Titles ────────────────────────────────────────────────

  const fetchProjectTitles = useCallback(async (projectIds: string[]): Promise<Record<string, string>> => {
    if (projectIds.length === 0) return {};

    const titles: Record<string, string> = {};

    // Firestore 'in' queries support up to 30 items
    const chunks: string[][] = [];
    for (let i = 0; i < projectIds.length; i += 30) {
      chunks.push(projectIds.slice(i, i + 30));
    }

    for (const chunk of chunks) {
      const projectQuery = query(
        collection(db, 'projects'),
        where('projectId', 'in', chunk)
      );
      const snapshot = await getDocs(projectQuery);
      snapshot.docs.forEach((d) => {
        const data = d.data() as Project;
        titles[data.projectId] = data.title;
      });
    }

    return titles;
  }, []);

  // ─── Fetch Assigned Audits ───────────────────────────────────────────────

  const fetchAssignedAudits = useCallback(async () => {
    if (!user) return;

    setAssignedAudits({ data: [], loading: true, error: null });

    try {
      const auditsQuery = query(
        collection(db, 'audits'),
        where('auditorId', '==', user.uid),
        where('status', 'in', ['pending', 'in_progress']),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(auditsQuery);
      const audits = snapshot.docs.map((d) => d.data() as Audit);

      // Fetch project titles for display
      const projectIds = [...new Set(audits.map((a) => a.projectId))];
      const titles = await fetchProjectTitles(projectIds);

      const data = audits.map((audit) => ({
        audit,
        projectTitle: titles[audit.projectId],
      }));

      setAssignedAudits({ data, loading: false, error: null });
    } catch {
      setAssignedAudits((prev) => ({
        ...prev,
        loading: false,
        error: 'Failed to load assigned audits.',
      }));
    }
  }, [user, fetchProjectTitles]);

  // ─── Fetch Available Projects ────────────────────────────────────────────

  const fetchAvailableProjects = useCallback(async () => {
    if (!user) return;

    setAvailableProjects({ data: [], loading: true, error: null });

    try {
      // Fetch the full user document to get specializations
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.exists() ? (userDoc.data() as User) : null;
      const specializations = userData?.specializations ?? [];

      // Get project IDs the auditor has already audited (conflict of interest)
      const existingAuditsQuery = query(
        collection(db, 'audits'),
        where('auditorId', '==', user.uid)
      );
      const existingAuditsSnapshot = await getDocs(existingAuditsQuery);
      const auditedProjectIds = new Set(
        existingAuditsSnapshot.docs.map((d) => (d.data() as Audit).projectId)
      );

      // Get project IDs the auditor has funded (conflict of interest)
      const fundingQuery = query(
        collection(db, 'funding'),
        where('funderId', '==', user.uid),
        where('status', '==', 'confirmed')
      );
      const fundingSnapshot = await getDocs(fundingQuery);
      const fundedProjectIds = new Set(
        fundingSnapshot.docs.map((d) => d.data().projectId as string)
      );

      // Get project IDs the auditor owns (conflict of interest)
      const ownedProjectsQuery = query(
        collection(db, 'projects'),
        where('ownerId', '==', user.uid)
      );
      const ownedSnapshot = await getDocs(ownedProjectsQuery);
      const ownedProjectIds = new Set(
        ownedSnapshot.docs.map((d) => (d.data() as Project).projectId)
      );

      // Query projects that need auditing (prescreened or pending_audit)
      const projectQuery = query(
        collection(db, 'projects'),
        where('verificationStatus', 'in', ['prescreened', 'pending_audit']),
        orderBy('createdAt', 'desc'),
        limit(AVAILABLE_PROJECTS_LIMIT)
      );
      const projectSnapshot = await getDocs(projectQuery);
      const allProjects = projectSnapshot.docs.map((d) => d.data() as Project);

      // Filter: match specializations and exclude conflict of interest
      const filtered = allProjects.filter((project) => {
        // Exclude projects the auditor owns
        if (ownedProjectIds.has(project.projectId)) return false;
        // Exclude projects the auditor has already audited
        if (auditedProjectIds.has(project.projectId)) return false;
        // Exclude projects the auditor has funded
        if (fundedProjectIds.has(project.projectId)) return false;
        // Match specializations (if auditor has declared any)
        if (specializations.length > 0) {
          return specializations.includes(project.category);
        }
        // If no specializations set, show all available
        return true;
      });

      setAvailableProjects({ data: filtered, loading: false, error: null });
    } catch {
      setAvailableProjects((prev) => ({
        ...prev,
        loading: false,
        error: 'Failed to load available projects.',
      }));
    }
  }, [user]);

  // ─── Fetch Completed Audits ──────────────────────────────────────────────

  const fetchCompletedAudits = useCallback(async (afterDoc?: DocumentSnapshot | null) => {
    if (!user) return;

    if (!afterDoc) {
      setCompletedAudits((prev) => ({ ...prev, loading: true, error: null }));
    } else {
      setLoadingMore(true);
    }

    try {
      let auditsQuery = query(
        collection(db, 'audits'),
        where('auditorId', '==', user.uid),
        where('status', '==', 'completed'),
        orderBy('completedAt', 'desc'),
        limit(COMPLETED_AUDITS_PAGE_SIZE + 1)
      );

      if (afterDoc) {
        auditsQuery = query(
          collection(db, 'audits'),
          where('auditorId', '==', user.uid),
          where('status', '==', 'completed'),
          orderBy('completedAt', 'desc'),
          startAfter(afterDoc),
          limit(COMPLETED_AUDITS_PAGE_SIZE + 1)
        );
      }

      const snapshot = await getDocs(auditsQuery);
      const auditDocs = snapshot.docs;

      // Check if there are more pages
      const hasMore = auditDocs.length > COMPLETED_AUDITS_PAGE_SIZE;
      const pageDocs = hasMore ? auditDocs.slice(0, COMPLETED_AUDITS_PAGE_SIZE) : auditDocs;

      setHasMoreCompleted(hasMore);
      if (pageDocs.length > 0) {
        setLastCompletedDoc(pageDocs[pageDocs.length - 1]);
      }

      const audits = pageDocs.map((d) => d.data() as Audit);

      // Fetch project titles
      const projectIds = [...new Set(audits.map((a) => a.projectId))];
      const titles = await fetchProjectTitles(projectIds);

      const data = audits.map((audit) => ({
        audit,
        projectTitle: titles[audit.projectId],
      }));

      if (afterDoc) {
        setCompletedAudits((prev) => ({
          data: [...prev.data, ...data],
          loading: false,
          error: null,
        }));
      } else {
        setCompletedAudits({ data, loading: false, error: null });
      }
    } catch {
      setCompletedAudits((prev) => ({
        ...prev,
        loading: false,
        error: 'Failed to load completed audits.',
      }));
    } finally {
      setLoadingMore(false);
    }
  }, [user, fetchProjectTitles]);

  // ─── Initial Data Fetch ──────────────────────────────────────────────────

  useEffect(() => {
    if (user && userProfile) {
      fetchAssignedAudits();
      fetchAvailableProjects();
      fetchCompletedAudits();
    }
  }, [user, userProfile, fetchAssignedAudits, fetchAvailableProjects, fetchCompletedAudits]);

  // ─── Load More Handler ───────────────────────────────────────────────────

  function handleLoadMore() {
    if (hasMoreCompleted && lastCompletedDoc) {
      setCurrentPage((prev) => prev + 1);
      fetchCompletedAudits(lastCompletedDoc);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Auditor Dashboard</h1>
          <p className="text-foreground/60 mt-1">
            Welcome back{userProfile?.name ? `, ${userProfile.name}` : ''}. Here&apos;s your audit overview.
          </p>
        </div>

        {/* Section 1: My Assigned Audits */}
        <section aria-labelledby="assigned-audits-heading" className="mb-8">
          <h2 id="assigned-audits-heading" className="text-lg font-semibold text-foreground mb-4">
            My Assigned Audits
          </h2>

          {assignedAudits.loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <AuditCardSkeleton key={i} />
              ))}
            </div>
          ) : assignedAudits.error ? (
            <SectionError
              message={assignedAudits.error}
              onRetry={fetchAssignedAudits}
            />
          ) : assignedAudits.data.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <EmptyState
                icon="📋"
                title="No assigned audits"
                description="You don't have any pending or in-progress audits. Browse available projects to find verification opportunities."
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {assignedAudits.data.map(({ audit, projectTitle }) => (
                <AuditCard key={audit.auditId} audit={audit} projectTitle={projectTitle} />
              ))}
            </div>
          )}
        </section>

        {/* Section 2: Available Projects */}
        <section aria-labelledby="available-projects-heading" className="mb-8">
          <h2 id="available-projects-heading" className="text-lg font-semibold text-foreground mb-4">
            Available Projects
          </h2>
          <p className="text-sm text-foreground/60 -mt-2 mb-4">
            Projects matching your specializations that need verification.
          </p>

          {availableProjects.loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <ProjectCardSkeleton key={i} />
              ))}
            </div>
          ) : availableProjects.error ? (
            <SectionError
              message={availableProjects.error}
              onRetry={fetchAvailableProjects}
            />
          ) : availableProjects.data.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <EmptyState
                icon="🔍"
                title="No available projects"
                description="There are no projects matching your specializations that need verification right now. Check back later."
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableProjects.data.map((project) => (
                <AvailableProjectCard key={project.projectId} project={project} />
              ))}
            </div>
          )}
        </section>

        {/* Section 3: Completed Audits */}
        <section aria-labelledby="completed-audits-heading">
          <h2 id="completed-audits-heading" className="text-lg font-semibold text-foreground mb-4">
            Completed Audits
          </h2>

          {completedAudits.loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <AuditCardSkeleton key={i} />
              ))}
            </div>
          ) : completedAudits.error ? (
            <SectionError
              message={completedAudits.error}
              onRetry={() => fetchCompletedAudits()}
            />
          ) : completedAudits.data.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <EmptyState
                icon="✅"
                title="No completed audits yet"
                description="Once you complete your first audit, it will appear here."
              />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {completedAudits.data.map(({ audit, projectTitle }) => (
                  <AuditCard key={audit.auditId} audit={audit} projectTitle={projectTitle} />
                ))}
              </div>

              {/* Pagination */}
              {hasMoreCompleted && (
                <div className="mt-6 text-center">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="px-5 py-2.5 text-sm font-medium text-primary-700 border border-primary-300 rounded-lg hover:bg-primary-50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingMore ? 'Loading...' : `Load More (Page ${currentPage})`}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

// ─── Page Export (Wrapped in ProtectedRoute) ─────────────────────────────────

export default function AuditorOverviewPage() {
  return (
    <ProtectedRoute allowedRoles={['auditor']}>
      <AuditorDashboard />
    </ProtectedRoute>
  );
}
