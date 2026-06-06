/**
 * Seed Script: Carbon Credit Marketplace
 *
 * Seeds the Firestore database with carbon credit inventory, packages,
 * sample transactions, and a sample certificate for development/testing.
 *
 * Usage (local emulator — just run it, no env vars needed):
 *   npx tsx scripts/seed-carbon-credits.ts
 *
 * Usage (production — requires gcloud auth):
 *   npx tsx scripts/seed-carbon-credits.ts --prod
 */

// Auto-configure emulator connection unless targeting production
const isProduction = process.argv.includes('--prod');
if (!isProduction) {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';
}

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = isProduction
  ? (process.env.GCLOUD_PROJECT || 'offsettabillity')
  : (process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'demo-offsettable');

const app = initializeApp({ projectId });
const db = getFirestore(app);

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

/** Unit price: R300 per ton (30000 cents) */
const UNIT_PRICE_CENTS = 30000;

// ═══════════════════════════════════════════════════════════════════════════════
// Credit Inventory — linked to existing solar projects
// ═══════════════════════════════════════════════════════════════════════════════

const creditInventory = [
  {
    inventoryId: 'inv-sunrise-credits',
    projectId: 'sunrise-credits-solar-families',
    availableTonnage: 11.00,
    totalTonnage: 11.00,
    unitPriceCents: UNIT_PRICE_CENTS,
    projectTitle: 'SunRise Credits: Solar Power for African Families',
    projectLocation: 'Limpopo, South Africa',
    createdAt: '2025-04-15T10:00:00Z',
    updatedAt: '2025-04-15T10:00:00Z',
  },
  {
    inventoryId: 'inv-solar-schools',
    projectId: 'solar-schools-community-education',
    availableTonnage: 156.00,
    totalTonnage: 156.00,
    unitPriceCents: UNIT_PRICE_CENTS,
    projectTitle: 'Solar Schools: Powering Education in Off-Grid Communities',
    projectLocation: 'KwaZulu-Natal, South Africa',
    createdAt: '2025-05-01T10:00:00Z',
    updatedAt: '2025-05-01T10:00:00Z',
  },
  {
    inventoryId: 'inv-solar-exchange',
    projectId: 'solar-credit-exchange',
    availableTonnage: 340.00,
    totalTonnage: 340.00,
    unitPriceCents: UNIT_PRICE_CENTS,
    projectTitle: 'Solar Credit Exchange: Verified Credits from Existing Installations',
    projectLocation: 'Gauteng, South Africa',
    createdAt: '2025-03-01T10:00:00Z',
    updatedAt: '2025-03-01T10:00:00Z',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Credit Packages — predefined bundles with volume discounts
// ═══════════════════════════════════════════════════════════════════════════════

const creditPackages = [
  {
    packageId: 'pkg-bronze',
    name: 'Bronze Package',
    tier: 'bronze' as const,
    tonnage: 5,
    priceCents: 135000,     // R1,350 (10% discount from 5 × R300 = R1,500)
    discountPercentage: 10,
    isActive: true,
    sortOrder: 1,
    createdAt: '2025-04-01T08:00:00Z',
    updatedAt: '2025-04-01T08:00:00Z',
  },
  {
    packageId: 'pkg-silver',
    name: 'Silver Package',
    tier: 'silver' as const,
    tonnage: 25,
    priceCents: 600000,     // R6,000 (20% discount from 25 × R300 = R7,500)
    discountPercentage: 20,
    isActive: true,
    sortOrder: 2,
    createdAt: '2025-04-01T08:00:00Z',
    updatedAt: '2025-04-01T08:00:00Z',
  },
  {
    packageId: 'pkg-gold',
    name: 'Gold Package',
    tier: 'gold' as const,
    tonnage: 100,
    priceCents: 2100000,    // R21,000 (30% discount from 100 × R300 = R30,000)
    discountPercentage: 30,
    isActive: true,
    sortOrder: 3,
    createdAt: '2025-04-01T08:00:00Z',
    updatedAt: '2025-04-01T08:00:00Z',
  },
  {
    packageId: 'pkg-platinum',
    name: 'Platinum Package',
    tier: 'platinum' as const,
    tonnage: 500,
    priceCents: 9000000,    // R90,000 (40% discount from 500 × R300 = R150,000)
    discountPercentage: 40,
    isActive: false, // Inactive — for testing inactive package filtering
    sortOrder: 4,
    createdAt: '2025-04-01T08:00:00Z',
    updatedAt: '2025-04-01T08:00:00Z',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Sample Funder — for transaction references
// ═══════════════════════════════════════════════════════════════════════════════

const sampleFunder = {
  userId: 'funder-sample-corp',
  email: 'sustainability@greencorp.co.za',
  name: 'James van der Merwe',
  role: 'funder' as const,
  organizationName: 'GreenCorp Holdings (Pty) Ltd',
  organizationType: 'corporate',
  country: 'ZA',
  isApproved: true,
  esgProfile: {
    industry: 'Manufacturing',
    budget: 500000000, // R5,000,000 annual ESG budget in cents
    interests: ['renewable-energy', 'carbon-removal'],
  },
  createdAt: '2024-06-01T08:00:00Z',
  updatedAt: '2024-06-01T08:00:00Z',
};

// ═══════════════════════════════════════════════════════════════════════════════
// Sample Purchase Transactions
// ═══════════════════════════════════════════════════════════════════════════════

const purchaseTransactions = [
  {
    transactionId: 'txn-confirmed-001',
    funderId: 'funder-sample-corp',
    quantity: 5,
    unitPriceCents: UNIT_PRICE_CENTS,
    totalAmountCents: 135000,  // Bronze package price (10% discount)
    currency: 'ZAR',
    status: 'confirmed' as const,
    packageId: 'pkg-bronze',
    projectAllocations: [
      {
        projectId: 'sunrise-credits-solar-families',
        projectTitle: 'SunRise Credits: Solar Power for African Families',
        tonnage: 5,
      },
    ],
    certificateId: 'cert-OT7kM9pL2xR4nQ5w',
    createdAt: '2025-05-10T14:30:00Z',
    updatedAt: '2025-05-10T15:00:00Z',
  },
  {
    transactionId: 'txn-pending-001',
    funderId: 'funder-sample-corp',
    quantity: 25,
    unitPriceCents: UNIT_PRICE_CENTS,
    totalAmountCents: 600000, // Silver package price (20% discount)
    currency: 'ZAR',
    status: 'pending' as const,
    packageId: 'pkg-silver',
    projectAllocations: [
      {
        projectId: 'solar-schools-community-education',
        projectTitle: 'Solar Schools: Powering Education in Off-Grid Communities',
        tonnage: 25,
      },
    ],
    createdAt: '2025-06-01T09:00:00Z',
    updatedAt: '2025-06-01T09:00:00Z',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Solar Credit Exchange — project document (credits-only, no funding needed)
// ═══════════════════════════════════════════════════════════════════════════════

const solarExchangeProject = {
  projectId: 'solar-credit-exchange',
  title: 'Solar Credit Exchange: Verified Credits from Existing Installations',
  description: `**Existing Solar. Verified Credits. Immediate Impact.**

The Solar Credit Exchange aggregates carbon credits generated by existing commercial and industrial solar installations across Gauteng. These are not future promises — these credits represent CO₂e already avoided by operational solar arrays.

**How It Works:**

Solar installation owners register their systems on the Offsettable platform. Smart meter data verifies actual generation in real-time. Credits are minted based on verified displacement of grid electricity (0.9 tCO₂/MWh avoided using Eskom's emission factor).

**Why Buy From the Exchange?**

• **Immediate delivery** — Credits already generated, no waiting for project completion
• **Verified & audited** — Each credit backed by IoT smart meter data from operational systems
• **Local impact** — All installations are in South Africa, supporting the domestic carbon market
• **No project risk** — These systems are already built and generating; no construction or funding risk
• **B-BBEE qualifying** — Counts as Socio-Economic Development and Environmental Sustainability spend

**Current Inventory Sources:**

• 12 commercial rooftop installations (50kW–500kW) across Johannesburg and Pretoria
• 3 industrial ground-mount systems (1MW+) in the East Rand
• Combined installed capacity: 8.2 MW
• Annual verified generation: ~12,000 MWh
• Annual credits generated: ~340 tons CO₂e avoided

**Verification:**

• ISO 14064-2 compliant methodology
• Real-time IoT monitoring via SolarEdge/Huawei FusionSolar APIs
• Monthly automated verification reports
• Annual third-party audit by accredited verifier
• Eskom grid emission factor: 0.9 tCO₂/MWh (updated annually)

**Perfect For:**

• Companies needing immediate offset for current reporting periods
• ESG teams with end-of-year compliance deadlines
• Organisations wanting zero project risk
• Buyers who prefer locally-sourced South African credits`,

  category: 'renewable-energy',
  subCategory: 'Solar Credit Marketplace',
  ownerId: 'owner-solar-exchange',
  location: {
    lat: -26.2,
    lng: 28.0,
    address: 'Gauteng Province, South Africa',
    country: 'ZA',
  },
  fundingGoal: 0, // No funding needed — credits-only project
  fundingRaised: 0,
  impactMetrics: {
    reportingPeriod: 'Annually' as const,
    primaryMetric: {
      label: 'kWh Saved / CO₂e Avoided',
      value: 340, // 340 tons CO₂ avoided annually
    },
  },
  verificationScore: 88,
  verificationStatus: 'verified' as const,
  verificationBadge: 'Verified' as const,
  riskLevel: 'low' as const,
  espQualification: {
    qualifies: true,
    category: 'Socio-Economic Development & Environmental Sustainability',
    evidence: 'ISO 14064-2 compliant, IoT-verified generation data, Eskom grid EF methodology',
  },
  sdgAlignment: ['7', '13', '9'], // Affordable Energy, Climate Action, Industry & Innovation
  documents: [
    'projects/solar-credit-exchange/documents/verification-methodology.pdf',
    'projects/solar-credit-exchange/documents/iot-monitoring-report.pdf',
    'projects/solar-credit-exchange/documents/annual-audit-2025.pdf',
  ],
  auditHistory: [],
  isFeatured: false,
  createdAt: '2025-03-01T10:00:00Z',
  updatedAt: '2025-03-01T10:00:00Z',
};

const solarExchangeOwner = {
  userId: 'owner-solar-exchange',
  email: 'credits@solarexchange.co.za',
  name: 'Naledi Dlamini',
  role: 'owner' as const,
  organizationName: 'Solar Credit Exchange (Pty) Ltd',
  organizationType: 'corporate',
  country: 'ZA',
  isApproved: true,
  createdAt: '2025-02-01T08:00:00Z',
  updatedAt: '2025-02-01T08:00:00Z',
};

// ═══════════════════════════════════════════════════════════════════════════════
// Sample Certificate — for the confirmed transaction
// ═══════════════════════════════════════════════════════════════════════════════

const certificate = {
  certificateId: 'OT7kM9pL2xR4nQ5w',
  transactionId: 'txn-confirmed-001',
  funderId: 'funder-sample-corp',
  funderOrganisationName: 'GreenCorp Holdings (Pty) Ltd',
  tonnageOffset: 5,
  projectTitle: 'SunRise Credits: Solar Power for African Families',
  projectLocation: 'Limpopo, South Africa',
  storagePath: 'certificates/funder-sample-corp/txn-confirmed-001.pdf',
  generatedAt: '2025-05-10T15:00:00Z',
};

// ═══════════════════════════════════════════════════════════════════════════════
// Seed Function
// ═══════════════════════════════════════════════════════════════════════════════

async function seedCarbonCredits(): Promise<void> {
  console.log('🌿 Seeding Carbon Credit Marketplace...\n');

  if (process.env.FIRESTORE_EMULATOR_HOST) {
    console.log(`  Using Firestore emulator at ${process.env.FIRESTORE_EMULATOR_HOST}\n`);
  }

  // Seed sample funder
  console.log(`  Creating sample funder: ${sampleFunder.name} (${sampleFunder.organizationName})...`);
  await db.collection('users').doc(sampleFunder.userId).set(sampleFunder, { merge: true });

  // Seed Solar Credit Exchange owner and project
  console.log(`  Creating exchange owner: ${solarExchangeOwner.name} (${solarExchangeOwner.organizationName})...`);
  await db.collection('users').doc(solarExchangeOwner.userId).set(solarExchangeOwner, { merge: true });

  console.log(`  Creating project: ${solarExchangeProject.title}...`);
  await db.collection('projects').doc(solarExchangeProject.projectId).set(solarExchangeProject, { merge: true });

  // Seed credit inventory
  console.log('\n  ─── Credit Inventory ───');
  for (const inventory of creditInventory) {
    console.log(`  Creating inventory: ${inventory.projectTitle} (${inventory.availableTonnage} tons)...`);
    await db.collection('creditInventory').doc(inventory.inventoryId).set(inventory, { merge: true });
  }

  // Seed credit packages
  console.log('\n  ─── Credit Packages ───');
  for (const pkg of creditPackages) {
    const status = pkg.isActive ? 'active' : 'inactive';
    console.log(`  Creating package: ${pkg.name} (${pkg.tonnage} tons, ${status})...`);
    await db.collection('creditPackages').doc(pkg.packageId).set(pkg, { merge: true });
  }

  // Seed purchase transactions
  console.log('\n  ─── Purchase Transactions ───');
  for (const txn of purchaseTransactions) {
    console.log(`  Creating transaction: ${txn.transactionId} (${txn.quantity} tons, ${txn.status})...`);
    await db.collection('purchaseTransactions').doc(txn.transactionId).set(txn, { merge: true });
  }

  // Seed certificate
  console.log('\n  ─── Certificates ───');
  console.log(`  Creating certificate: ${certificate.certificateId}...`);
  await db.collection('certificates').doc(certificate.certificateId).set(certificate, { merge: true });

  // Summary
  console.log('\n✅ Carbon Credit Marketplace seeded successfully!\n');

  console.log('  ─── Summary ───');
  console.log(`  Credit Inventory: ${creditInventory.length} records`);
  console.log(`    • SunRise Credits: ${creditInventory[0].availableTonnage} tons @ R${UNIT_PRICE_CENTS / 100}/ton`);
  console.log(`    • Solar Schools: ${creditInventory[1].availableTonnage} tons @ R${UNIT_PRICE_CENTS / 100}/ton`);
  console.log(`  Credit Packages: ${creditPackages.length} (${creditPackages.filter(p => p.isActive).length} active, ${creditPackages.filter(p => !p.isActive).length} inactive)`);
  console.log(`  Transactions: ${purchaseTransactions.length} (1 confirmed, 1 pending)`);
  console.log(`  Certificates: 1`);
  console.log(`  Sample Funder: ${sampleFunder.organizationName}`);
  console.log(`\n  Total available tonnage: ${creditInventory.reduce((sum, inv) => sum + inv.availableTonnage, 0)} tons`);
  console.log(`  Unit price: R${UNIT_PRICE_CENTS / 100}/ton (${UNIT_PRICE_CENTS} cents)`);
}

seedCarbonCredits().catch((error) => {
  console.error('Failed to seed carbon credits:', error);
  process.exit(1);
});
