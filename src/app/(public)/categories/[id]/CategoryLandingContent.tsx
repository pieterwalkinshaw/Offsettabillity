'use client';

import { useState, useEffect } from 'react';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { LeadCaptureForm } from '@/components/forms/LeadCaptureForm';
import { ConsultationForm } from '@/components/forms/ConsultationForm';
import type { Project } from '@shared/types';

interface CategoryInfo {
  id: string;
  name: string;
  primaryMetricLabel: string;
  sdgNumbers: readonly number[];
  icon: string;
  valueProposition: string;
}

export interface CategoryLandingContentProps {
  category: CategoryInfo;
}

/** Platform trust stats — static values for the landing page shell */
const TRUST_STATS = [
  { label: 'Projects Verified', value: '250+' },
  { label: 'Auditors Active', value: '45+' },
  { label: 'Total Funded', value: 'R12M+' },
  { label: 'Avg. Verification Score', value: '87/100' },
];

/**
 * CategoryLandingContent — Client component for category landing pages.
 *
 * Renders the full landing page layout with:
 * - Static hero (headline, value prop, trust signals, primary CTA)
 * - Dynamic featured projects (fetched from Firestore)
 * - Secondary CTA (consultation form)
 *
 * Projects are fetched client-side to keep the page shell static for fast LCP.
 */
export function CategoryLandingContent({ category }: CategoryLandingContentProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFeaturedProjects() {
      try {
        // Dynamic import to avoid Firebase initialization at build time
        const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase/config');

        const projectsRef = collection(db, 'projects');
        const q = query(
          projectsRef,
          where('verificationStatus', 'in', ['verified', 'live', 'funded']),
          where('category', '==', category.id),
          orderBy('createdAt', 'desc'),
          limit(6)
        );
        const snapshot = await getDocs(q);
        const fetched = snapshot.docs.map((doc) => ({
          projectId: doc.id,
          ...doc.data(),
        })) as Project[];
        setProjects(fetched);
      } catch (err) {
        console.error('Failed to fetch featured projects:', err);
        setError('Unable to load projects. Please try again later.');
      } finally {
        setLoading(false);
      }
    }

    fetchFeaturedProjects();
  }, [category.id]);

  const hasFewerThanThreeProjects = !loading && projects.length < 3;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-50 via-white to-primary-50 border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
            {/* Left: Headline + Value Prop + Trust Signals */}
            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
                Verified {category.name} Projects
              </h1>
              <p className="mt-4 text-lg text-foreground/70 max-w-xl">
                {category.valueProposition}
              </p>

              {/* Trust Signals */}
              <div className="mt-8">
                <TrustSignals />
              </div>

              {/* SDG Alignment */}
              <div className="mt-6 flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-foreground/60">SDG Alignment:</span>
                {category.sdgNumbers.map((sdg) => (
                  <span
                    key={sdg}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 text-primary-700 text-xs font-bold"
                    title={`UN SDG ${sdg}`}
                  >
                    {sdg}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: Primary CTA — Lead Capture Form */}
            <div className="lg:sticky lg:top-8">
              <div className="rounded-2xl bg-white border border-gray-200 shadow-lg p-6 sm:p-8">
                <LeadCaptureForm
                  leadType="report_request"
                  heading="Get Your ESG Impact Report"
                  description={`Receive a personalized report on ${category.name.toLowerCase()} investment opportunities tailored to your portfolio.`}
                  submitLabel="Get Your Free Report"
                  showName
                  showCompany
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Projects Section */}
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Featured {category.name} Projects
          </h2>
          <p className="text-foreground/60 mb-8">
            Independently verified projects with transparent audit trails and measurable impact.
          </p>

          {loading ? (
            <ProjectGridSkeleton />
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
              <p className="text-red-700 font-medium">{error}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-3 text-sm text-red-600 underline hover:text-red-700"
              >
                Retry
              </button>
            </div>
          ) : projects.length === 0 ? (
            <EmptyProjectsState categoryName={category.name} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <ProjectCard
                  key={project.projectId}
                  project={project}
                  categoryName={category.name}
                />
              ))}
            </div>
          )}

          {/* Supplement with primary CTA if fewer than 3 projects */}
          {hasFewerThanThreeProjects && (
            <div className="mt-10 rounded-2xl bg-primary-50 border border-primary-200 p-8 text-center">
              <h3 className="text-xl font-bold text-foreground mb-2">
                Looking for More {category.name} Opportunities?
              </h3>
              <p className="text-foreground/60 mb-6 max-w-lg mx-auto">
                New projects are being verified regularly. Speak to an advisor to learn about upcoming {category.name.toLowerCase()} projects that match your ESG goals.
              </p>
              <a
                href="#consultation"
                className="inline-flex items-center rounded-lg bg-primary-600 px-6 py-3 text-white font-semibold hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
              >
                Request a Consultation
              </a>
            </div>
          )}
        </div>
      </section>

      {/* Secondary CTA — Consultation Form */}
      <section id="consultation" className="py-12 sm:py-16 bg-gray-50 border-t border-gray-200">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6 sm:p-10">
            <ConsultationForm
              heading="Speak to an ESG Advisor"
              description={`Get expert guidance on ${category.name.toLowerCase()} investments and how they fit your B-BBEE compliance strategy.`}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * Trust signals section — verification badges and platform stats.
 */
function TrustSignals() {
  return (
    <div className="space-y-4">
      {/* Verification Badges */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
          ✓ Independently Audited
        </span>
        <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
          ✓ B-BBEE Qualifying
        </span>
        <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
          ✓ Section 18A Eligible
        </span>
      </div>

      {/* Platform Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {TRUST_STATS.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg bg-white border border-gray-200 p-3 text-center"
          >
            <p className="text-lg font-bold text-primary-700">{stat.value}</p>
            <p className="text-xs text-foreground/60">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton loading state for the project grid.
 */
function ProjectGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 3 }).map((_, i) => (
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
 * Empty state when no projects exist for this category.
 * Supplements with a primary CTA per requirement 10.7.
 */
function EmptyProjectsState({ categoryName }: { categoryName: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="mb-6">
        <svg
          className="w-24 h-24 text-primary-200"
          viewBox="0 0 96 96"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <circle cx="48" cy="48" r="40" fill="currentColor" opacity="0.3" />
          <path
            d="M36 40h24M36 48h16M36 56h20"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        New {categoryName} Projects Coming Soon
      </h3>
      <p className="text-foreground/60 max-w-md mb-6">
        Projects in this category are currently being verified. Request a consultation to be notified when new opportunities become available.
      </p>
      <a
        href="#consultation"
        className="inline-flex items-center rounded-lg bg-primary-600 px-6 py-3 text-white font-semibold hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
      >
        Request a Consultation
      </a>
    </div>
  );
}
