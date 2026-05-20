/**
 * Property Test: Taxonomy category uniqueness and validation (Property 9)
 *
 * Validates: Requirements 3.1, 3.2, 3.3
 *
 * For any taxonomy category creation request, the system SHALL accept it if and only if:
 * the ID is unique among all categories (active and inactive), the ID matches the pattern
 * `[a-z0-9-]` with max 50 chars, the display name is provided and ≤ 80 chars, and the
 * primary metric label is provided. Duplicate IDs SHALL be rejected.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { TaxonomyCategorySchema } from '../../shared/schemas';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate a valid taxonomy category ID (lowercase alphanumeric with hyphens, max 50 chars) */
const validId = fc.stringMatching(/^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$/)
  .filter(s => s.length >= 2 && s.length <= 50);

/** Generate a short valid ID for simpler cases */
const shortValidId = fc.constantFrom(
  'energy-saving', 'renewable-energy', 'carbon-removal', 'education',
  'health', 'food-security', 'clean-water', 'waste-management',
  'biodiversity', 'housing', 'digital-inclusion', 'gender-equality'
);

/** Generate a valid display name (1-80 chars) */
const validName = fc.string({ minLength: 1, maxLength: 80 })
  .filter(s => s.trim().length >= 1);

/** Generate a valid primary metric label */
const validPrimaryMetricLabel = fc.constantFrom(
  'kWh Saved', 'MWh Generated', 'Tons CO₂e Removed', 'People Trained',
  'Lives Impacted', 'Meals Provided', 'Liters Provided', 'Tons Diverted',
  'Hectares Protected', 'Units Built', 'People Connected', 'Women Impacted'
);

/** Generate valid SDG numbers (1-17) */
const validSdgNumbers = fc.array(
  fc.integer({ min: 1, max: 17 }),
  { minLength: 0, maxLength: 5 }
);

/** Generate a valid sort order (0-999) */
const validSortOrder = fc.integer({ min: 0, max: 999 });

/** Generate a complete valid taxonomy category input */
const validTaxonomyCategory = fc.record({
  id: shortValidId,
  name: validName,
  description: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
  primaryMetricLabel: validPrimaryMetricLabel,
  icon: fc.option(fc.constantFrom('zap', 'sun', 'leaf', 'book', 'heart', 'droplet'), { nil: undefined }),
  sdgNumbers: fc.option(validSdgNumbers, { nil: undefined }),
  isActive: fc.option(fc.boolean(), { nil: undefined }),
  sortOrder: fc.option(validSortOrder, { nil: undefined }),
});

// ─── Invalid Input Generators ────────────────────────────────────────────────

/** Generate an invalid ID (contains uppercase, spaces, or special chars) */
const invalidId = fc.oneof(
  fc.constant(''),                                    // Empty
  fc.constant('Has Uppercase'),                       // Uppercase
  fc.constant('has spaces'),                          // Spaces
  fc.constant('special!chars'),                       // Special chars
  fc.constant('under_score'),                         // Underscore
  fc.constant('a'.repeat(51))                         // Too long (> 50 chars)
);

/** Generate an invalid name (empty or > 80 chars) */
const invalidName = fc.oneof(
  fc.constant(''),                                    // Empty
  fc.constant('A'.repeat(81))                         // Too long
);

/** Generate an invalid primary metric label (empty) */
const invalidPrimaryMetricLabel = fc.constant('');

/** Generate invalid SDG numbers (outside 1-17 range) */
const invalidSdgNumbers = fc.oneof(
  fc.constant([0]),                                   // Below minimum
  fc.constant([18]),                                  // Above maximum
  fc.constant([-1]),                                  // Negative
  fc.constant([1, 2, 99])                             // Mix with invalid
);

