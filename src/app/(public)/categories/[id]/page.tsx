import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { CategoryLandingContent } from './CategoryLandingContent';

/**
 * Static taxonomy data for all 12 initial categories.
 * Used for generateStaticParams and static page generation.
 * This avoids a Firestore call at build time while keeping pages fully static.
 */
const CATEGORIES = [
  {
    id: 'energy-saving',
    name: 'Energy Saving & Efficiency',
    primaryMetricLabel: 'kWh Saved / CO₂e Avoided',
    sdgNumbers: [7, 13],
    icon: 'zap',
    sortOrder: 0,
    isActive: true,
    valueProposition:
      'Invest in verified energy efficiency projects that reduce carbon emissions and deliver measurable cost savings.',
  },
  {
    id: 'renewable-energy',
    name: 'Renewable Energy',
    primaryMetricLabel: 'MWh Generated',
    sdgNumbers: [7, 13],
    icon: 'sun',
    sortOrder: 1,
    isActive: true,
    valueProposition:
      'Fund independently verified renewable energy projects generating clean power across Southern Africa.',
  },
  {
    id: 'carbon-removal',
    name: 'Carbon Removal & Sequestration',
    primaryMetricLabel: 'Tons CO₂e Removed',
    sdgNumbers: [13, 15],
    icon: 'leaf',
    sortOrder: 2,
    isActive: true,
    valueProposition:
      'Support verified carbon removal projects with transparent audit trails and measurable sequestration outcomes.',
  },
  {
    id: 'education',
    name: 'Education & Skills Development',
    primaryMetricLabel: 'People Trained / Employed',
    sdgNumbers: [4, 8],
    icon: 'graduation-cap',
    sortOrder: 3,
    isActive: true,
    valueProposition:
      'Fund verified education and skills development projects that create employment and build capacity.',
  },
  {
    id: 'health',
    name: 'Healthcare & Wellness',
    primaryMetricLabel: 'Lives Impacted',
    sdgNumbers: [3],
    icon: 'heart-pulse',
    sortOrder: 4,
    isActive: true,
    valueProposition:
      'Invest in verified healthcare projects delivering measurable wellness outcomes to underserved communities.',
  },
  {
    id: 'food-security',
    name: 'Food Security & Agriculture',
    primaryMetricLabel: 'Meals Provided / Hectares',
    sdgNumbers: [2],
    icon: 'wheat',
    sortOrder: 5,
    isActive: true,
    valueProposition:
      'Support verified food security and sustainable agriculture projects with audit-ready impact reporting.',
  },
  {
    id: 'clean-water',
    name: 'Clean Water & Sanitation',
    primaryMetricLabel: 'Liters Provided / Communities',
    sdgNumbers: [6],
    icon: 'droplets',
    sortOrder: 6,
    isActive: true,
    valueProposition:
      'Fund verified clean water and sanitation projects providing safe water access to communities in need.',
  },
  {
    id: 'waste-management',
    name: 'Waste Management & Recycling',
    primaryMetricLabel: 'Tons Diverted from Landfill',
    sdgNumbers: [12],
    icon: 'recycle',
    sortOrder: 7,
    isActive: true,
    valueProposition:
      'Invest in verified waste management projects diverting materials from landfill with transparent metrics.',
  },
  {
    id: 'biodiversity',
    name: 'Biodiversity & Conservation',
    primaryMetricLabel: 'Hectares Protected',
    sdgNumbers: [14, 15],
    icon: 'trees',
    sortOrder: 8,
    isActive: true,
    valueProposition:
      'Support verified biodiversity and conservation projects protecting ecosystems and natural habitats.',
  },
  {
    id: 'housing',
    name: 'Affordable Housing',
    primaryMetricLabel: 'Units Built / Families Housed',
    sdgNumbers: [11],
    icon: 'home',
    sortOrder: 9,
    isActive: true,
    valueProposition:
      'Fund verified affordable housing projects creating safe, dignified homes for families in need.',
  },
  {
    id: 'digital-inclusion',
    name: 'Digital Inclusion & Connectivity',
    primaryMetricLabel: 'People Connected',
    sdgNumbers: [9],
    icon: 'wifi',
    sortOrder: 10,
    isActive: true,
    valueProposition:
      'Invest in verified digital inclusion projects bridging the connectivity gap in underserved areas.',
  },
  {
    id: 'gender-equality',
    name: 'Gender Equality & Empowerment',
    primaryMetricLabel: 'Women/Girls Impacted',
    sdgNumbers: [5],
    icon: 'users',
    sortOrder: 11,
    isActive: true,
    valueProposition:
      'Support verified gender equality projects empowering women and girls through measurable interventions.',
  },
] as const;

type CategoryData = (typeof CATEGORIES)[number];

/**
 * Pre-generate pages for all 12 active categories at build time.
 * Combined with dynamicParams = false, any non-matching ID returns 404.
 */
export function generateStaticParams() {
  return CATEGORIES.filter((c) => c.isActive).map((c) => ({ id: c.id }));
}

/** Prevent rendering for category IDs not in generateStaticParams — returns 404 */
export const dynamicParams = false;

/**
 * Generate metadata per category for SEO and Google Ads Quality Score.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const category = CATEGORIES.find((c) => c.id === id);

  if (!category) {
    return { title: 'Category Not Found | Offsettabillity' };
  }

  return {
    title: `Verified ${category.name} Projects | Offsettabillity`,
    description: category.valueProposition,
    openGraph: {
      title: `Verified ${category.name} Projects | Offsettabillity`,
      description: category.valueProposition,
    },
  };
}

/**
 * Category Landing Page — Statically generated for Google Ads traffic.
 *
 * Structure (per UX-Patterns steering):
 * 1. Headline matching category name
 * 2. Value proposition
 * 3. Trust signals (badges, stats)
 * 4. Primary CTA (lead form)
 * 5. Featured projects (3–6, loaded client-side)
 * 6. Secondary CTA (consultation)
 *
 * The page shell is fully static (LCP < 2.5s).
 * Projects are fetched client-side from Firestore.
 */
export default async function CategoryLandingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const category = CATEGORIES.find((c) => c.id === id);

  if (!category || !category.isActive) {
    notFound();
  }

  return <CategoryLandingContent category={category} />;
}
