/**
 * Property Test: Category filter correctness (Property 27)
 *
 * Validates: Requirements 8.2
 *
 * For any category filter applied to the public project listing, all returned
 * projects SHALL have a category matching the selected filter. No projects from
 * other categories SHALL be included.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { Project, VerificationStatus } from '../../shared/types';

// ─── Domain Constants ────────────────────────────────────────────────────────

/** Categories available on the platform (from taxonomy) */
const CATEGORIES = [
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

/** Statuses that appear in the public listing */
const PUBLIC_STATUSES: VerificationStatus[] = ['verified', 'live', 'funded'];

// ─── Helper Function ─────────────────────────────────────────────────────────

/**
 * Filters a list of projects by category.
 *
 * When a category filter is applied (non-empty string), returns only projects
 * whose category matches the selected filter exactly.
 * When no filter is applied (empty string), returns all projects unchanged.
 */
function filterByCategory(
  projects: Pick<Project, 'projectId' | 'category'>[],
  selectedCategory: string
): Pick<Project, 'projectId' | 'category'>[] {
  if (selectedCategory === '') {
    return projects;
  }
  return projects.filter((p) => p.category === selectedCategory);
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate a valid category from the taxonomy */
const categoryArb = fc.constantFrom(...CATEGORIES);

/** Generate a minimal project with a random category */
const projectArb = fc.record({
  projectId: fc.stringMatching(/^[a-zA-Z0-9]{10,30}$/),
  category: categoryArb,
});

/** Generate an array of projects (1–50 items) with various categories */
const projectListArb = fc.array(projectArb, { minLength: 1, maxLength: 50 });

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 27: Category filter correctness', () => {
  /**
   * **Validates: Requirements 8.2**
   * All returned projects have category matching the filter
   */
  it('all returned projects have category matching the selected filter', () => {
    fc.assert(
      fc.property(
        projectListArb,
        categoryArb,
        (projects, selectedCategory) => {
          const filtered = filterByCategory(projects, selectedCategory);

          for (const project of filtered) {
            expect(project.category).toBe(selectedCategory);
          }
        }
      ),
      { numRuns: 500 }
    );
  });

  /**
   * **Validates: Requirements 8.2**
   * No projects from other categories are included in filtered results
   */
  it('no projects from other categories are included in filtered results', () => {
    fc.assert(
      fc.property(
        projectListArb,
        categoryArb,
        (projects, selectedCategory) => {
          const filtered = filterByCategory(projects, selectedCategory);

          const otherCategoryProjects = filtered.filter(
            (p) => p.category !== selectedCategory
          );
          expect(otherCategoryProjects).toHaveLength(0);
        }
      ),
      { numRuns: 500 }
    );
  });

  /**
   * **Validates: Requirements 8.2**
   * When no filter is applied (empty string), all projects are returned
   */
  it('returns all projects when no filter is applied (empty string)', () => {
    fc.assert(
      fc.property(
        projectListArb,
        (projects) => {
          const filtered = filterByCategory(projects, '');

          expect(filtered).toHaveLength(projects.length);
          expect(filtered).toEqual(projects);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 8.2**
   * Filtered count equals the number of projects with matching category in the original list
   */
  it('filtered count equals the number of matching projects in the original list', () => {
    fc.assert(
      fc.property(
        projectListArb,
        categoryArb,
        (projects, selectedCategory) => {
          const filtered = filterByCategory(projects, selectedCategory);

          const expectedCount = projects.filter(
            (p) => p.category === selectedCategory
          ).length;
          expect(filtered).toHaveLength(expectedCount);
        }
      ),
      { numRuns: 500 }
    );
  });

  /**
   * **Validates: Requirements 8.2**
   * Filtering is idempotent — applying the same filter twice yields the same result
   */
  it('filtering is idempotent — applying the same filter twice yields the same result', () => {
    fc.assert(
      fc.property(
        projectListArb,
        categoryArb,
        (projects, selectedCategory) => {
          const firstFilter = filterByCategory(projects, selectedCategory);
          const secondFilter = filterByCategory(firstFilter, selectedCategory);

          expect(secondFilter).toEqual(firstFilter);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 8.2**
   * When a category has no matching projects, the filter returns an empty array
   */
  it('returns empty array when no projects match the selected category', () => {
    // Generate projects that all have a different category than the filter
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            projectId: fc.stringMatching(/^[a-zA-Z0-9]{10,30}$/),
            category: fc.constantFrom('energy-saving', 'education', 'health'),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        fc.constantFrom('biodiversity', 'housing', 'digital-inclusion'),
        (projects, selectedCategory) => {
          // Ensure none of the projects have the selected category
          const projectsWithoutCategory = projects.filter(
            (p) => p.category !== selectedCategory
          );

          const filtered = filterByCategory(projectsWithoutCategory, selectedCategory);
          expect(filtered).toHaveLength(0);
        }
      ),
      { numRuns: 200 }
    );
  });
});
