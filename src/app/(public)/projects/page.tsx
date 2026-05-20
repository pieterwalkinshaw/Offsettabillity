'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { ProjectCard } from '@/components/projects/ProjectCard';
import type { Project, TaxonomyCategory } from '@shared/types';

const PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const VISIBLE_STATUSES = ['verified', 'live', 'funded'] as const;

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<TaxonomyCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalLoaded, setTotalLoaded] = useState(0);

  // Fetch active taxonomy categories for the filter dropdown
  useEffect(() => {
    async function fetchCategories() {
      try {
        const categoriesRef = collection(db, 'taxonomy');
        const q = query(
          categoriesRef,
          where('isActive', '==', true),
          orderBy('sortOrder', 'asc')
        );
        const snapshot = await getDocs(q);
        const cats = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as TaxonomyCategory[];
        setCategories(cats);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      }
    }
    fetchCategories();
  }, []);

  // Fetch projects when category filter changes
  const fetchProjects = useCallback(async (category: string, cursor?: DocumentSnapshot | null) => {
    const isLoadMore = !!cursor;
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const projectsRef = collection(db, 'projects');

      let q;
      if (category && cursor) {
        q = query(
          projectsRef,
          where('verificationStatus', 'in', [...VISIBLE_STATUSES]),
          where('category', '==', category),
          orderBy('createdAt', 'desc'),
          startAfter(cursor),
          limit(PAGE_SIZE)
        );
      } else if (category) {
        q = query(
          projectsRef,
          where('verificationStatus', 'in', [...VISIBLE_STATUSES]),
          where('category', '==', category),
          orderBy('createdAt', 'desc'),
          limit(PAGE_SIZE)
        );
      } else if (cursor) {
        q = query(
          projectsRef,
          where('verificationStatus', 'in', [...VISIBLE_STATUSES]),
          orderBy('createdAt', 'desc'),
          startAfter(cursor),
          limit(PAGE_SIZE)
        );
      } else {
        q = query(
          projectsRef,
          where('verificationStatus', 'in', [...VISIBLE_STATUSES]),
          orderBy('createdAt', 'desc'),
          limit(PAGE_SIZE)
        );
      }

      const snapshot = await getDocs(q);

      const fetchedProjects = snapshot.docs.map((doc) => ({
        projectId: doc.id,
        ...doc.data(),
      })) as Project[];

      if (isLoadMore) {
        setProjects((prev) => [...prev, ...fetchedProjects]);
        setTotalLoaded((prev) => prev + fetchedProjects.length);
      } else {
        setProjects(fetchedProjects);
        setTotalLoaded(fetchedProjects.length);
      }

      const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;
      setLastDoc(lastVisible);

      // Determine if there are more results and we haven't hit the max
      const newTotal = isLoadMore
        ? totalLoaded + fetchedProjects.length
        : fetchedProjects.length;
      setHasMore(fetchedProjects.length === PAGE_SIZE && newTotal < MAX_PAGE_SIZE);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [totalLoaded]);

  // Initial fetch and refetch on category change
  useEffect(() => {
    setLastDoc(null);
    setTotalLoaded(0);
    setHasMore(false);
    fetchProjects(selectedCategory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  const handleLoadMore = () => {
    if (lastDoc && hasMore) {
      fetchProjects(selectedCategory, lastDoc);
    }
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Page Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
            Verified Impact Projects
          </h1>
          <p className="mt-2 text-foreground/60 text-base sm:text-lg max-w-2xl">
            Browse independently verified ESG projects ready for funding. Every project has been audited for impact and compliance.
          </p>
        </div>
      </header>

      {/* Filter Bar */}
      <div className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <label
              htmlFor="category-filter"
              className="text-sm font-medium text-foreground/70"
            >
              Filter by category:
            </label>
            <select
              id="category-filter"
              value={selectedCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full sm:w-64 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              aria-label="Filter projects by category"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {selectedCategory && (
              <button
                type="button"
                onClick={() => handleCategoryChange('')}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium underline underline-offset-2"
              >
                Clear filter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Project Grid */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <ProjectGridSkeleton />
        ) : projects.length === 0 ? (
          <EmptyState
            category={selectedCategory}
            categoryName={categories.find((c) => c.id === selectedCategory)?.name}
            onClearFilter={() => handleCategoryChange('')}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <ProjectCard key={project.projectId} project={project} />
              ))}
            </div>

            {/* Load More / Pagination */}
            {hasMore && (
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="rounded-lg bg-primary-600 px-6 py-3 text-white font-semibold hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingMore ? 'Loading...' : 'Load More Projects'}
                </button>
              </div>
            )}

            {!hasMore && projects.length > 0 && (
              <p className="mt-8 text-center text-sm text-foreground/50">
                Showing all {projects.length} project{projects.length !== 1 ? 's' : ''}
                {selectedCategory ? ' in this category' : ''}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}

/**
 * Skeleton loading state for the project grid.
 */
function ProjectGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-gray-200 bg-white p-5 animate-pulse"
        >
          <div className="h-4 w-3/4 bg-gray-200 rounded mb-3" />
          <div className="h-3 w-1/2 bg-gray-100 rounded mb-4" />
          <div className="h-3 w-full bg-gray-100 rounded mb-2" />
          <div className="h-3 w-2/3 bg-gray-100 rounded mb-4" />
          <div className="h-8 w-full bg-gray-100 rounded" />
        </div>
      ))}
    </div>
  );
}

/**
 * Empty state shown when no projects match the current filter.
 */
function EmptyState({
  category,
  categoryName,
  onClearFilter,
}: {
  category: string;
  categoryName?: string;
  onClearFilter: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {/* Illustration */}
      <div className="mb-6">
        <svg
          className="w-32 h-32 text-primary-200"
          viewBox="0 0 128 128"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <circle cx="64" cy="64" r="56" fill="currentColor" opacity="0.3" />
          <path
            d="M44 52h40M44 64h28M44 76h36"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <circle cx="92" cy="92" r="16" fill="currentColor" opacity="0.5" />
          <path
            d="M88 92h8M92 88v8"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <h2 className="text-xl font-semibold text-foreground mb-2">
        No projects found{categoryName ? ` in ${categoryName}` : ''}
      </h2>
      <p className="text-foreground/60 max-w-md mb-6">
        {category
          ? "There are no verified projects in this category yet. Try browsing all categories to discover available impact opportunities."
          : "There are no verified projects available at the moment. Check back soon as new projects are being verified regularly."}
      </p>

      {category && (
        <button
          type="button"
          onClick={onClearFilter}
          className="rounded-lg bg-primary-600 px-6 py-3 text-white font-semibold hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
        >
          Browse All Projects
        </button>
      )}
    </div>
  );
}
