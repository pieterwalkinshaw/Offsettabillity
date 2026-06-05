'use client';

import { useState, useCallback, FormEvent } from 'react';
import { getUtmParams } from '@/lib/hooks/useUtmCapture';
import type { LeadType } from '@shared/types';

export interface LeadCaptureFormProps {
  /** The type of lead being captured */
  leadType: LeadType;
  /** Optional heading displayed above the form */
  heading?: string;
  /** Optional description text below the heading */
  description?: string;
  /** Optional callback on successful submission */
  onSuccess?: () => void;
  /** Optional additional CSS classes */
  className?: string;
  /** Whether to show the name field */
  showName?: boolean;
  /** Whether to show the company field */
  showCompany?: boolean;
  /** Whether to show the phone field */
  showPhone?: boolean;
  /** Whether to show the message field */
  showMessage?: boolean;
  /** Custom submit button text */
  submitLabel?: string;
  /** Additional fields rendered before the consent checkbox */
  children?: React.ReactNode;
}

interface FormErrors {
  email?: string;
  name?: string;
  company?: string;
  phone?: string;
  message?: string;
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * LeadCaptureForm — Reusable lead capture component.
 *
 * Features:
 * - Hidden honeypot field ("website") to detect bots
 * - Consent checkbox (unchecked by default) with privacy policy link
 * - UTM parameter attachment from sessionStorage
 * - Submits to /api/leads endpoint
 * - Configurable fields via props
 */
export function LeadCaptureForm({
  leadType,
  heading,
  description,
  onSuccess,
  className = '',
  showName = false,
  showCompany = false,
  showPhone = false,
  showMessage = false,
  submitLabel = 'Get Started',
  children,
}: LeadCaptureFormProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!email.trim()) {
      newErrors.email = 'Email is required.';
    } else if (!isValidEmail(email.trim())) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (showName && name.trim().length > 100) {
      newErrors.name = 'Name must be 100 characters or fewer.';
    }

    if (showCompany && company.trim().length > 200) {
      newErrors.company = 'Company must be 200 characters or fewer.';
    }

    if (showPhone && phone.trim().length > 20) {
      newErrors.phone = 'Phone must be 20 characters or fewer.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [email, name, company, phone, showName, showCompany, showPhone]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();

      if (!validate()) return;

      setSubmitting(true);
      setSubmitError(null);

      try {
        const utm = getUtmParams();

        const payload: Record<string, unknown> = {
          email: email.trim(),
          type: leadType,
          source: typeof window !== 'undefined' ? window.location.href : '',
          marketingConsent: consent,
          utm: {
            source: utm?.source ?? undefined,
            medium: utm?.medium ?? undefined,
            campaign: utm?.campaign ?? undefined,
            content: utm?.content ?? undefined,
            term: utm?.term ?? undefined,
          },
          // Honeypot field — if filled, backend silently discards
          website: honeypot,
        };

        if (showName && name.trim()) payload.name = name.trim();
        if (showCompany && company.trim()) payload.company = company.trim();
        if (showPhone && phone.trim()) payload.phone = phone.trim();
        if (showMessage && message.trim()) payload.message = message.trim();

        const response = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error?.message || 'Submission failed. Please try again.');
        }

