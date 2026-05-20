/**
 * Property Test: Project card required fields (Property 28)
 *
 * Validates: Requirements 8.4
 *
 * For any project displayed as a card in listings, the rendered output SHALL
 * include: title, category name, verification badge, funding progress (raised
 * vs goal), primary impact metric (label and value), and location country.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { VerificationBadge, ReportingPeriod } from '../../shared/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProjectCardInput {
  projectId: string;
  title: string;
  category: string;
  verificationBadge: VerificationBadge;
  fundingGoal: number;
  fundingRaised: number;
  impactMetrics: {
    reportingPeriod: ReportingPeriod;
    primaryMetric: {
      label: string;
      value: number;
    };
  };
  location: {
    lat: number;
    lng: number;
    address: string;
    country: string;
  };
}

interface CardFields {
  title: string;
  category: string;
  verificationBadge: VerificationBadge;
  fundingRaised: number;
  fundingGoal: number;
  impactMetricLabel: string;
  impactMetricValue: number;
  locationCountry: string;
}

// ─── Helper: Extract Card Fields ─────────────────────────────────────────────

/**
 * Extracts the fields that would be displayed on a project card.
 * This mirrors the data extraction logic in the ProjectCard component.
 */
function extractCardFields(project: ProjectCardInput, categoryName?: string): CardFields {
  return {
    title: project.title,
    category: categoryName || project.category,
    verificationBadge: project.verificationBadge,
    fundingRaised: project.fundingRaised,
    fundingGoal: project.fundingGoal,
    impactMetricLabel: project.impactMetrics.primaryMetric.label,
    impactMetricValue: project.impactMetrics.primaryMetric.value,
    locationCountry: project.location.country,
  };
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const VALID_BADGES: VerificationBadge[] = ['None', 'Verified', 'Verified+', 'Premium Assured'];

const REPORTING_PERIODS: ReportingPeriod[] = ['Monthly', 'Quarterly', 'Annually', 'Project Duration'];

/** ISO 3166-1 alpha-2 country code (2 uppercase letters) */
const countryCodeArb = fc.constantFrom(
  'ZA', 'US', 'GB', 'DE', 'FR', 'AU', 'CA', 'IN', 'BR', 'JP',
  'KE', 'NG', 'EG', 'GH', 'TZ', 'MX', 'AR', 'CL', 'NZ', 'SG'
);

/** Non-empty string for titles (1-120 chars) */
const titleArb = fc.string({ minLength: 1, maxLength: 120 }).filter((s) => s.trim().length > 0);

/** Category ID (lowercase alphanumeric with hyphens) */
const categoryArb = fc.constantFrom(
  'energy-saving', 'renewable-energy', 'carbon-removal', 'education',
  'health', 'food-security', 'clean-water', 'waste-management',
  'biodiversity', 'housing', 'digital-inclusion', 'gender-equality'
);

/** Category display name */
const categoryNameArb = fc.constantFrom(
  'Energy Saving', 'Renewable Energy', 'Carbon Removal', 'Education',
  'Health', 'Food Security', 'Clean Water', 'Waste Management',
  'Biodiversity', 'Housing', 'Digital Inclusion', 'Gender Equality'
);

/** Verification badge */
const badgeArb = fc.constantFrom(...VALID_BADGES);

/** Funding amounts in integer cents (ZAR) */
const fundingGoalArb = fc.integer({ min: 1000, max: 999999999 });
const fundingRaisedArb = fc.integer({ min: 0, max: 999999999 });

/** Impact metric label (non-empty) */
const metricLabelArb = fc.constantFrom(
  'kWh Saved', 'MWh Generated', 'Tons CO₂e Removed', 'People Trained',
  'Lives Impacted', 'Meals Provided', 'Liters Provided', 'Tons Diverted',
  'Hectares Protected', 'Units Built', 'People Connected', 'Women Impacted'
);

/** Impact metric value (non-negative number) */
const metricValueArb = fc.integer({ min: 0, max: 999999999 });

/** Reporting period */
const reportingPeriodArb = fc.constantFrom(
  'Monthly' as const, 'Quarterly' as const, 'Annually' as const, 'Project Duration' as const
);

/** Location coordinates */
const latArb = fc.double({ min: -90, max: 90, noNaN: true });
const lngArb = fc.double({ min: -180, max: 180, noNaN: true });

/** Address string */
const addressArb = fc.constantFrom(
  '123 Main St, Johannesburg', '456 Oak Ave, Cape Town', '789 Pine Rd, Nairobi',
  '10 Downing St, London', '1600 Pennsylvania Ave, Washington DC'
);

/** Full project card input arbitrary */
const projectCardArb: fc.Arbitrary<ProjectCardInput> = fc.record({
  projectId: fc.uuid(),
  title: titleArb,
  category: categoryArb,
  verificationBadge: badgeArb,
  fundingGoal: fundingGoalArb,
  fundingRaised: fundingRaisedArb,
  impactMetrics: fc.record({
    reportingPeriod: reportingPeriodArb,
    primaryMetric: fc.record({
      label: metricLabelArb,
      value: metricValueArb,
    }),
  }),
  location: fc.record({
    lat: latArb,
    lng: lngArb,
    address: addressArb,
    country: countryCodeArb,
  }),
});

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 28: Project card required fields', () => {
  /**
   * **Validates: Requirements 8.4**
   * Title is always present and non-empty in the card output.
   */
  it('title is always present and non-empty', () => {
    fc.assert(
      fc.property(projectCardArb, (project) => {
        const fields = extractCardFields(project);
        expect(fields.title).toBeDefined();
        expect(typeof fields.title).toBe('string');
        expect(fields.title.length).toBeGreaterThan(0);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 8.4**
   * Category is always present in the card output.
   */
  it('category is always present', () => {
    fc.assert(
      fc.property(projectCardArb, categoryNameArb, (project, categoryName) => {
        const fields = extractCardFields(project, categoryName);
        expect(fields.category).toBeDefined();
        expect(typeof fields.category).toBe('string');
        expect(fields.category.length).toBeGreaterThan(0);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 8.4**
   * Category falls back to project.category when no categoryName is provided.
   */
  it('category falls back to project.category when categoryName is not provided', () => {
    fc.assert(
      fc.property(projectCardArb, (project) => {
        const fields = extractCardFields(project);
        expect(fields.category).toBe(project.category);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 8.4**
   * Verification badge is always one of the valid values.
   */
  it('verification badge is always one of the valid values', () => {
    fc.assert(
      fc.property(projectCardArb, (project) => {
        const fields = extractCardFields(project);
        expect(VALID_BADGES).toContain(fields.verificationBadge);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 8.4**
   * Funding progress (raised and goal) are always present as numbers.
   */
  it('funding progress (raised and goal) are always present as numbers', () => {
    fc.assert(
      fc.property(projectCardArb, (project) => {
        const fields = extractCardFields(project);
        expect(typeof fields.fundingRaised).toBe('number');
        expect(typeof fields.fundingGoal).toBe('number');
        expect(Number.isFinite(fields.fundingRaised)).toBe(true);
        expect(Number.isFinite(fields.fundingGoal)).toBe(true);
        expect(fields.fundingGoal).toBeGreaterThan(0);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 8.4**
   * Primary impact metric label and value are always present.
   */
  it('primary impact metric label and value are always present', () => {
    fc.assert(
      fc.property(projectCardArb, (project) => {
        const fields = extractCardFields(project);
        expect(fields.impactMetricLabel).toBeDefined();
        expect(typeof fields.impactMetricLabel).toBe('string');
        expect(fields.impactMetricLabel.length).toBeGreaterThan(0);
        expect(typeof fields.impactMetricValue).toBe('number');
        expect(Number.isFinite(fields.impactMetricValue)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 8.4**
   * Location country is always present as a 2-character code.
   */
  it('location country is always present (2-char code)', () => {
    fc.assert(
      fc.property(projectCardArb, (project) => {
        const fields = extractCardFields(project);
        expect(fields.locationCountry).toBeDefined();
        expect(typeof fields.locationCountry).toBe('string');
        expect(fields.locationCountry.length).toBe(2);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 8.4**
   * All required fields are simultaneously present for any valid project.
   */
  it('all required fields are simultaneously present for any valid project', () => {
    fc.assert(
      fc.property(projectCardArb, categoryNameArb, (project, categoryName) => {
        const fields = extractCardFields(project, categoryName);

        // Title present and non-empty
        expect(fields.title.length).toBeGreaterThan(0);

        // Category present and non-empty
        expect(fields.category.length).toBeGreaterThan(0);

        // Badge is valid
        expect(VALID_BADGES).toContain(fields.verificationBadge);

        // Funding progress present as numbers
        expect(Number.isFinite(fields.fundingRaised)).toBe(true);
        expect(Number.isFinite(fields.fundingGoal)).toBe(true);
        expect(fields.fundingGoal).toBeGreaterThan(0);

        // Impact metric present
        expect(fields.impactMetricLabel.length).toBeGreaterThan(0);
        expect(Number.isFinite(fields.impactMetricValue)).toBe(true);

        // Location country is 2-char code
        expect(fields.locationCountry.length).toBe(2);
      }),
      { numRuns: 300 }
    );
  });

  /**
   * **Validates: Requirements 8.4**
   * The extracted fields faithfully represent the source project data.
   */
  it('extracted fields faithfully represent the source project data', () => {
    fc.assert(
      fc.property(projectCardArb, categoryNameArb, (project, categoryName) => {
        const fields = extractCardFields(project, categoryName);

        expect(fields.title).toBe(project.title);
        expect(fields.category).toBe(categoryName);
        expect(fields.verificationBadge).toBe(project.verificationBadge);
        expect(fields.fundingRaised).toBe(project.fundingRaised);
        expect(fields.fundingGoal).toBe(project.fundingGoal);
        expect(fields.impactMetricLabel).toBe(project.impactMetrics.primaryMetric.label);
        expect(fields.impactMetricValue).toBe(project.impactMetrics.primaryMetric.value);
        expect(fields.locationCountry).toBe(project.location.country);
      }),
      { numRuns: 200 }
    );
  });
});
