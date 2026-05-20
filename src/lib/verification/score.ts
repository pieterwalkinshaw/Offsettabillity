import type { Project, Audit } from '../../../shared/types';

/**
 * Weights for each verification score component.
 * Total must equal 1.0.
 */
const WEIGHTS = {
  documentationCompleteness: 0.20,
  auditorAssessment: 0.40,
  impactMethodology: 0.20,
  reportingCompliance: 0.20,
} as const;

/**
 * Calculate documentation completeness score (0-100).
 * Based on the number of documents attached to the project.
 * - 0 docs = 0
 * - 1+ docs = 50
 * - 5+ docs = 80
 * - 10+ docs = 100
 */
export function calculateDocumentationScore(project: Project): number {
  const docCount = project.documents.length;

  if (docCount >= 10) return 100;
  if (docCount >= 5) return 80;
  if (docCount >= 1) return 50;
  return 0;
}

/**
 * Calculate auditor assessment score (0-100).
 * Average of all completed audit scoreContributions.
 * If no completed audits exist, returns 0.
 */
export function calculateAuditScore(audits: Audit[]): number {
  const completedAudits = audits.filter(
    (a) => a.status === 'completed' && a.scoreContribution !== undefined
  );

  if (completedAudits.length === 0) return 0;

  const total = completedAudits.reduce(
    (sum, audit) => sum + (audit.scoreContribution ?? 0),
    0
  );

  return Math.round(total / completedAudits.length);
}

/**
 * Calculate impact methodology score (0-100).
 * Based on audit methodology descriptions — scores by detail/length.
 * - No audits with methodology = 0
 * - Short methodology (< 50 chars) = 40
 * - Medium methodology (50-200 chars) = 70
 * - Detailed methodology (> 200 chars) = 100
 *
 * Returns the average across all audits that have methodology.
 */
export function calculateMethodologyScore(audits: Audit[]): number {
  const auditsWithMethodology = audits.filter(
    (a) => a.status === 'completed' && a.methodology && a.methodology.length > 0
  );

  if (auditsWithMethodology.length === 0) return 0;

  const total = auditsWithMethodology.reduce((sum, audit) => {
    const length = audit.methodology?.length ?? 0;

    if (length > 200) return sum + 100;
    if (length >= 50) return sum + 70;
    return sum + 40;
  }, 0);

  return Math.round(total / auditsWithMethodology.length);
}

/**
 * Calculate reporting compliance score (0-100).
 * Based on whether the project has impact metrics with a reporting period
 * and a primary metric value set.
 * - No reporting period = 0
 * - Reporting period set but no metric value = 50
 * - Full compliance (period + value) = 100
 */
export function calculateComplianceScore(project: Project): number {
  const { impactMetrics } = project;

  if (!impactMetrics || !impactMetrics.reportingPeriod) return 0;

  if (
    impactMetrics.primaryMetric &&
    impactMetrics.primaryMetric.value !== undefined &&
    impactMetrics.primaryMetric.value !== null
  ) {
    return 100;
  }

  return 50;
}

/**
 * Calculate the overall verification score for a project.
 * Uses weighted components:
 * - Documentation completeness: 20%
 * - Auditor assessment: 40%
 * - Impact methodology: 20%
 * - Reporting compliance: 20%
 *
 * Returns a rounded integer in the range 0-100.
 */
export function calculateVerificationScore(project: Project, audits: Audit[]): number {
  const docScore = calculateDocumentationScore(project);
  const auditScore = calculateAuditScore(audits);
  const methodologyScore = calculateMethodologyScore(audits);
  const complianceScore = calculateComplianceScore(project);

  const weightedScore =
    docScore * WEIGHTS.documentationCompleteness +
    auditScore * WEIGHTS.auditorAssessment +
    methodologyScore * WEIGHTS.impactMethodology +
    complianceScore * WEIGHTS.reportingCompliance;

  return Math.round(weightedScore);
}