        setSubmitted(true);
        onSuccess?.();
      } catch (err) {
        setSubmitError(
          err instanceof Error ? err.message : 'Something went wrong. Please try again.'
        );
      } finally {
        setSubmitting(false);
      }
    },
    [
      email,
      name,
      company,
      phone,
      message,
      honeypot,
      consent,
      leadType,
      showName,
      showCompany,
      showPhone,
      showMessage,
      validate,
      onSuccess,
    ]
  );

  if (submitted) {
    return (
      <div className={`rounded-xl bg-primary-50 border border-primary-200 p-6 text-center ${className}`}>
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-100 mb-3">
          <svg
            className="w-6 h-6 text-primary-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-1">Thank you!</h3>
        <p className="text-foreground/60 text-sm">
          We&apos;ll be in touch within 24 hours.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`flex flex-col gap-4 ${className}`}
      noValidate
    >
      {heading && (
        <h3 className="text-xl font-bold text-foreground">{heading}</h3>
      )}
      {description && (
        <p className="text-sm text-foreground/60">{description}</p>
      )}

      {/* Honeypot field — hidden from real users, bots fill it */}
      <div className="absolute -left-[9999px] opacity-0 h-0 w-0 overflow-hidden" aria-hidden="true">
        <label htmlFor="lead-website">Website</label>
        <input
          id="lead-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      {/* Email — always shown */}
      <div>
        <label htmlFor="lead-email" className="block text-sm font-medium text-foreground mb-1">
          Email <span className="text-red-500">*</span>
        </label>
        <input
          id="lead-email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
          }}
          placeholder="you@company.co.za"
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          aria-describedby={errors.email ? 'lead-email-error' : undefined}
          aria-invalid={!!errors.email}
          required
        />
        {errors.email && (
          <p id="lead-email-error" className="mt-1 text-sm text-red-600" role="alert" aria-live="polite">
            {errors.email}
          </p>
        )}
      </div>

      {/* Name */}
      {showName && (
        <div>
          <label htmlFor="lead-name" className="block text-sm font-medium text-foreground mb-1">
            Full Name
          </label>
          <input
            id="lead-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            placeholder="Jane Doe"
            maxLength={100}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            aria-describedby={errors.name ? 'lead-name-error' : undefined}
            aria-invalid={!!errors.name}
          />
          {errors.name && (
            <p id="lead-name-error" className="mt-1 text-sm text-red-600" role="alert" aria-live="polite">
              {errors.name}
            </p>
          )}
        </div>
      )}

      {/* Company */}
      {showCompany && (
        <div>
          <label htmlFor="lead-company" className="block text-sm font-medium text-foreground mb-1">
            Company
          </label>
          <input
            id="lead-company"
            type="text"
            value={company}
            onChange={(e) => {
              setCompany(e.target.value);
              if (errors.company) setErrors((prev) => ({ ...prev, company: undefined }));
            }}
            placeholder="Acme Corp"
            maxLength={200}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            aria-describedby={errors.company ? 'lead-company-error' : undefined}
            aria-invalid={!!errors.company}
          />
          {errors.company && (
            <p id="lead-company-error" className="mt-1 text-sm text-red-600" role="alert" aria-live="polite">
              {errors.company}
            </p>
          )}
        </div>
      )}

      {/* Phone */}
      {showPhone && (
        <div>
          <label htmlFor="lead-phone" className="block text-sm font-medium text-foreground mb-1">
            Phone
          </label>
          <input
            id="lead-phone"
            type="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
            }}
            placeholder="+27 12 345 6789"
            maxLength={20}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            aria-describedby={errors.phone ? 'lead-phone-error' : undefined}
            aria-invalid={!!errors.phone}
          />
          {errors.phone && (
            <p id="lead-phone-error" className="mt-1 text-sm text-red-600" role="alert" aria-live="polite">
              {errors.phone}
            </p>
          )}
        </div>
      )}

      {/* Message */}
      {showMessage && (
        <div>
          <label htmlFor="lead-message" className="block text-sm font-medium text-foreground mb-1">
            Message
          </label>
          <textarea
            id="lead-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell us about your ESG goals..."
            rows={4}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-y"
          />
        </div>
      )}

      {/* Additional fields from parent */}
      {children}

      {/* Consent checkbox — unchecked by default */}
      <div className="flex items-start gap-3">
        <input
          id="lead-consent"
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
        <label htmlFor="lead-consent" className="text-sm text-foreground/70">
          I agree to receive marketing communications from Offsettable.{' '}
          <a
            href="/privacy"
            className="text-primary-600 underline hover:text-primary-700"
            target="_blank"
            rel="noopener noreferrer"
          >
            Privacy Policy
          </a>
        </label>
      </div>

      {/* Submit error */}
      {submitError && (
        <p className="text-sm text-red-600" role="alert" aria-live="polite">
          {submitError}
        </p>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-primary-600 px-6 py-3 text-white font-semibold hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? 'Submitting...' : submitLabel}
      </button>
    </form>
  );
}
