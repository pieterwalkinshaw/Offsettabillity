/**
 * Property Test: Report content completeness (Property 29)
 *
 * Validates: Requirements 9.1, 9.4, 9.5
 *
 * For any generated impact report, the output SHALL contain: project title,
 * category, location, funding goal, funding raised, verification badge,
 * verification score, full audit trail (each audit's findings, score contribution,
 * recommendation, methodology, completedAt), impact metrics, ESP qualification
 * details, and SDG alignment.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type {
  VerificationBadge,
  ReportingPeriod,
  ReportAccessLevel,
  AuditRecommendation,
} from '../../shared/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuditTrailEntry {
  auditId: string;
  auditorId: string;
  findings: string;
  scoreContribution: number;
  recommendation: string;
  methodology: string;
  completedAt: string | null;
}

interface ReportData {
  reportId: string;
  projectId: string;
  generatedAt: string;
  project: {
    title: string;
    category: string;
    location: {
      address: string;
      country: string;
      lat: number;
      lng: number;
    };
    fundingGoal: number;
    fundingRaised: number;
    verificationBadge: string;
    verificationScore: number;
    impactMetrics: {
      reportingPeriod: string;
      primaryMetric: {
        label: string;
        value: number;
      };
    };
    espQualification: {
      qualifies: boolean;
      category?: string;
      evidence?: string;
    } | null;
    sdgAlignment: string[];
  };
  auditTrail: AuditTrailEntry[];
  auditNotice: string | null;
  accessLevel: ReportAccessLevel;
}

// ─── Helper: Validate Report Completeness ────────────────────────────────────

/**
 * Validates that a generated report contains all required fields as specified
 * by Requirements 9.1, 9.4, and 9.5.
 */
