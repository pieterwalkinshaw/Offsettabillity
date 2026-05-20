/**
 * ESG Budget Allocation Logic
 *
 * Pure function that takes an industry and budget, and returns a recommended
 * allocation across active ESG project categories.
 *
 * Rules:
 * - Must produce at least 3 categories
 * - Percentages must sum to 100%
 * - Amounts must sum to the input budget
 * - Industry selection weights certain categories higher
 */

export interface AllocationInput {
  industry: string;
  budget: number; // ZAR (not cents)
}

export interface AllocationItem {
  categoryId: string;
  categoryName: string;
  percentage: number;
  amount: number;
}

export interface AllocationResult {
  total: number;
  allocations: AllocationItem[];
}

/** All supported industries for the calculator */
export const INDUSTRIES = [
  'Mining',
  'Finance',
  'Technology',
  'Agriculture',
  'Manufacturing',
  'Energy',
  'Healthcare',
  'Retail',
  'Construction',
  'Transport',
  'Other',
] as const;

export type Industry = (typeof INDUSTRIES)[number];

/** Category definitions matching the taxonomy seed */
interface CategoryDef {
  id: string;
  name: string;
}

const CATEGORIES: CategoryDef[] = [
  { id: 'energy-saving', name: 'Energy Saving & Efficiency' },
  { id: 'renewable-energy', name: 'Renewable Energy' },
  { id: 'carbon-removal', name: 'Carbon Removal & Sequestration' },
  { id: 'education', name: 'Education & Skills Development' },
  { id: 'health', name: 'Healthcare & Wellness' },
  { id: 'food-security', name: 'Food Security & Agriculture' },
  { id: 'clean-water', name: 'Clean Water & Sanitation' },
  { id: 'waste-management', name: 'Waste Management & Recycling' },
  { id: 'biodiversity', name: 'Biodiversity & Conservation' },
  { id: 'housing', name: 'Affordable Housing' },
  { id: 'digital-inclusion', name: 'Digital Inclusion & Connectivity' },
  { id: 'gender-equality', name: 'Gender Equality & Empowerment' },
];

/**
 * Industry-specific weight profiles.
 * Each profile assigns relative weights to categories.
 * Categories with weight 0 are excluded from the allocation.
 * At least 3 categories will always have non-zero weights.
 */
const INDUSTRY_WEIGHTS: Record<string, Record<string, number>> = {
  Mining: {
    'energy-saving': 25,
    'renewable-energy': 20,
    'carbon-removal': 20,
    'clean-water': 15,
    'biodiversity': 10,
    'education': 5,
    'health': 5,
  },
  Finance: {
    'education': 20,
    'digital-inclusion': 20,
    'gender-equality': 15,
    'carbon-removal': 15,
    'energy-saving': 10,
    'renewable-energy': 10,
    'housing': 10,
  },
  Technology: {
    'digital-inclusion': 25,
    'education': 25,
    'energy-saving': 15,
    'renewable-energy': 10,
    'gender-equality': 10,
    'carbon-removal': 10,
    'waste-management': 5,
  },
  Agriculture: {
    'food-security': 25,
    'clean-water': 20,
    'biodiversity': 15,
    'renewable-energy': 15,
    'carbon-removal': 10,
    'education': 10,
    'energy-saving': 5,
  },
  Manufacturing: {
    'energy-saving': 25,
    'waste-management': 20,
    'carbon-removal': 15,
    'renewable-energy': 15,
    'clean-water': 10,
    'education': 10,
    'health': 5,
  },
  Energy: {
    'renewable-energy': 30,
    'energy-saving': 25,
    'carbon-removal': 20,
    'biodiversity': 10,
    'education': 10,
    'clean-water': 5,
  },
  Healthcare: {
    'health': 30,
    'clean-water': 20,
    'education': 15,
    'gender-equality': 10,
    'food-security': 10,
    'digital-inclusion': 10,
    'housing': 5,
  },
  Retail: {
    'waste-management': 20,
    'education': 15,
    'gender-equality': 15,
    'energy-saving': 15,
    'carbon-removal': 10,
    'food-security': 10,
    'digital-inclusion': 10,
    'housing': 5,
  },
  Construction: {
    'housing': 25,
    'energy-saving': 20,
    'waste-management': 15,
    'renewable-energy': 15,
    'carbon-removal': 10,
    'education': 10,
    'clean-water': 5,
  },
  Transport: {
    'energy-saving': 25,
    'carbon-removal': 25,
    'renewable-energy': 20,
    'clean-water': 10,
    'education': 10,
    'biodiversity': 5,
    'waste-management': 5,
  },
  Other: {
    'energy-saving': 15,
    'renewable-energy': 15,
    'carbon-removal': 15,
    'education': 15,
    'health': 10,
    'clean-water': 10,
    'waste-management': 10,
    'gender-equality': 10,
  },
};

