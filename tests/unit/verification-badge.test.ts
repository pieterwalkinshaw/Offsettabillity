import { describe, it, expect } from 'vitest';
import { determineBadge } from '@/lib/verification/badge';

describe('determineBadge', () => {
  it('returns "None" when no completed audits', () => {
    expect(determineBadge(0, 0)).toBe('None');
    expect(determineBadge(100, 0)).toBe('None');
  });

  it('returns "Verified" with 1 completed audit regardless of score', () => {
    expect(determineBadge(0, 1)).toBe('Verified');
    expect(determineBadge(50, 1)).toBe('Verified');
    expect(determineBadge(85, 1)).toBe('Verified');
  });

  it('returns "Verified" with 2 audits but score <= 85', () => {
    expect(determineBadge(85, 2)).toBe('Verified');
    expect(determineBadge(50, 2)).toBe('Verified');
  });

  it('returns "Verified+" with 2+ audits and score > 85', () => {
    expect(determineBadge(86, 2)).toBe('Verified+');
    expect(determineBadge(90, 2)).toBe('Verified+');
    expect(determineBadge(95, 2)).toBe('Verified+');
  });

  it('returns "Verified+" with 3 audits and score between 86-95', () => {
    expect(determineBadge(90, 3)).toBe('Verified+');
    expect(determineBadge(95, 3)).toBe('Verified+');
  });

  it('returns "Premium Assured" with 3+ audits and score > 95', () => {
    expect(determineBadge(96, 3)).toBe('Premium Assured');
    expect(determineBadge(100, 3)).toBe('Premium Assured');
    expect(determineBadge(99, 5)).toBe('Premium Assured');
  });

  it('returns "Verified+" not "Premium Assured" when score is exactly 95 with 3 audits', () => {
    expect(determineBadge(95, 3)).toBe('Verified+');
  });

  it('returns "Verified" not "Verified+" when score is exactly 85 with 2 audits', () => {
    expect(determineBadge(85, 2)).toBe('Verified');
  });
});
