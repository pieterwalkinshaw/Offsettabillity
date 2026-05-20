/**
 * Property Test: Verification badge determination (Property 11)
 *
 * Validates: Requirements 4.4, 4.5, 4.6
 *
 * For any project with a set of completed audits, the verification badge SHALL be
 * determined as follows: if the project has 3+ completed audits with "approve"
 * recommendation and a verification score > 95, the badge is "Premium Assured";
 * else if 2+ completed audits and score > 85, the badge is "Verified+"; else if
 * 1+ completed audit with "approve" recommendation, the badge is "Verified";
 * otherwise the badge is "None".
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { determineBadge } from '../../src/lib/verification/badge';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate a verification score between 0 and 100 */
const scoreArb = fc.integer({ min: 0, max: 100 });

/** Generate a completed audit count between 0 and 10 */
const auditCountArb = fc.integer({ min: 0, max: 10 });

/** Generate a score strictly greater than 95 (96-100) */
const premiumScore = fc.integer({ min: 96, max: 100 });

/** Generate a score strictly greater than 85 but not greater than 95 (86-95) */
const verifiedPlusOnlyScore = fc.integer({ min: 86, max: 95 });

/** Generate a score strictly greater than 85 (86-100) */
const aboveVerifiedPlusThreshold = fc.integer({ min: 86, max: 100 });

/** Generate a score at or below 85 (0-85) */
const belowVerifiedPlusThreshold = fc.integer({ min: 0, max: 85 });

/** Generate a score at or below 95 (0-95) */
const belowPremiumThreshold = fc.integer({ min: 0, max: 95 });

/** Generate audit count of 3 or more (3-10) */
const threeOrMoreAudits = fc.integer({ min: 3, max: 10 });

/** Generate audit count of exactly 2 */
const exactlyTwoAudits = fc.constant(2);

/** Generate audit count of 2 or more (2-10) */
const twoOrMoreAudits = fc.integer({ min: 2, max: 10 });

/** Generate audit count of exactly 1 */
const exactlyOneAudit = fc.constant(1);

/** Generate audit count of 1 or more (1-10) */
const oneOrMoreAudits = fc.integer({ min: 1, max: 10 });

