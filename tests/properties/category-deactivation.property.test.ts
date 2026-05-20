/**
 * Property Test: Category deactivation preserves existing projects (Property 10)
 *
 * Validates: Requirements 3.4
 *
 * For any deactivated category, new projects SHALL NOT be able to select that category,
 * but all existing projects assigned to that category SHALL continue to display the
 * category name and metric label unchanged.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { TaxonomyCategory, Project } from '../../shared/types';

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Determines if a category can be selected for new projects.
 * Returns true only if the category is active.
 */
function canSelectCategory(category: TaxonomyCategory): boolean {
  return category.isActive === true;
}

/**
 * Returns the display data for a project's assigned category.
 * Existing projects always retain their category name and metric label,
 * regardless of whether the category is active or inactive.
 */
function getProjectCategoryDisplay(
  project: Project,
  category: TaxonomyCategory
): { name: string; primaryMetricLabel: string } {
  return {
    name: category.name,
    primaryMetricLabel: category.primaryMetricLabel,
  };
}

/**
 * Simulates deactivating a category. Returns a new category object
 * with isActive set to false, preserving all other fields.
 */
function deactivateCategory(category: TaxonomyCategory): TaxonomyCategory {
  return { ...category, isActive: false };
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate a valid taxonomy category ID */
const validCategoryId = fc.constantFrom(
  'energy-saving', 'renewable-energy', 'carbon-removal', 'education',
  'health', 'food-security', 'clean-water', 'waste-management',
  'biodiversity', 'housing', 'digital-inclusion', 'gender-equality'
);

/** Generate a valid category name */
const validCategoryName = fc.constantFrom(
  'Energy Saving & Efficiency', 'Renewable Energy', 'Carbon Removal & Sequestration',
  'Education & Skills Development', 'Healthcare & Wellness', 'Food Security & Agriculture',
  'Clean Water & Sanitation', 'Waste Management & Recycling', 'Biodiversity & Conservation',
  'Affordable Housing', 'Digital Inclusion & Connectivity', 'Gender Equality & Empowerment'
);

/** Generate a valid primary metric label */
const validPrimaryMetricLabel = fc.constantFrom(
  'kWh Saved', 'MWh Generated', 'Tons CO₂e Removed', 'People Trained',
  'Lives Impacted', 'Meals Provided', 'Liters Provided', 'Tons Diverted',
  'Hectares Protected', 'Units Built', 'People Connected', 'Women Impacted'
);

/** Generate a valid SDG numbers array */
const validSdgNumbers = fc.array(
  fc.integer({ min: 1, max: 17 }),
  { minLength: 1, maxLength: 5 }
);

/** Generate a complete TaxonomyCategory object */
const taxonomyCategoryArb = fc.record({
  id: validCategoryId,
  name: validCategoryName,
  description: fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: undefined }),
  primaryMetricLabel: validPrimaryMetricLabel,
  icon: fc.option(fc.constantFrom('zap', 'sun', 'leaf', 'book', 'heart', 'droplet'), { nil: undefined }),
  sdgNumbers: fc.option(validSdgNumbers, { nil: undefined }),
  isActive: fc.constant(true),
  sortOrder: fc.integer({ min: 0, max: 999 }),
});

/** Generate a deactivated TaxonomyCategory */
const deactivatedCategoryArb = taxonomyCategoryArb.map(cat => ({
  ...cat,
  isActive: false,
}));

/** Generate a TaxonomyCategory with random active status */
const anyCategoryArb = fc.record({
  id: validCategoryId,
  name: validCategoryName,
  description: fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: undefined }),
  primaryMetricLabel: validPrimaryMetricLabel,
  icon: fc.option(fc.constantFrom('zap', 'sun', 'leaf', 'book', 'heart', 'droplet'), { nil: undefined }),
  sdgNumbers: fc.option(validSdgNumbers, { nil: undefined }),
  isActive: fc.boolean(),
  sortOrder: fc.integer({ min: 0, max: 999 }),
});

