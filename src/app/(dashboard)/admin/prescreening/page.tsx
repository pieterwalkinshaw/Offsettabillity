'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase/config';
import { useAuth } from '@/lib/auth/AuthContext';
import { ProtectedRoute } from '@/lib/auth/ProtectedRoute';
import type { Project } from '@shared/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SectionState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

// ─── Skeleton Components ─────────────────────────────────────────────────────

function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-gray-100 animate-pulse">
      <div className="h-4 w-40 bg-gray-200 rounded" />
      <div className="h-4 w-24 bg-gray-200 rounded" />
      <div className="h-4 w-20 bg-gray-200 rounded" />
      <div className="h-8 w-24 bg-gray-200 rounded ml-auto" />
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
    <div className="text-center py-10 px-4">
      <div className="text-4xl mb-3" aria-hidden="true">{icon}</div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-foreground/60 mt-1">{description}</p>
    </div>
  );
}

// ─── Pre-screening Page Component ────────────────────────────────────────────

function PrescreeningPage() {
  const { userProfile } = useAuth();

  const [projects, setProjects] = useState<SectionState<Project[]>>({
    data: [],
    loading: true,
    error: null,
  });

  const [prescreenedProjects, setPrescreenedProjects] = useState<SectionState<Project[]>>({
    data: [],
    loading: true,
    error: null,
  });

  const [prescreeningId, setPrescreeningId] = useState<string | null>(null);
  const [prescreenError, setPrescreenError] = useState<string | null>(null);
  const [prescreenSuccess, setPrescreenSuccess] = useState<string | null>(null);

  // ─── Fetch Submitted Projects ──────────────────────────────────────────

  const fetchSubmittedProjects = useCallback(async () => {
    setProjects((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const q = query(
        collection(db, 'projects'),
        where('verificationStatus', '==', 'submitted'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => doc.data() as Project);

      setProjects({ data, loading: false, error: null });
    } catch {
      setProjects((prev) => ({
        ...prev,
        loading: false,
        error: 'Failed to load submitted projects.',
      }));
    }
  }, []);

  // ─── Fetch Prescreened Projects (Ready for Auditor Assignment) ──────────

  const fetchPrescreenedProjects = useCallback(async () => {
    setPrescreenedProjects((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const q = query(
        collection(db, 'projects'),
        where('verificationStatus', '==', 'prescreened'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => doc.data() as Project);

      setPrescreenedProjects({ data, loading: false, error: null });
    } catch {
      setPrescreenedProjects((prev) => ({
        ...prev,
        loading: false,
        error: 'Failed to load prescreened projects.',
      }));
    }
  }, []);

  useEffect(() => {
    if (userProfile) {
      fetchSubmittedProjects();
      fetchPrescreenedProjects();
    }
  }, [userProfile, fetchSubmittedProjects, fetchPrescreenedProjects]);

  // ─── Pre-screen Action ─────────────────────────────────────────────────

  async function handlePrescreen(projectId: string) {
    setPrescreeningId(projectId);
    setPrescreenError(null);
    setPrescreenSuccess(null);

    try {
      const prescreenFn = httpsCallable(functions, 'admin_prescreenProject');
      await prescreenFn({ projectId });

      setPrescreenSuccess(`Project pre-screened successfully.`);

      // Remove the project from the submitted list and add to prescreened list
      const prescreenedProject = projects.data.find((p) => p.projectId === projectId);
      setProjects((prev) => ({
        ...prev,
        data: prev.data.filter((p) => p.projectId !== projectId),
      }));
      if (prescreenedProject) {
        setPrescreenedProjects((prev) => ({
          ...prev,
          data: [{ ...prescreenedProject, verificationStatus: 'prescreened' }, ...prev.data],
        }));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to pre-screen project.';
      setPrescreenError(message);
    } finally {
      setPrescreeningId(null);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Pre-screening</h1>
          <p className="text-foreground/60 mt-1">
            Review submitted projects and approve them for auditor assignment.
          </p>
        </div>

        {/* Success/Error Toasts */}
        {prescreenSuccess && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 flex items-center gap-2">
            <span className="text-green-600" aria-hidden="true">✓</span>
            <p className="text-sm text-green-700">{prescreenSuccess}</p>
            <button
              onClick={() => setPrescreenSuccess(null)}
              className="ml-auto text-green-600 hover:text-green-800"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {prescreenError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 flex items-center gap-2">
            <span className="text-red-500" aria-hidden="true">⚠️</span>
            <p className="text-sm text-red-700">{prescreenError}</p>
            <button
              onClick={() => setPrescreenError(null)}
              className="ml-auto text-red-600 hover:text-red-800"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {/* Projects Table */}
        <section aria-labelledby="submitted-projects-heading">
          <h2 id="submitted-projects-heading" className="sr-only">
            Submitted Projects
          </h2>

          {projects.loading ? (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRowSkeleton key={i} />
              ))}
            </div>
          ) : projects.error ? (
            <SectionError
              message={projects.error}
              onRetry={fetchSubmittedProjects}
            />
          ) : projects.data.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <EmptyState
                icon="📋"
                title="No projects awaiting pre-screening"
                description="All submitted projects have been reviewed."
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
                      <th className="text-left px-4 py-3 font-medium text-foreground/70">Country</th>
                      <th className="text-left px-4 py-3 font-medium text-foreground/70">Submitted</th>
                      <th className="text-right px-4 py-3 font-medium text-foreground/70">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.data.map((project) => (
                      <tr
                        key={project.projectId}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
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
                          {project.createdAt
                            ? new Date(project.createdAt).toLocaleDateString()
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handlePrescreen(project.projectId)}
                            disabled={prescreeningId === project.projectId}
                            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {prescreeningId === project.projectId ? (
                              <>
                                <svg
                                  className="animate-spin -ml-0.5 mr-1.5 h-3.5 w-3.5 text-white"
                                  xmlns="http://www.w3.org/2000/svg"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  aria-hidden="true"
                                >
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Processing...
                              </>
                            ) : (
                              'Pre-screen'
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* Prescreened Projects — Ready for Auditor Assignment */}
        <section aria-labelledby="prescreened-projects-heading" className="mt-10">
          <h2 id="prescreened-projects-heading" className="text-lg font-semibold text-foreground mb-4">
            Prescreened — Ready for Auditor Assignment
          </h2>

          {prescreenedProjects.loading ? (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              {Array.from({ length: 3 }).map((_, i) => (
                <TableRowSkeleton key={i} />
              ))}
            </div>
          ) : prescreenedProjects.error ? (
            <SectionError
              message={prescreenedProjects.error}
              onRetry={fetchPrescreenedProjects}
            />
          ) : prescreenedProjects.data.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <EmptyState
                icon="✅"
                title="No prescreened projects pending assignment"
                description="Pre-screen submitted projects above to move them here."
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
                      <th className="text-left px-4 py-3 font-medium text-foreground/70">Country</th>
                      <th className="text-right px-4 py-3 font-medium text-foreground/70">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prescreenedProjects.data.map((project) => (
                      <tr
                        key={project.projectId}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-foreground max-w-[200px] truncate">
                          {project.title}
                        </td>
                        <td className="px-4 py-3 text-foreground/70 capitalize">
                          {project.category.replace(/-/g, ' ')}
                        </td>
                        <td className="px-4 py-3 text-foreground/70">
                          {project.location?.country || '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <a
                            href={`/admin/prescreening/${project.projectId}/assign`}
                            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                          >
                            Assign Auditor
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ─── Page Export ──────────────────────────────────────────────────────────────

export default function AdminPrescreeningPage() {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <PrescreeningPage />
    </ProtectedRoute>
  );
}