/** Generate an invalid sort order (outside 0-999) */
const invalidSortOrder = fc.oneof(
  fc.constant(-1),                                    // Below minimum
  fc.constant(1000)                                   // Above maximum
);

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 9: Taxonomy category uniqueness and validation', () => {
  /**
   * **Validates: Requirements 3.1, 3.2**
   * Valid taxonomy category inputs pass schema validation.
   */
  it('valid taxonomy category inputs pass schema validation', () => {
    fc.assert(
      fc.property(validTaxonomyCategory, (input) => {
        const result = TaxonomyCategorySchema.safeParse(input);
        expect(result.success).toBe(true);

        if (result.success) {
          expect(result.data.id).toBe(input.id);
          expect(result.data.name).toBe(input.name);
          expect(result.data.primaryMetricLabel).toBe(input.primaryMetricLabel);
          // isActive defaults to true if not provided
          expect(result.data.isActive).toBe(input.isActive ?? true);
          // sortOrder defaults to 0 if not provided
          expect(result.data.sortOrder).toBe(input.sortOrder ?? 0);
        }
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 3.1**
   * Category ID must match pattern [a-z0-9-] with max 50 chars.
   */
  it('invalid category IDs are rejected', () => {
    fc.assert(
      fc.property(
        invalidId,
        validName,
        validPrimaryMetricLabel,
        (id, name, primaryMetricLabel) => {
          const input = { id, name, primaryMetricLabel };
          const result = TaxonomyCategorySchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 3.2**
   * Display name must be provided and not exceed 80 chars.
   */
  it('invalid display names are rejected', () => {
    fc.assert(
      fc.property(
        shortValidId,
        invalidName,
        validPrimaryMetricLabel,
        (id, name, primaryMetricLabel) => {
          const input = { id, name, primaryMetricLabel };
          const result = TaxonomyCategorySchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 3.2**
   * Primary metric label must be provided (non-empty).
   */
  it('empty primary metric label is rejected', () => {
    fc.assert(
      fc.property(
        shortValidId,
        validName,
        invalidPrimaryMetricLabel,
        (id, name, primaryMetricLabel) => {
          const input = { id, name, primaryMetricLabel };
          const result = TaxonomyCategorySchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * **Validates: Requirements 3.1**
   * SDG numbers must be integers between 1 and 17.
   */
  it('invalid SDG numbers are rejected', () => {
    fc.assert(
      fc.property(
        shortValidId,
        validName,
        validPrimaryMetricLabel,
        invalidSdgNumbers,
        (id, name, primaryMetricLabel, sdgNumbers) => {
          const input = { id, name, primaryMetricLabel, sdgNumbers };
          const result = TaxonomyCategorySchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * **Validates: Requirements 3.1**
   * Sort order must be an integer between 0 and 999.
   */
  it('invalid sort order values are rejected', () => {
    fc.assert(
      fc.property(
        shortValidId,
        validName,
        validPrimaryMetricLabel,
        invalidSortOrder,
        (id, name, primaryMetricLabel, sortOrder) => {
          const input = { id, name, primaryMetricLabel, sortOrder };
          const result = TaxonomyCategorySchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * **Validates: Requirements 3.1**
   * isActive defaults to true when not provided.
   */
  it('isActive defaults to true when not provided', () => {
    fc.assert(
      fc.property(
        shortValidId,
        validName,
        validPrimaryMetricLabel,
        (id, name, primaryMetricLabel) => {
          const input = { id, name, primaryMetricLabel };
          const result = TaxonomyCategorySchema.safeParse(input);
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.isActive).toBe(true);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 3.1**
   * sortOrder defaults to 0 when not provided.
   */
  it('sortOrder defaults to 0 when not provided', () => {
    fc.assert(
      fc.property(
        shortValidId,
        validName,
        validPrimaryMetricLabel,
        (id, name, primaryMetricLabel) => {
          const input = { id, name, primaryMetricLabel };
          const result = TaxonomyCategorySchema.safeParse(input);
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.sortOrder).toBe(0);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 3.3**
   * Validation failures produce error details with field information.
   */
  it('validation failures produce error details', () => {
    fc.assert(
      fc.property(
        invalidId,
        validName,
        validPrimaryMetricLabel,
        (id, name, primaryMetricLabel) => {
          const input = { id, name, primaryMetricLabel };
          const result = TaxonomyCategorySchema.safeParse(input);
          expect(result.success).toBe(false);

          if (!result.success) {
            expect(result.error.issues.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 3.1**
   * Optional fields (description, icon, sdgNumbers) can be omitted.
   */
  it('optional fields can be omitted without affecting validation', () => {
    fc.assert(
      fc.property(
        shortValidId,
        validName,
        validPrimaryMetricLabel,
        (id, name, primaryMetricLabel) => {
          // Minimal valid input — only required fields
          const input = { id, name, primaryMetricLabel };
          const result = TaxonomyCategorySchema.safeParse(input);
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 3.1**
   * Description must not exceed 500 characters.
   */
  it('description exceeding 500 characters is rejected', () => {
    const longDescription = 'A'.repeat(501);
    const input = {
      id: 'energy-saving',
      name: 'Energy Saving',
      primaryMetricLabel: 'kWh Saved',
      description: longDescription,
    };
    const result = TaxonomyCategorySchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  /**
   * **Validates: Requirements 3.2, 3.3**
   * Duplicate IDs are rejected by the uniqueness check.
   * Simulates the Cloud Function's duplicate detection logic:
   * given a set of existing category IDs, a new category with a duplicate ID is rejected.
   */
  it('duplicate IDs are rejected by uniqueness check simulation', () => {
    /**
     * Simulates the taxonomy_create uniqueness logic:
     * checks if the ID already exists in the "database" (a Set of existing IDs).
     */
    function simulateCreateCategory(
      existingIds: Set<string>,
      input: unknown
    ): { success: true; id: string } | { success: false; error: { code: string; message: string; fields?: Record<string, string> } } {
      // Step 1: Schema validation
      const parseResult = TaxonomyCategorySchema.safeParse(input);
      if (!parseResult.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parseResult.error.issues) {
          const path = issue.path.join('.');
          fieldErrors[path] = issue.message;
        }
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Input validation failed.',
            fields: fieldErrors,
          },
        };
      }

      // Step 2: Uniqueness check
      if (existingIds.has(parseResult.data.id)) {
        return {
          success: false,
          error: {
            code: 'ALREADY_EXISTS',
            message: `A taxonomy category with ID '${parseResult.data.id}' already exists.`,
          },
        };
      }

      return { success: true, id: parseResult.data.id };
    }

    fc.assert(
      fc.property(
        // Generate a list of unique valid IDs to simulate existing categories
        fc.array(shortValidId, { minLength: 1, maxLength: 6 }),
        validName,
        validPrimaryMetricLabel,
        (existingIdList, name, primaryMetricLabel) => {
          const existingIds = new Set(existingIdList);

          // Pick one existing ID to use as a duplicate
          const duplicateId = existingIdList[0];

          // Attempt to create a category with a duplicate ID — should be rejected
          const duplicateResult = simulateCreateCategory(existingIds, {
            id: duplicateId,
            name,
            primaryMetricLabel,
          });
          expect(duplicateResult.success).toBe(false);
          if (!duplicateResult.success) {
            expect(duplicateResult.error.code).toBe('ALREADY_EXISTS');
          }

          // Attempt to create a category with a unique ID — should succeed
          const uniqueId = 'unique-test-id';
          // Only test if uniqueId is not already in the set
          if (!existingIds.has(uniqueId)) {
            const uniqueResult = simulateCreateCategory(existingIds, {
              id: uniqueId,
              name,
              primaryMetricLabel,
            });
            expect(uniqueResult.success).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 3.1, 3.3**
   * When both schema validation and uniqueness fail, schema errors take precedence.
   */
  it('schema validation errors take precedence over uniqueness check', () => {
    function simulateCreateCategory(
      existingIds: Set<string>,
      input: unknown
    ): { success: true; id: string } | { success: false; error: { code: string; fields?: Record<string, string> } } {
      const parseResult = TaxonomyCategorySchema.safeParse(input);
      if (!parseResult.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parseResult.error.issues) {
          const path = issue.path.join('.');
          fieldErrors[path] = issue.message;
        }
        return {
          success: false,
          error: { code: 'VALIDATION_ERROR', fields: fieldErrors },
        };
      }
      if (existingIds.has(parseResult.data.id)) {
        return { success: false, error: { code: 'ALREADY_EXISTS' } };
      }
      return { success: true, id: parseResult.data.id };
    }

    fc.assert(
      fc.property(
        invalidId,
        invalidName,
        validPrimaryMetricLabel,
        (id, name, primaryMetricLabel) => {
          const existingIds = new Set([id]); // ID is "existing"
          const result = simulateCreateCategory(existingIds, {
            id,
            name,
            primaryMetricLabel,
          });
          // Schema validation should fail first (before uniqueness check)
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.code).toBe('VALIDATION_ERROR');
            expect(result.error.fields).toBeDefined();
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
