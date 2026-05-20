import Link from 'next/link';
import type { Project, VerificationBadge } from '@shared/types';

/**
 * Props for the ProjectCard component.
 * Accepts a Project object (or the subset of fields needed for display).
 */
export interface ProjectCardProps {
  project: Pick<
    Project,
    | 'projectId'
    | 'title'
    | 'category'
    | 'verificationBadge'
    | 'fundingGoal'
    | 'fundingRaised'
    | 'impactMetrics'
    | 'location'
  >;
  /** Optional category display name (resolved from taxonomy). Falls back to project.category. */
  categoryName?: string;
}

/**
 * Badge color configuration by verification tier.
 */
const BADGE_STYLES: Record<VerificationBadge, { bg: string; text: string }> = {
  None: { bg: 'bg-gray-100', text: 'text-gray-600' },
  Verified: { bg: 'bg-blue-100', text: 'text-blue-700' },
  'Verified+': { bg: 'bg-green-100', text: 'text-green-700' },
  'Premium Assured': { bg: 'bg-amber-100', text: 'text-amber-700' },
};

/**
 * Format integer cents (ZAR) to a human-readable currency string.
 * e.g. 150000 → "R 1,500"
 */
function formatZARCents(cents: number): string {
  const rands = cents / 100;
  return `R ${rands.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/**
 * Format a number with locale-aware thousands separators.
 * e.g. 1500 → "1,500"
 */
function formatNumber(value: number): string {
  return value.toLocaleString('en-ZA');
}

/**
 * Get a country flag emoji from an ISO 3166-1 alpha-2 country code.
 */
function getCountryFlag(countryCode: string): string {
  const code = countryCode.toUpperCase();
  const flag = [...code]
    .map((char) => String.fromCodePoint(0x1f1e6 + char.charCodeAt(0) - 65))
    .join('');
  return flag;
}

/**
 * ProjectCard Component
 *
 * Displays a project summary card for use in listing grids.
 * Shows: title, category, verification badge, funding progress,
 * primary impact metric, and location country.
 *
 * Mobile: full-width, stacks vertically.
 * Desktop: fixed-height card, grid-friendly.
 *
 * Links to the project detail page at /projects/{projectId}.
 */
export function ProjectCard({ project, categoryName }: ProjectCardProps) {
  const {
    projectId,
    title,
    category,
    verificationBadge,
    fundingGoal,
    fundingRaised,
    impactMetrics,
    location,
  } = project;

  const displayCategory = categoryName || category;
  const badgeStyle = BADGE_STYLES[verificationBadge];
  const fundingPercentage =
    fundingGoal > 0 ? Math.min((fundingRaised / fundingGoal) * 100, 100) : 0;

  return (
    <Link
      href={`/projects/${projectId}`}
      className="block w-full rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-primary-300 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:h-[280px] sm:flex sm:flex-col"
      aria-label={`View project: ${title}`}
    >
      {/* Header: Category + Badge */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs font-medium text-foreground/60 uppercase tracking-wide truncate">
          {displayCategory}
        </span>
        <span
          className={`inline-flex items-center shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeStyle.bg} ${badgeStyle.text}`}
        >
          {verificationBadge}
        </span>
      </div>

      {/* Title (truncated to one line) */}
      <h3 className="text-base font-semibold text-foreground truncate whitespace-nowrap overflow-hidden mb-3">
        {title}
      </h3>

      {/* Funding Progress */}
      <div className="mb-3 sm:mt-auto">
        <div className="flex items-center justify-between text-xs text-foreground/60 mb-1">
          <span>{formatZARCents(fundingRaised)} raised</span>
          <span>of {formatZARCents(fundingGoal)}</span>
        </div>
        <div
          className="h-2 rounded-full bg-gray-100 overflow-hidden"
          role="progressbar"
          aria-valuenow={Math.round(fundingPercentage)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Funding progress: ${Math.round(fundingPercentage)}%`}
        >
          <div
            className="h-full rounded-full bg-primary-500 transition-all duration-300"
            style={{ width: `${fundingPercentage}%` }}
          />
        </div>
      </div>

      {/* Impact Metric + Location */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-foreground/70 truncate">
          {impactMetrics.primaryMetric.label}: {formatNumber(impactMetrics.primaryMetric.value)}
        </span>
        <span
          className="text-sm shrink-0"
          title={location.country}
          aria-label={`Location: ${location.country}`}
        >
          {getCountryFlag(location.country)}
        </span>
      </div>
    </Link>
  );
}
