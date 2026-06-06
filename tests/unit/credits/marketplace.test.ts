import { describe, it, expect } from 'vitest';
import { calculatePurchasePrice, formatZAR } from '@shared/creditUtils';
import type { CreditInventory, CreditPackage, CreditPackageTier } from '@shared/types';

// ─── Pure logic extracted from src/app/(dashboard)/credits/page.tsx ──────────
// These replicate the exact logic in the component for unit testing purposes.

/**
 * Tier styling logic — maps tier name to Tailwind CSS classes.
 * Mirrors the tierStyle() function in the marketplace page.
 */
function tierStyle(tier: string): { bg: string; border: string; badge: string } {
  switch (tier) {
    case 'bronze':
      return { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700' };
    case 'silver':
      return { bg: 'bg-gray-50', border: 'border-gray-300', badge: 'bg-gray-200 text-gray-700' };
    case 'gold':
      return { bg: 'bg-yellow-50', border: 'border-yellow-300', badge: 'bg-yellow-100 text-yellow-700' };
    default:
      return { bg: 'bg-white', border: 'border-gray-200', badge: 'bg-gray-100 text-gray-600' };
  }
}

/**
 * Validates a custom quantity input string.
 * Mirrors the validateQuantity() logic in the marketplace page.
 *
 * Returns the parsed number if valid, or an error message string if invalid.
 */
function validateQuantity(value: string, totalAvailable: number): number | string {
  const parsed = parseFloat(value);
  if (isNaN(parsed) || parsed <= 0) {
    return 'Please enter a valid quantity.';
  }
  if (parsed < 1) {
    return 'Minimum purchase is 1 ton.';
  }
  if (parsed > totalAvailable) {
    return `Maximum available is ${totalAvailable.toFixed(2)} tons.`;
  }
  // Check max 2 decimal places
  const decimalParts = value.split('.');
  if (decimalParts.length === 2 && decimalParts[1].length > 2) {
    return 'Maximum 2 decimal places allowed.';
  }
  return parsed;
}

/**
 * Total available aggregation — sums availableTonnage across inventory items.
 * Mirrors the useMemo in the marketplace page.
 */
function computeTotalAvailable(inventory: CreditInventory[]): number {
  return inventory.reduce((sum, inv) => sum + inv.availableTonnage, 0);
}

/**
 * Package disable logic — a package is disabled when its tonnage exceeds total available.
 * Mirrors the isDisabled check in the marketplace page.
 */
function isPackageDisabled(pkg: CreditPackage, totalAvailable: number): boolean {
  return pkg.tonnage > totalAvailable;
}

// ─── Test Helpers ────────────────────────────────────────────────────────────

function makeInventory(overrides: Partial<CreditInventory> = {}): CreditInventory {
  return {
    inventoryId: 'inv-test-1',
    projectId: 'proj-1',
    availableTonnage: 100,
    totalTonnage: 200,
    unitPriceCents: 15000,
    projectTitle: 'Test Solar Project',
    projectLocation: 'Limpopo, South Africa',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function makePackage(overrides: Partial<CreditPackage> = {}): CreditPackage {
  return {
    packageId: 'pkg-test',
    name: 'Bronze Package',
    tier: 'bronze' as CreditPackageTier,
    tonnage: 5,
    priceCents: 6750000,
    discountPercentage: 10,
    isActive: true,
    sortOrder: 1,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Marketplace Page Logic', () => {
  // ─── Quantity Validation ─────────────────────────────────────────────────

  describe('validateQuantity', () => {
    const totalAvailable = 167.00;

    it('accepts a valid whole number quantity', () => {
      expect(validateQuantity('10', totalAvailable)).toBe(10);
    });

    it('accepts a valid quantity with one decimal place', () => {
      expect(validateQuantity('5.5', totalAvailable)).toBe(5.5);
    });

    it('accepts a valid quantity with two decimal places', () => {
      expect(validateQuantity('25.75', totalAvailable)).toBe(25.75);
    });

    it('accepts exactly 1 ton (minimum)', () => {
      expect(validateQuantity('1', totalAvailable)).toBe(1);
    });

    it('accepts the total available (maximum)', () => {
      expect(validateQuantity('167', totalAvailable)).toBe(167);
    });

    it('rejects empty string', () => {
      expect(validateQuantity('', totalAvailable)).toBe('Please enter a valid quantity.');
    });

    it('rejects non-numeric input', () => {
      expect(validateQuantity('abc', totalAvailable)).toBe('Please enter a valid quantity.');
    });

    it('rejects zero', () => {
      expect(validateQuantity('0', totalAvailable)).toBe('Please enter a valid quantity.');
    });

    it('rejects negative values', () => {
      expect(validateQuantity('-5', totalAvailable)).toBe('Please enter a valid quantity.');
    });

    it('rejects values less than 1 ton', () => {
      expect(validateQuantity('0.5', totalAvailable)).toBe('Minimum purchase is 1 ton.');
    });

    it('rejects values exceeding total available', () => {
      expect(validateQuantity('200', totalAvailable)).toBe('Maximum available is 167.00 tons.');
    });

    it('rejects more than 2 decimal places', () => {
      expect(validateQuantity('10.123', totalAvailable)).toBe('Maximum 2 decimal places allowed.');
    });

    it('rejects 3 decimal places even if value is valid otherwise', () => {
      expect(validateQuantity('5.555', totalAvailable)).toBe('Maximum 2 decimal places allowed.');
    });
  });

  // ─── Package Disable Logic ───────────────────────────────────────────────

  describe('isPackageDisabled', () => {
    it('enables a package when tonnage is less than total available', () => {
      const pkg = makePackage({ tonnage: 5 });
      expect(isPackageDisabled(pkg, 167)).toBe(false);
    });

    it('enables a package when tonnage equals total available', () => {
      const pkg = makePackage({ tonnage: 100 });
      expect(isPackageDisabled(pkg, 100)).toBe(false);
    });

    it('disables a package when tonnage exceeds total available', () => {
      const pkg = makePackage({ tonnage: 100 });
      expect(isPackageDisabled(pkg, 50)).toBe(true);
    });

    it('disables a package when total available is zero', () => {
      const pkg = makePackage({ tonnage: 5 });
      expect(isPackageDisabled(pkg, 0)).toBe(true);
    });

    it('enables a package with tonnage of 1 when at least 1 is available', () => {
      const pkg = makePackage({ tonnage: 1 });
      expect(isPackageDisabled(pkg, 1)).toBe(false);
    });
  });

  // ─── Total Available Aggregation ─────────────────────────────────────────

  describe('computeTotalAvailable', () => {
    it('returns 0 for an empty inventory array', () => {
      expect(computeTotalAvailable([])).toBe(0);
    });

    it('returns the single item tonnage for a single inventory item', () => {
      const inventory = [makeInventory({ availableTonnage: 11 })];
      expect(computeTotalAvailable(inventory)).toBe(11);
    });

    it('sums tonnage across multiple inventory items', () => {
      const inventory = [
        makeInventory({ inventoryId: 'inv-1', availableTonnage: 11 }),
        makeInventory({ inventoryId: 'inv-2', availableTonnage: 156 }),
      ];
      expect(computeTotalAvailable(inventory)).toBe(167);
    });

    it('handles decimal tonnage values correctly', () => {
      const inventory = [
        makeInventory({ inventoryId: 'inv-1', availableTonnage: 10.50 }),
        makeInventory({ inventoryId: 'inv-2', availableTonnage: 25.75 }),
      ];
      expect(computeTotalAvailable(inventory)).toBeCloseTo(36.25, 2);
    });

    it('includes items with zero tonnage in sum (no filtering)', () => {
      // The page fetches only items with availableTonnage > 0 from Firestore,
      // but the aggregation itself just sums whatever is in the array.
      const inventory = [
        makeInventory({ inventoryId: 'inv-1', availableTonnage: 0 }),
        makeInventory({ inventoryId: 'inv-2', availableTonnage: 50 }),
      ];
      expect(computeTotalAvailable(inventory)).toBe(50);
    });
  });

  // ─── Price Calculation for Display ───────────────────────────────────────

  describe('price calculation for custom quantity display', () => {
    const unitPriceCents = 15000; // R150 per ton

    it('calculates price for a whole number quantity', () => {
      const price = calculatePurchasePrice(10, unitPriceCents);
      expect(price).toBe(150000); // R1,500.00
    });

    it('calculates price for a fractional quantity', () => {
      const price = calculatePurchasePrice(2.5, unitPriceCents);
      expect(price).toBe(37500); // R375.00
    });

    it('returns 0-equivalent price for near-zero valid quantity', () => {
      // Minimum is 1 ton in validation, but price calc works for any positive number
      const price = calculatePurchasePrice(1, unitPriceCents);
      expect(price).toBe(15000); // R150.00
    });

    it('calculates correct price for maximum quantity', () => {
      const price = calculatePurchasePrice(167, unitPriceCents);
      expect(price).toBe(2505000); // R25,050.00
    });

    it('applies package discount to displayed price', () => {
      // 10 tons at R150/ton = R1500, 10% discount = R1350
      const price = calculatePurchasePrice(10, unitPriceCents, 10);
      expect(price).toBe(135000);
    });

    it('formats the calculated price correctly in ZAR', () => {
      const price = calculatePurchasePrice(10, unitPriceCents);
      const formatted = formatZAR(price);
      expect(formatted).toContain('R');
      // 150000 cents = R 1 500.00
      expect(formatted).toMatch(/1.*500/);
    });
  });

  // ─── Tier Styling ────────────────────────────────────────────────────────

  describe('tierStyle', () => {
    it('returns orange styles for bronze tier', () => {
      const style = tierStyle('bronze');
      expect(style.bg).toBe('bg-orange-50');
      expect(style.border).toBe('border-orange-200');
      expect(style.badge).toBe('bg-orange-100 text-orange-700');
    });

    it('returns gray styles for silver tier', () => {
      const style = tierStyle('silver');
      expect(style.bg).toBe('bg-gray-50');
      expect(style.border).toBe('border-gray-300');
      expect(style.badge).toBe('bg-gray-200 text-gray-700');
    });

    it('returns yellow styles for gold tier', () => {
      const style = tierStyle('gold');
      expect(style.bg).toBe('bg-yellow-50');
      expect(style.border).toBe('border-yellow-300');
      expect(style.badge).toBe('bg-yellow-100 text-yellow-700');
    });

    it('returns default styles for unknown tier', () => {
      const style = tierStyle('platinum');
      expect(style.bg).toBe('bg-white');
      expect(style.border).toBe('border-gray-200');
      expect(style.badge).toBe('bg-gray-100 text-gray-600');
    });

    it('returns default styles for empty string', () => {
      const style = tierStyle('');
      expect(style.bg).toBe('bg-white');
      expect(style.border).toBe('border-gray-200');
      expect(style.badge).toBe('bg-gray-100 text-gray-600');
    });
  });

  // ─── Package Cards Discount Display ──────────────────────────────────────

  describe('package discount info display logic', () => {
    it('displays correct discount percentage from package data', () => {
      const pkg = makePackage({
        tonnage: 5,
        priceCents: 6750000,
        discountPercentage: 10,
      });
      expect(pkg.discountPercentage).toBe(10);
    });

    it('shows correct formatted price for a package', () => {
      const pkg = makePackage({ priceCents: 6750000 });
      const formatted = formatZAR(pkg.priceCents);
      expect(formatted).toContain('R');
      // 6750000 cents = R 67 500.00
      expect(formatted).toMatch(/67.*500/);
    });

    it('only active packages should be shown (isActive filter)', () => {
      const allPackages = [
        makePackage({ packageId: 'pkg-1', isActive: true }),
        makePackage({ packageId: 'pkg-2', isActive: false }),
        makePackage({ packageId: 'pkg-3', isActive: true }),
      ];
      // The page queries Firestore with where('isActive', '==', true),
      // so the filtering happens at the query level. Here we test the expected filter behavior.
      const activePackages = allPackages.filter((p) => p.isActive);
      expect(activePackages).toHaveLength(2);
      expect(activePackages.every((p) => p.isActive)).toBe(true);
    });

    it('disabled packages show "Insufficient stock" text condition', () => {
      const totalAvailable = 20;
      const pkg = makePackage({ tonnage: 25 });
      // In the UI: isDisabled = pkg.tonnage > totalAvailable
      const isDisabled = isPackageDisabled(pkg, totalAvailable);
      expect(isDisabled).toBe(true);
      // When isDisabled, the UI renders "Insufficient stock" text
    });
  });
});
