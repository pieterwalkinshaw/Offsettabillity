'use client';

import { useState, useCallback, FormEvent } from 'react';
import Link from 'next/link';
import { getUtmParams } from '@/lib/hooks/useUtmCapture';
import { ShieldCheck, Award, BarChart3 } from 'lucide-react';

const QUICK_LINKS = [
  { href: '/projects', label: 'Browse Projects' },
  { href: '/categories', label: 'Categories' },
  { href: '/about', label: 'About Us' },
  { href: '/contact', label: 'Contact' },
] as const;

const LEGAL_LINKS = [
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Service' },
] as const;

/**
 * Footer — Site footer with newsletter signup, trust badges, and quick links.
 *
 * Features:
 * - Newsletter signup form (email input + submit)
 * - Trust badges section (verified projects, auditor network, impact tracked)
 * - Quick links
 * - Copyright
 * - Mobile-responsive
 */
export function Footer() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleNewsletterSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setEmailError(null);

      const trimmed = email.trim();
      if (!trimmed) {
        setEmailError('Email is required.');
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmed)) {
        setEmailError('Please enter a valid email address.');
        return;
      }

      setSubmitting(true);

      try {
        const utm = getUtmParams();

        const payload = {
          email: trimmed,
          type: 'newsletter' as const,
          source: typeof window !== 'undefined' ? window.location.href : '',
          marketingConsent: true,
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
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error('Failed to subscribe');
        }

        setSubmitted(true);
      } catch {
        setEmailError('Something went wrong. Please try again.');
      } finally {
        setSubmitting(false);
      }
    },
    [email]
  );

  return (
    <footer className="w-full border-t border-gray-200 bg-gray-50">
      {/* Trust Badges */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 border-b border-gray-200">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          <div className="flex flex-col items-center gap-2">
            <ShieldCheck className="h-8 w-8 text-primary-600" aria-hidden="true" />
            <p className="text-lg font-bold text-foreground">Independently Verified</p>
            <p className="text-sm text-foreground/60">
              Every project audited by qualified professionals
            </p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Award className="h-8 w-8 text-primary-600" aria-hidden="true" />
            <p className="text-lg font-bold text-foreground">Audit-Ready Reports</p>
            <p className="text-sm text-foreground/60">
              B-BBEE and ESP compliant documentation
            </p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary-600" aria-hidden="true" />
            <p className="text-lg font-bold text-foreground">Measurable Impact</p>
            <p className="text-sm text-foreground/60">
              Transparent metrics aligned to UN SDGs
            </p>
          </div>
        </div>
      </div>

      {/* Main Footer Content */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Newsletter Signup */}
          <div className="md:col-span-2">
            <h3 className="text-lg font-bold text-foreground mb-2">
              Stay Updated
            </h3>
            <p className="text-sm text-foreground/60 mb-4">
              Get the latest verified impact projects and ESG insights delivered to your inbox.
            </p>

            {!submitted ? (
              <form
                onSubmit={handleNewsletterSubmit}
                className="flex flex-col sm:flex-row gap-3"
                noValidate
              >
                <div className="flex-1">
                  <label htmlFor="footer-newsletter-email" className="sr-only">
                    Email address
                  </label>
                  <input
                    id="footer-newsletter-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError(null);
                    }}
                    placeholder="you@company.co.za"
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    aria-describedby={emailError ? 'footer-email-error' : undefined}
                    aria-invalid={!!emailError}
                  />
                  {emailError && (
                    <p
                      id="footer-email-error"
                      className="mt-1 text-sm text-red-600"
                      role="alert"
                      aria-live="polite"
                    >
                      {emailError}
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-primary-600 px-6 py-3 text-white font-semibold hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {submitting ? 'Subscribing...' : 'Subscribe'}
                </button>
              </form>
            ) : (
              <p className="text-sm text-primary-700 font-medium">
                ✓ You&apos;re subscribed! Check your inbox for updates.
              </p>
            )}
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-bold text-foreground mb-3">Quick Links</h3>
            <nav aria-label="Footer navigation">
              <ul className="space-y-2">
                {QUICK_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-foreground/70 hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-200 bg-gray-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-foreground/50">
            © {new Date().getFullYear()} Offsettabillity. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs text-foreground/50 hover:text-foreground/70 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
