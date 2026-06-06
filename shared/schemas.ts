// shared/schemas.ts — Zod validation schemas for Offsettabillity platform
// Used by both frontend (Next.js) and Cloud Functions
// Single source of truth for FE + BE validation

import { z } from 'zod/v4';

// ─── Lead Capture Schema ─────────────────────────────────────────────────────

export const LeadCreateSchema = z.object({
  email: z.string().email().max(254),
  name: z.string().max(100).optional(),
  company: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  type: z.enum(['calculator', 'report_request', 'consultation', 'newsletter', 'auditor_inquiry']),
  source: z.string().url(),
  projectId: z.string().optional(),
  message: z.string().optional(),
  industry: z.string().optional(),
  budget: z.number().min(1).max(999999999).optional(),
  marketingConsent: z.boolean(),
  utm: z.object({
    source: z.string().optional(),
    medium: z.string().optional(),
    campaign: z.string().optional(),
    content: z.string().optional(),
    term: z.string().optional(),
  }),
});

// ─── Project Creation Schema ─────────────────────────────────────────────────

export const ProjectCreateSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(5000),
  category: z.string().min(1).max(50),
  subCategory: z.string().optional(),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    address: z.string().min(1),
    country: z.string().length(2),
  }),
  fundingGoal: z.number().int().min(1000).max(999999999),
  impactMetrics: z.object({
    reportingPeriod: z.enum(['Monthly', 'Quarterly', 'Annually', 'Project Duration']),
    primaryMetric: z.object({
      label: z.string().min(1),
      value: z.number(),
    }),
  }),
});

// ─── Audit Submission Schema ─────────────────────────────────────────────────

export const AuditSubmitSchema = z.object({
  auditId: z.string().min(1),
  findings: z.string().min(1),
  scoreContribution: z.number().int().min(0).max(100),
  methodology: z.string().min(1),
  recommendation: z.enum(['approve', 'conditional', 'reject']),
  evidenceDocuments: z.array(z.string()).optional(),
});

// ─── Funding Creation Schema ─────────────────────────────────────────────────

export const FundingCreateSchema = z.object({
  projectId: z.string().min(1),
  amount: z.number().int().min(1000).max(100000000),
  currency: z.string().length(3).default('ZAR'),
});

// ─── Registration Schema ─────────────────────────────────────────────────────

export const RegistrationSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(64).regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Password must contain uppercase, lowercase, and digit'
  ),
  name: z.string().min(1).max(100),
  country: z.string().length(2),
  role: z.enum(['funder', 'owner', 'auditor']),
  // Role-specific fields
  organizationName: z.string().optional(),
  organizationType: z.string().optional(),
  organizationRegNumber: z.string().optional(),
  industry: z.string().optional(),
  areasOfInterest: z.array(z.string()).optional(),
  qualifications: z.string().optional(),
  yearsOfExperience: z.number().int().min(0).optional(),
  specializations: z.array(z.string()).optional(),
});

// ─── Taxonomy Category Schema ────────────────────────────────────────────────

export const TaxonomyCategorySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).max(50),
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  primaryMetricLabel: z.string().min(1),
  icon: z.string().optional(),
  sdgNumbers: z.array(z.number().int().min(1).max(17)).optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

// ─── Carbon Credit Purchase Schema ──────────────────────────────────────────

export const CreditPurchaseSchema = z.object({
  quantity: z.number().min(1).max(100000).refine(
    (val) => Number(val.toFixed(2)) === val,
    { message: 'Quantity must have at most 2 decimal places' }
  ),
  projectAllocations: z.array(z.object({
    projectId: z.string().min(1),
    tonnage: z.number().min(0.01),
  })).min(1),
  packageId: z.string().optional(),
});

// ─── Credit Package Admin Schema ─────────────────────────────────────────────

export const CreditPackageSchema = z.object({
  name: z.string().min(1).max(100),
  tier: z.enum(['bronze', 'silver', 'gold', 'platinum']),
  tonnage: z.number().min(1).max(100000),
  priceCents: z.number().int().min(100).max(999999999),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(999),
});

// ─── Export Date Range Schema ────────────────────────────────────────────────

export const ExportDateRangeSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
}).refine(
  (data) => new Date(data.startDate) < new Date(data.endDate),
  { message: 'Start date must be before end date' }
);

// ─── Inferred Types from Schemas ─────────────────────────────────────────────

export type LeadCreateInput = z.infer<typeof LeadCreateSchema>;
export type ProjectCreateInput = z.infer<typeof ProjectCreateSchema>;
export type AuditSubmitInput = z.infer<typeof AuditSubmitSchema>;
export type FundingCreateInput = z.infer<typeof FundingCreateSchema>;
export type RegistrationInput = z.infer<typeof RegistrationSchema>;
export type TaxonomyCategoryInput = z.infer<typeof TaxonomyCategorySchema>;
export type CreditPurchaseInput = z.infer<typeof CreditPurchaseSchema>;
export type CreditPackageInput = z.infer<typeof CreditPackageSchema>;
export type ExportDateRangeInput = z.infer<typeof ExportDateRangeSchema>;
