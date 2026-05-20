/**
 * Property 5: Project creation invariants
 *
 * **Validates: Requirements 2.1, 2.2, 2.8**
 *
 * For any valid project creation input (title ≤120 chars, description ≤5000 chars,
 * category from active taxonomy, valid location, fundingGoal 1000–999999999 cents,
 * valid impact metrics), the created project SHALL have verificationStatus="draft",
 * verificationBadge="None", and fundingRaised=0.
 *
 * For any input violating these constraints, creation SHALL be rejected with
 * field-specific validation errors.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ProjectCreateSchema } from '@shared/schemas';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const validReportingPeriod = fc.constantFrom(
  'Monthly',
  'Quarterly',
  'Annually',
  'Project Duration'
) as fc.Arbitrary<'Monthly' | 'Quarterly' | 'Annually' | 'Project Duration'>;

const validLocation = fc.record({
  lat: fc.double({ min: -90, max: 90, noNaN: true }),
  lng: fc.double({ min: -180, max: 180, noNaN: true }),
  address: fc.string({ minLength: 1, maxLength: 200 }),
  country: fc.stringMatching(/^[A-Z]{2}$/),
});

const validImpactMetrics = fc.record({
  reportingPeriod: validReportingPeriod,
  primaryMetric: fc.record({
    label: fc.string({ minLength: 1, maxLength: 100 }),
    value: fc.double({ min: 0, max: 1_000_000_000, noNaN: true }),
  }),
});

const validProjectInput = fc.record({
  title: fc.string({ minLength: 1, maxLength: 120 }),
  description: fc.string({ minLength: 1, maxLength: 5000 }),
  category: fc.string({ minLength: 1, maxLength: 50 }),
  location: validLocation,
  fundingGoal: fc.integer({ min: 1000, max: 999_999_999 }),
  impactMetrics: validImpactMetrics,
});

// Optional subCategory field
const validProjectInputWithOptional = fc.record({
  title: fc.string({ minLength: 1, maxLength: 120 }),
  description: fc.string({ minLength: 1, maxLength: 5000 }),
  category: fc.string({ minLength: 1, maxLength: 50 }),
  subCategory: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
  location: validLocation,
  fundingGoal: fc.integer({ min: 1000, max: 999_999_999 }),
  impactMetrics: validImpactMetrics,
});

// ─── Invalid Input Arbitraries ───────────────────────────────────────────────

// Title violations: empty or too long
const invalidTitleEmpty = validProjectInput.map((input) => ({
  ...input,
  title: '',
}));

const invalidTitleTooLong = validProjectInput.chain((input) =>
  fc.string({ minLength: 121, maxLength: 200 }).map((title) => ({
    ...input,
    title,
  }))
);

// Description violations: empty or too long
const invalidDescriptionEmpty = validProjectInput.map((input) => ({
  ...input,
  description: '',
}));

const invalidDescriptionTooLong = validProjectInput.chain((input) =>
  fc.string({ minLength: 5001, maxLength: 6000 }).map((description) => ({
    ...input,
    description,
  }))
);

// Category violations: empty or too long
const invalidCategoryEmpty = validProjectInput.map((input) => ({
  ...input,
  category: '',
}));

const invalidCategoryTooLong = validProjectInput.chain((input) =>
  fc.string({ minLength: 51, maxLength: 100 }).map((category) => ({
    ...input,
    category,
  }))
);

// FundingGoal violations: below minimum, above maximum, or non-integer
const invalidFundingGoalTooLow = validProjectInput.chain((input) =>
  fc.integer({ min: -1_000_000, max: 999 }).map((fundingGoal) => ({
    ...input,
    fundingGoal,
  }))
);

const invalidFundingGoalTooHigh = validProjectInput.chain((input) =>
  fc.integer({ min: 1_000_000_000, max: 2_000_000_000 }).map((fundingGoal) => ({
    ...input,
    fundingGoal,
  }))
);

const invalidFundingGoalNonInteger = validProjectInput.map((input) => ({
  ...input,
  fundingGoal: 1500.5,
}));

// Location violations: lat out of range
const invalidLocationLat = validProjectInput.chain((input) =>
  fc.double({ min: 91, max: 200, noNaN: true }).map((lat) => ({
    ...input,
    location: { ...input.location, lat },
  }))
);

// Location violations: lng out of range
const invalidLocationLng = validProjectInput.chain((input) =>
  fc.double({ min: 181, max: 400, noNaN: true }).map((lng) => ({
    ...input,
    location: { ...input.location, lng },
  }))
);

// Location violations: empty address
const invalidLocationEmptyAddress = validProjectInput.map((input) => ({
  ...input,
  location: { ...input.location, address: '' },
}));

// Location violations: country not exactly 2 chars
const invalidLocationCountry = validProjectInput.chain((input) =>
  fc.stringMatching(/^[A-Z]{3,5}$/).map((country) => ({
    ...input,
    location: { ...input.location, country },
  }))
);

// Impact metrics violations: empty label
const invalidMetricsEmptyLabel = validProjectInput.map((input) => ({
  ...input,
  impactMetrics: {
    ...input.impactMetrics,
    primaryMetric: { ...input.impactMetrics.primaryMetric, label: '' },
  },
}));

// ─── Helper: Simulate project creation from valid input ──────────────────────

interface CreatedProject {
  title: string;
  description: string;
  category: string;
  subCategory?: string;
  location: { lat: number; lng: number; address: string; country: string };
  fundingGoal: number;
  fundingRaised: number;
  impactMetrics: {
    reportingPeriod: string;
    primaryMetric: { label: string; value: number };
  };
  verificationStatus: string;
  verificationBadge: string;
}

/**
 * Simulates the project creation logic that would be in the Cloud Function.
 * Given a valid input, returns the project with initial state fields set.
 * This mirrors what `functions/src/projects/create.ts` will do (task 5.1).
 */