/**
 * Allocate a budget across ESG categories based on industry.
 *
 * @param input - The industry and budget to allocate
 * @returns Allocation result with total and category breakdowns
 *
 * Guarantees:
 * - At least 3 categories in the result
 * - Percentages sum to exactly 100
 * - Amounts sum to exactly the input budget
 */
export function allocate(input: AllocationInput): AllocationResult {
  const { industry, budget } = input;

  // Get weights for the industry, fallback to "Other" if unknown
  const weights = INDUSTRY_WEIGHTS[industry] ?? INDUSTRY_WEIGHTS['Other'];

  // Calculate total weight for normalization
  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);

  // Build raw allocations with percentages
  const rawAllocations: { categoryId: string; categoryName: string; rawPercentage: number }[] = [];

  for (const [categoryId, weight] of Object.entries(weights)) {
    if (weight <= 0) continue;
    const category = CATEGORIES.find((c) => c.id === categoryId);
    if (!category) continue;

    rawAllocations.push({
      categoryId,
      categoryName: category.name,
      rawPercentage: (weight / totalWeight) * 100,
    });
  }

  // Sort by percentage descending for consistent output
  rawAllocations.sort((a, b) => b.rawPercentage - a.rawPercentage);

  // Round percentages using largest remainder method to ensure they sum to exactly 100
  const floored = rawAllocations.map((a) => ({
    ...a,
    percentage: Math.floor(a.rawPercentage),
    remainder: a.rawPercentage - Math.floor(a.rawPercentage),
  }));

  let currentSum = floored.reduce((sum, a) => sum + a.percentage, 0);
  const deficit = 100 - currentSum;

  // Distribute the remaining percentage points to items with largest remainders
  const sortedByRemainder = [...floored].sort((a, b) => b.remainder - a.remainder);
  for (let i = 0; i < deficit; i++) {
    sortedByRemainder[i].percentage += 1;
  }

  // Calculate amounts from percentages using largest remainder method
  // to ensure they sum exactly to budget and remain non-negative
  const rawAmounts = floored.map((a) => ({
    ...a,
    rawAmount: (a.percentage / 100) * budget,
  }));

  const allocations: AllocationItem[] = rawAmounts.map((a) => ({
    categoryId: a.categoryId,
    categoryName: a.categoryName,
    percentage: a.percentage,
    amount: Math.floor(a.rawAmount),
  }));

  // Distribute remaining budget units to items with largest fractional parts
  const amountSum = allocations.reduce((sum, a) => sum + a.amount, 0);
  let remaining = budget - amountSum;

  if (remaining > 0) {
    // Sort indices by fractional remainder descending
    const indices = allocations
      .map((_, i) => i)
      .sort((a, b) => {
        const remA = rawAmounts[a].rawAmount - Math.floor(rawAmounts[a].rawAmount);
        const remB = rawAmounts[b].rawAmount - Math.floor(rawAmounts[b].rawAmount);
        return remB - remA;
      });

    for (let i = 0; i < remaining && i < indices.length; i++) {
      allocations[indices[i]].amount += 1;
    }
  }

  return {
    total: budget,
    allocations,
  };
}
