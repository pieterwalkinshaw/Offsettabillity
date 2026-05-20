import { describe, it, expect } from 'vitest';
import { allocate, INDUSTRIES } from '@/lib/calculator/allocate';

describe('allocate', () => {
  it('returns at least 3 categories for any industry', () => {
    for (const industry of INDUSTRIES) {
      const result = allocate({ industry, budget: 100000 });
      expect(result.allocations.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('returns percentages that sum to exactly 100', () => {
    const result = allocate({ industry: 'Mining', budget: 500000 });
    const percentageSum = result.allocations.reduce((sum, a) => sum + a.percentage, 0);
    expect(percentageSum).toBe(100);
  });

  it('returns amounts that sum to exactly the input budget', () => {
    const budget = 1234567;
    const result = allocate({ industry: 'Technology', budget });
    const amountSum = result.allocations.reduce((sum, a) => sum + a.amount, 0);
    expect(amountSum).toBe(budget);
  });

  it('sets total equal to the input budget', () => {
    const budget = 999999;
    const result = allocate({ industry: 'Finance', budget });
    expect(result.total).toBe(budget);
  });

  it('handles minimum budget of R1', () => {
    const result = allocate({ industry: 'Other', budget: 1 });
    expect(result.total).toBe(1);
    expect(result.allocations.length).toBeGreaterThanOrEqual(3);
    const amountSum = result.allocations.reduce((sum, a) => sum + a.amount, 0);
    expect(amountSum).toBe(1);
  });

  it('handles maximum budget of R999,999,999', () => {
    const result = allocate({ industry: 'Energy', budget: 999999999 });
    expect(result.total).toBe(999999999);
    const amountSum = result.allocations.reduce((sum, a) => sum + a.amount, 0);
    expect(amountSum).toBe(999999999);
  });

  it('weights Mining toward energy-saving and carbon-removal', () => {
    const result = allocate({ industry: 'Mining', budget: 1000000 });
    const energySaving = result.allocations.find((a) => a.categoryId === 'energy-saving');
    const carbonRemoval = result.allocations.find((a) => a.categoryId === 'carbon-removal');
    expect(energySaving).toBeDefined();
    expect(carbonRemoval).toBeDefined();
    // These should be among the top allocations for Mining
    expect(energySaving!.percentage).toBeGreaterThanOrEqual(15);
    expect(carbonRemoval!.percentage).toBeGreaterThanOrEqual(10);
  });

  it('weights Technology toward digital-inclusion and education', () => {
    const result = allocate({ industry: 'Technology', budget: 1000000 });
    const digital = result.allocations.find((a) => a.categoryId === 'digital-inclusion');
    const education = result.allocations.find((a) => a.categoryId === 'education');
    expect(digital).toBeDefined();
    expect(education).toBeDefined();
    expect(digital!.percentage).toBeGreaterThanOrEqual(20);
    expect(education!.percentage).toBeGreaterThanOrEqual(20);
  });

  it('falls back to "Other" weights for unknown industry', () => {
    const result = allocate({ industry: 'UnknownIndustry', budget: 100000 });
    expect(result.allocations.length).toBeGreaterThanOrEqual(3);
    const percentageSum = result.allocations.reduce((sum, a) => sum + a.percentage, 0);
    expect(percentageSum).toBe(100);
  });

  it('all percentages are non-negative integers', () => {
    for (const industry of INDUSTRIES) {
      const result = allocate({ industry, budget: 777777 });
      for (const alloc of result.allocations) {
        expect(alloc.percentage).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(alloc.percentage)).toBe(true);
      }
    }
  });

  it('all amounts are non-negative integers', () => {
    for (const industry of INDUSTRIES) {
      const result = allocate({ industry, budget: 333333 });
      for (const alloc of result.allocations) {
        expect(alloc.amount).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(alloc.amount)).toBe(true);
      }
    }
  });

  it('each allocation has a valid categoryId and categoryName', () => {
    const result = allocate({ industry: 'Healthcare', budget: 500000 });
    for (const alloc of result.allocations) {
      expect(alloc.categoryId).toBeTruthy();
      expect(alloc.categoryName).toBeTruthy();
      expect(typeof alloc.categoryId).toBe('string');
      expect(typeof alloc.categoryName).toBe('string');
    }
  });
});
