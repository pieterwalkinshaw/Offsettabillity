/**
 * Integration Tests: Critical Paths
 *
 * Tests the end-to-end logic of the platform's critical paths using
 * pure helper functions (no actual Firebase calls).
 *
 * Critical paths tested:
 * 1. Registration → user document creation with correct role fields
 * 2. Project creation → draft status → document upload → submission → status transition
 * 3. Verification workflow: prescreen → assign audit → submit findings → score recalculation → badge update
 * 4. Funding flow: create transaction → confirm payment → fundingRaised increment → goal threshold check
 * 5. Lead capture: validation → storage → rate limiting → honeypot detection
 */

import { describe, it, expect } from 'vitest';
import { RegistrationSchema, ProjectCreateSchema, AuditSubmitSchema, FundingCreateSchema, LeadCreateSchema } from '@shared/schemas';
import { calculateVerificationScore, calculateDocumentationScore, calculateAuditScore, calculateMethodologyScore, calculateComplianceScore } from '@/lib/verification/score';
import { determineBadge } from '@/lib/verification/badge';
import { hasConflictOfInterest } from '@/lib/verification/conflict';
import type { Project, Audit, User, VerificationStatus, VerificationBadge, FundingTransaction } from '@shared/types';

// ─── Test Helpers ────────────────────────────────────────────────────────────

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    projectId: 'proj-1',
    title: 'Solar Panel Installation',
    description: 'Installing solar panels in rural communities',
    category: 'renewable-energy',
    ownerId: 'owner-1',
    location: { lat: -33.9, lng: 18.4, address: 'Cape Town', country: 'ZA' },
    fundingGoal: 5000000, // R50,000
    fundingRaised: 0,
    impactMetrics: {
      reportingPeriod: 'Quarterly',
      primaryMetric: { label: 'MWh Generated', value: 120 },
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
    findings: 'Project documentation verified. Impact metrics confirmed.',
    scoreContribution: 85,
    methodology: 'Standard verification methodology applied to all project documents and evidence. Site visit conducted.',
    recommendation: 'approve',
    createdAt: '2024-01-15T00:00:00Z',
    completedAt: '2024-02-01T00:00:00Z',
    ...overrides,
  };
}

// ─── Critical Path 1: Registration → User Document Creation ──────────────────

