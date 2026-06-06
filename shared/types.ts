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

// ─── Carbon Credit Types ─────────────────────────────────────────────────────

export interface CreditInventory {
  inventoryId: string;           // Auto-generated document ID
  projectId: string;             // FK to Project.projectId
  availableTonnage: number;      // Metric tons CO₂e, 2 decimal places
  totalTonnage: number;          // Original tonnage (never decrements)
  unitPriceCents: number;        // Price per ton in ZAR integer cents
  projectTitle: string;          // Denormalized for read performance
  projectLocation: string;       // Denormalized (address string)
  createdAt: string;             // ISO 8601 timestamp
  updatedAt: string;             // ISO 8601 timestamp
}

export type CreditPackageTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface CreditPackage {
  packageId: string;             // Auto-generated document ID
  name: string;                  // Display name (e.g. "Bronze Package")
  tier: CreditPackageTier;       // Tier identifier for ordering
  tonnage: number;               // Metric tons in this package
  priceCents: number;            // Total package price in ZAR integer cents
  discountPercentage: number;    // Calculated: (1 - priceCents / (tonnage * unitPriceCents)) * 100
  isActive: boolean;             // Only active packages shown in marketplace
  sortOrder: number;             // Display ordering
  createdAt: string;
  updatedAt: string;
}

export type PurchaseTransactionStatus = 'pending' | 'confirmed' | 'failed' | 'refunded';

export interface PurchaseTransaction {
  transactionId: string;         // Auto-generated document ID
  funderId: string;              // FK to User.userId (role=funder)
  quantity: number;              // Metric tons purchased (2 decimal places)
  unitPriceCents: number;        // Price per ton at time of purchase
  totalAmountCents: number;      // Total in ZAR integer cents
  currency: string;              // ISO 4217, always "ZAR"
  status: PurchaseTransactionStatus;
  packageId?: string;            // FK to CreditPackage (if package purchase)
  projectAllocations: ProjectAllocation[];  // Which projects supply the credits
  certificateId?: string;        // FK to Certificate (set after generation)
  createdAt: string;
  updatedAt: string;
}

export interface ProjectAllocation {
  projectId: string;
  projectTitle: string;          // Denormalized
  tonnage: number;               // Tons allocated from this project
}

export interface Certificate {
  certificateId: string;         // Unique alphanumeric ID (≥12 chars)
  transactionId: string;         // FK to PurchaseTransaction
  funderId: string;              // FK to User.userId
  funderOrganisationName: string;// Denormalized from User
  tonnageOffset: number;         // Total tons on this certificate
  projectTitle: string;          // Primary project title
  projectLocation: string;       // Primary project location
  storagePath: string;           // Cloud Storage path: certificates/{funderId}/{transactionId}.pdf
  generatedAt: string;           // ISO 8601 timestamp
}

// ─── Carbon Credit Request Types ─────────────────────────────────────────────

export type CreditPurchaseRequest = {
  quantity: number;
  projectAllocations: { projectId: string; tonnage: number }[];
  packageId?: string;
};

export type CreditPackageInput = {
  name: string;
  tier: CreditPackageTier;
  tonnage: number;
  priceCents: number;
  isActive: boolean;
  sortOrder: number;
};
