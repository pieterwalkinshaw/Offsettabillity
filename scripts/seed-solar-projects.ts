/**
 * Seed Script: Solar Carbon Credit Projects
 *
 * Creates two verified projects on the Offsettabillity platform:
 * 1. "SunRise Credits" — Residential solar installations with carbon credit returns
 * 2. "Solar Schools" — Community solar powering education infrastructure
 *
 * Usage:
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 npx tsx scripts/seed-solar-projects.ts
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({
  projectId: process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'demo-offsettabillity',
});

const db = getFirestore(app);

// ═══════════════════════════════════════════════════════════════════════════════
// PROJECT 1: SunRise Credits — Residential Solar with Carbon Credit Returns
// ═══════════════════════════════════════════════════════════════════════════════

const SUNRISE_ID = 'sunrise-credits-solar-families';

const sunriseProject = {
  projectId: SUNRISE_ID,
  title: 'SunRise Credits: Solar Power for African Families, Carbon Returns for You',
  description: `**The Problem: A Power Poverty Trap**

Across sub-Saharan Africa, 600 million people live without reliable electricity. When the grid fails — often for 8+ hours daily — families are forced into a devastating cycle: spend a third of their income on dirty diesel generators and toxic kerosene lamps, or sit in darkness.

Meet Sipho's family in Limpopo. They spend R1,200 every month on diesel just to keep their fridge running and lights on during load-shedding. The generator fumes give his youngest daughter asthma. His children do homework by candlelight. The money that could go to school fees disappears into a fuel tank.

**The Solution: Solar + Smart Monitoring + Carbon Credits**

SunRise Credits installs complete solar-plus-battery systems on family homes in communities with unreliable grid infrastructure. But here's what makes this different from charity:

**Every system generates verified carbon credits.**

Each kilowatt-hour of solar energy produced displaces a kilowatt-hour that would have come from South Africa's coal-heavy grid (emission factor: 0.9 tCO₂/MWh). Smart inverters transmit real-time generation data to our central registry, providing transparent, IoT-verified proof of every credit generated.

**How Your Investment Works:**

1. **You fund the installation** — R45,000 covers a complete 3kW solar + 5kWh battery system for one family
2. **The family gets free, clean power** — 99% uptime vs. 60-80% grid reliability
3. **Carbon credits are generated** — Each system avoids approximately 5.5 tons of CO₂ per year
4. **Credits are verified** — Gold Standard methodology, IoT smart meter verification
5. **Returns flow back** — Carbon credit revenue funds maintenance and expands to new families

**The Numbers That Matter:**

• R45,000 per family installation (3kW solar + 5kWh lithium battery + smart inverter)
• 5.5 tons CO₂ avoided per family per year
• R1,200/month saved on diesel/kerosene per family
• 25% increase in children's evening study time
• Zero indoor toxic emissions (eliminating PM2.5, NOx, CO exposure)
• 4% property value increase per home
• 99.9% power uptime vs. 60-80% grid reliability

**Sponsorship Options:**

• R45,000 — Power one family (full installation)
• R225,000 — Power a street (5 families)
• R450,000 — Power a community block (10 families)
• R2,250,000 — Power an entire village (50 families)

**Or contribute partially:**
• R5,000 — Subsidize one family's battery storage (the most expensive component)
• R15,000 — Cover the solar panels for one family
• R10,000 — Fund the smart inverter and IoT monitoring for one family

Partial contributions reduce the family's monthly repayment from R850/month to as low as R200/month over 5 years — making solar affordable for even the poorest households.

**Verification & Compliance:**

• ISO 14064-2 / GHG Protocol compliant
• Gold Standard or Verra (VCS) certified credits
• CDM Small-Scale Methodology (AMS-I.L.) for electrification
• IoT-enabled smart meters as "Single Source of Truth"
• Real-time generation data transmitted via cellular networks
• Third-party audited central ledger

**B-BBEE Qualification:**
Enterprise Development (funding solar micro-enterprises), Socio-Economic Development, and Environmental Sustainability under the B-BBEE Codes. Section 12L tax incentive eligible for energy efficiency investments.

**The Carbon Equation:**
ER = (Gen_solar × EF_grid) + (Fuel_saved × EF_fuel)

Where every MWh of solar in South Africa avoids 0.9 tons of CO₂ — verified, permanent, and additional.

*"Before solar, my children did their homework by candlelight, and we spent a third of our income just to keep the generator running. Now, our home is always bright, and the money we save has allowed us to expand our small grocery shop."* — Community Member, 2025`,

  category: 'renewable-energy',
  subCategory: 'Residential Solar & Carbon Credits',
  ownerId: 'owner-sunrise-credits',
  location: {
    lat: -23.9,
    lng: 29.4,
    address: 'Limpopo, Mpumalanga & Eastern Cape, South Africa',
    country: 'ZA',
  },
  fundingGoal: 22500000, // R225,000 (5 families as initial goal) in cents
  fundingRaised: 9000000, // R90,000 raised (2 families fully funded)
  impactMetrics: {
    reportingPeriod: 'Annually' as const,
    primaryMetric: {
      label: 'kWh Saved / CO₂e Avoided',
      value: 11, // 11 tons CO₂ avoided (2 families × 5.5 tons)
    },
  },
  verificationScore: 92,
  verificationStatus: 'verified' as const,
  verificationBadge: 'Verified+' as const,
  riskLevel: 'low' as const,
  espQualification: {
    qualifies: true,
    category: 'Enterprise Development & Socio-Economic Development',
    evidence: 'ISO 14064-2 compliant, Gold Standard methodology, IoT-verified generation data, Section 12L eligible',
  },
  sdgAlignment: ['7', '13', '3', '4'], // Affordable Energy, Climate Action, Health, Education
  documents: [
    'projects/sunrise-credits-solar-families/documents/gold-standard-methodology.pdf',
    'projects/sunrise-credits-solar-families/documents/iot-verification-report.pdf',
    'projects/sunrise-credits-solar-families/documents/iso14064-compliance.pdf',
    'projects/sunrise-credits-solar-families/documents/community-impact-assessment.pdf',
    'projects/sunrise-credits-solar-families/documents/bbee-qualification.pdf',
  ],
  auditHistory: ['audit-sunrise-001', 'audit-sunrise-002'],
  isFeatured: true,
  createdAt: '2024-04-01T08:00:00Z',
  updatedAt: '2025-04-15T10:00:00Z',
};

// ═══════════════════════════════════════════════════════════════════════════════
// PROJECT 2: Solar Schools — Community Solar Powering Education
// ═══════════════════════════════════════════════════════════════════════════════

const SCHOOLS_ID = 'solar-schools-community-education';

const solarSchoolsProject = {
  projectId: SCHOOLS_ID,
  title: 'Solar Schools: Powering Education in Off-Grid Communities',
  description: `**When the Power Goes Out, Learning Stops**

In rural South Africa, 4,200 schools have unreliable or no electricity. When load-shedding hits — sometimes 8 hours a day — computer labs go dark, projectors die, and the digital divide widens. Teachers revert to chalk and talk. Students who should be learning coding are learning by candlelight.

But it doesn't have to be this way.

**Solar Schools: Energy Independence for Education**

We install commercial-grade solar systems on rural schools, providing:

• **Uninterrupted computer labs** — 20-seat labs powered entirely by solar, operational even during Stage 6 load-shedding
• **Connectivity** — Solar-powered WiFi hotspots providing internet access to students and the surrounding community
• **Community charging stations** — After school hours, community members can charge phones and devices, creating a hub of digital inclusion
• **Carbon credits** — Each school system generates 15-25 tons of CO₂ avoidance per year

**What Your Sponsorship Provides:**

**Full School Package (R350,000):**
• 10kW solar array + 20kWh battery storage
• 20 refurbished laptops with educational software
• Solar-powered WiFi router with 50GB monthly data
• Smart monitoring system (IoT-verified carbon credits)
• 3-year maintenance and support contract
• Teacher training on digital literacy tools

**Partial Sponsorship Options:**
• R150,000 — Solar installation only (panels + battery + inverter)
• R80,000 — Computer lab setup (20 laptops + networking)
• R50,000 — Connectivity package (WiFi + 2 years data)
• R35,000 — Community charging station (10 ports + solar)
• R25,000 — Smart monitoring + carbon credit registration

**The Ripple Effect:**

Each Solar School doesn't just power one building — it transforms an entire community:

• 500+ students gain reliable access to digital learning
• 200+ community members access charging and WiFi daily
• 15-25 tons CO₂ avoided annually (verified carbon credits)
• R180,000/year saved on diesel generator costs
• 3 local jobs created (maintenance, lab management, community liaison)

**Carbon Credit Generation:**

Each school's 10kW system generates approximately 14,600 kWh annually. Using South Africa's grid emission factor (0.9 tCO₂/MWh), this displaces approximately 13 tons of CO₂ per year from the grid alone. Adding diesel generator displacement brings the total to 15-25 tons annually.

These credits are:
• Verified via IoT smart meters (real-time cellular data transmission)
• Registered under Gold Standard or Verra (VCS)
• Sold on the voluntary carbon market
• Revenue reinvested into system maintenance and expansion

**Impact Data (Pilot Schools):**
• 8 schools installed in 2024-2025 pilot
• 4,200 students now have reliable computer access
• 32% improvement in digital literacy scores
• 156 tons CO₂ avoided in first year
• Zero unplanned power outages since installation
• 1,600 community members using charging stations weekly

**B-BBEE Qualification:**
Skills Development (Priority Element), Enterprise Development, and Socio-Economic Development. Qualifies under both the Generic and QSE Scorecards.

*"The day the solar panels went up, everything changed. Our computer lab works every day now — not just when Eskom decides. My students are learning Python while other schools are still waiting for the lights to come back on."* — Principal Mabaso, Nkandla Combined School`,

  category: 'renewable-energy',
  subCategory: 'Community Solar & Digital Education',
  ownerId: 'owner-solar-schools',
  location: {
    lat: -28.7,
    lng: 30.8,
    address: 'KwaZulu-Natal, Limpopo & Eastern Cape, South Africa',
    country: 'ZA',
  },
  fundingGoal: 35000000, // R350,000 (1 full school) in cents
  fundingRaised: 15000000, // R150,000 raised (solar installation funded)
  impactMetrics: {
    reportingPeriod: 'Annually' as const,
    primaryMetric: {
      label: 'kWh Saved / CO₂e Avoided',
      value: 156, // 156 tons CO₂ avoided across pilot schools
    },
  },
  verificationScore: 85,
  verificationStatus: 'verified' as const,
  verificationBadge: 'Verified' as const,
  riskLevel: 'low' as const,
  espQualification: {
    qualifies: true,
    category: 'Skills Development & Socio-Economic Development',
    evidence: 'Gold Standard verified, IoT monitoring, B-BBEE Skills Development Priority Element, Section 12L eligible',
  },
  sdgAlignment: ['7', '4', '9', '13'], // Affordable Energy, Education, Infrastructure, Climate Action
  documents: [
    'projects/solar-schools-community-education/documents/pilot-impact-report.pdf',
    'projects/solar-schools-community-education/documents/carbon-verification.pdf',
    'projects/solar-schools-community-education/documents/school-partnership-mous.pdf',
    'projects/solar-schools-community-education/documents/digital-literacy-outcomes.pdf',
  ],
  auditHistory: ['audit-schools-001'],
  isFeatured: true,
  createdAt: '2024-08-01T08:00:00Z',
  updatedAt: '2025-05-01T10:00:00Z',
};

// ─── Audit Records ───────────────────────────────────────────────────────────

const audits = [
  {
    auditId: 'audit-sunrise-001',
    projectId: SUNRISE_ID,
    auditorId: 'auditor-energy-specialist',
    status: 'completed' as const,
    findings: 'IoT smart meter data verified against Gold Standard methodology. 2 family installations confirmed operational with 99.2% uptime over 6-month monitoring period. Carbon credit calculations align with CDM AMS-I.L. methodology. Grid emission factor correctly applied (0.9 tCO₂/MWh). Diesel displacement verified via household fuel purchase records (pre/post comparison). Financial additionality demonstrated — families could not afford installations without subsidy.',
    scoreContribution: 94,
    methodology: 'Comprehensive MRV audit including: remote IoT data verification (6 months generation logs), on-site inspection of 2 installations, household interviews, fuel purchase record analysis, grid emission factor validation against Eskom published data, financial additionality assessment via household income analysis.',
    recommendation: 'approve' as const,
    createdAt: '2024-10-01T09:00:00Z',
    completedAt: '2024-10-20T16:00:00Z',
  },
  {
    auditId: 'audit-sunrise-002',
    projectId: SUNRISE_ID,
    auditorId: 'auditor-carbon-verifier',
    status: 'completed' as const,
    findings: 'Second verification confirms sustained performance. Smart meter data shows consistent generation across seasonal variations. Carbon credit issuance of 11 tCO₂e verified for 2-family cohort. Community health survey shows elimination of indoor kerosene use. Economic impact confirmed: average R1,150/month fuel savings per household. Recommend scaling to 50-family deployment.',
    scoreContribution: 90,
    methodology: 'Annual verification audit: 12-month IoT data analysis, community health survey (n=8 household members), economic impact assessment, carbon credit registry cross-reference, system degradation analysis, maintenance log review.',
    recommendation: 'approve' as const,
    createdAt: '2025-03-01T09:00:00Z',
    completedAt: '2025-03-18T14:00:00Z',
  },
  {
    auditId: 'audit-schools-001',
    projectId: SCHOOLS_ID,
    auditorId: 'auditor-education-impact',
    status: 'completed' as const,
    findings: 'Pilot school installations verified across 8 sites. Solar generation data confirmed via IoT monitoring — average 14,200 kWh/year per school. Computer labs operational during all load-shedding events (verified via school attendance and lab usage logs). Digital literacy assessment shows 32% improvement in standardized scores. Carbon credit calculation verified: 156 tCO₂e avoided across pilot. Community charging station usage data confirms 1,600+ weekly users. 3 maintenance jobs created per school confirmed via employment records.',
    scoreContribution: 85,
    methodology: 'Multi-site verification: IoT data audit across 8 schools, on-site visits to 3 schools, teacher interviews (n=12), student digital literacy pre/post assessment review, community usage surveys, employment verification, carbon credit methodology review against Gold Standard requirements.',
    recommendation: 'approve' as const,
    createdAt: '2025-01-15T09:00:00Z',
    completedAt: '2025-02-05T14:00:00Z',
  },
];

// ─── Project Owners ──────────────────────────────────────────────────────────

const owners = [
  {
    userId: 'owner-sunrise-credits',
    email: 'info@sunrisecredits.co.za',
    name: 'Thabo Mokoena',
    role: 'owner' as const,
    organizationName: 'SunRise Energy Solutions NPC',
    organizationType: 'npo',
    organizationRegNumber: 'NPO-2023-089234',
    country: 'ZA',
    isApproved: true,
    createdAt: '2024-03-01T08:00:00Z',
    updatedAt: '2024-03-01T08:00:00Z',
  },
  {
    userId: 'owner-solar-schools',
    email: 'projects@solarschools.org.za',
    name: 'Lindiwe Dlamini',
    role: 'owner' as const,
    organizationName: 'Solar Schools Foundation',
    organizationType: 'npo',
    organizationRegNumber: 'NPO-2024-012567',
    country: 'ZA',
    isApproved: true,
    createdAt: '2024-07-01T08:00:00Z',
    updatedAt: '2024-07-01T08:00:00Z',
  },
];

// ─── Seed Function ───────────────────────────────────────────────────────────

async function seedSolarProjects(): Promise<void> {
  console.log('☀️  Seeding Solar Carbon Credit Projects...\n');

  if (process.env.FIRESTORE_EMULATOR_HOST) {
    console.log(`  Using Firestore emulator at ${process.env.FIRESTORE_EMULATOR_HOST}\n`);
  }

  // Create owners
  for (const owner of owners) {
    console.log(`  Creating owner: ${owner.name} (${owner.organizationName})...`);
    await db.collection('users').doc(owner.userId).set(owner, { merge: true });
  }

  // Create projects
  console.log(`\n  Creating project: SunRise Credits...`);
  await db.collection('projects').doc(SUNRISE_ID).set(sunriseProject, { merge: true });

  console.log(`  Creating project: Solar Schools...`);
  await db.collection('projects').doc(SCHOOLS_ID).set(solarSchoolsProject, { merge: true });

  // Create audits
  for (const audit of audits) {
    console.log(`  Creating audit: ${audit.auditId}...`);
    await db.collection('audits').doc(audit.auditId).set(audit, { merge: true });
  }

  console.log('\n✅ Solar Projects seeded successfully!\n');

  console.log('  ─── Project 1: SunRise Credits ───');
  console.log(`  Title: ${sunriseProject.title}`);
  console.log(`  Status: ${sunriseProject.verificationStatus} (${sunriseProject.verificationBadge})`);
  console.log(`  Score: ${sunriseProject.verificationScore}/100`);
  console.log(`  Funding: R${(sunriseProject.fundingRaised / 100).toLocaleString()} / R${(sunriseProject.fundingGoal / 100).toLocaleString()}`);
  console.log(`  CO₂ Avoided: ${sunriseProject.impactMetrics.primaryMetric.value} tons`);
  console.log(`  SDGs: ${sunriseProject.sdgAlignment.join(', ')}`);
  console.log(`  View: /projects/${SUNRISE_ID}\n`);

  console.log('  ─── Project 2: Solar Schools ───');
  console.log(`  Title: ${solarSchoolsProject.title}`);
  console.log(`  Status: ${solarSchoolsProject.verificationStatus} (${solarSchoolsProject.verificationBadge})`);
  console.log(`  Score: ${solarSchoolsProject.verificationScore}/100`);
  console.log(`  Funding: R${(solarSchoolsProject.fundingRaised / 100).toLocaleString()} / R${(solarSchoolsProject.fundingGoal / 100).toLocaleString()}`);
  console.log(`  CO₂ Avoided: ${solarSchoolsProject.impactMetrics.primaryMetric.value} tons`);
  console.log(`  SDGs: ${solarSchoolsProject.sdgAlignment.join(', ')}`);
  console.log(`  View: /projects/${SCHOOLS_ID}`);
}

seedSolarProjects().catch((error) => {
  console.error('Failed to seed solar projects:', error);
  process.exit(1);
});
