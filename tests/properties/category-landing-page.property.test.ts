/**
 * Property Test: Category landing page existence (Property 31)
 *
 * Validates: Requirements 10.1, 10.8
 *
 * For any active taxonomy category, a statically generated landing page SHALL exist
 * at `/categories/{category-id}`. For any inactive or nonexistent category ID, the
 * system SHALL return a 404 response.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { TaxonomyCategory } from '../../shared/types';
import {
  categoryPageExists,
  getGeneratedCategoryPages,
} from '../../src/lib/categories/categoryPageExists';

// ─── Domain Constants ────────────────────────────────────────────────────────

/** The 12 initial category IDs defined in the platform taxonomy */
const KNOWN_CATEGORY_IDS = [
  'energy-saving',
  'renewable-energy',
  'carbon-removal',
  'education',
  'health',
  'food-security',
  'clean-water',
  'waste-management',
  'biodiversity',
  'housing',
  'digital-inclusion',
  'gender-equality',
] as const;

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate a valid category ID (lowercase alphanumeric with hyphens, max 50 chars) */
const validCategoryIdArb = fc.stringMatching(/^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$/).filter(
  (id) => id.length >= 2 && id.length <= 50
);

/** Generate a category ID from the known set */
const knownCategoryIdArb = fc.constantFrom(...KNOWN_CATEGORY_IDS);

/** Generate a random string that is unlikely to match any known category ID */
const nonexistentCategoryIdArb = fc.oneof(
  fc.string({ minLength: 1, maxLength: 50 }).filter(
    (s) => !KNOWN_CATEGORY_IDS.includes(s as typeof KNOWN_CATEGORY_IDS[number])
  ),
  fc.constantFrom(
    'nonexistent-category',
    'invalid-id-xyz',
    'foo-bar-baz',
    'test-category-999',
    'ENERGY-SAVING', // wrong case
    'energy_saving', // underscores instead of hyphens
    '',
  )
);

/** Generate a valid TaxonomyCategory object */
const taxonomyCategoryArb = (
  idArb: fc.Arbitrary<string> = validCategoryIdArb,
  isActiveArb: fc.Arbitrary<boolean> = fc.boolean()
): fc.Arbitrary<TaxonomyCategory> =>
  fc.record({
    id: idArb,
    name: fc.string({ minLength: 1, maxLength: 80 }),
    description: fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: undefined }),
    primaryMetricLabel: fc.string({ minLength: 1, maxLength: 100 }),
    icon: fc.option(
      fc.constantFrom('zap', 'sun', 'leaf', 'graduation-cap', 'heart-pulse', 'wheat', 'droplets', 'recycle', 'trees', 'home', 'wifi', 'users'),
      { nil: undefined }
    ),
    sdgNumbers: fc.option(
      fc.array(fc.integer({ min: 1, max: 17 }), { minLength: 1, maxLength: 5 }),
      { nil: undefined }
    ),
    isActive: isActiveArb,
    sortOrder: fc.integer({ min: 0, max: 999 }),
  });

/** Generate an active TaxonomyCategory */
const activeCategoryArb = taxonomyCategoryArb(validCategoryIdArb, fc.constant(true));

/** Generate an inactive TaxonomyCategory */
const inactiveCategoryArb = taxonomyCategoryArb(validCategoryIdArb, fc.constant(false));

