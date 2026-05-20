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
import { ProjectCard } from '@/components/projects/ProjectCard';
import { OwnerDashboard } from '@/components/dashboard/OwnerDashboard';
import type { FundingTransaction, Project, User } from '@shared/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const FUNDED_PROJECTS_PAGE_SIZE = 25;
const RECOMMENDED_PROJECTS_LIMIT = 10;

// ─── Types ───────────────────────────────────────────────────────────────────

interface SectionState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatZARCents(cents: number): string {
  const rands = cents / 100;
  return `R ${rands.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Skeleton Components ─────────────────────────────────────────────────────

function CardSkeleton() {
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
      <div className="flex justify-between">
        <div className="h-3 w-24 bg-gray-200 rounded" />
        <div className="h-4 w-6 bg-gray-200 rounded" />
      </div>
    </div>
  );
}

function MetricSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm animate-pulse">
      <div className="h-4 w-32 bg-gray-200 rounded mb-3" />
      <div className="h-8 w-40 bg-gray-200 rounded" />
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

// ─── Funder Dashboard Component ──────────────────────────────────────────────

function FunderDashboard() {
  const { user, userProfile } = useAuth();

  // Section states
  const [fundedProjects, setFundedProjects] = useState<SectionState<Project[]>>({
    data: [],
    loading: true,
    error: null,
  });
  const [totalContribution, setTotalContribution] = useState<SectionState<number>>({
    data: 0,
    loading: true,
    error: null,
  });
  const [recommendedProjects, setRecommendedProjects] = useState<SectionState<Project[]>>({
    data: [],
    loading: true,
    error: null,
  });

  // Pagination state for funded projects
  const [lastFundedDoc, setLastFundedDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMoreFunded, setHasMoreFunded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  // ─── Fetch Funded Projects ───────────────────────────────────────────────

  const fetchFundedProjects = useCallback(async (afterDoc?: DocumentSnapshot | null) => {
    if (!user) return;

    if (!afterDoc) {
      setFundedProjects((prev) => ({ ...prev, loading: true, error: null }));
    } else {
      setLoadingMore(true);
    }

    try {
      // Query confirmed funding transactions for this funder
      let fundingQuery = query(
        collection(db, 'funding'),
        where('funderId', '==', user.uid),
        where('status', '==', 'confirmed'),
        orderBy('createdAt', 'desc'),
        limit(FUNDED_PROJECTS_PAGE_SIZE + 1)
      );

      if (afterDoc) {
        fundingQuery = query(
          collection(db, 'funding'),
          where('funderId', '==', user.uid),
          where('status', '==', 'confirmed'),
          orderBy('createdAt', 'desc'),
          startAfter(afterDoc),
          limit(FUNDED_PROJECTS_PAGE_SIZE + 1)
        );
      }

      const fundingSnapshot = await getDocs(fundingQuery);
      const fundingDocs = fundingSnapshot.docs;

      // Check if there are more pages
      const hasMore = fundingDocs.length > FUNDED_PROJECTS_PAGE_SIZE;
      const pageDocs = hasMore ? fundingDocs.slice(0, FUNDED_PROJECTS_PAGE_SIZE) : fundingDocs;

      setHasMoreFunded(hasMore);
      if (pageDocs.length > 0) {
        setLastFundedDoc(pageDocs[pageDocs.length - 1]);
      }

      // Get unique project IDs from funding transactions
      const projectIds = [...new Set(
        pageDocs.map((doc) => (doc.data() as FundingTransaction).projectId)
      )];

      // Fetch the related projects
      let projects: Project[] = [];
      if (projectIds.length > 0) {
        // Firestore 'in' queries support up to 30 items
        const projectQuery = query(
          collection(db, 'projects'),
          where('projectId', 'in', projectIds)
        );
        const projectSnapshot = await getDocs(projectQuery);
        projects = projectSnapshot.docs.map((doc) => doc.data() as Project);

        // Sort projects by the order of funding transactions
        projects.sort((a, b) => {
          const indexA = projectIds.indexOf(a.projectId);
          const indexB = projectIds.indexOf(b.projectId);
          return indexA - indexB;
        });
      }

      if (afterDoc) {
        setFundedProjects((prev) => ({
          data: [...prev.data, ...projects],
          loading: false,
          error: null,
        }));
      } else {
        setFundedProjects({ data: projects, loading: false, error: null });
      }
    } catch {
      setFundedProjects((prev) => ({
        ...prev,
        loading: false,
        error: 'Failed to load funded projects.',
      }));
    } finally {
      setLoadingMore(false);
    }
  }, [user]);

  // ─── Fetch Total Impact Contribution ─────────────────────────────────────

  const fetchTotalContribution = useCallback(async () => {
    if (!user) return;

    setTotalContribution({ data: 0, loading: true, error: null });

    try {
      const fundingQuery = query(
        collection(db, 'funding'),
        where('funderId', '==', user.uid),
        where('status', '==', 'confirmed')
      );
      const snapshot = await getDocs(fundingQuery);

      let total = 0;
      snapshot.docs.forEach((doc) => {
        const data = doc.data() as FundingTransaction;
        total += data.amount;
      });

      setTotalContribution({ data: total, loading: false, error: null });
    } catch {
      setTotalContribution((prev) => ({
        ...prev,
        loading: false,
        error: 'Failed to load total contribution.',
      }));
    }
  }, [user]);

  // ─── Fetch Recommended Projects ──────────────────────────────────────────

  const fetchRecommendedProjects = useCallback(async () => {
    if (!user) return;

    setRecommendedProjects({ data: [], loading: true, error: null });

    try {
      // Fetch the full user document to get esgProfile interests
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.exists() ? (userDoc.data() as User) : null;
      const interests = userData?.esgProfile?.interests ?? [];

      // Get all project IDs the funder has already funded
      const fundingQuery = query(
        collection(db, 'funding'),
        where('funderId', '==', user.uid),
        where('status', '==', 'confirmed')
      );
      const fundingSnapshot = await getDocs(fundingQuery);
      const fundedProjectIds = new Set(
        fundingSnapshot.docs.map((doc) => (doc.data() as FundingTransaction).projectId)
      );

      // Query verified projects — we'll filter by ESG interests client-side
      // since Firestore doesn't support complex array-contains-any + not-in combinations
      const projectQuery = query(
        collection(db, 'projects'),
        where('verificationStatus', 'in', ['verified', 'live']),
        orderBy('verificationScore', 'desc'),
        limit(50) // Fetch more than needed to filter client-side
      );
      const projectSnapshot = await getDocs(projectQuery);

      const allProjects = projectSnapshot.docs.map((doc) => doc.data() as Project);

      // Filter: match interests and exclude already-funded projects
      let recommended = allProjects.filter((project) => {
        // Exclude already funded
        if (fundedProjectIds.has(project.projectId)) return false;
        // If user has interests, match by category
        if (interests.length > 0) {
          return interests.includes(project.category);
        }
        // If no interests set, show all verified projects
        return true;
      });

      // Limit to 10
      recommended = recommended.slice(0, RECOMMENDED_PROJECTS_LIMIT);

      setRecommendedProjects({ data: recommended, loading: false, error: null });
    } catch {
      setRecommendedProjects((prev) => ({
        ...prev,
        loading: false,
        error: 'Failed to load recommended projects.',
      }));
    }
  }, [user]);

  // ─── Initial Data Fetch ──────────────────────────────────────────────────

  useEffect(() => {
    if (user && userProfile) {
      fetchFundedProjects();
      fetchTotalContribution();
      fetchRecommendedProjects();
    }
  }, [user, userProfile, fetchFundedProjects, fetchTotalContribution, fetchRecommendedProjects]);

  // ─── Load More Handler ───────────────────────────────────────────────────

  function handleLoadMore() {
    if (hasMoreFunded && lastFundedDoc) {
      setCurrentPage((prev) => prev + 1);
      fetchFundedProjects(lastFundedDoc);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-foreground/60 mt-1">
            Welcome back{userProfile?.name ? `, ${userProfile.name}` : ''}. Here&apos;s your funding overview.
          </p>
        </div>

        {/* Section 1: Total Impact Contribution */}
        <section aria-labelledby="total-contribution-heading" className="mb-8">
          <h2 id="total-contribution-heading" className="text-lg font-semibold text-foreground mb-4">
            Total Impact Contribution
          </h2>

          {totalContribution.loading ? (
            <MetricSkeleton />
          ) : totalContribution.error ? (
            <SectionError
              message={totalContribution.error}
              onRetry={fetchTotalContribution}
            />
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-foreground/60 mb-1">Total confirmed funding</p>
              <p className="text-3xl font-bold text-primary-700">
                {formatZARCents(totalContribution.data)}
              </p>
            </div>
          )}
        </section>

        {/* Section 2: My Funded Projects */}
        <section aria-labelledby="funded-projects-heading" className="mb-8">
          <h2 id="funded-projects-heading" className="text-lg font-semibold text-foreground mb-4">
            My Funded Projects
          </h2>

          {fundedProjects.loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : fundedProjects.error ? (
            <SectionError
              message={fundedProjects.error}
              onRetry={() => fetchFundedProjects()}
            />
          ) : fundedProjects.data.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <EmptyState
                icon="💰"
                title="No funded projects yet"
                description="Browse verified projects and make your first impact investment."
                actionLabel="Browse Projects"
                actionHref="/projects"
              />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {fundedProjects.data.map((project) => (
                  <ProjectCard key={project.projectId} project={project} />
                ))}
              </div>

              {/* Pagination */}
              {hasMoreFunded && (
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

        {/* Section 3: Recommended Projects */}
        <section aria-labelledby="recommended-projects-heading">
          <h2 id="recommended-projects-heading" className="text-lg font-semibold text-foreground mb-4">
            Recommended Projects
          </h2>
          <p className="text-sm text-foreground/60 -mt-2 mb-4">
            Verified projects matching your ESG profile interests.
          </p>

          {recommendedProjects.loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : recommendedProjects.error ? (
            <SectionError
              message={recommendedProjects.error}
              onRetry={fetchRecommendedProjects}
            />
          ) : recommendedProjects.data.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <EmptyState
                icon="🔍"
                title="No recommendations available"
                description="Update your ESG profile interests to get personalized project recommendations."
                actionLabel="Browse All Projects"
                actionHref="/projects"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recommendedProjects.data.map((project) => (
                <ProjectCard key={project.projectId} project={project} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ─── Role-Based Dashboard Router ─────────────────────────────────────────────

function DashboardRouter() {
  const { userProfile } = useAuth();

  if (!userProfile) return null;

  switch (userProfile.role) {
    case 'owner':
      return <OwnerDashboard />;
    case 'funder':
    default:
      return <FunderDashboard />;
  }
}

// ─── Page Export ──────────────────────────────────────────────────────────────

export default function OverviewPage() {
  return <DashboardRouter />;
}