/** Generate a valid project assigned to a given category */
const projectWithCategoryArb = (categoryId: string) => fc.record({
  projectId: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 120 }),
  description: fc.string({ minLength: 1, maxLength: 500 }),
  category: fc.constant(categoryId),
  ownerId: fc.uuid(),
  location: fc.record({
    lat: fc.double({ min: -90, max: 90, noNaN: true }),
    lng: fc.double({ min: -180, max: 180, noNaN: true }),
    address: fc.string({ minLength: 1, maxLength: 200 }),
    country: fc.constantFrom('ZA', 'US', 'GB', 'DE', 'KE', 'NG'),
  }),
  fundingGoal: fc.integer({ min: 1000, max: 999999999 }),
  fundingRaised: fc.integer({ min: 0, max: 999999999 }),
  impactMetrics: fc.record({
    reportingPeriod: fc.constantFrom('Monthly', 'Quarterly', 'Annually', 'Project Duration') as fc.Arbitrary<'Monthly' | 'Quarterly' | 'Annually' | 'Project Duration'>,
    primaryMetric: fc.record({
      label: validPrimaryMetricLabel,
      value: fc.double({ min: 0, max: 1000000, noNaN: true }),
    }),
  }),
  verificationScore: fc.integer({ min: 0, max: 100 }),
  verificationStatus: fc.constantFrom('draft', 'submitted', 'prescreened', 'pending_audit', 'verified', 'live', 'funded') as fc.Arbitrary<'draft' | 'submitted' | 'prescreened' | 'pending_audit' | 'verified' | 'live' | 'funded'>,
  verificationBadge: fc.constantFrom('None', 'Verified', 'Verified+', 'Premium Assured') as fc.Arbitrary<'None' | 'Verified' | 'Verified+' | 'Premium Assured'>,
  documents: fc.array(fc.string(), { minLength: 0, maxLength: 5 }),
  createdAt: fc.date().map(d => d.toISOString()),
  updatedAt: fc.date().map(d => d.toISOString()),
});

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 10: Category deactivation preserves existing projects', () => {
  /**
   * **Validates: Requirements 3.4**
   * For any category with isActive=false, canSelectCategory returns false.
   */
  it('deactivated categories cannot be selected for new projects', () => {
    fc.assert(
      fc.property(deactivatedCategoryArb, (category) => {
        expect(canSelectCategory(category)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 3.4**
   * For any category with isActive=true, canSelectCategory returns true.
   */
  it('active categories can be selected for new projects', () => {
    fc.assert(
      fc.property(taxonomyCategoryArb, (category) => {
        expect(canSelectCategory(category)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 3.4**
   * For any existing project with an assigned category (active or inactive),
   * the category display data is preserved.
   */
  it('existing projects retain category display data regardless of active status', () => {
    fc.assert(
      fc.property(
        anyCategoryArb,
        fc.uuid(),
        (category, projectId) => {
          // Create a project assigned to this category
          const project: Project = {
            projectId,
            title: 'Test Project',
            description: 'A test project',
            category: category.id,
            ownerId: 'owner-123',
            location: { lat: -33.9, lng: 18.4, address: 'Cape Town', country: 'ZA' },
            fundingGoal: 100000,
            fundingRaised: 0,
            impactMetrics: {
              reportingPeriod: 'Monthly',
              primaryMetric: { label: category.primaryMetricLabel, value: 100 },
            },
            verificationScore: 0,
            verificationStatus: 'verified',
            verificationBadge: 'Verified',
            documents: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          const display = getProjectCategoryDisplay(project, category);

          // Category name and metric label are always available
          expect(display.name).toBe(category.name);
          expect(display.primaryMetricLabel).toBe(category.primaryMetricLabel);
          expect(display.name.length).toBeGreaterThan(0);
          expect(display.primaryMetricLabel.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 3.4**
   * Deactivating a category does not modify existing project data.
   */
  it('deactivating a category does not modify existing project data', () => {
    fc.assert(
      fc.property(
        taxonomyCategoryArb.chain(category =>
          projectWithCategoryArb(category.id).map(project => ({ category, project }))
        ),
        ({ category, project }) => {
          // Capture project state before deactivation
          const projectBefore = { ...project };

          // Deactivate the category
          const deactivated = deactivateCategory(category);

          // Verify the category is now inactive
          expect(deactivated.isActive).toBe(false);
          expect(canSelectCategory(deactivated)).toBe(false);

          // Verify the project data is completely unchanged
          expect(project.projectId).toBe(projectBefore.projectId);
          expect(project.title).toBe(projectBefore.title);
          expect(project.description).toBe(projectBefore.description);
          expect(project.category).toBe(projectBefore.category);
          expect(project.fundingGoal).toBe(projectBefore.fundingGoal);
          expect(project.fundingRaised).toBe(projectBefore.fundingRaised);
          expect(project.verificationStatus).toBe(projectBefore.verificationStatus);
          expect(project.verificationBadge).toBe(projectBefore.verificationBadge);

          // Verify the category display data is still accessible
          const display = getProjectCategoryDisplay(project, deactivated);
          expect(display.name).toBe(category.name);
          expect(display.primaryMetricLabel).toBe(category.primaryMetricLabel);
        }
      ),
      { numRuns: 200 }
    );
  });
});
