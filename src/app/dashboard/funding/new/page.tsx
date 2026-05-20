'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase/config';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  Loader2,
  AlertCircle,
  TrendingUp,
  ShieldCheck,
  MapPin,
  CheckCircle2,
} from 'lucide-react';
import type { Project, VerificationBadge } from '@shared/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(cents: number): string {
  return `R ${(cents / 100).toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function badgeColor(badge: VerificationBadge): string {
  switch (badge) {
    case 'Premium Assured':
      return 'bg-amber-100 text-amber-700';
    case 'Verified+':
      return 'bg-green-100 text-green-700';
    case 'Verified':
      return 'bg-blue-100 text-blue-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function FundingNewPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { userProfile, loading: authLoading } = useAuth();

  const projectId = searchParams.get('projectId');

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [amountRands, setAmountRands] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  // Redirect if not a funder
  useEffect(() => {
    if (!authLoading && userProfile && userProfile.role !== 'funder') {
      setError('Only funders can commit funding to projects.');
    }
  }, [authLoading, userProfile]);

  // Fetch project data
  useEffect(() => {
    if (!projectId) {
      setError('No project specified. Please select a project to fund.');
      setLoading(false);
      return;
    }

    async function fetchProject() {
      setLoading(true);
      setError(null);
      try {
        const projectRef = doc(db, 'projects', projectId!);
        const projectSnap = await getDoc(projectRef);

        if (!projectSnap.exists()) {
          setError('Project not found.');
          setLoading(false);
          return;
        }

        const projectData = {
          ...projectSnap.data(),
          projectId: projectSnap.id,
        } as Project;

        // Check eligibility
        if (
          projectData.verificationStatus !== 'verified' &&
          projectData.verificationStatus !== 'live'
        ) {
          setError(
            'This project is not currently eligible for funding. Only verified or live projects can receive funding.'
          );
          setLoading(false);
          return;
        }

        setProject(projectData);
      } catch {
        setError('Failed to load project details. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchProject();
  }, [projectId]);

  // Handle amount input
  const handleAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/[^0-9.]/g, '');
      setAmountRands(value);
      setFieldError(null);
    },
    []
  );

  // Submit funding commitment
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFieldError(null);

      if (!project || !projectId) return;

      // Parse and validate amount
      const parsedAmount = parseFloat(amountRands);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        setFieldError('Please enter a valid amount.');
        return;
      }

      const amountCents = Math.round(parsedAmount * 100);

      // Validate range: R10.00 (1000 cents) to R1,000,000.00 (100000000 cents)
      if (amountCents < 1000) {
        setFieldError('Minimum funding amount is R 10.00.');
        return;
      }
      if (amountCents > 100000000) {
        setFieldError('Maximum funding amount is R 1,000,000.00 per transaction.');
        return;
      }

      setSubmitting(true);

      try {
        const fundingCreateFn = httpsCallable<
          { projectId: string; amount: number; currency: string },
          { transactionId: string; projectId: string }
        >(functions, 'funding_create');

        const result = await fundingCreateFn({
          projectId,
          amount: amountCents,
          currency: 'ZAR',
        });

        const transactionId = result.data.transactionId;

        // In production, this would redirect to the payment gateway's hosted payment page.
        // The payment gateway would then call back to funding_confirmPayment on success
        // or funding_failPayment on failure.
        // For now, navigate to the confirmation/receipt page.
        router.push(
          `/dashboard/funding/confirmation?transactionId=${transactionId}&projectId=${projectId}&amount=${amountCents}`
        );
      } catch (err: unknown) {
        const error = err as { message?: string; details?: { error?: { message?: string } } };
        const message =
          error.details?.error?.message ??
          error.message ??
          'Failed to process funding commitment. Please try again.';
        setFieldError(message);
      } finally {
        setSubmitting(false);
      }
    },
    [project, projectId, amountRands, router]
  );

  // ─── Auth Loading ────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        <span className="ml-3 text-foreground/60">Checking authentication...</span>
      </div>
    );
  }

  // ─── Loading State ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        <span className="ml-3 text-foreground/60">Loading project...</span>
      </div>
    );
  }

  // ─── Error State ─────────────────────────────────────────────────────────────

  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h1 className="text-xl font-semibold mb-2">Unable to Fund</h1>
        <p className="text-foreground/60 text-center max-w-md">
          {error || 'Project not found.'}
        </p>
        <button
          onClick={() => router.back()}
          className="mt-6 px-4 py-2 text-sm font-medium text-primary-600 hover:text-primary-700 underline"
        >
          Go Back
        </button>
      </div>
    );
  }

  // ─── Derived Values ──────────────────────────────────────────────────────────

  const fundingPercentage =
    project.fundingGoal > 0
      ? Math.min(
          Math.round((project.fundingRaised / project.fundingGoal) * 100),
          100
        )
      : 0;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {/* Page Header */}
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-primary-600" />
          Fund This Project
        </h1>
        <p className="mt-2 text-foreground/60">
          Commit funding to support verified ESG impact.
        </p>
      </header>

      {/* Project Summary Card */}
      <section
        className="border border-foreground/10 rounded-lg p-5 mb-8 bg-white dark:bg-gray-900"
        aria-labelledby="project-summary-heading"
      >
        <h2 id="project-summary-heading" className="sr-only">
          Project Summary
        </h2>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground">
              {project.title}
            </h3>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              <span className="text-sm text-foreground/60 capitalize">
                {project.category.replace(/-/g, ' ')}
              </span>
              {project.location?.country && (
                <span className="flex items-center gap-1 text-sm text-foreground/60">
                  <MapPin className="w-3.5 h-3.5" />
                  {project.location.country}
                </span>
              )}
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${badgeColor(project.verificationBadge)}`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            {project.verificationBadge}
          </span>
        </div>

        {/* Funding Progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm text-foreground/60 mb-1.5">
            <span>{formatCurrency(project.fundingRaised)} raised</span>
            <span>of {formatCurrency(project.fundingGoal)}</span>
          </div>
          <div
            className="h-2.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden"
            role="progressbar"
            aria-valuenow={fundingPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Funding progress: ${fundingPercentage}%`}
          >
            <div
              className="h-full rounded-full bg-primary-500 transition-all duration-300"
              style={{ width: `${fundingPercentage}%` }}
            />
          </div>
          <p className="text-xs text-foreground/50 mt-1">
            {fundingPercentage}% funded
          </p>
        </div>
      </section>

      {/* Funding Form */}
      <section aria-labelledby="funding-form-heading">
        <h2
          id="funding-form-heading"
          className="text-lg font-semibold text-foreground mb-4"
        >
          Your Funding Commitment
        </h2>

        <form onSubmit={handleSubmit} noValidate>
          {/* Amount Input */}
          <div className="mb-6">
            <label
              htmlFor="funding-amount"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              Amount (ZAR)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50 text-sm font-medium">
                R
              </span>
              <input
                id="funding-amount"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amountRands}
                onChange={handleAmountChange}
                disabled={submitting}
                className={`w-full pl-8 pr-4 py-3 border rounded-lg text-foreground bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${
                  fieldError
                    ? 'border-red-400 focus:ring-red-500 focus:border-red-500'
                    : 'border-foreground/20'
                }`}
                aria-describedby={fieldError ? 'amount-error' : 'amount-hint'}
                aria-invalid={!!fieldError}
              />
            </div>
            {fieldError && (
              <p
                id="amount-error"
                className="mt-1.5 text-sm text-red-600"
                role="alert"
              >
                {fieldError}
              </p>
            )}
            {!fieldError && (
              <p id="amount-hint" className="mt-1.5 text-xs text-foreground/50">
                Minimum R 10.00 — Maximum R 1,000,000.00 per transaction.
              </p>
            )}
          </div>

          {/* Funder Info */}
          {userProfile && (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-sm text-foreground/70">
                <span className="font-medium">Funding as:</span>{' '}
                {userProfile.name}
                {userProfile.organizationName &&
                  ` (${userProfile.organizationName})`}
              </p>
              <p className="text-xs text-foreground/50 mt-1">
                Currency: South African Rand (ZAR)
              </p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting || !amountRands}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Commit Funding
              </>
            )}
          </button>

          <p className="mt-3 text-xs text-foreground/50 text-center">
            You will be redirected to our secure payment partner to complete the
            transaction.
          </p>
        </form>
      </section>
    </div>
  );
}
