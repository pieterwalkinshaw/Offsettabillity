export type Role = 'funder' | 'owner' | 'auditor' | 'admin';

export interface User {
  userId: string;
  name: string;
  email: string;
  role: Role;
  organizationName?: string;
  organizationType?: string;
  ESGProfile?: {
    industry: string;
    budget: number;
    interests: string[];
  };
  createdAt: string; // ISO date string
}

export type ProjectRiskLevel = 'low' | 'medium' | 'high';
export type ProjectStatus = 'draft' | 'submitted' | 'prescreened' | 'pending_audit' | 'verified' | 'live' | 'funded';
export type VerificationBadge = 'Verified' | 'Verified+' | 'Premium Assured' | 'None';

export interface ImpactMetrics {
  reportingPeriod: string; // e.g. Monthly, Annually, Project Duration
  primaryMetric: {
    label: string;
    value: number | string;
  };
  // Optional specific breakdown for Waste Management
  wasteBreakdown?: {
    recycled: number;
    reused: number;
    composted: number;
    landfill: number;
  };
}

export interface Project {
  projectId: string;
  title: string;
  description: string;
  category: string;
  subCategory: string;
  ownerId: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  fundingGoal: number;
  fundingRaised: number;
  impactMetrics: ImpactMetrics;
  verificationScore: number;
  verificationStatus: ProjectStatus;
  verificationBadge: VerificationBadge;
  riskLevel: ProjectRiskLevel;
  status: ProjectStatus;
  auditHistory: string[]; // Array of Audit IDs
  createdAt: string; // ISO date string
}

export interface TaxonomyCategory {
  id: string;
  name: string;
  primaryMetricLabel: string;
  requiresWasteBreakdown?: boolean;
}

export type AuditStatus = 'pending' | 'in_progress' | 'completed';

export interface Audit {
  auditId: string;
  projectId: string;
  auditorId: string;
  status: AuditStatus;
  findings: string;
  scoreContribution: number;
  documents: string[]; // Array of file URLs
  createdAt: string;
  completedAt?: string;
}

export type LeadType = 'report_request' | 'consultation' | 'portfolio_builder';
export type LeadStatus = 'new' | 'contacted' | 'converted';

export interface Lead {
  leadId: string;
  userId?: string;
  type: LeadType;
  projectId?: string;
  message?: string;
  email: string;
  company?: string;
  status: LeadStatus;
  createdAt: string;
}

export type ReportAccessLevel = 'public' | 'gated' | 'private';

export interface Report {
  reportId: string;
  projectId: string;
  fileUrl: string;
  accessLevel: ReportAccessLevel;
  createdAt: string;
}
