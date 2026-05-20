'use client';

import { useState, useCallback } from 'react';
import { allocate, AllocationResult, INDUSTRIES } from '@/lib/calculator/allocate';
import { getUtmParams } from '@/lib/hooks/useUtmCapture';

type CalculatorStep = 'input' | 'results' | 'email';

interface ValidationErrors {
  industry?: string;
  budget?: string;
  email?: string;
}

/**
 * Validate email format (basic RFC 5322-compatible check).
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Format a number as ZAR currency string.
 */
function formatZAR(amount: number): string {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/**
 * ESG Calculator Widget
 *
 * Interactive calculator that:
 * 1. Accepts industry selection and budget input
 * 2. Displays allocation results within 1 second (no personal info required)
 * 3. Gates detailed report behind email input
 * 4. Captures lead of type "calculator" on email submission
 *
 * Mobile-responsive: single-column layout below 640px.
 */
export function ESGCalculator() {
  const [step, setStep] = useState<CalculatorStep>('input');
  const [industry, setIndustry] = useState('');
  const [budgetInput, setBudgetInput] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [result, setResult] = useState<AllocationResult | null>(null);
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [leadError, setLeadError] = useState<string | null>(null);

  const validateInputs = useCallback((): boolean => {
    const newErrors: ValidationErrors = {};

    if (!industry) {
      newErrors.industry = 'Please select an industry.';
    }

    const budgetNum = Number(budgetInput.replace(/[^0-9]/g, ''));
    if (!budgetInput || isNaN(budgetNum) || budgetNum < 1) {
      newErrors.budget = 'Please enter a budget of at least R1.';
    } else if (budgetNum > 999_999_999) {
      newErrors.budget = 'Budget cannot exceed R999,999,999.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [industry, budgetInput]);

  const handleCalculate = useCallback(() => {
    if (!validateInputs()) return;

    const budgetNum = Number(budgetInput.replace(/[^0-9]/g, ''));
    const allocation = allocate({ industry, budget: budgetNum });
    setResult(allocation);
    setStep('results');
  }, [industry, budgetInput, validateInputs]);

  const handleGetReport = useCallback(() => {
    setStep('email');
    setErrors({});
  }, []);

  const handleEmailSubmit = useCallback(async () => {
    if (!email || !isValidEmail(email)) {
      setErrors({ email: 'Please enter a valid email address.' });
      return;
    }

    setErrors({});
    setLeadSubmitting(true);
    setLeadError(null);

    try {
      const utm = getUtmParams();
      const budgetNum = Number(budgetInput.replace(/[^0-9]/g, ''));

      const leadPayload = {
        email,
        type: 'calculator' as const,
        source: typeof window !== 'undefined' ? window.location.href : '',
        industry,
        budget: budgetNum,
        marketingConsent: false,
        utm: {
          source: utm?.source ?? undefined,
          medium: utm?.medium ?? undefined,
          campaign: utm?.campaign ?? undefined,
          content: utm?.content ?? undefined,
          term: utm?.term ?? undefined,
        },
      };

      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadPayload),
      });

      if (!response.ok) {
        throw new Error('Failed to submit');
      }

      setLeadSubmitted(true);
    } catch {
      setLeadError('Something went wrong. Please try again.');
    } finally {
      setLeadSubmitting(false);
    }
  }, [email, industry, budgetInput]);

  const handleReset = useCallback(() => {
    setStep('input');
    setIndustry('');
    setBudgetInput('');
    setEmail('');
    setErrors({});
    setResult(null);
    setLeadSubmitted(false);
    setLeadError(null);
  }, []);

  return (
    <section
      className="w-full max-w-2xl mx-auto rounded-2xl border border-primary-200 bg-white p-6 sm:p-8 shadow-lg"
      aria-labelledby="esg-calculator-heading"
    >
      <h2
        id="esg-calculator-heading"
        className="text-2xl sm:text-3xl font-bold text-foreground mb-2"
      >
        ESG Impact Calculator
      </h2>
      <p className="text-foreground/60 mb-6 text-sm sm:text-base">
        Discover how to allocate your ESG budget across verified impact categories.
      </p>

      {step === 'input' && (
        <div className="flex flex-col gap-4">
          {/* Industry Selection */}
          <div>
            <label
              htmlFor="esg-industry"
              className="block text-sm font-medium text-foreground mb-1"
            >
              Industry
            </label>
            <select
              id="esg-industry"
              value={industry}
              onChange={(e) => {
                setIndustry(e.target.value);
                if (errors.industry) setErrors((prev) => ({ ...prev, industry: undefined }));
              }}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              aria-describedby={errors.industry ? 'industry-error' : undefined}
              aria-invalid={!!errors.industry}
            >
              <option value="">Select your industry</option>
              {INDUSTRIES.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
            {errors.industry && (
              <p id="industry-error" className="mt-1 text-sm text-red-600" role="alert" aria-live="polite">
                {errors.industry}
              </p>
            )}
          </div>

          {/* Budget Input */}
          <div>
            <label
              htmlFor="esg-budget"
              className="block text-sm font-medium text-foreground mb-1"
            >
              Annual ESG Budget (ZAR)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/50 font-medium">
                R
              </span>
              <input
                id="esg-budget"
                type="text"
                inputMode="numeric"
                value={budgetInput}
                onChange={(e) => {
                  // Allow only digits and commas
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  setBudgetInput(raw);
                  if (errors.budget) setErrors((prev) => ({ ...prev, budget: undefined }));
                }}
                placeholder="500,000"
                className="w-full rounded-lg border border-gray-300 bg-white pl-8 pr-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                aria-describedby={errors.budget ? 'budget-error' : undefined}
                aria-invalid={!!errors.budget}
              />
            </div>
            {errors.budget && (
              <p id="budget-error" className="mt-1 text-sm text-red-600" role="alert" aria-live="polite">
                {errors.budget}
              </p>
            )}
          </div>

          {/* Calculate Button */}
          <button
            type="button"
            onClick={handleCalculate}
            className="w-full sm:w-auto sm:self-start mt-2 rounded-lg bg-primary-600 px-6 py-3 text-white font-semibold hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
          >
            Calculate My Impact Allocation
          </button>
        </div>
      )}

      {step === 'results' && result && (
        <div className="flex flex-col gap-5 animate-fade-in">
          {/* Total */}
          <div className="rounded-lg bg-primary-50 p-4 border border-primary-100">
            <p className="text-sm text-primary-700 font-medium">Recommended Annual ESG Spend</p>
            <p className="text-2xl sm:text-3xl font-bold text-primary-800">
              {formatZAR(result.total)}
            </p>
          </div>

          {/* Allocation Breakdown */}
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-3">
              Allocation Breakdown
            </h3>
            <ul className="space-y-2" aria-label="ESG allocation breakdown">
              {result.allocations.map((item) => (
                <li key={item.categoryId} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">
                        {item.categoryName}
                      </span>
                      <span className="text-sm text-foreground/60">
                        {item.percentage}%
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary-500 transition-all duration-500"
                        style={{ width: `${item.percentage}%` }}
                        role="progressbar"
                        aria-valuenow={item.percentage}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${item.categoryName}: ${item.percentage}%`}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-medium text-foreground/70 sm:w-28 sm:text-right">
                    {formatZAR(item.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <button
              type="button"
              onClick={handleGetReport}
              className="flex-1 rounded-lg bg-primary-600 px-6 py-3 text-white font-semibold hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
            >
              Get Detailed Report
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 rounded-lg border border-gray-300 px-6 py-3 text-foreground font-semibold hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
            >
              Recalculate
            </button>
          </div>
        </div>
      )}

      {step === 'email' && (
        <div className="flex flex-col gap-4 animate-fade-in">
          {!leadSubmitted ? (
            <>
              <p className="text-foreground/70 text-sm">
                Enter your email to receive a personalized ESG allocation report with detailed recommendations.
              </p>

              <div>
                <label
                  htmlFor="esg-email"
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  Email Address
                </label>
                <input
                  id="esg-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  placeholder="you@company.co.za"
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  aria-invalid={!!errors.email}
                />
                {errors.email && (
                  <p id="email-error" className="mt-1 text-sm text-red-600" role="alert" aria-live="polite">
                    {errors.email}
                  </p>
                )}
              </div>

              {leadError && (
                <p className="text-sm text-red-600" role="alert" aria-live="polite">
                  {leadError}
                </p>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleEmailSubmit}
                  disabled={leadSubmitting}
                  className="flex-1 rounded-lg bg-primary-600 px-6 py-3 text-white font-semibold hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {leadSubmitting ? 'Sending...' : 'Send My Report'}
                </button>
                <button
                  type="button"
                  onClick={() => setStep('results')}
                  className="flex-1 rounded-lg border border-gray-300 px-6 py-3 text-foreground font-semibold hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
                >
                  Back to Results
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-100 mb-3">
                <svg
                  className="w-6 h-6 text-primary-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">Report Requested</h3>
              <p className="text-foreground/60 text-sm">
                Your personalized ESG allocation report will be delivered to{' '}
                <strong>{email}</strong> within 24 hours.
              </p>
              <button
                type="button"
                onClick={handleReset}
                className="mt-4 rounded-lg border border-gray-300 px-6 py-2 text-foreground font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
              >
                Calculate Again
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
