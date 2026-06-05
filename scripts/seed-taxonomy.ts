/**
 * Seed script: Populate Firestore with the 12 initial taxonomy categories.
 *
 * Usage:
 *   npx tsx scripts/seed-taxonomy.ts
 *
 * The script is idempotent — running it multiple times produces the same state.
 * It connects to the Firestore emulator when FIRESTORE_EMULATOR_HOST is set.
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin — uses emulator when FIRESTORE_EMULATOR_HOST is set
const app = initializeApp({
  projectId: process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'demo-Offsettable',
});

const db = getFirestore(app);

interface TaxonomySeed {
  id: string;
  name: string;
  primaryMetricLabel: string;
  sdgNumbers: number[];
  icon: string;
  sortOrder: number;
  isActive: boolean;
}

const categories: TaxonomySeed[] = [
  {
    id: 'energy-saving',
    name: 'Energy Saving & Efficiency',
    primaryMetricLabel: 'kWh Saved / CO₂e Avoided',
    sdgNumbers: [7, 13],
    icon: 'zap',
    sortOrder: 0,
    isActive: true,
  },
  {
    id: 'renewable-energy',
    name: 'Renewable Energy',
    primaryMetricLabel: 'MWh Generated',
    sdgNumbers: [7, 13],
    icon: 'sun',
    sortOrder: 1,
    isActive: true,
  },
  {
    id: 'carbon-removal',
    name: 'Carbon Removal & Sequestration',
    primaryMetricLabel: 'Tons CO₂e Removed',
    sdgNumbers: [13, 15],
    icon: 'leaf',
    sortOrder: 2,
    isActive: true,
  },
  {
    id: 'education',
    name: 'Education & Skills Development',
    primaryMetricLabel: 'People Trained / Employed',
    sdgNumbers: [4, 8],
    icon: 'graduation-cap',
    sortOrder: 3,
    isActive: true,
  },
  {
    id: 'health',
    name: 'Healthcare & Wellness',
    primaryMetricLabel: 'Lives Impacted',
    sdgNumbers: [3],
    icon: 'heart-pulse',
    sortOrder: 4,
    isActive: true,
  },
  {
    id: 'food-security',
    name: 'Food Security & Agriculture',
    primaryMetricLabel: 'Meals Provided / Hectares',
    sdgNumbers: [2],
    icon: 'wheat',
    sortOrder: 5,
    isActive: true,
  },
  {
    id: 'clean-water',
    name: 'Clean Water & Sanitation',
    primaryMetricLabel: 'Liters Provided / Communities',
    sdgNumbers: [6],
    icon: 'droplets',
    sortOrder: 6,
    isActive: true,
  },
  {
    id: 'waste-management',
    name: 'Waste Management & Recycling',
    primaryMetricLabel: 'Tons Diverted from Landfill',
    sdgNumbers: [12],
    icon: 'recycle',
    sortOrder: 7,
    isActive: true,
  },
  {
    id: 'biodiversity',
    name: 'Biodiversity & Conservation',
    primaryMetricLabel: 'Hectares Protected',
    sdgNumbers: [14, 15],
    icon: 'trees',
    sortOrder: 8,
    isActive: true,
  },
  {
    id: 'housing',
    name: 'Affordable Housing',
    primaryMetricLabel: 'Units Built / Families Housed',
    sdgNumbers: [11],
    icon: 'home',
    sortOrder: 9,
    isActive: true,
  },
  {
    id: 'digital-inclusion',
    name: 'Digital Inclusion & Connectivity',
    primaryMetricLabel: 'People Connected',
    sdgNumbers: [9],
    icon: 'wifi',
    sortOrder: 10,
    isActive: true,
  },
  {
    id: 'gender-equality',
    name: 'Gender Equality & Empowerment',
    primaryMetricLabel: 'Women/Girls Impacted',
    sdgNumbers: [5],
    icon: 'users',
    sortOrder: 11,
    isActive: true,
  },
];

async function seedTaxonomy(): Promise<void> {
  console.log('Seeding taxonomy categories...');

  if (process.env.FIRESTORE_EMULATOR_HOST) {
    console.log(`  Using Firestore emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`);
  }

  const batch = db.batch();

  for (const category of categories) {
    const docRef = db.collection('taxonomy').doc(category.id);
    // Use set with merge to make the script idempotent
    batch.set(docRef, category, { merge: true });
  }

  await batch.commit();

  console.log(`Successfully seeded ${categories.length} taxonomy categories:`);
  for (const category of categories) {
    console.log(`  ${category.sortOrder}. ${category.name} (${category.id})`);
  }
}

seedTaxonomy().catch((error) => {
  console.error('Failed to seed taxonomy:', error);
  process.exit(1);
});