/** Generate audit count of 0 */
const zeroAudits = fc.constant(0);

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 11: Verification badge determination', () => {
  /**
   * **Validates: Requirements 4.6**
   * 3+ audits AND score > 95 → "Premium Assured"
   */
  it('assigns "Premium Assured" when 3+ completed audits and score > 95', () => {
    fc.assert(
      fc.property(premiumScore, threeOrMoreAudits, (score, audits) => {
        const badge = determineBadge(score, audits);
        expect(badge).toBe('Premium Assured');
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 4.5**
   * 2+ audits AND score > 85 (but not qualifying for Premium Assured) → "Verified+"
   */
  it('assigns "Verified+" when 2+ audits and score > 85 but not Premium Assured', () => {
    fc.assert(
      fc.property(
        verifiedPlusOnlyScore,
        twoOrMoreAudits,
        (score, audits) => {
          // When score is 86-95, even with 3+ audits it won't be Premium Assured
          const badge = determineBadge(score, audits);
          expect(badge).toBe('Verified+');
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 4.5**
   * Exactly 2 audits AND score > 85 → "Verified+" (cannot be Premium since < 3 audits)
   */
  it('assigns "Verified+" when exactly 2 audits and score > 85', () => {
    fc.assert(
      fc.property(aboveVerifiedPlusThreshold, exactlyTwoAudits, (score, audits) => {
        const badge = determineBadge(score, audits);
        expect(badge).toBe('Verified+');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 4.4**
   * 1+ audits but not qualifying for Verified+ or Premium → "Verified"
   */
  it('assigns "Verified" when 1+ audits but score ≤ 85', () => {
    fc.assert(
      fc.property(belowVerifiedPlusThreshold, oneOrMoreAudits, (score, audits) => {
        const badge = determineBadge(score, audits);
        expect(badge).toBe('Verified');
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 4.4**
   * Exactly 1 audit with any score → "Verified" (cannot be Verified+ since < 2 audits)
   */
  it('assigns "Verified" when exactly 1 audit regardless of score', () => {
    fc.assert(
      fc.property(scoreArb, exactlyOneAudit, (score, audits) => {
        const badge = determineBadge(score, audits);
        expect(badge).toBe('Verified');
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 4.4, 4.5, 4.6**
   * 0 audits → "None" regardless of score
   */
  it('assigns "None" when 0 completed audits regardless of score', () => {
    fc.assert(
      fc.property(scoreArb, zeroAudits, (score, audits) => {
        const badge = determineBadge(score, audits);
        expect(badge).toBe('None');
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 4.6**
   * Boundary test: score=95 with 3 audits → "Verified+" (not Premium, since > 95 required)
   */
  it('boundary: score exactly 95 with 3+ audits is "Verified+" not "Premium Assured"', () => {
    fc.assert(
      fc.property(threeOrMoreAudits, (audits) => {
        const badge = determineBadge(95, audits);
        // Score must be STRICTLY greater than 95 for Premium Assured
        expect(badge).not.toBe('Premium Assured');
        expect(badge).toBe('Verified+');
      }),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 4.5**
   * Boundary test: score=85 with 2+ audits → "Verified" (not Verified+, since > 85 required)
   */
  it('boundary: score exactly 85 with 2+ audits is "Verified" not "Verified+"', () => {
    fc.assert(
      fc.property(twoOrMoreAudits, (audits) => {
        const badge = determineBadge(85, audits);
        // Score must be STRICTLY greater than 85 for Verified+
        expect(badge).not.toBe('Verified+');
        expect(badge).toBe('Verified');
      }),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 4.4, 4.5, 4.6**
   * The badge function is deterministic: same inputs always produce same output.
   */
  it('badge determination is deterministic', () => {
    fc.assert(
      fc.property(scoreArb, auditCountArb, (score, audits) => {
        const badge1 = determineBadge(score, audits);
        const badge2 = determineBadge(score, audits);
        expect(badge1).toBe(badge2);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 4.4, 4.5, 4.6**
   * The badge is always one of the four valid values.
   */
  it('badge is always a valid VerificationBadge value', () => {
    fc.assert(
      fc.property(scoreArb, auditCountArb, (score, audits) => {
        const badge = determineBadge(score, audits);
        expect(['None', 'Verified', 'Verified+', 'Premium Assured']).toContain(badge);
      }),
      { numRuns: 500 }
    );
  });

  /**
   * **Validates: Requirements 4.4, 4.5, 4.6**
   * Badge tiers are monotonically non-decreasing with more audits and higher scores.
   * Adding more audits or increasing the score should never downgrade the badge.
   */
  it('badge never downgrades when audits increase (score held constant)', () => {
    const badgeRank = { 'None': 0, 'Verified': 1, 'Verified+': 2, 'Premium Assured': 3 };

    fc.assert(
      fc.property(scoreArb, auditCountArb, (score, audits) => {
        const currentBadge = determineBadge(score, audits);
        const nextBadge = determineBadge(score, audits + 1);
        expect(badgeRank[nextBadge]).toBeGreaterThanOrEqual(badgeRank[currentBadge]);
      }),
      { numRuns: 300 }
    );
  });

  /**
   * **Validates: Requirements 4.4, 4.5, 4.6**
   * Badge never downgrades when score increases (audits held constant).
   */
  it('badge never downgrades when score increases (audits held constant)', () => {
    const badgeRank = { 'None': 0, 'Verified': 1, 'Verified+': 2, 'Premium Assured': 3 };

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99 }),
        auditCountArb,
        (score, audits) => {
          const currentBadge = determineBadge(score, audits);
          const higherScoreBadge = determineBadge(score + 1, audits);
          expect(badgeRank[higherScoreBadge]).toBeGreaterThanOrEqual(badgeRank[currentBadge]);
        }
      ),
      { numRuns: 300 }
    );
  });
});
