/**
 * Seed Script: Career Guidance Project
 *
 * Creates a compelling, verified project on the Offsettabillity platform:
 * "Pathways to Purpose" — Psychometric Career Guidance for Rural Youth
 *
 * This project enables funders to sponsor psychometric assessments for
 * children in remote rural communities, informing their subject choices
 * and career guidance.
 *
 * Usage:
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 npx tsx scripts/seed-career-guidance-project.ts
 *
 * Or against production (with credentials):
 *   npx tsx scripts/seed-career-guidance-project.ts
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({
  projectId: process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'demo-offsettabillity',
});

const db = getFirestore(app);

// ─── Project Data ────────────────────────────────────────────────────────────

const PROJECT_ID = 'pathways-to-purpose-career-guidance';

const project = {
  projectId: PROJECT_ID,
  title: 'Pathways to Purpose: Psychometric Career Guidance for Rural Youth',
  description: `In the rolling hills of the Eastern Cape, Limpopo, and KwaZulu-Natal, thousands of Grade 9 learners face a decision that will shape the rest of their lives — choosing their school subjects for Grade 10. For most, this choice is made blind. No career counsellor. No psychometric assessment. No understanding of their own aptitudes, interests, or the careers that match them.

Meet Thandi. She's 15, lives in a village outside Mthatha, and dreams of "something better." Her school has 1,200 learners and zero career guidance professionals. When subject selection day arrives, she picks what her friends pick. Three years later, she discovers she's locked out of the university programme she actually wanted.

Thandi's story repeats 500,000 times every year across South Africa's rural schools.

**Pathways to Purpose** changes this. We deploy mobile psychometric assessment teams to remote schools, equipped with tablet-based assessment tools validated for the South African context. Each child receives:

• A comprehensive psychometric assessment (aptitude, interest, personality, and learning style)
• A personalised career guidance report linking their profile to viable career paths
• A one-on-one feedback session with a registered psychometrist
• A subject choice recommendation aligned to their top 3 career matches
• Access to a digital career portal with bursary and learnerships information

**The cost to transform one child's future: R850.**

That's less than a restaurant dinner for two. But for a rural learner, it's the difference between a career chosen by chance and a career chosen by design.

**Our verification promise:**
Every assessment is conducted by a registered psychometrist (HPCSA). Every report is generated from validated instruments (MBTI, DAT, SDS). Every child's outcome is tracked — we measure subject alignment, matric pass rates, and tertiary admission rates for every cohort we serve.

**Impact to date (pilot phase):**
• 2,400 learners assessed across 18 schools
• 89% reported feeling "confident" or "very confident" in their subject choices after assessment
• 94% of assessed learners' subject choices aligned with their psychometric profile
• 12% increase in matric pass rate for assessed cohort vs. control group

**Your sponsorship options:**
• R850 — Sponsor 1 child's full assessment and career guidance session
• R4,250 — Sponsor 5 children (one study group)
• R17,000 — Sponsor an entire classroom of 20 learners
• R85,000 — Sponsor a full school cohort of 100 Grade 9 learners

Every rand is tracked. Every child is named (with consent). Every outcome is reported back to you in your ESG impact report.

**B-BBEE Qualification:**
This project qualifies as Skills Development (Priority Element) and Socio-Economic Development under the B-BBEE Codes of Good Practice. Your contribution is audit-ready from day one.`,

  category: 'education',
  subCategory: 'Career Guidance & Psychometric Assessment',
  ownerId: 'owner-pathways-to-purpose',
  location: {
    lat: -31.5889,
    lng: 28.7844,
    address: 'Eastern Cape, Limpopo & KwaZulu-Natal, South Africa',
    country: 'ZA',
  },
  fundingGoal: 8500000, // R85,000 (100 children) as initial goal — stored in cents
  fundingRaised: 2125000, // R21,250 raised so far (25 children sponsored)
  impactMetrics: {
    reportingPeriod: 'Annually' as const,
    primaryMetric: {
      label: 'People Trained / Employed',
      value: 2400, // Learners assessed to date
    },
  },
  verificationScore: 88,
  verificationStatus: 'verified' as const,
  verificationBadge: 'Verified+' as const,
  riskLevel: 'low' as const,
  espQualification: {
    qualifies: true,
    category: 'Skills Development & Socio-Economic Development',
    evidence: 'HPCSA-registered psychometrists, validated instruments (MBTI, DAT, SDS), B-BBEE Skills Development Priority Element',
  },
  sdgAlignment: ['4', '8', '10'], // Quality Education, Decent Work, Reduced Inequalities
  documents: [
    'projects/pathways-to-purpose-career-guidance/documents/hpcsa-registration.pdf',
    'projects/pathways-to-purpose-career-guidance/documents/pilot-impact-report-2024.pdf',
    'projects/pathways-to-purpose-career-guidance/documents/bbee-qualification-letter.pdf',
    'projects/pathways-to-purpose-career-guidance/documents/psychometric-instrument-validation.pdf',
    'projects/pathways-to-purpose-career-guidance/documents/school-partnership-agreements.pdf',
  ],
  auditHistory: ['audit-pathways-001', 'audit-pathways-002'],
  isFeatured: true,
  createdAt: '2024-06-15T08:00:00Z',
  updatedAt: '2025-03-01T10:30:00Z',
};

// ─── Audit Records ───────────────────────────────────────────────────────────

const audits = [
  {
    auditId: 'audit-pathways-001',
    projectId: PROJECT_ID,
    auditorId: 'auditor-dr-nkosi',
    status: 'completed' as const,
    findings: 'Project documentation is comprehensive and well-organized. HPCSA registrations verified for all 4 psychometrists on the team. Psychometric instruments (MBTI, DAT, SDS) are validated for the South African population. Pilot data from 18 schools demonstrates strong methodology. Impact measurement framework is robust with pre/post assessment tracking and longitudinal cohort monitoring. Financial controls are adequate with per-child cost tracking.',
    scoreContribution: 90,
    methodology: 'Document review of HPCSA registrations, instrument validation certificates, and pilot impact data. Telephonic interviews with 3 school principals from pilot schools. Review of 50 randomly sampled assessment reports for quality and completeness. Verification of B-BBEE qualification documentation against DTIC codes. Site visit to mobile assessment team deployment at Ngqeleni Senior Secondary School.',
    recommendation: 'approve' as const,
    evidenceDocuments: [
      'audits/audit-pathways-001/evidence/hpcsa-verification.pdf',
      'audits/audit-pathways-001/evidence/site-visit-photos.pdf',
    ],
    createdAt: '2024-09-01T09:00:00Z',
    completedAt: '2024-09-15T16:00:00Z',
  },
  {
    auditId: 'audit-pathways-002',
    projectId: PROJECT_ID,
    auditorId: 'auditor-prof-williams',
    status: 'completed' as const,
    findings: 'Second audit confirms sustained quality of delivery. Reviewed 2024 annual impact report showing 2,400 assessments completed. Outcome tracking data shows 89% learner confidence improvement and 12% matric pass rate uplift for assessed cohort. Cost per assessment (R850) is competitive with market rates (R1,200-R2,500 for equivalent urban services). Mobile deployment model is innovative and scalable. Recommend continued funding with expansion to additional provinces.',
    scoreContribution: 86,
    methodology: 'Comprehensive review of 2024 annual impact report. Statistical analysis of outcome data (confidence surveys, subject alignment rates, matric results). Cost-benefit analysis comparing project costs to market alternatives. Interview with project director and lead psychometrist. Review of data privacy and consent procedures for minor participants.',
    recommendation: 'approve' as const,
    evidenceDocuments: [
      'audits/audit-pathways-002/evidence/impact-data-analysis.pdf',
      'audits/audit-pathways-002/evidence/cost-benefit-report.pdf',
    ],
    createdAt: '2025-01-10T09:00:00Z',
    completedAt: '2025-01-28T14:00:00Z',
  },
];

// ─── Project Owner User ──────────────────────────────────────────────────────

const projectOwner = {
  userId: 'owner-pathways-to-purpose',
  email: 'info@pathwaystopurpose.org.za',
  name: 'Dr. Nomvula Khumalo',
  role: 'owner' as const,
  organizationName: 'Pathways to Purpose NPC',
  organizationType: 'npo',
  organizationRegNumber: 'NPO-2023-045891',
  country: 'ZA',
  isApproved: true,
  createdAt: '2024-05-01T08:00:00Z',
  updatedAt: '2024-05-01T08:00:00Z',
};

// ─── Seed Function ───────────────────────────────────────────────────────────

async function seedCareerGuidanceProject(): Promise<void> {
  console.log('🎓 Seeding Career Guidance Project: Pathways to Purpose...\n');

  if (process.env.FIRESTORE_EMULATOR_HOST) {
    console.log(`  Using Firestore emulator at ${process.env.FIRESTORE_EMULATOR_HOST}\n`);
  }

  // 1. Create project owner
  console.log('  Creating project owner: Dr. Nomvula Khumalo...');
  await db.collection('users').doc(projectOwner.userId).set(projectOwner, { merge: true });

  // 2. Create the project
  console.log('  Creating project: Pathways to Purpose...');
  await db.collection('projects').doc(PROJECT_ID).set(project, { merge: true });

  // 3. Create audit records
  for (const audit of audits) {
    console.log(`  Creating audit: ${audit.auditId}...`);
    await db.collection('audits').doc(audit.auditId).set(audit, { merge: true });
  }

  console.log('\n✅ Career Guidance Project seeded successfully!');
  console.log(`\n  Project: ${project.title}`);
  console.log(`  Status: ${project.verificationStatus} (${project.verificationBadge})`);
  console.log(`  Score: ${project.verificationScore}/100`);
  console.log(`  Funding: R${(project.fundingRaised / 100).toLocaleString()} / R${(project.fundingGoal / 100).toLocaleString()}`);
  console.log(`  Impact: ${project.impactMetrics.primaryMetric.value} learners assessed`);
  console.log(`  SDGs: ${project.sdgAlignment.join(', ')}`);
  console.log(`  ESP: ${project.espQualification.category}`);
  console.log(`\n  View at: /projects/${PROJECT_ID}`);
}

seedCareerGuidanceProject().catch((error) => {
  console.error('Failed to seed career guidance project:', error);
  process.exit(1);
});
