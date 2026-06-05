import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

const CATEGORIES = [
  { id: 'energy-saving', name: 'Energy Saving & Efficiency', icon: '⚡', metric: 'kWh Saved / CO₂e Avoided', sdgs: [7, 13] },
  { id: 'renewable-energy', name: 'Renewable Energy', icon: '☀️', metric: 'MWh Generated', sdgs: [7, 13] },
  { id: 'carbon-removal', name: 'Carbon Removal & Sequestration', icon: '🌿', metric: 'Tons CO₂e Removed', sdgs: [13, 15] },
  { id: 'education', name: 'Education & Skills Development', icon: '🎓', metric: 'People Trained / Employed', sdgs: [4, 8] },
  { id: 'health', name: 'Healthcare & Wellness', icon: '❤️', metric: 'Lives Impacted', sdgs: [3] },
  { id: 'food-security', name: 'Food Security & Agriculture', icon: '🌾', metric: 'Meals Provided / Hectares', sdgs: [2] },
  { id: 'clean-water', name: 'Clean Water & Sanitation', icon: '💧', metric: 'Liters Provided / Communities', sdgs: [6] },
  { id: 'waste-management', name: 'Waste Management & Recycling', icon: '♻️', metric: 'Tons Diverted from Landfill', sdgs: [12] },
  { id: 'biodiversity', name: 'Biodiversity & Conservation', icon: '🌳', metric: 'Hectares Protected', sdgs: [14, 15] },
  { id: 'housing', name: 'Affordable Housing', icon: '🏠', metric: 'Units Built / Families Housed', sdgs: [11] },
  { id: 'digital-inclusion', name: 'Digital Inclusion & Connectivity', icon: '📶', metric: 'People Connected', sdgs: [9] },
  { id: 'gender-equality', name: 'Gender Equality & Empowerment', icon: '👩', metric: 'Women/Girls Impacted', sdgs: [5] },
];

export default function CategoriesPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />

      <section className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
            Impact Categories
          </h1>
          <p className="mt-3 text-lg text-foreground/70 max-w-2xl">
            Browse verified ESG projects by category. Each category is aligned to UN Sustainable Development Goals and qualifies for B-BBEE compliance.
          </p>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.id}
                href={`/categories/${cat.id}`}
                className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-primary-300 transition-all"
              >
                <div className="text-3xl mb-3">{cat.icon}</div>
                <h2 className="text-lg font-semibold text-foreground group-hover:text-primary-700 transition-colors">
                  {cat.name}
                </h2>
                <p className="mt-2 text-sm text-foreground/60">
                  Primary metric: {cat.metric}
                </p>
                <div className="mt-3 flex gap-1.5">
                  {cat.sdgs.map((sdg) => (
                    <span
                      key={sdg}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-xs font-bold"
                    >
                      {sdg}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