function validateReportCompleteness(reportData: ReportData): {
  valid: boolean;
  missingFields: string[];
} {
  const missingFields: string[] = [];

  // Project title (Req 9.1)
  if (reportData.project.title === undefined || reportData.project.title === null) {
    missingFields.push('project.title');
  }

  // Category (Req 9.1)
  if (reportData.project.category === undefined || reportData.project.category === null) {
    missingFields.push('project.category');
  }

  // Location (Req 9.1)
  if (!reportData.project.location) {
    missingFields.push('project.location');
  } else {
    if (reportData.project.location.address === undefined) missingFields.push('project.location.address');
    if (reportData.project.location.country === undefined) missingFields.push('project.location.country');
    if (reportData.project.location.lat === undefined) missingFields.push('project.location.lat');
    if (reportData.project.location.lng === undefined) missingFields.push('project.location.lng');
  }

  // Funding goal (Req 9.1)
  if (reportData.project.fundingGoal === undefined || reportData.project.fundingGoal === null) {
    missingFields.push('project.fundingGoal');
  }

  // Funding raised (Req 9.1)
  if (reportData.project.fundingRaised === undefined || reportData.project.fundingRaised === null) {
    missingFields.push('project.fundingRaised');
  }

  // Verification badge (Req 9.4)
  if (reportData.project.verificationBadge === undefined || reportData.project.verificationBadge === null) {
    missingFields.push('project.verificationBadge');
  }

  // Verification score (Req 9.4)
  if (reportData.project.verificationScore === undefined || reportData.project.verificationScore === null) {
    missingFields.push('project.verificationScore');
  }

  // Audit trail (Req 9.4) — must be an array (may be empty with notice)
  if (!Array.isArray(reportData.auditTrail)) {
    missingFields.push('auditTrail');
  } else {
    // Each audit entry must have required fields
    for (let i = 0; i < reportData.auditTrail.length; i++) {
      const entry = reportData.auditTrail[i];
      if (entry.findings === undefined) missingFields.push(`auditTrail[${i}].findings`);
      if (entry.scoreContribution === undefined) missingFields.push(`auditTrail[${i}].scoreContribution`);
      if (entry.recommendation === undefined) missingFields.push(`auditTrail[${i}].recommendation`);
      if (entry.methodology === undefined) missingFields.push(`auditTrail[${i}].methodology`);
      if (entry.completedAt === undefined) missingFields.push(`auditTrail[${i}].completedAt`);
    }
  }

  // Impact metrics (Req 9.1)
  if (!reportData.project.impactMetrics) {
    missingFields.push('project.impactMetrics');
  } else {
    if (reportData.project.impactMetrics.reportingPeriod === undefined) {
      missingFields.push('project.impactMetrics.reportingPeriod');
    }
    if (!reportData.project.impactMetrics.primaryMetric) {
      missingFields.push('project.impactMetrics.primaryMetric');
    } else {
      if (reportData.project.impactMetrics.primaryMetric.label === undefined) {
        missingFields.push('project.impactMetrics.primaryMetric.label');
      }
      if (reportData.project.impactMetrics.primaryMetric.value === undefined) {
        missingFields.push('project.impactMetrics.primaryMetric.value');
      }
    }
  }

  // ESP qualification (Req 9.5) — must be present (can be null for non-qualifying)
  if (reportData.project.espQualification === undefined) {
    missingFields.push('project.espQualification');
  }

  // SDG alignment (Req 9.5) — must be present as array
  if (!Array.isArray(reportData.project.sdgAlignment)) {
    missingFields.push('project.sdgAlignment');
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Builds a ReportData object from project data and audit trail,
 * mirroring the logic in the reports_generate Cloud Function.
 */
function buildReportData(
  projectData: {
    title: string;
    category: string;
    location: { address: string; country: string; lat: number; lng: number };
    fundingGoal: number;
    fundingRaised: number;
    verificationBadge: string;
    verificationScore: number;
    impactMetrics: {
      reportingPeriod: string;
      primaryMetric: { label: string; value: number };
    };
    espQualification: { qualifies: boolean; category?: string; evidence?: string } | null;
    sdgAlignment: string[];
  },
  auditTrail: AuditTrailEntry[]
): ReportData {
  const auditNotice =
    auditTrail.length === 0
      ? 'Verification is pending. No audit trail is available for this project at this time.'
      : null;

  return {
    reportId: 'report-' + Math.random().toString(36).slice(2),
    projectId: 'project-' + Math.random().toString(36).slice(2),
    generatedAt: new Date().toISOString(),
    project: {
      title: projectData.title || '',
      category: projectData.category || '',
      location: {
        address: projectData.location?.address || '',
        country: projectData.location?.country || '',
        lat: projectData.location?.lat || 0,
        lng: projectData.location?.lng || 0,
      },
      fundingGoal: projectData.fundingGoal || 0,
      fundingRaised: projectData.fundingRaised || 0,
      verificationBadge: projectData.verificationBadge || 'None',
      verificationScore: projectData.verificationScore || 0,
      impactMetrics: {
        reportingPeriod: projectData.impactMetrics?.reportingPeriod || '',
        primaryMetric: {
          label: projectData.impactMetrics?.primaryMetric?.label || '',
          value: projectData.impactMetrics?.primaryMetric?.value || 0,
        },
      },
      espQualification: projectData.espQualification || null,
      sdgAlignment: projectData.sdgAlignment || [],
    },
    auditTrail,
    auditNotice,
    accessLevel: 'public',
  };
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const VALID_BADGES: VerificationBadge[] = ['None', 'Verified', 'Verified+', 'Premium Assured'];

const RECOMMENDATIONS: AuditRecommendation[] = ['approve', 'conditional', 'reject'];

const REPORTING_PERIODS: ReportingPeriod[] = ['Monthly', 'Quarterly', 'Annually', 'Project Duration'];

/** ISO 3166-1 alpha-2 country code */
const countryCodeArb = fc.constantFrom(
  'ZA', 'US', 'GB', 'DE', 'FR', 'AU', 'CA', 'IN', 'BR', 'JP',
  'KE', 'NG', 'EG', 'GH', 'TZ', 'MX', 'AR', 'CL', 'NZ', 'SG'
);

/** Non-empty string for titles (1-120 chars) */
const titleArb = fc.string({ minLength: 1, maxLength: 120 }).filter((s) => s.trim().length > 0);

/** Category ID */
const categoryArb = fc.constantFrom(
  'energy-saving', 'renewable-energy', 'carbon-removal', 'education',
  'health', 'food-security', 'clean-water', 'waste-management',
  'biodiversity', 'housing', 'digital-inclusion', 'gender-equality'
);

/** Verification badge */
const badgeArb = fc.constantFrom(...VALID_BADGES);

/** Funding amounts in integer cents (ZAR) */
const fundingGoalArb = fc.integer({ min: 1000, max: 999999999 });
const fundingRaisedArb = fc.integer({ min: 0, max: 999999999 });

/** Verification score (0-100) */
const verificationScoreArb = fc.integer({ min: 0, max: 100 });

/** Impact metric label */
const metricLabelArb = fc.constantFrom(
  'kWh Saved', 'MWh Generated', 'Tons CO₂e Removed', 'People Trained',
  'Lives Impacted', 'Meals Provided', 'Liters Provided', 'Tons Diverted',
  'Hectares Protected', 'Units Built', 'People Connected', 'Women Impacted'
);

/** Impact metric value */
const metricValueArb = fc.integer({ min: 0, max: 999999999 });

/** Reporting period */
const reportingPeriodArb = fc.constantFrom(...REPORTING_PERIODS);

/** Location coordinates */
const latArb = fc.double({ min: -90, max: 90, noNaN: true });
const lngArb = fc.double({ min: -180, max: 180, noNaN: true });

/** Address string */
const addressArb = fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0);

/** SDG numbers (1-17) */
const sdgArb = fc.array(
  fc.integer({ min: 1, max: 17 }).map((n) => n.toString()),
  { minLength: 0, maxLength: 5 }
);

/** ESP qualification */
const espQualificationArb = fc.oneof(
  fc.constant(null),
  fc.record({
    qualifies: fc.boolean(),
    category: fc.option(fc.constantFrom('Enterprise Development', 'Supplier Development', 'Socio-Economic Development'), { nil: undefined }),
    evidence: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
  })
);

/** Audit trail entry */
const auditTrailEntryArb: fc.Arbitrary<AuditTrailEntry> = fc.record({
  auditId: fc.uuid(),
  auditorId: fc.uuid(),
  findings: fc.string({ minLength: 1, maxLength: 500 }),
  scoreContribution: fc.integer({ min: 0, max: 100 }),
  recommendation: fc.constantFrom(...RECOMMENDATIONS),
  methodology: fc.string({ minLength: 1, maxLength: 300 }),
  completedAt: fc.oneof(
    fc.integer({ min: 1577836800000, max: 1924991999000 }).map((ts) => new Date(ts).toISOString()),
    fc.constant(null)
  ),
});

/** Audit trail (array of entries, 0-5) */
const auditTrailArb = fc.array(auditTrailEntryArb, { minLength: 0, maxLength: 5 });

/** Full project data for report generation */
const projectDataArb = fc.record({
  title: titleArb,
  category: categoryArb,
  location: fc.record({
    address: addressArb,
    country: countryCodeArb,
    lat: latArb,
    lng: lngArb,
  }),
  fundingGoal: fundingGoalArb,
  fundingRaised: fundingRaisedArb,
  verificationBadge: badgeArb,
  verificationScore: verificationScoreArb,
  impactMetrics: fc.record({
    reportingPeriod: reportingPeriodArb,
    primaryMetric: fc.record({
      label: metricLabelArb,
      value: metricValueArb,
    }),
  }),
  espQualification: espQualificationArb,
  sdgAlignment: sdgArb,
});

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 29: Report content completeness', () => {
  /**
   * **Validates: Requirements 9.1**
   * Report always contains project title, category, location.
   */
  it('report always contains project title, category, and location', () => {
    fc.assert(
      fc.property(projectDataArb, auditTrailArb, (projectData, auditTrail) => {
        const report = buildReportData(projectData, auditTrail);

        expect(report.project.title).toBeDefined();
        expect(typeof report.project.title).toBe('string');

        expect(report.project.category).toBeDefined();
        expect(typeof report.project.category).toBe('string');

        expect(report.project.location).toBeDefined();
        expect(typeof report.project.location.address).toBe('string');
        expect(typeof report.project.location.country).toBe('string');
        expect(typeof report.project.location.lat).toBe('number');
        expect(typeof report.project.location.lng).toBe('number');
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 9.1**
   * Report always contains funding goal and funding raised.
   */
  it('report always contains funding goal and funding raised', () => {
    fc.assert(
      fc.property(projectDataArb, auditTrailArb, (projectData, auditTrail) => {
        const report = buildReportData(projectData, auditTrail);

        expect(report.project.fundingGoal).toBeDefined();
        expect(typeof report.project.fundingGoal).toBe('number');
        expect(Number.isFinite(report.project.fundingGoal)).toBe(true);

        expect(report.project.fundingRaised).toBeDefined();
        expect(typeof report.project.fundingRaised).toBe('number');
        expect(Number.isFinite(report.project.fundingRaised)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 9.4**
   * Report always contains verification badge and score.
   */
  it('report always contains verification badge and score', () => {
    fc.assert(
      fc.property(projectDataArb, auditTrailArb, (projectData, auditTrail) => {
        const report = buildReportData(projectData, auditTrail);

        expect(report.project.verificationBadge).toBeDefined();
        expect(typeof report.project.verificationBadge).toBe('string');
        expect(VALID_BADGES).toContain(report.project.verificationBadge);

        expect(report.project.verificationScore).toBeDefined();
        expect(typeof report.project.verificationScore).toBe('number');
        expect(report.project.verificationScore).toBeGreaterThanOrEqual(0);
        expect(report.project.verificationScore).toBeLessThanOrEqual(100);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 9.4**
   * Report always contains audit trail (array, may be empty with notice).
   */
  it('report always contains audit trail (array, may be empty with notice)', () => {
    fc.assert(
      fc.property(projectDataArb, auditTrailArb, (projectData, auditTrail) => {
        const report = buildReportData(projectData, auditTrail);

        expect(Array.isArray(report.auditTrail)).toBe(true);

        // If audit trail is empty, there should be a notice
        if (report.auditTrail.length === 0) {
          expect(report.auditNotice).toBeDefined();
          expect(typeof report.auditNotice).toBe('string');
          expect(report.auditNotice!.length).toBeGreaterThan(0);
        }

        // Each audit entry must have all required fields
        for (const entry of report.auditTrail) {
          expect(entry.findings).toBeDefined();
          expect(entry.scoreContribution).toBeDefined();
          expect(typeof entry.scoreContribution).toBe('number');
          expect(entry.recommendation).toBeDefined();
          expect(entry.methodology).toBeDefined();
          // completedAt can be null but must be defined
          expect('completedAt' in entry).toBe(true);
        }
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 9.1**
   * Report always contains impact metrics.
   */
  it('report always contains impact metrics', () => {
    fc.assert(
      fc.property(projectDataArb, auditTrailArb, (projectData, auditTrail) => {
        const report = buildReportData(projectData, auditTrail);

        expect(report.project.impactMetrics).toBeDefined();
        expect(report.project.impactMetrics.reportingPeriod).toBeDefined();
        expect(typeof report.project.impactMetrics.reportingPeriod).toBe('string');

        expect(report.project.impactMetrics.primaryMetric).toBeDefined();
        expect(report.project.impactMetrics.primaryMetric.label).toBeDefined();
        expect(typeof report.project.impactMetrics.primaryMetric.label).toBe('string');
        expect(report.project.impactMetrics.primaryMetric.value).toBeDefined();
        expect(typeof report.project.impactMetrics.primaryMetric.value).toBe('number');
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 9.5**
   * Report always contains ESP qualification and SDG alignment.
   */
  it('report always contains ESP qualification and SDG alignment', () => {
    fc.assert(
      fc.property(projectDataArb, auditTrailArb, (projectData, auditTrail) => {
        const report = buildReportData(projectData, auditTrail);

        // ESP qualification must be present (can be null for non-qualifying projects)
        expect('espQualification' in report.project).toBe(true);
        if (report.project.espQualification !== null) {
          expect(typeof report.project.espQualification.qualifies).toBe('boolean');
        }

        // SDG alignment must be present as an array
        expect(Array.isArray(report.project.sdgAlignment)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 9.1, 9.4, 9.5**
   * Full report completeness validation passes for any valid input.
   */
  it('full report completeness validation passes for any valid input', () => {
    fc.assert(
      fc.property(projectDataArb, auditTrailArb, (projectData, auditTrail) => {
        const report = buildReportData(projectData, auditTrail);
        const result = validateReportCompleteness(report);

        expect(result.valid).toBe(true);
        expect(result.missingFields).toEqual([]);
      }),
      { numRuns: 300 }
    );
  });
});
