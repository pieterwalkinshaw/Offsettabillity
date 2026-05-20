// shared/types.ts — Canonical TypeScript types for Offsettabillity platform
// Used by both frontend (Next.js) and backend (Cloud Functions)

// ─── Enums ───────────────────────────────────────────────────────────────────

export type UserRole = 'funder' | 'owner' | 'auditor' | 'admin';

export type VerificationStatus =
  | 'draft'
  | 'submitted'
  | 'prescreened'
  | 'pending_audit'
  | 'verified'
  | 'live'
  | 'funded';

export type VerificationBadge = 'None' | 'Verified' | 'Verified+' | 'Premium Assured';

export type LeadType =
  | 'calculator'
  | 'report_request'
  | 'consultation'
  | 'newsletter'
  | 'auditor_inquiry';

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';

export type AuditStatus = 'pending' | 'in_progress' | 'completed' | 'rejected';

export type AuditRecommendation = 'approve' | 'conditional' | 'reject';

export type FundingTransactionStatus = 'pending' | 'confirmed' | 'failed' | 'refunded';

export type ReportAccessLevel = 'public' | 'gated' | 'private';

export type ReportingPeriod = 'Monthly' | 'Quarterly' | 'Annually' | 'Project Duration';

export type RiskLevel = 'low' | 'medium' | 'high';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface User {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  organizationName?: string;
  organizationType?: string;
  organizationRegNumber?: string;
  phone?: string;
  country: string;
  isApproved: boolean;
  expertise?: string[];
  esgProfile?: EsgProfile;
  industry?: string;
  areasOfInterest?: string[];
  qualifications?: string;
  yearsOfExperience?: number;
  specializations?: string[];
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EsgProfile {
  industry?: string;
  budget?: number;
  interests?: string[];
}

export interface Project {
  projectId: string;
  title: string;
  description: string;
  category: string;
  subCategory?: string;
  ownerId: string;
  location: ProjectLocation;
  fundingGoal: number; // Integer cents (ZAR)
  fundingRaised: number; // Integer cents (ZAR)
  impactMetrics: ImpactMetrics;
  verificationScore: number; // 0–100
  verificationStatus: VerificationStatus;
  verificationBadge: VerificationBadge;
  riskLevel?: RiskLevel;
  espQualification?: EspQualification;
  sdgAlignment?: string[];
  documents: string[]; // Cloud Storage paths
  auditHistory?: string[]; // Array of Audit IDs
  isFeatured?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectLocation {
  lat: number;
  lng: number;
  address: string;
  country: string; // ISO 3166-1 alpha-2
}

export interface ImpactMetrics {
  reportingPeriod: ReportingPeriod;
  primaryMetric: {
    label: string;
    value: number;
  };
}

export interface EspQualification {
  qualifies: boolean;
  category?: string;
  evidence?: string;
}

export interface TaxonomyCategory {
  id: string;
  name: string;
  description?: string;
  primaryMetricLabel: string;
  icon?: string;
  sdgNumbers?: number[];
  isActive: boolean;
  sortOrder: number;
}

export interface Audit {
  auditId: string;
  projectId: string;
  auditorId: string;
  status: AuditStatus;
  findings?: string;
  scoreContribution?: number; // 0–100
  methodology?: string;
  recommendation?: AuditRecommendation;
  evidenceDocuments?: string[]; // Cloud Storage paths
  createdAt: string;
  completedAt?: string;
}

export interface Lead {
  leadId: string;
  email: string;
  name?: string;
  company?: string;
  phone?: string;
  type: LeadType;
  source: string;
  projectId?: string;
  message?: string;
  industry?: string;
  budget?: number;
  marketingConsent: boolean;
  utm: UtmParams;
  status: LeadStatus;
  assignedTo?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface UtmParams {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
}

export interface FundingTransaction {
  transactionId: string;
  projectId: string;
  funderId: string;
  amount: number; // Integer cents (ZAR)
  currency: string; // ISO 4217, default ZAR
  status: FundingTransactionStatus;
  paymentReference?: string;
  createdAt: string;
}

export interface Report {
  reportId: string;
  projectId: string;
  title: string;
  fileUrl: string; // Cloud Storage path
  accessLevel: ReportAccessLevel;
  generatedAt: string;
}

// ─── Request/Response Types ──────────────────────────────────────────────────

export interface LeadCreateRequest {
  email: string;
  name?: string;
  company?: string;
  phone?: string;
  type: LeadType;
  source: string;
  projectId?: string;
  message?: string;
  industry?: string;
  budget?: number;
  marketingConsent: boolean;
  utm: UtmParams;
}

export interface ProjectCreateRequest {
  title: string;
  description: string;
  category: string;
  subCategory?: string;
  location: ProjectLocation;
  fundingGoal: number; // Integer cents (ZAR)
  impactMetrics: ImpactMetrics;
}

export interface AuditSubmitRequest {
  auditId: string;
  findings: string;
  scoreContribution: number; // 0–100
  methodology: string;
  recommendation: AuditRecommendation;
  evidenceDocuments?: string[];
}

export interface FundingCreateRequest {
  projectId: string;
  amount: number; // Integer cents (ZAR)
  currency?: string; // Default: ZAR
}

export interface RegistrationRequest {
  email: string;
  password: string;
  name: string;
  country: string;
  role: Exclude<UserRole, 'admin'>;
  organizationName?: string;
  organizationType?: string;
  organizationRegNumber?: string;
  industry?: string;
  areasOfInterest?: string[];
  qualifications?: string;
  yearsOfExperience?: number;
  specializations?: string[];
}

// ─── API Response Types ──────────────────────────────────────────────────────

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;
