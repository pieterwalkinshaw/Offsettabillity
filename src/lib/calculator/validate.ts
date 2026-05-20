/**
 * Calculator Input Validation
 *
 * Pure validation function for ESG calculator inputs.
 * Returns validation errors or success, ensuring invalid inputs
 * never produce an allocation result.
 */

import { INDUSTRIES } from './allocate';

export interface CalculatorValidationErrors {
  industry?: string;
  budget?: string;
}

export interface CalculatorValidationResult {
  valid: boolean;
  errors: CalculatorValidationErrors;
}

/**
 * Validate calculator inputs.
 *
 * Rules:
 * - Industry must be a non-empty string matching one of the predefined INDUSTRIES
 * - Budget must be a number in the range 1–999,999,999 (inclusive)
 *
 * @param industry - The selected industry string
 * @param budget - The budget value in ZAR
 * @returns Validation result with errors (if any) and a valid flag
 */
export function validateCalculatorInput(
  industry: string,
  budget: number
): CalculatorValidationResult {
  const errors: CalculatorValidationErrors = {};

  // Validate industry: must be non-empty and from the predefined list
  if (!industry || !INDUSTRIES.includes(industry as (typeof INDUSTRIES)[number])) {
    errors.industry = 'Please select an industry.';
  }

  // Validate budget: must be in range R1–R999,999,999
  if (budget < 1) {
    errors.budget = 'Please enter a budget of at least R1.';
  } else if (budget > 999_999_999) {
    errors.budget = 'Budget cannot exceed R999,999,999.';
  } else if (!Number.isFinite(budget) || isNaN(budget)) {
    errors.budget = 'Please enter a valid budget amount.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