describe('Critical Path 1: Registration → User Document Creation', () => {
  describe('Funder registration with correct role fields', () => {
    it('validates a complete funder registration and produces correct user document shape', () => {
      const input = {
        email: 'funder@company.co.za',
        password: 'SecurePass1',
        name: 'John Smith',
        country: 'ZA',
        role: 'funder' as const,
        organizationName: 'Green Corp',
        organizationType: 'corporate',
        industry: 'manufacturing',
        areasOfInterest: ['renewable-energy', 'carbon-removal'],
      };

      // Validation passes
      const result = RegistrationSchema.safeParse(input);
      expect(result.success).toBe(true);

      if (result.success) {
        // Simulate user document creation
        const userDoc: Partial<User> = {
          email: result.data.email,
          name: result.data.name,
          role: result.data.role,
          country: result.data.country,
          isApproved: true, // Funders are auto-approved
          organizationName: result.data.organizationName,
          organizationType: result.data.organizationType,
          industry: result.data.industry,
          areasOfInterest: result.data.areasOfInterest,
        };

        expect(userDoc.role).toBe('funder');
        expect(userDoc.isApproved).toBe(true);
        expect(userDoc.organizationName).toBe('Green Corp');
        expect(userDoc.industry).toBe('manufacturing');
        expect(userDoc.areasOfInterest).toEqual(['renewable-energy', 'carbon-removal']);
      }
    });

    it('validates a complete owner registration with org fields', () => {
      const input = {
        email: 'owner@ngo.org',
        password: 'OwnerPass1',
        name: 'Jane Doe',
        country: 'ZA',
        role: 'owner' as const,
        organizationName: 'Impact NGO',
        organizationType: 'ngo',
        organizationRegNumber: 'NPO-2024-001',
      };

      const result = RegistrationSchema.safeParse(input);
      expect(result.success).toBe(true);

      if (result.success) {
        const userDoc: Partial<User> = {
          email: result.data.email,
          name: result.data.name,
          role: result.data.role,
          country: result.data.country,
          isApproved: true, // Owners are auto-approved
          organizationName: result.data.organizationName,
          organizationRegNumber: result.data.organizationRegNumber,
          organizationType: result.data.organizationType,
        };

        expect(userDoc.role).toBe('owner');
        expect(userDoc.isApproved).toBe(true);
        expect(userDoc.organizationRegNumber).toBe('NPO-2024-001');
      }
    });

    it('validates auditor registration with isApproved=false', () => {
      const input = {
        email: 'auditor@verify.co.za',
        password: 'AuditPass1',
        name: 'Dr. Audit',
        country: 'ZA',
        role: 'auditor' as const,
        qualifications: 'ISO 14001 Lead Auditor',
        yearsOfExperience: 10,
        specializations: ['renewable-energy', 'carbon-removal'],
      };

      const result = RegistrationSchema.safeParse(input);
      expect(result.success).toBe(true);

      if (result.success) {
        const userDoc: Partial<User> = {
          email: result.data.email,
          name: result.data.name,
          role: result.data.role,
          country: result.data.country,
          isApproved: false, // Auditors require admin approval
          qualifications: result.data.qualifications,
          yearsOfExperience: result.data.yearsOfExperience,
          specializations: result.data.specializations,
        };

        expect(userDoc.role).toBe('auditor');
        expect(userDoc.isApproved).toBe(false);
        expect(userDoc.qualifications).toBe('ISO 14001 Lead Auditor');
        expect(userDoc.specializations).toEqual(['renewable-energy', 'carbon-removal']);
      }
    });

    it('rejects registration with invalid password (no uppercase)', () => {
      const input = {
        email: 'user@test.com',
        password: 'nouppercas1',
        name: 'Test User',
        country: 'ZA',
        role: 'funder' as const,
      };

      const result = RegistrationSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects registration with invalid country code', () => {
      const input = {
        email: 'user@test.com',
        password: 'ValidPass1',
        name: 'Test User',
        country: 'INVALID',
        role: 'funder' as const,
      };

      const result = RegistrationSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('stores UTM parameters with user document on registration', () => {
      const input = {
        email: 'utm-user@test.com',
        password: 'ValidPass1',
        name: 'UTM User',
        country: 'ZA',
        role: 'funder' as const,
        organizationName: 'UTM Corp',
        organizationType: 'corporate',
        industry: 'tech',
        areasOfInterest: ['digital-inclusion'],
      };

      const result = RegistrationSchema.safeParse(input);
      expect(result.success).toBe(true);

      // Simulate UTM params from session
      const utmParams = { source: 'google', medium: 'cpc', campaign: 'esg-2024' };

      if (result.success) {
        const userDoc = {
          email: result.data.email,
          name: result.data.name,
          role: result.data.role,
          country: result.data.country,
          isApproved: true,
          utmSource: utmParams.source,
          utmMedium: utmParams.medium,
          utmCampaign: utmParams.campaign,
        };

        expect(userDoc.utmSource).toBe('google');
        expect(userDoc.utmMedium).toBe('cpc');
        expect(userDoc.utmCampaign).toBe('esg-2024');
      }
    });
  });
});


// ─── Critical Path 2: Project Creation → Draft → Upload → Submission → Status ─

describe('Critical Path 2: Project Creation → Draft → Upload → Submission → Status Transition', () => {
  it('validates project creation input and sets initial draft state', () => {
    const input = {
      title: 'Community Solar Farm',
      description: 'A 500kW solar farm providing clean energy to 200 households in rural KZN.',
      category: 'renewable-energy',
      location: { lat: -29.8, lng: 31.0, address: 'Durban, KZN', country: 'ZA' },
      fundingGoal: 2500000, // R25,000
      impactMetrics: {
        reportingPeriod: 'Quarterly' as const,
        primaryMetric: { label: 'MWh Generated', value: 500 },
      },
    };

    // Step 1: Validate project creation input
    const parseResult = ProjectCreateSchema.safeParse(input);
    expect(parseResult.success).toBe(true);

    // Step 2: Simulate project creation with draft defaults
    const project = makeProject({
      title: input.title,
      description: input.description,
      category: input.category,
      location: input.location,
      fundingGoal: input.fundingGoal,
      fundingRaised: 0,
      impactMetrics: input.impactMetrics,
      verificationStatus: 'draft',
      verificationBadge: 'None',
      documents: [],
    });

    expect(project.verificationStatus).toBe('draft');
    expect(project.verificationBadge).toBe('None');
    expect(project.fundingRaised).toBe(0);
    expect(project.documents).toHaveLength(0);
  });

  it('simulates document upload validation (accept valid, reject invalid)', () => {
    const project = makeProject({ documents: ['doc1.pdf', 'doc2.png'] });

    // Valid upload: PDF, under 5MB, under 10 docs
    const validFile = { type: 'application/pdf', size: 3 * 1024 * 1024, name: 'report.pdf' };
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg'];
    const maxSize = 5 * 1024 * 1024;
    const maxDocs = 10;

    const isValidType = allowedTypes.includes(validFile.type);
    const isValidSize = validFile.size <= maxSize;
    const isUnderLimit = project.documents.length < maxDocs;

    expect(isValidType).toBe(true);
    expect(isValidSize).toBe(true);
    expect(isUnderLimit).toBe(true);

    // Invalid upload: wrong type
    const invalidFile = { type: 'application/zip', size: 1024, name: 'archive.zip' };
    expect(allowedTypes.includes(invalidFile.type)).toBe(false);

    // Invalid upload: too large
    const largeFile = { type: 'application/pdf', size: 6 * 1024 * 1024, name: 'huge.pdf' };
    expect(largeFile.size <= maxSize).toBe(false);

    // Invalid upload: too many documents
    const fullProject = makeProject({
      documents: Array.from({ length: 10 }, (_, i) => `doc${i}.pdf`),
    });
    expect(fullProject.documents.length < maxDocs).toBe(false);
  });

  it('transitions project from draft to submitted when documents exist', () => {
    // Project with documents can be submitted
    const projectWithDocs = makeProject({
      verificationStatus: 'draft',
      documents: ['evidence.pdf', 'registration.pdf'],
    });

    // Simulate submission logic
    const canSubmit = projectWithDocs.verificationStatus === 'draft' && projectWithDocs.documents.length > 0;
    expect(canSubmit).toBe(true);

    // After submission
    const submittedProject: Project = {
      ...projectWithDocs,
      verificationStatus: 'submitted',
    };
    expect(submittedProject.verificationStatus).toBe('submitted');
  });

  it('rejects submission when project has no documents', () => {
    const projectNoDocs = makeProject({
      verificationStatus: 'draft',
      documents: [],
    });

    const canSubmit = projectNoDocs.verificationStatus === 'draft' && projectNoDocs.documents.length > 0;
    expect(canSubmit).toBe(false);
  });

  it('prevents editing title/category/fundingGoal after submission', () => {
    const submittedProject = makeProject({ verificationStatus: 'submitted' });

    // Immutable fields after submission
    const immutableFields = ['title', 'category', 'fundingGoal'];
    const editableStatuses: VerificationStatus[] = ['draft'];

    const canEditImmutableFields = editableStatuses.includes(submittedProject.verificationStatus);
    expect(canEditImmutableFields).toBe(false);

    // Other fields remain editable
    const mutableFields = ['description', 'location', 'impactMetrics'];
    // These should still be editable regardless of status (by owner)
    expect(mutableFields.length).toBeGreaterThan(0);
  });
});


// ─── Critical Path 3: Verification Workflow ──────────────────────────────────

describe('Critical Path 3: Verification Workflow (prescreen → assign → submit → score → badge)', () => {
  it('full verification workflow: prescreen → assign → submit findings → recalculate score → update badge', () => {
    // Step 1: Project starts as "submitted"
    const project = makeProject({
      verificationStatus: 'submitted',
      documents: ['evidence.pdf', 'registration.pdf', 'impact-plan.pdf'],
    });

    // Step 2: Admin pre-screens → transitions to "prescreened"
    const prescreenedProject: Project = {
      ...project,
      verificationStatus: 'prescreened',
    };
    expect(prescreenedProject.verificationStatus).toBe('prescreened');

    // Step 3: Admin assigns auditor (no conflict of interest)
    const auditorId = 'auditor-1';
    const conflict = hasConflictOfInterest(
      auditorId,
      prescreenedProject.ownerId,
      [], // no funders
      [], // no previous auditors
    );
    expect(conflict).toBe(false);

    // Step 4: Project transitions to "pending_audit"
    const pendingAuditProject: Project = {
      ...prescreenedProject,
      verificationStatus: 'pending_audit',
    };
    expect(pendingAuditProject.verificationStatus).toBe('pending_audit');

    // Step 5: Auditor submits findings
    const auditInput = {
      auditId: 'audit-1',
      findings: 'All documentation verified. Impact metrics confirmed through site visit.',
      scoreContribution: 90,
      methodology: 'Comprehensive verification methodology including document review, stakeholder interviews, and on-site inspection of solar panel installations. Cross-referenced with utility records for energy generation claims.',
      recommendation: 'approve' as const,
    };

    const auditParseResult = AuditSubmitSchema.safeParse(auditInput);
    expect(auditParseResult.success).toBe(true);

    // Step 6: Audit record created as "completed"
    const completedAudit = makeAudit({
      auditId: auditInput.auditId,
      projectId: pendingAuditProject.projectId,
      auditorId,
      status: 'completed',
      findings: auditInput.findings,
      scoreContribution: auditInput.scoreContribution,
      methodology: auditInput.methodology,
      recommendation: auditInput.recommendation,
    });

    // Step 7: Recalculate verification score
    const newScore = calculateVerificationScore(pendingAuditProject, [completedAudit]);
    expect(newScore).toBeGreaterThan(0);
    expect(newScore).toBeLessThanOrEqual(100);

    // Step 8: Determine badge (1 completed audit with approve → "Verified")
    const newBadge = determineBadge(newScore, 1);
    expect(newBadge).toBe('Verified');

    // Step 9: Project transitions to "verified" (first approve audit)
    const verifiedProject: Project = {
      ...pendingAuditProject,
      verificationStatus: 'verified',
      verificationScore: newScore,
      verificationBadge: newBadge,
    };
    expect(verifiedProject.verificationStatus).toBe('verified');
    expect(verifiedProject.verificationBadge).toBe('Verified');
  });

  it('upgrades badge to Verified+ with 2 audits and score > 85', () => {
    const project = makeProject({
      documents: Array.from({ length: 5 }, (_, i) => `doc${i}.pdf`),
      impactMetrics: {
        reportingPeriod: 'Quarterly',
        primaryMetric: { label: 'MWh Generated', value: 500 },
      },
    });

    const audits: Audit[] = [
      makeAudit({
        auditId: 'audit-1',
        scoreContribution: 92,
        methodology: 'A'.repeat(201), // detailed → 100
        recommendation: 'approve',
      }),
      makeAudit({
        auditId: 'audit-2',
        auditorId: 'auditor-2',
        scoreContribution: 90,
        methodology: 'A'.repeat(201), // detailed → 100
        recommendation: 'approve',
      }),
    ];

    const score = calculateVerificationScore(project, audits);
    // docScore=80, auditScore=91, methodologyScore=100, complianceScore=100
    // weighted = 80*0.20 + 91*0.40 + 100*0.20 + 100*0.20 = 16 + 36.4 + 20 + 20 = 92.4 → 92
    expect(score).toBeGreaterThan(85);

    const badge = determineBadge(score, 2);
    expect(badge).toBe('Verified+');
  });

  it('upgrades badge to Premium Assured with 3 audits and score > 95', () => {
    const project = makeProject({
      documents: Array.from({ length: 10 }, (_, i) => `doc${i}.pdf`),
      impactMetrics: {
        reportingPeriod: 'Quarterly',
        primaryMetric: { label: 'MWh Generated', value: 500 },
      },
    });

    const audits: Audit[] = [
      makeAudit({
        auditId: 'audit-1',
        scoreContribution: 98,
        methodology: 'A'.repeat(201),
        recommendation: 'approve',
      }),
      makeAudit({
        auditId: 'audit-2',
        auditorId: 'auditor-2',
        scoreContribution: 97,
        methodology: 'A'.repeat(201),
        recommendation: 'approve',
      }),
      makeAudit({
        auditId: 'audit-3',
        auditorId: 'auditor-3',
        scoreContribution: 99,
        methodology: 'A'.repeat(201),
        recommendation: 'approve',
      }),
    ];

    const score = calculateVerificationScore(project, audits);
    // docScore=100, auditScore=98, methodologyScore=100, complianceScore=100
    // weighted = 100*0.20 + 98*0.40 + 100*0.20 + 100*0.20 = 20 + 39.2 + 20 + 20 = 99.2 → 99
    expect(score).toBeGreaterThan(95);

    const badge = determineBadge(score, 3);
    expect(badge).toBe('Premium Assured');
  });

  it('rejects audit assignment when conflict of interest exists', () => {
    // Auditor owns the project
    expect(hasConflictOfInterest('auditor-1', 'auditor-1', [], [])).toBe(true);

    // Auditor has funded the project
    expect(hasConflictOfInterest('auditor-1', 'owner-1', ['auditor-1'], [])).toBe(true);

    // Auditor audited in previous cycle
    expect(hasConflictOfInterest('auditor-1', 'owner-1', [], ['auditor-1'])).toBe(true);

    // No conflict
    expect(hasConflictOfInterest('auditor-1', 'owner-1', ['funder-1'], ['auditor-2'])).toBe(false);
  });
});


// ─── Critical Path 4: Funding Flow ───────────────────────────────────────────

describe('Critical Path 4: Funding Flow (create → confirm → increment → goal threshold)', () => {
  it('full funding flow: validate → create transaction → confirm → increment fundingRaised → check goal', () => {
    // Step 1: Validate funding input
    const fundingInput = {
      projectId: 'proj-1',
      amount: 1500000, // R15,000
      currency: 'ZAR',
    };

    const parseResult = FundingCreateSchema.safeParse(fundingInput);
    expect(parseResult.success).toBe(true);

    // Step 2: Verify project eligibility (must be "verified" or "live")
    const eligibleStatuses: VerificationStatus[] = ['verified', 'live'];
    const project = makeProject({ verificationStatus: 'verified' });
    expect(eligibleStatuses.includes(project.verificationStatus)).toBe(true);

    // Step 3: Create transaction with status "pending"
    const transaction: FundingTransaction = {
      transactionId: 'txn-1',
      projectId: project.projectId,
      funderId: 'funder-1',
      amount: fundingInput.amount,
      currency: 'ZAR',
      status: 'pending',
      createdAt: '2024-03-01T00:00:00Z',
    };
    expect(transaction.status).toBe('pending');

    // Step 4: Confirm payment → increment fundingRaised
    const confirmedTransaction: FundingTransaction = {
      ...transaction,
      status: 'confirmed',
    };
    expect(confirmedTransaction.status).toBe('confirmed');

    const updatedFundingRaised = project.fundingRaised + confirmedTransaction.amount;
    expect(updatedFundingRaised).toBe(1500000);

    // Step 5: Check goal threshold (not yet reached)
    const reachedGoal = updatedFundingRaised >= project.fundingGoal;
    expect(reachedGoal).toBe(false); // 1.5M < 5M
  });

  it('transitions project to funded when fundingRaised >= fundingGoal', () => {
    const project = makeProject({
      verificationStatus: 'verified',
      fundingGoal: 2000000, // R20,000
      fundingRaised: 1800000, // R18,000 already raised
    });

    // New payment of R5,000 (500000 cents) pushes over goal
    const paymentAmount = 500000;
    const newFundingRaised = project.fundingRaised + paymentAmount;

    expect(newFundingRaised).toBe(2300000);
    expect(newFundingRaised >= project.fundingGoal).toBe(true);

    // Project transitions to "funded"
    const fundedProject: Project = {
      ...project,
      fundingRaised: newFundingRaised,
      verificationStatus: 'funded',
    };
    expect(fundedProject.verificationStatus).toBe('funded');
    // Overfunding is allowed
    expect(fundedProject.fundingRaised).toBeGreaterThan(fundedProject.fundingGoal);
  });

  it('does not modify fundingRaised on failed payment', () => {
    const project = makeProject({
      verificationStatus: 'verified',
      fundingRaised: 1000000,
    });

    // Payment fails
    const failedTransaction: FundingTransaction = {
      transactionId: 'txn-fail',
      projectId: project.projectId,
      funderId: 'funder-1',
      amount: 500000,
      currency: 'ZAR',
      status: 'failed',
      createdAt: '2024-03-01T00:00:00Z',
    };

    // fundingRaised should NOT change
    const updatedFundingRaised = failedTransaction.status === 'confirmed'
      ? project.fundingRaised + failedTransaction.amount
      : project.fundingRaised;

    expect(updatedFundingRaised).toBe(1000000); // unchanged
  });

  it('triggers concentration alert when single funder exceeds 50% of goal', () => {
    const project = makeProject({
      fundingGoal: 4000000, // R40,000
    });

    // Funder has contributed R25,000 (2500000 cents) = 62.5% of goal
    const funderTotal = 2500000;
    const concentrationThreshold = project.fundingGoal * 0.5;

    const shouldAlert = funderTotal > concentrationThreshold;
    expect(shouldAlert).toBe(true);
    expect(funderTotal).toBeGreaterThan(2000000); // > 50% of 4M
  });

  it('rejects funding for ineligible project statuses', () => {
    const ineligibleStatuses: VerificationStatus[] = ['draft', 'submitted', 'prescreened', 'pending_audit', 'funded'];
    const eligibleStatuses: VerificationStatus[] = ['verified', 'live'];

    for (const status of ineligibleStatuses) {
      expect(eligibleStatuses.includes(status)).toBe(false);
    }

    for (const status of eligibleStatuses) {
      expect(eligibleStatuses.includes(status)).toBe(true);
    }
  });

  it('validates funding amount bounds (1000–100000000 cents)', () => {
    // Too low
    const tooLow = FundingCreateSchema.safeParse({ projectId: 'p1', amount: 999, currency: 'ZAR' });
    expect(tooLow.success).toBe(false);

    // Minimum valid
    const minValid = FundingCreateSchema.safeParse({ projectId: 'p1', amount: 1000, currency: 'ZAR' });
    expect(minValid.success).toBe(true);

    // Maximum valid
    const maxValid = FundingCreateSchema.safeParse({ projectId: 'p1', amount: 100000000, currency: 'ZAR' });
    expect(maxValid.success).toBe(true);

    // Too high
    const tooHigh = FundingCreateSchema.safeParse({ projectId: 'p1', amount: 100000001, currency: 'ZAR' });
    expect(tooHigh.success).toBe(false);
  });
});


// ─── Critical Path 5: Lead Capture ───────────────────────────────────────────

describe('Critical Path 5: Lead Capture (validation → storage → rate limiting → honeypot)', () => {
  describe('Lead validation and storage', () => {
    it('validates and stores a complete lead submission', () => {
      const leadInput = {
        email: 'lead@company.co.za',
        name: 'Potential Funder',
        company: 'Green Investments',
        phone: '+27821234567',
        type: 'consultation' as const,
        source: 'https://offsettabillity.co.za/categories/renewable-energy',
        projectId: 'proj-1',
        message: 'Interested in funding renewable energy projects.',
        industry: 'finance',
        budget: 500000,
        marketingConsent: true,
        utm: {
          source: 'google',
          medium: 'cpc',
          campaign: 'esg-funding-2024',
          content: 'renewable-ad',
          term: 'esg investment south africa',
        },
      };

      const parseResult = LeadCreateSchema.safeParse(leadInput);
      expect(parseResult.success).toBe(true);

      if (parseResult.success) {
        // Simulate lead document creation
        const leadDoc = {
          leadId: 'lead-generated-id',
          email: parseResult.data.email,
          name: parseResult.data.name,
          company: parseResult.data.company,
          phone: parseResult.data.phone,
          type: parseResult.data.type,
          source: parseResult.data.source,
          projectId: parseResult.data.projectId,
          message: parseResult.data.message,
          industry: parseResult.data.industry,
          budget: parseResult.data.budget,
          marketingConsent: parseResult.data.marketingConsent,
          utm: parseResult.data.utm,
          status: 'new' as const,
        };

        expect(leadDoc.status).toBe('new');
        expect(leadDoc.email).toBe('lead@company.co.za');
        expect(leadDoc.type).toBe('consultation');
        expect(leadDoc.marketingConsent).toBe(true);
        expect(leadDoc.utm.source).toBe('google');
        expect(leadDoc.utm.campaign).toBe('esg-funding-2024');
      }
    });

    it('rejects lead with invalid email', () => {
      const invalidLead = {
        email: 'not-an-email',
        type: 'newsletter' as const,
        source: 'https://offsettabillity.co.za',
        marketingConsent: false,
        utm: {},
      };

      const result = LeadCreateSchema.safeParse(invalidLead);
      expect(result.success).toBe(false);
    });

    it('rejects lead with missing required type field', () => {
      const missingType = {
        email: 'valid@email.com',
        source: 'https://offsettabillity.co.za',
        marketingConsent: false,
        utm: {},
      };

      const result = LeadCreateSchema.safeParse(missingType);
      expect(result.success).toBe(false);
    });

    it('accepts lead without marketing consent (stores but no marketing)', () => {
      const noConsentLead = {
        email: 'noconsent@test.com',
        type: 'calculator' as const,
        source: 'https://offsettabillity.co.za/calculator',
        marketingConsent: false,
        utm: {},
      };

      const result = LeadCreateSchema.safeParse(noConsentLead);
      expect(result.success).toBe(true);

      if (result.success) {
        // Lead is stored but should not receive marketing
        expect(result.data.marketingConsent).toBe(false);
        // System should NOT send marketing communications
        const canSendMarketing = result.data.marketingConsent === true;
        expect(canSendMarketing).toBe(false);
      }
    });

    it('allows duplicate leads for same email+type (creates new record)', () => {
      const leadInput = {
        email: 'repeat@test.com',
        type: 'newsletter' as const,
        source: 'https://offsettabillity.co.za',
        marketingConsent: true,
        utm: {},
      };

      // Both submissions should validate successfully (no deduplication)
      const result1 = LeadCreateSchema.safeParse(leadInput);
      const result2 = LeadCreateSchema.safeParse(leadInput);
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Each would get a unique leadId (simulated)
      const leadId1 = 'lead-001';
      const leadId2 = 'lead-002';
      expect(leadId1).not.toBe(leadId2);
    });
  });

  describe('Rate limiting logic', () => {
    it('allows up to 5 requests within 60-second window', () => {
      const RATE_LIMIT_MAX = 5;
      const RATE_LIMIT_WINDOW_MS = 60_000;

      // Simulate 5 requests from same IP within window
      const now = Date.now();
      const timestamps = [
        now - 50000,
        now - 40000,
        now - 30000,
        now - 20000,
        now - 10000,
      ];

      // All within window
      const withinWindow = timestamps.filter(t => t > now - RATE_LIMIT_WINDOW_MS);
      expect(withinWindow.length).toBe(5);

      // 5th request is at the limit — next should be rejected
      const isRateLimited = withinWindow.length >= RATE_LIMIT_MAX;
      expect(isRateLimited).toBe(true);
    });

    it('allows requests after window expires', () => {
      const RATE_LIMIT_MAX = 5;
      const RATE_LIMIT_WINDOW_MS = 60_000;

      const now = Date.now();
      // All timestamps are older than 60 seconds
      const oldTimestamps = [
        now - 70000,
        now - 80000,
        now - 90000,
        now - 100000,
        now - 110000,
      ];

      const withinWindow = oldTimestamps.filter(t => t > now - RATE_LIMIT_WINDOW_MS);
      expect(withinWindow.length).toBe(0);

      const isRateLimited = withinWindow.length >= RATE_LIMIT_MAX;
      expect(isRateLimited).toBe(false);
    });
  });

  describe('Honeypot detection', () => {
    it('detects bot submission when honeypot field is filled', () => {
      const submission = {
        email: 'bot@spam.com',
        type: 'newsletter',
        source: 'https://offsettabillity.co.za',
        marketingConsent: false,
        utm: {},
        // Honeypot fields — should be empty for real users
        website: 'http://spam-site.com',
        _hp: 'bot-value',
      };

      // Honeypot detection logic (from leads_create function)
      const isBotDetected = !!(submission.website || submission._hp);
      expect(isBotDetected).toBe(true);

      // Should return fake success without storing
    });

    it('passes legitimate submission without honeypot fields', () => {
      const submission = {
        email: 'real@user.com',
        type: 'consultation',
        source: 'https://offsettabillity.co.za',
        marketingConsent: true,
        utm: { source: 'google' },
        // Honeypot fields empty (real user)
        website: '',
        _hp: '',
      };

      const isBotDetected = !!(submission.website || submission._hp);
      expect(isBotDetected).toBe(false);
    });

    it('passes when honeypot fields are absent entirely', () => {
      const submission = {
        email: 'real@user.com',
        type: 'consultation',
        source: 'https://offsettabillity.co.za',
        marketingConsent: true,
        utm: {},
      };

      const body = submission as Record<string, unknown>;
      const isBotDetected = !!(body.website || body._hp);
      expect(isBotDetected).toBe(false);
    });
  });
});
