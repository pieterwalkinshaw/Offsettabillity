'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { href: '/projects', label: 'Projects' },
  { href: '/categories', label: 'Categories' },
  { href: '/about', label: 'About' },
] as const;

/**
 * Header — Sticky site header with primary CTA visible without scrolling.
 *
 * Features:
 * - position: sticky top-0 (always visible)
 * - Logo/brand link
 * - Navigation links (Projects, Categories, About)
 * - Primary CTA button ("Speak to an Advisor")
 * - Mobile hamburger menu
 * - Mobile-responsive
 */
export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMenu = useCallback(() => {
    setMobileMenuOpen((prev) => !prev);
  }, []);

  const closeMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo / Brand */}
          <Link
            href="/"
            className="flex items-center gap-2 text-xl font-bold text-primary-700 hover:text-primary-800 transition-colors"
            onClick={closeMenu}
          >
            <svg
              className="h-8 w-8 text-primary-600"
              viewBox="0 0 32 32"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2.5" />
              <path
                d="M10 16l4 4 8-8"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Offsettabillity</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8" aria-label="Main navigation">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-foreground/70 hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-foreground/70 hover:text-foreground transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/contact"
              className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
            >
              Speak to an Advisor
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            onClick={toggleMenu}
            className="md:hidden inline-flex items-center justify-center rounded-lg p-2 text-foreground/70 hover:bg-gray-100 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" aria-hidden="true" />
            ) : (
              <Menu className="h-6 w-6" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div
          id="mobile-menu"
          className="md:hidden border-t border-gray-200 bg-white animate-fade-in"
        >
          <nav className="flex flex-col px-4 py-4 gap-1" aria-label="Mobile navigation">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeMenu}
                className="rounded-lg px-4 py-3 text-base font-medium text-foreground/80 hover:bg-gray-50 hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={closeMenu}
              className="rounded-lg px-4 py-3 text-base font-medium text-foreground/80 hover:bg-gray-50 hover:text-foreground transition-colors"
            >
              Log in
            </Link>
            <div className="mt-3 px-4">
              <Link
                href="/contact"
                onClick={closeMenu}
                className="block w-full rounded-lg bg-primary-600 px-5 py-3 text-center text-base font-semibold text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
              >
                Speak to an Advisor
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