/** Generate a list of categories with a mix of active and inactive */
const categoryListArb = fc.array(
  taxonomyCategoryArb(
    fc.oneof(knownCategoryIdArb, validCategoryIdArb),
    fc.boolean()
  ),
  { minLength: 1, maxLength: 20 }
).chain((categories) => {
  // Ensure unique IDs in the list
  const seen = new Set<string>();
  const unique = categories.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
  return fc.constant(unique.length > 0 ? unique : [categories[0]]);
});

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 31: Category landing page existence', () => {
  /**
   * **Validates: Requirements 10.1**
   * Active categories have pages at `/categories/{id}` (return true)
   */
  it('active categories have landing pages', () => {
    fc.assert(
      fc.property(
        fc.array(activeCategoryArb, { minLength: 1, maxLength: 15 }).map((cats) => {
          // Ensure unique IDs
          const seen = new Set<string>();
          return cats.filter((c) => {
            if (seen.has(c.id)) return false;
            seen.add(c.id);
            return true;
          });
        }).filter((cats) => cats.length > 0),
        (activeCategories) => {
          for (const category of activeCategories) {
            expect(categoryPageExists(category.id, activeCategories)).toBe(true);
          }
        }
      ),
      { numRuns: 300 }
    );
  });

  /**
   * **Validates: Requirements 10.8**
   * Inactive categories return 404 (return false)
   */
  it('inactive categories do not have landing pages', () => {
    fc.assert(
      fc.property(
        fc.array(inactiveCategoryArb, { minLength: 1, maxLength: 15 }).map((cats) => {
          const seen = new Set<string>();
          return cats.filter((c) => {
            if (seen.has(c.id)) return false;
            seen.add(c.id);
            return true;
          });
        }).filter((cats) => cats.length > 0),
        (inactiveCategories) => {
          for (const category of inactiveCategories) {
            expect(categoryPageExists(category.id, inactiveCategories)).toBe(false);
          }
        }
      ),
      { numRuns: 300 }
    );
  });

  /**
   * **Validates: Requirements 10.8**
   * Nonexistent category IDs return 404 (return false)
   */
  it('nonexistent category IDs do not have landing pages', () => {
    fc.assert(
      fc.property(
        nonexistentCategoryIdArb,
        fc.array(activeCategoryArb, { minLength: 1, maxLength: 12 }).map((cats) => {
          const seen = new Set<string>();
          return cats.filter((c) => {
            if (seen.has(c.id)) return false;
            seen.add(c.id);
            return true;
          });
        }).filter((cats) => cats.length > 0),
        (nonexistentId, categories) => {
          // Ensure the nonexistent ID is truly not in the category list
          const categoryIds = categories.map((c) => c.id);
          if (!categoryIds.includes(nonexistentId)) {
            expect(categoryPageExists(nonexistentId, categories)).toBe(false);
          }
        }
      ),
      { numRuns: 300 }
    );
  });

  /**
   * **Validates: Requirements 10.1, 10.8**
   * The set of generated pages matches exactly the set of active categories
   */
  it('the set of pages matches exactly the set of active categories', () => {
    fc.assert(
      fc.property(categoryListArb, (categories) => {
        const generatedPages = getGeneratedCategoryPages(categories);
        const activeIds = categories
          .filter((c) => c.isActive)
          .map((c) => c.id);

        // Same length
        expect(generatedPages.length).toBe(activeIds.length);

        // Every active category has a page
        for (const id of activeIds) {
          expect(generatedPages).toContain(id);
        }

        // Every generated page corresponds to an active category
        for (const pageId of generatedPages) {
          expect(activeIds).toContain(pageId);
        }

        // No inactive category has a page
        const inactiveIds = categories
          .filter((c) => !c.isActive)
          .map((c) => c.id);
        for (const id of inactiveIds) {
          expect(generatedPages).not.toContain(id);
        }
      }),
      { numRuns: 300 }
    );
  });

  /**
   * **Validates: Requirements 10.1, 10.8**
   * In a mixed list, categoryPageExists is true for active and false for inactive
   */
  it('in a mixed category list, only active categories have pages', () => {
    fc.assert(
      fc.property(categoryListArb, (categories) => {
        for (const category of categories) {
          const exists = categoryPageExists(category.id, categories);
          if (category.isActive) {
            expect(exists).toBe(true);
          } else {
            expect(exists).toBe(false);
          }
        }
      }),
      { numRuns: 300 }
    );
  });

  /**
   * **Validates: Requirements 10.8**
   * Empty string category ID always returns 404
   */
  it('empty string category ID returns 404', () => {
    fc.assert(
      fc.property(
        fc.array(activeCategoryArb, { minLength: 0, maxLength: 12 }),
        (categories) => {
          expect(categoryPageExists('', categories)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 10.8**
   * Empty category list means no pages exist
   */
  it('empty category list means no pages exist for any ID', () => {
    fc.assert(
      fc.property(
        fc.oneof(knownCategoryIdArb, validCategoryIdArb),
        (categoryId) => {
          expect(categoryPageExists(categoryId, [])).toBe(false);
          expect(getGeneratedCategoryPages([])).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
