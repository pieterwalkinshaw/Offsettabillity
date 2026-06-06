'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  CheckCircle2,
  Loader2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import type { Project } from '@shared/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(cents: number): string {
  return `R ${(cents / 100).toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Page Component ──────────────────────────────────────────────────────────

import { Suspense } from 'react';

function FundingConfirmationContent() {
  const searchParams = useSearchParams();
  const { userProfile } = useAuth();

  const transactionId = searchParams.get('transactionId');
  const projectId = searchParams.get('projectId');
  const amountParam = searchParams.get('amount');

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const amountCents = amountParam ? parseInt(amountParam, 10) : 0;

  // Fetch project details for the receipt
  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    async function fetchProject() {
      setLoading(true);
      try {
        const projectRef = doc(db, 'projects', projectId!);
        const projectSnap = await getDoc(projectRef);

        if (projectSnap.exists()) {
          setProject({
            ...projectSnap.data(),
            projectId: projectSnap.id,
          } as Project);
        }
      } catch {
        // Non-critical — we can still show the confirmation without project details
      } finally {
        setLoading(false);
      }
    }

    fetchProject();
  }, [projectId]);

  // ─── Missing Params ────────────────────────────────────────────────────────

  if (!transactionId || !projectId || !amountCents) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h1 className="text-xl font-semibold mb-2">Invalid Confirmation</h1>
        <p className="text-foreground/60 text-center max-w-md">
          This page requires valid transaction details. Please start a new
          funding commitment from a project page.
        </p>
        <Link
          href="/projects"
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-600 hover:text-primary-700 underline"
        >
          Browse Projects
        </Link>
      </div>
    );
  }

  // ─── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        <span className="ml-3 text-foreground/60">
          Loading confirmation...
        </span>
      </div>
    );
  }

  // ─── Render Confirmation ───────────────────────────────────────────────────

  return (
    <div className="max-w-xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {/* Success Icon */}
      <div className="flex flex-col items-center text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">
          Funding Commitment Received
        </h1>
        <p className="mt-2 text-foreground/60 max-w-sm">
          Your funding commitment has been recorded. Payment processing is
          underway.
        </p>
      </div>

      {/* Receipt Card */}
      <section
        className="border border-foreground/10 rounded-lg p-6 bg-white dark:bg-gray-900 mb-6"
        aria-labelledby="receipt-heading"
      >
        <h2
          id="receipt-heading"
          className="text-sm font-medium text-foreground/50 uppercase tracking-wide mb-4"
        >
          Transaction Receipt
        </h2>

        <dl className="space-y-3">
          {/* Transaction ID */}
          <div className="flex justify-between items-start">
            <dt className="text-sm text-foreground/60">Transaction ID</dt>
            <dd className="text-sm font-mono text-foreground text-right max-w-[200px] truncate">
              {transactionId}
            </dd>
          </div>

          {/* Amount */}
          <div className="flex justify-between items-start">
            <dt className="text-sm text-foreground/60">Amount</dt>
            <dd className="text-lg font-semibold text-foreground">
              {formatCurrency(amountCents)}
            </dd>
          </div>

          {/* Currency */}
          <div className="flex justify-between items-start">
            <dt className="text-sm text-foreground/60">Currency</dt>
            <dd className="text-sm text-foreground">ZAR (South African Rand)</dd>
          </div>

          {/* Project */}
          {project && (
            <div className="flex justify-between items-start">
              <dt className="text-sm text-foreground/60">Project</dt>
              <dd className="text-sm text-foreground text-right max-w-[200px]">
                {project.title}
              </dd>
            </div>
          )}

          {/* Funder */}
          {userProfile && (
            <div className="flex justify-between items-start">
              <dt className="text-sm text-foreground/60">Funder</dt>
              <dd className="text-sm text-foreground text-right">
                {userProfile.name}
                {userProfile.organizationName &&
                  ` (${userProfile.organizationName})`}
              </dd>
            </div>
          )}

          {/* Date */}
          <div className="flex justify-between items-start">
            <dt className="text-sm text-foreground/60">Date</dt>
            <dd className="text-sm text-foreground">
              {formatDate(new Date())}
            </dd>
          </div>

          {/* Status */}
          <div className="flex justify-between items-start">
            <dt className="text-sm text-foreground/60">Status</dt>
            <dd className="inline-flex items-center gap-1.5 text-sm font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">
              Pending Confirmation
            </dd>
          </div>
        </dl>

        <div className="mt-5 pt-4 border-t border-foreground/10">
          <p className="text-xs text-foreground/50">
            Your payment is being processed by our secure payment partner. Once
            confirmed, the project&apos;s funding progress will be updated and
            you will receive a confirmation email.
          </p>
        </div>
      </section>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        {project && (
          <Link
            href={`/project?id=${projectId}`}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-foreground/20 text-foreground font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            View Project
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
        <Link
          href="/overview"
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}

export default function FundingConfirmationPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>}>
      <FundingConfirmationContent />
    </Suspense>
  );
}
