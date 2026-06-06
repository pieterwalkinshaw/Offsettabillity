import { describe, it, expect } from 'vitest';
import {
  calculatePurchasePrice,
  formatZAR,
  generateCertificateId,
} from '@shared/creditUtils';

describe('calculatePurchasePrice', () => {
  it('returns quantity * unitPriceCents as an integer for whole numbers', () => {
    expect(calculatePurchasePrice(10, 15000)).toBe(150000);
  });

  it('returns rounded integer cents for fractional quantities', () => {
    // 2.5 * 15000 = 37500 (exact)
    expect(calculatePurchasePrice(2.5, 15000)).toBe(37500);
    // 1.33 * 15000 = 19950 (exact)
    expect(calculatePurchasePrice(1.33, 15000)).toBe(19950);
  });

  it('rounds the result to avoid floating-point errors', () => {
    // 0.1 + 0.2 style issue: 1.01 * 9999 = 10098.99 → rounds to 10099
    expect(calculatePurchasePrice(1.01, 9999)).toBe(Math.round(1.01 * 9999));
  });

  it('applies package discount correctly', () => {
    // 10 tons * 15000 = 150000, 10% discount → 135000
    expect(calculatePurchasePrice(10, 15000, 10)).toBe(135000);
  });

  it('applies 0% discount same as no discount', () => {
    expect(calculatePurchasePrice(5, 15000, 0)).toBe(75000);
    expect(calculatePurchasePrice(5, 15000)).toBe(75000);
  });

  it('handles large quantities', () => {
    expect(calculatePurchasePrice(100000, 15000)).toBe(1500000000);
  });

  it('handles discount that results in fractional cents', () => {
    // 3 * 10000 = 30000, 7% discount → 30000 * 0.93 = 27900
    expect(calculatePurchasePrice(3, 10000, 7)).toBe(27900);
    // 1 * 333 = 333, 33% discount → 333 * 0.67 = 223.11 → rounds to 223
    expect(calculatePurchasePrice(1, 333, 33)).toBe(Math.round(333 * 0.67));
  });
});

describe('formatZAR', () => {
  it('formats zero cents', () => {
    const result = formatZAR(0);
    expect(result).toContain('R');
    expect(result).toContain('0');
  });

  it('formats a whole Rand amount', () => {
    const result = formatZAR(150000);
    // 150000 cents = R 1 500.00 (en-ZA uses space as thousands separator)
    expect(result).toMatch(/R\s.*1.*500/);
  });

  it('formats cents correctly with two decimal places', () => {
    const result = formatZAR(99);
    // 99 cents = R 0.99
    expect(result).toContain('0');
    expect(result).toContain('99');
  });

  it('always includes two decimal places', () => {
    const result = formatZAR(10000);
    // R 100.00
    expect(result).toMatch(/\d+[.,]00/);
  });
});

describe('generateCertificateId', () => {
  it('returns exactly 16 characters', () => {
    const id = generateCertificateId();
    expect(id).toHaveLength(16);
  });

  it('contains only alphanumeric characters', () => {
    const id = generateCertificateId();
    expect(id).toMatch(/^[a-zA-Z0-9]{16}$/);
  });

  it('generates unique IDs across multiple calls', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateCertificateId());
    }
    // All 100 IDs should be unique
    expect(ids.size).toBe(100);
  });

  it('meets the minimum 12-character requirement from the spec', () => {
    const id = generateCertificateId();
    expect(id.length).toBeGreaterThanOrEqual(12);
  });
});
