import type { TaxonomyCategory } from '@/types';

const LOCAL_STORAGE_KEY = 'offsettable_taxonomy';

const DEFAULT_TAXONOMY: TaxonomyCategory[] = [
  { id: 'cat-carbon', name: 'Carbon Removal', primaryMetricLabel: 'Total CO2e Removed (t)' },
  { id: 'cat-water', name: 'Clean Water', primaryMetricLabel: '% Water Quality Improvements' },
  { id: 'cat-education', name: 'Education', primaryMetricLabel: 'Number of Employable People' },
  { id: 'cat-waste', name: 'Waste Management', primaryMetricLabel: 'Waste Diversion Rate (%)', requiresWasteBreakdown: true },
  { id: 'cat-energy', name: 'Renewable Energy', primaryMetricLabel: 'Total Energy Generated (MWh)' },
  { id: 'cat-food', name: 'Food Security', primaryMetricLabel: 'Number of Meals Provided' },
];

export async function getTaxonomy(): Promise<TaxonomyCategory[]> {
  if (typeof window === 'undefined') return DEFAULT_TAXONOMY;
  
  const data = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!data) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_TAXONOMY));
    return DEFAULT_TAXONOMY;
  }
  return JSON.parse(data);
}

export async function saveTaxonomy(categories: TaxonomyCategory[]): Promise<void> {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(categories));
  }
}
