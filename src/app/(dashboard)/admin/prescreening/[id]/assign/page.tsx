'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase/config';
import { useAuth } from '@/lib/auth/AuthContext';
import { ProtectedRoute } from '@/lib/auth/ProtectedRoute';
import type { Project, User } from '@shared/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SectionState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

// ─── Skeleton Components ─────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm animate-pulse space-y-3">
      <div className="h-5 w-48 bg-gray-200 rounded" />
      <div className="h-4 w-32 bg-gray-200 rounded" />
      <div className="h-4 w-40 bg-gray-200 rounded" />
    </div>
  );
}

function AuditorListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg animate-pulse">
          <div className="h-4 w-32 bg-gray-200 rounded" />
          <div className="h-4 w-24 bg-gray-200 rounded" />
          <div className="h-8 w-20 bg-gray-200 rounded ml-auto" />
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

// ─── Assign Auditor Page Component ───────────────────────────────────────────

function AssignAuditorPage() {
  const params = useParams();
  const router = useRouter();
  const { userProfile } = useAuth();
  const projectId = params.id as string;

  // State
  const [project, setProject] = useState<SectionState<Project | null>>({
    data: null,
    loading: true,
    error: null,
  });
  const [auditors, setAuditors] = useState<SectionState<User[]>>({
    data: [],
    loading: true,
    error: null,
  });
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);

  // ─── Fetch Project ─────────────────────────────────────────────────────

  const fetchProject = useCallback(async () => {
    if (!projectId) return;

    setProject((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const projectDoc = await getDoc(doc(db, 'projects', projectId));

      if (!projectDoc.exists()) {
        setProject({ data: null, loading: false, error: 'Project not found.' });
        return;
      }

      const data = projectDoc.data() as Project;
      setProject({ data, loading: false, error: null });
    } catch {
      setProject((prev) => ({
        ...prev,
        loading: false,
        error: 'Failed to load project details.',
      }));
    }
  }, [projectId]);

  // ─── Fetch Approved Auditors ───────────────────────────────────────────

  const fetchAuditors = useCallback(async () => {
    setAuditors((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const q = query(
        collection(db, 'users'),
        where('role', '==', 'auditor'),
        where('isApproved', '==', true)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => doc.data() as User);

      setAuditors({ data, loading: false, error: null });
    } catch {
      setAuditors((prev) => ({
        ...prev,
        loading: false,
        error: 'Failed to load approved auditors.',
      }));
    }
  }, []);

  useEffect(() => {
    if (userProfile) {
      fetchProject();
      fetchAuditors();
    }
  }, [userProfile, fetchProject, fetchAuditors]);

  // ─── Assign Auditor Action ─────────────────────────────────────────────

  async function handleAssign(auditorId: string) {
    setAssigningId(auditorId);
    setAssignError(null);
    setAssignSuccess(null);

    try {
      const assignFn = httpsCallable(functions, 'admin_assignAudit');
      await assignFn({ projectId, auditorId });

      setAssignSuccess('Auditor assigned successfully. Project is now pending audit.');

      // Redirect back to prescreening after a short delay
      setTimeout(() => {
        router.push('/admin/prescreening');
      }, 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to assign auditor.';
      setAssignError(message);
    } finally {
      setAssigningId(null);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────

  const isProjectPrescreened = project.data?.verificationStatus === 'prescreened';

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm text-foreground/60" aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5">
            <li>
              <a href="/admin/prescreening" className="hover:text-foreground transition-colors">
                Pre-screening
              </a>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-foreground font-medium">Assign Auditor</li>
          </ol>
        </nav>

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Assign Auditor</h1>
          <p className="text-foreground/60 mt-1">
            Select an approved auditor to verify this project.
          </p>
        </div>

        {/* Success/Error Messages */}
        {assignSuccess && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 flex items-center gap-2">
            <span className="text-green-600" aria-hidden="true">✓</span>
            <p className="text-sm text-green-700">{assignSuccess}</p>
          </div>
        )}

        {assignError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 flex items-center gap-2">
            <span className="text-red-500" aria-hidden="true">⚠️</span>
            <p className="text-sm text-red-700">{assignError}</p>
            <button
              onClick={() => setAssignError(null)}
              className="ml-auto text-red-600 hover:text-red-800"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {/* Project Details */}
        <section aria-labelledby="project-details-heading" className="mb-8">
          <h2 id="project-details-heading" className="text-lg font-semibold text-foreground mb-4">
            Project Details
          </h2>

          {project.loading ? (
            <DetailSkeleton />
          ) : project.error ? (
            <SectionError message={project.error} onRetry={fetchProject} />
          ) : project.data ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground mb-2">{project.data.title}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-foreground/60">Category:</span>{' '}
                  <span className="text-foreground capitalize">
                    {project.data.category.replace(/-/g, ' ')}
                  </span>
                </div>
                <div>
                  <span className="text-foreground/60">Country:</span>{' '}
                  <span className="text-foreground">
                    {project.data.location?.country || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-foreground/60">Status:</span>{' '}
                  <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 capitalize">
                    {project.data.verificationStatus.replace(/_/g, ' ')}
                  </span>
                </div>
                <div>
                  <span className="text-foreground/60">Funding Goal:</span>{' '}
                  <span className="text-foreground">
                    R {(project.data.fundingGoal / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {!isProjectPrescreened && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm text-amber-700">
                    This project is not in &quot;prescreened&quot; status. Only prescreened projects can be assigned an auditor.
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </section>

        {/* Auditor Selection */}
        <section aria-labelledby="auditor-selection-heading">
          <h2 id="auditor-selection-heading" className="text-lg font-semibold text-foreground mb-4">
            Approved Auditors
          </h2>

          {auditors.loading ? (
            <AuditorListSkeleton />
          ) : auditors.error ? (
            <SectionError message={auditors.error} onRetry={fetchAuditors} />
          ) : auditors.data.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="text-center py-10 px-4">
                <div className="text-4xl mb-3" aria-hidden="true">👤</div>
                <h3 className="text-base font-semibold text-foreground">No approved auditors</h3>
                <p className="text-sm text-foreground/60 mt-1">
                  Approve auditor accounts before assigning them to projects.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {auditors.data.map((auditor) => (
                <div
                  key={auditor.userId}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-gray-200 bg-white shadow-sm hover:border-gray-300 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{auditor.name}</p>
                    <p className="text-sm text-foreground/60 truncate">{auditor.email}</p>
                    {auditor.specializations && auditor.specializations.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {auditor.specializations.map((spec) => (
                          <span
                            key={spec}
                            className="inline-block rounded-full px-2 py-0.5 text-xs bg-blue-50 text-blue-700 capitalize"
                          >
                            {spec.replace(/-/g, ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-foreground/60">
                    <span>{auditor.country}</span>
                  </div>
                  <button
                    onClick={() => handleAssign(auditor.userId)}
                    disabled={!isProjectPrescreened || assigningId === auditor.userId || !!assignSuccess}
                    className="shrink-0 inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {assigningId === auditor.userId ? (
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
                        Assigning...
                      </>
                    ) : (
                      'Assign'
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ─── Page Export ──────────────────────────────────────────────────────────────

export default function AdminAssignAuditPage() {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <AssignAuditorPage />
    </ProtectedRoute>
  );
}
