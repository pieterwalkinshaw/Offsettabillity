import { describe, it, expect } from 'vitest';
import {
  calculateDocumentationScore,
  calculateAuditScore,
  calculateMethodologyScore,
  calculateComplianceScore,
  calculateVerificationScore,
} from '@/lib/verification/score';
import type { Project, Audit } from '@shared/types';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    projectId: 'proj-1',
    title: 'Test Project',
    description: 'A test project',
    category: 'energy-saving',
    ownerId: 'user-1',
    location: { lat: -33.9, lng: 18.4, address: 'Cape Town', country: 'ZA' },
    fundingGoal: 100000,
    fundingRaised: 0,
    impactMetrics: {
      reportingPeriod: 'Quarterly',
      primaryMetric: { label: 'kWh Saved', value: 5000 },
    },
    verificationScore: 0,
    verificationStatus: 'draft',
    verificationBadge: 'None',
    documents: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeAudit(overrides: Partial<Audit> = {}): Audit {
  return {
    auditId: 'audit-1',
    projectId: 'proj-1',
    auditorId: 'auditor-1',
    status: 'completed',
    scoreContribution: 80,
    methodology: 'Standard verification methodology applied to all project documents and evidence.',
    createdAt: '2024-01-01T00:00:00Z',
    completedAt: '2024-02-01T00:00:00Z',
    ...overrides,
  };
}

describe('calculateDocumentationScore', () => {
  it('returns 0 for no documents', () => {
    const project = makeProject({ documents: [] });
    expect(calculateDocumentationScore(project)).toBe(0);
  });

  it('returns 50 for 1 document', () => {
    const project = makeProject({ documents: ['doc1.pdf'] });
    expect(calculateDocumentationScore(project)).toBe(50);
  });

  it('returns 50 for 4 documents', () => {
    const project = makeProject({ documents: ['a', 'b', 'c', 'd'] });
    expect(calculateDocumentationScore(project)).toBe(50);
  });

  it('returns 80 for 5 documents', () => {
    const project = makeProject({
      documents: ['a', 'b', 'c', 'd', 'e'],
    });
    expect(calculateDocumentationScore(project)).toBe(80);
  });

  it('returns 80 for 9 documents', () => {
    const project = makeProject({
      documents: Array.from({ length: 9 }, (_, i) => `doc${i}.pdf`),
    });
    expect(calculateDocumentationScore(project)).toBe(80);
  });

  it('returns 100 for 10 documents', () => {
    const project = makeProject({
      documents: Array.from({ length: 10 }, (_, i) => `doc${i}.pdf`),
    });
    expect(calculateDocumentationScore(project)).toBe(100);
  });
});

describe('calculateAuditScore', () => {
  it('returns 0 for no audits', () => {
    expect(calculateAuditScore([])).toBe(0);
  });

  it('returns 0 for only pending audits', () => {
    const audits = [makeAudit({ status: 'pending', scoreContribution: 90 })];
    expect(calculateAuditScore(audits)).toBe(0);
  });

  it('returns the score for a single completed audit', () => {
    const audits = [makeAudit({ scoreContribution: 75 })];
    expect(calculateAuditScore(audits)).toBe(75);
  });

  it('returns the average for multiple completed audits', () => {
    const audits = [
      makeAudit({ auditId: 'a1', scoreContribution: 80 }),
      makeAudit({ auditId: 'a2', scoreContribution: 60 }),
    ];
    expect(calculateAuditScore(audits)).toBe(70);
  });

  it('ignores non-completed audits in the average', () => {
    const audits = [
      makeAudit({ auditId: 'a1', scoreContribution: 90 }),
      makeAudit({ auditId: 'a2', status: 'in_progress', scoreContribution: 20 }),
    ];
    expect(calculateAuditScore(audits)).toBe(90);
  });
});

describe('calculateMethodologyScore', () => {
  it('returns 0 for no audits', () => {
    expect(calculateMethodologyScore([])).toBe(0);
  });

  it('returns 0 for audits without methodology', () => {
    const audits = [makeAudit({ methodology: undefined })];
    expect(calculateMethodologyScore(audits)).toBe(0);
  });

  it('returns 40 for short methodology (< 50 chars)', () => {
    const audits = [makeAudit({ methodology: 'Brief check.' })];
    expect(calculateMethodologyScore(audits)).toBe(40);
  });

  it('returns 70 for medium methodology (50-200 chars)', () => {
    const methodology = 'A'.repeat(100);
    const audits = [makeAudit({ methodology })];
    expect(calculateMethodologyScore(audits)).toBe(70);
  });

  it('returns 100 for detailed methodology (> 200 chars)', () => {
    const methodology = 'A'.repeat(201);
    const audits = [makeAudit({ methodology })];
    expect(calculateMethodologyScore(audits)).toBe(100);
  });

  it('averages across multiple audits with methodology', () => {
    const audits = [
      makeAudit({ auditId: 'a1', methodology: 'Short' }), // 40
      makeAudit({ auditId: 'a2', methodology: 'A'.repeat(201) }), // 100
    ];
    expect(calculateMethodologyScore(audits)).toBe(70); // (40 + 100) / 2
  });
});

describe('calculateComplianceScore', () => {
  it('returns 100 for full compliance (period + value)', () => {
    const project = makeProject({
      impactMetrics: {
        reportingPeriod: 'Quarterly',
        primaryMetric: { label: 'kWh', value: 100 },
      },
    });
    expect(calculateComplianceScore(project)).toBe(100);
  });

  it('returns 50 for reporting period set but no metric value', () => {
    const project = makeProject({
      impactMetrics: {
        reportingPeriod: 'Monthly',
        primaryMetric: { label: 'kWh', value: undefined as unknown as number },
      },
    });
    expect(calculateComplianceScore(project)).toBe(50);
  });

  it('returns 0 for no impact metrics', () => {
    const project = makeProject({
      impactMetrics: undefined as unknown as Project['impactMetrics'],
    });
    expect(calculateComplianceScore(project)).toBe(0);
  });
});

describe('calculateVerificationScore', () => {
  it('returns 0 for a project with no docs, no audits, no metrics', () => {
    const project = makeProject({
      documents: [],
      impactMetrics: undefined as unknown as Project['impactMetrics'],
    });
    expect(calculateVerificationScore(project, [])).toBe(0);
  });

  it('calculates weighted score correctly', () => {
    // docScore = 50 (1 doc), auditScore = 80, methodologyScore = 70 (medium), complianceScore = 100
    // weighted = 50*0.20 + 80*0.40 + 70*0.20 + 100*0.20 = 10 + 32 + 14 + 20 = 76
    const project = makeProject({
      documents: ['doc1.pdf'],
      impactMetrics: {
        reportingPeriod: 'Quarterly',
        primaryMetric: { label: 'kWh', value: 5000 },
      },
    });
    const audits = [
      makeAudit({ scoreContribution: 80, methodology: 'A'.repeat(100) }),
    ];
    expect(calculateVerificationScore(project, audits)).toBe(76);
  });

  it('returns a value between 0 and 100', () => {
    const project = makeProject({
      documents: Array.from({ length: 10 }, (_, i) => `doc${i}.pdf`),
      impactMetrics: {
        reportingPeriod: 'Annually',
        primaryMetric: { label: 'tons', value: 999 },
      },
    });
    const audits = [
      makeAudit({ scoreContribution: 100, methodology: 'A'.repeat(250) }),
    ];
    const score = calculateVerificationScore(project, audits);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
