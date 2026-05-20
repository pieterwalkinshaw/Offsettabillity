'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase/config';
import { useAuth } from '@/lib/auth/AuthContext';
import { ProtectedRoute } from '@/lib/auth/ProtectedRoute';
import type { Audit, Project, AuditRecommendation } from '@shared/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SectionState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

interface FormState {
  findings: string;
  scoreContribution: string;
  methodology: string;
  recommendation: AuditRecommendation | '';
}

interface FormErrors {
  findings?: string;
  scoreContribution?: string;
  methodology?: string;
  recommendation?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const RECOMMENDATIONS: { value: AuditRecommendation; label: string; description: string }[] = [
  { value: 'approve', label: 'Approve', description: 'Project meets verification standards' },
  { value: 'conditional', label: 'Conditional', description: 'Project needs minor improvements' },
  { value: 'reject', label: 'Reject', description: 'Project does not meet standards' },
];

// ─── Skeleton Component ──────────────────────────────────────────────────────

function FormSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-3">
        <div className="h-5 w-48 bg-gray-200 rounded" />
        <div className="h-4 w-32 bg-gray-200 rounded" />
        <div className="h-4 w-40 bg-gray-200 rounded" />
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <div className="h-5 w-32 bg-gray-200 rounded" />
        <div className="h-32 w-full bg-gray-200 rounded" />
        <div className="h-10 w-full bg-gray-200 rounded" />
        <div className="h-32 w-full bg-gray-200 rounded" />
        <div className="h-10 w-full bg-gray-200 rounded" />
      </div>
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

// ─── Submit Findings Page Component ──────────────────────────────────────────

function SubmitFindingsPage() {
  const params = useParams();
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const auditId = params.id as string;

  // State
  const [audit, setAudit] = useState<SectionState<Audit | null>>({
    data: null,
    loading: true,
    error: null,
  });
  const [project, setProject] = useState<SectionState<Project | null>>({
    data: null,
    loading: true,
    error: null,
  });

  const [form, setForm] = useState<FormState>({
    findings: '',
    scoreContribution: '',
    methodology: '',
    recommendation: '',
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // ─── Fetch Audit ───────────────────────────────────────────────────────

  const fetchAudit = useCallback(async () => {
    if (!auditId) return;

    setAudit((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const auditDoc = await getDoc(doc(db, 'audits', auditId));

      if (!auditDoc.exists()) {
        setAudit({ data: null, loading: false, error: 'Audit not found.' });
        return;
      }

      const data = auditDoc.data() as Audit;
      setAudit({ data, loading: false, error: null });

      // Fetch the associated project
      if (data.projectId) {
        fetchProject(data.projectId);
      }
    } catch {
      setAudit((prev) => ({
        ...prev,
        loading: false,
        error: 'Failed to load audit details.',
      }));
    }
  }, [auditId]);

  // ─── Fetch Project ─────────────────────────────────────────────────────

  const fetchProject = async (projectId: string) => {
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
  };

  useEffect(() => {
    if (userProfile) {
      fetchAudit();
    }
  }, [userProfile, fetchAudit]);

  // ─── Form Validation ───────────────────────────────────────────────────

  function validateForm(): boolean {
    const errors: FormErrors = {};

    if (!form.findings.trim()) {
      errors.findings = 'Findings are required.';
    }

    const score = parseInt(form.scoreContribution, 10);
    if (form.scoreContribution === '' || isNaN(score)) {
      errors.scoreContribution = 'Score contribution is required.';
    } else if (score < 0 || score > 100) {
      errors.scoreContribution = 'Score must be between 0 and 100.';
    }

    if (!form.methodology.trim()) {
      errors.methodology = 'Methodology description is required.';
    }

    if (!form.recommendation) {
      errors.recommendation = 'Recommendation is required.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ─── Submit Handler ────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm()) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const submitFn = httpsCallable(functions, 'audits_submit');
      const result = await submitFn({
        auditId,
        findings: form.findings.trim(),
        scoreContribution: parseInt(form.scoreContribution, 10),
        methodology: form.methodology.trim(),
        recommendation: form.recommendation,
      });

      const response = result.data as { success: boolean; data?: { verificationScore: number; verificationBadge: string } };

      if (response.success) {
        setSubmitSuccess(true);

        // Redirect to overview after a short delay
        setTimeout(() => {
          router.push('/overview');
        }, 3000);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit findings.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Permission Check ──────────────────────────────────────────────────

  const isAssignedAuditor = audit.data?.auditorId === user?.uid;
  const isSubmittable = audit.data?.status === 'pending' || audit.data?.status === 'in_progress';

  // ─── Render ────────────────────────────────────────────────────────────

  if (audit.loading || project.loading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 md:p-10">
        <div className="max-w-3xl mx-auto">
          <FormSkeleton />
        </div>
      </div>
    );
  }

  if (audit.error) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 md:p-10">
        <div className="max-w-3xl mx-auto">
          <SectionError message={audit.error} onRetry={fetchAudit} />
        </div>
      </div>
    );
  }

  if (submitSuccess) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 md:p-10">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
            <div className="text-5xl mb-4" aria-hidden="true">✅</div>
            <h2 className="text-xl font-bold text-green-800 mb-2">Findings Submitted</h2>
            <p className="text-sm text-green-700 mb-4">
              Your audit findings have been recorded. The project verification score and badge have been updated.
            </p>
            <p className="text-xs text-green-600">Redirecting to dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm text-foreground/60" aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5">
            <li>
              <a href="/overview" className="hover:text-foreground transition-colors">
                Dashboard
              </a>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-foreground font-medium">Submit Audit Findings</li>
          </ol>
        </nav>

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Submit Audit Findings</h1>
          <p className="text-foreground/60 mt-1">
            Complete your verification assessment for this project.
          </p>
        </div>

        {/* Permission Warning */}
        {!isAssignedAuditor && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">
              You are not the assigned auditor for this audit. Only the assigned auditor can submit findings.
            </p>
          </div>
        )}

        {!isSubmittable && audit.data && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-700">
              This audit is in &quot;{audit.data.status}&quot; status and cannot accept submissions.
            </p>
          </div>
        )}

        {/* Project Context */}
        {project.data && (
          <section aria-labelledby="project-context-heading" className="mb-8">
            <h2 id="project-context-heading" className="text-lg font-semibold text-foreground mb-4">
              Project Under Review
            </h2>
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground mb-2">{project.data.title}</h3>
              <p className="text-sm text-foreground/70 mb-3 line-clamp-3">{project.data.description}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-foreground/60">Category:</span>{' '}
                  <span className="text-foreground capitalize">
                    {project.data.category.replace(/-/g, ' ')}
                  </span>
                </div>
                <div>
                  <span className="text-foreground/60">Country:</span>{' '}
                  <span className="text-foreground">{project.data.location?.country || '—'}</span>
                </div>
                <div>
                  <span className="text-foreground/60">Impact Metric:</span>{' '}
                  <span className="text-foreground">
                    {project.data.impactMetrics?.primaryMetric?.label || '—'}:{' '}
                    {project.data.impactMetrics?.primaryMetric?.value?.toLocaleString() || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-foreground/60">Documents:</span>{' '}
                  <span className="text-foreground">
                    {project.data.documents?.length || 0} uploaded
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Submit Error */}
        {submitError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 flex items-center gap-2">
            <span className="text-red-500" aria-hidden="true">⚠️</span>
            <p className="text-sm text-red-700">{submitError}</p>
            <button
              onClick={() => setSubmitError(null)}
              className="ml-auto text-red-600 hover:text-red-800"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {/* Findings Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
            <h2 className="text-lg font-semibold text-foreground">Audit Assessment</h2>

            {/* Findings */}
            <div>
              <label htmlFor="findings" className="block text-sm font-medium text-foreground mb-1.5">
                Findings <span className="text-red-500">*</span>
              </label>
              <textarea
                id="findings"
                rows={6}
                value={form.findings}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, findings: e.target.value }));
                  if (formErrors.findings) setFormErrors((prev) => ({ ...prev, findings: undefined }));
                }}
                placeholder="Describe your verification findings, observations, and evidence reviewed..."
                className={`w-full rounded-lg border px-3 py-2.5 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                  formErrors.findings ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                disabled={!isAssignedAuditor || !isSubmittable || submitting}
              />
              {formErrors.findings && (
                <p className="mt-1 text-xs text-red-600" role="alert">{formErrors.findings}</p>
              )}
            </div>

            {/* Score Contribution */}
            <div>
              <label htmlFor="scoreContribution" className="block text-sm font-medium text-foreground mb-1.5">
                Score Contribution (0–100) <span className="text-red-500">*</span>
              </label>
              <input
                id="scoreContribution"
                type="number"
                min="0"
                max="100"
                value={form.scoreContribution}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, scoreContribution: e.target.value }));
                  if (formErrors.scoreContribution) setFormErrors((prev) => ({ ...prev, scoreContribution: undefined }));
                }}
                placeholder="Enter a score from 0 to 100"
                className={`w-full rounded-lg border px-3 py-2.5 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                  formErrors.scoreContribution ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                disabled={!isAssignedAuditor || !isSubmittable || submitting}
              />
              {formErrors.scoreContribution && (
                <p className="mt-1 text-xs text-red-600" role="alert">{formErrors.scoreContribution}</p>
              )}
              <p className="mt-1 text-xs text-foreground/50">
                This score contributes to the project&apos;s overall verification score.
              </p>
            </div>

            {/* Methodology */}
            <div>
              <label htmlFor="methodology" className="block text-sm font-medium text-foreground mb-1.5">
                Methodology <span className="text-red-500">*</span>
              </label>
              <textarea
                id="methodology"
                rows={4}
                value={form.methodology}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, methodology: e.target.value }));
                  if (formErrors.methodology) setFormErrors((prev) => ({ ...prev, methodology: undefined }));
                }}
                placeholder="Describe the verification methodology used (document review, site visit, data analysis, etc.)..."
                className={`w-full rounded-lg border px-3 py-2.5 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                  formErrors.methodology ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                disabled={!isAssignedAuditor || !isSubmittable || submitting}
              />
              {formErrors.methodology && (
                <p className="mt-1 text-xs text-red-600" role="alert">{formErrors.methodology}</p>
              )}
            </div>

            {/* Recommendation */}
            <div>
              <fieldset>
                <legend className="block text-sm font-medium text-foreground mb-3">
                  Recommendation <span className="text-red-500">*</span>
                </legend>
                <div className="space-y-2">
                  {RECOMMENDATIONS.map((rec) => (
                    <label
                      key={rec.value}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        form.recommendation === rec.value
                          ? 'border-primary-300 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      } ${(!isAssignedAuditor || !isSubmittable || submitting) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <input
                        type="radio"
                        name="recommendation"
                        value={rec.value}
                        checked={form.recommendation === rec.value}
                        onChange={(e) => {
                          setForm((prev) => ({ ...prev, recommendation: e.target.value as AuditRecommendation }));
                          if (formErrors.recommendation) setFormErrors((prev) => ({ ...prev, recommendation: undefined }));
                        }}
                        className="mt-0.5 h-4 w-4 text-primary-600 focus:ring-primary-500"
                        disabled={!isAssignedAuditor || !isSubmittable || submitting}
                      />
                      <div>
                        <p className="text-sm font-medium text-foreground">{rec.label}</p>
                        <p className="text-xs text-foreground/60">{rec.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
                {formErrors.recommendation && (
                  <p className="mt-2 text-xs text-red-600" role="alert">{formErrors.recommendation}</p>
                )}
              </fieldset>
            </div>

            {/* Submit Button */}
            <div className="pt-4 border-t border-gray-200">
              <button
                type="submit"
                disabled={!isAssignedAuditor || !isSubmittable || submitting}
                className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <svg
                      className="animate-spin -ml-0.5 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Submitting...
                  </>
                ) : (
                  'Submit Findings'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page Export ──────────────────────────────────────────────────────────────

export default function AuditSubmitPage() {
  return (
    <ProtectedRoute allowedRoles={['auditor']}>
      <SubmitFindingsPage />
    </ProtectedRoute>
  );
}