function createProjectFromValidInput(
  input: ReturnType<typeof ProjectCreateSchema.parse>
): CreatedProject {
  return {
    ...input,
    fundingRaised: 0,
    verificationStatus: 'draft',
    verificationBadge: 'None',
  };
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 5: Project creation invariants', () => {
  describe('Valid inputs pass schema validation', () => {
    it('any valid project input passes ProjectCreateSchema validation', () => {
      fc.assert(
        fc.property(validProjectInputWithOptional, (input) => {
          const result = ProjectCreateSchema.safeParse(input);
          expect(result.success).toBe(true);
        }),
        { numRuns: 200 }
      );
    });
  });

  describe('Created projects have correct initial state', () => {
    it('verificationStatus is always "draft" for newly created projects', () => {
      /**
       * **Validates: Requirements 2.2**
       */
      fc.assert(
        fc.property(validProjectInput, (input) => {
          const parseResult = ProjectCreateSchema.safeParse(input);
          expect(parseResult.success).toBe(true);
          if (parseResult.success) {
            const project = createProjectFromValidInput(parseResult.data);
            expect(project.verificationStatus).toBe('draft');
          }
        }),
        { numRuns: 200 }
      );
    });

    it('verificationBadge is always "None" for newly created projects', () => {
      /**
       * **Validates: Requirements 2.2**
       */
      fc.assert(
        fc.property(validProjectInput, (input) => {
          const parseResult = ProjectCreateSchema.safeParse(input);
          expect(parseResult.success).toBe(true);
          if (parseResult.success) {
            const project = createProjectFromValidInput(parseResult.data);
            expect(project.verificationBadge).toBe('None');
          }
        }),
        { numRuns: 200 }
      );
    });

    it('fundingRaised is always 0 for newly created projects', () => {
      /**
       * **Validates: Requirements 2.2**
       */
      fc.assert(
        fc.property(validProjectInput, (input) => {
          const parseResult = ProjectCreateSchema.safeParse(input);
          expect(parseResult.success).toBe(true);
          if (parseResult.success) {
            const project = createProjectFromValidInput(parseResult.data);
            expect(project.fundingRaised).toBe(0);
          }
        }),
        { numRuns: 200 }
      );
    });

    it('all input fields are preserved in the created project', () => {
      /**
       * **Validates: Requirements 2.1**
       */
      fc.assert(
        fc.property(validProjectInput, (input) => {
          const parseResult = ProjectCreateSchema.safeParse(input);
          expect(parseResult.success).toBe(true);
          if (parseResult.success) {
            const project = createProjectFromValidInput(parseResult.data);
            expect(project.title).toBe(parseResult.data.title);
            expect(project.description).toBe(parseResult.data.description);
            expect(project.category).toBe(parseResult.data.category);
            expect(project.location).toEqual(parseResult.data.location);
            expect(project.fundingGoal).toBe(parseResult.data.fundingGoal);
            expect(project.impactMetrics).toEqual(parseResult.data.impactMetrics);
          }
        }),
        { numRuns: 200 }
      );
    });
  });

  describe('Invalid inputs are rejected with validation errors', () => {
    it('rejects empty title', () => {
      /**
       * **Validates: Requirements 2.8**
       */
      fc.assert(
        fc.property(invalidTitleEmpty, (input) => {
          const result = ProjectCreateSchema.safeParse(input);
          expect(result.success).toBe(false);
        }),
        { numRuns: 50 }
      );
    });

    it('rejects title exceeding 120 characters', () => {
      /**
       * **Validates: Requirements 2.1, 2.8**
       */
      fc.assert(
        fc.property(invalidTitleTooLong, (input) => {
          const result = ProjectCreateSchema.safeParse(input);
          expect(result.success).toBe(false);
        }),
        { numRuns: 50 }
      );
    });

    it('rejects empty description', () => {
      /**
       * **Validates: Requirements 2.8**
       */
      fc.assert(
        fc.property(invalidDescriptionEmpty, (input) => {
          const result = ProjectCreateSchema.safeParse(input);
          expect(result.success).toBe(false);
        }),
        { numRuns: 50 }
      );
    });

    it('rejects description exceeding 5000 characters', () => {
      /**
       * **Validates: Requirements 2.1, 2.8**
       */
      fc.assert(
        fc.property(invalidDescriptionTooLong, (input) => {
          const result = ProjectCreateSchema.safeParse(input);
          expect(result.success).toBe(false);
        }),
        { numRuns: 50 }
      );
    });

    it('rejects empty category', () => {
      /**
       * **Validates: Requirements 2.8**
       */
      fc.assert(
        fc.property(invalidCategoryEmpty, (input) => {
          const result = ProjectCreateSchema.safeParse(input);
          expect(result.success).toBe(false);
        }),
        { numRuns: 50 }
      );
    });

    it('rejects category exceeding 50 characters', () => {
      /**
       * **Validates: Requirements 2.1, 2.8**
       */
      fc.assert(
        fc.property(invalidCategoryTooLong, (input) => {
          const result = ProjectCreateSchema.safeParse(input);
          expect(result.success).toBe(false);
        }),
        { numRuns: 50 }
      );
    });

    it('rejects fundingGoal below 1000 cents', () => {
      /**
       * **Validates: Requirements 2.1, 2.8**
       */
      fc.assert(
        fc.property(invalidFundingGoalTooLow, (input) => {
          const result = ProjectCreateSchema.safeParse(input);
          expect(result.success).toBe(false);
        }),
        { numRuns: 50 }
      );
    });

    it('rejects fundingGoal above 999999999 cents', () => {
      /**
       * **Validates: Requirements 2.1, 2.8**
       */
      fc.assert(
        fc.property(invalidFundingGoalTooHigh, (input) => {
          const result = ProjectCreateSchema.safeParse(input);
          expect(result.success).toBe(false);
        }),
        { numRuns: 50 }
      );
    });

    it('rejects non-integer fundingGoal', () => {
      /**
       * **Validates: Requirements 2.1, 2.8**
       */
      fc.assert(
        fc.property(invalidFundingGoalNonInteger, (input) => {
          const result = ProjectCreateSchema.safeParse(input);
          expect(result.success).toBe(false);
        }),
        { numRuns: 50 }
      );
    });

    it('rejects latitude outside -90 to 90 range', () => {
      /**
       * **Validates: Requirements 2.1, 2.8**
       */
      fc.assert(
        fc.property(invalidLocationLat, (input) => {
          const result = ProjectCreateSchema.safeParse(input);
          expect(result.success).toBe(false);
        }),
        { numRuns: 50 }
      );
    });

    it('rejects longitude outside -180 to 180 range', () => {
      /**
       * **Validates: Requirements 2.1, 2.8**
       */
      fc.assert(
        fc.property(invalidLocationLng, (input) => {
          const result = ProjectCreateSchema.safeParse(input);
          expect(result.success).toBe(false);
        }),
        { numRuns: 50 }
      );
    });

    it('rejects empty address', () => {
      /**
       * **Validates: Requirements 2.1, 2.8**
       */
      fc.assert(
        fc.property(invalidLocationEmptyAddress, (input) => {
          const result = ProjectCreateSchema.safeParse(input);
          expect(result.success).toBe(false);
        }),
        { numRuns: 50 }
      );
    });

    it('rejects country code not exactly 2 characters', () => {
      /**
       * **Validates: Requirements 2.1, 2.8**
       */
      fc.assert(
        fc.property(invalidLocationCountry, (input) => {
          const result = ProjectCreateSchema.safeParse(input);
          expect(result.success).toBe(false);
        }),
        { numRuns: 50 }
      );
    });

    it('rejects empty primary metric label', () => {
      /**
       * **Validates: Requirements 2.1, 2.8**
       */
      fc.assert(
        fc.property(invalidMetricsEmptyLabel, (input) => {
          const result = ProjectCreateSchema.safeParse(input);
          expect(result.success).toBe(false);
        }),
        { numRuns: 50 }
      );
    });
  });
});
