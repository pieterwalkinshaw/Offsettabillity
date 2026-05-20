'use client';

import { useState, useEffect, useCallback } from 'react';
import { Cookie, X, Settings } from 'lucide-react';

/**
 * Cookie categories and their descriptions.
 */
const COOKIE_CATEGORIES = {
  essential: {
    label: 'Essential',
    description: 'Required for the platform to function. Cannot be disabled.',
    required: true,
  },
  analytics: {
    label: 'Analytics',
    description: 'Help us understand how visitors interact with the platform.',
    required: false,
  },
  marketing: {
    label: 'Marketing',
    description: 'Used to deliver relevant ads and track campaign performance.',
    required: false,
  },
} as const;

type CookieCategory = keyof typeof COOKIE_CATEGORIES;

export interface CookiePreferences {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: number;
}

const STORAGE_KEY = 'cookie_consent_preferences';
/** 6 months in milliseconds */
const CONSENT_EXPIRY_MS = 6 * 30 * 24 * 60 * 60 * 1000;

/**
 * Reads stored cookie preferences from localStorage.
 * Returns null if no preferences exist or if they have expired.
 */
function getStoredPreferences(): CookiePreferences | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const preferences: CookiePreferences = JSON.parse(stored);
    const now = Date.now();

    // Check if preferences have expired (6 months)
    if (now - preferences.timestamp > CONSENT_EXPIRY_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return preferences;
  } catch {
    return null;
  }
}

/**
 * Persists cookie preferences to localStorage with a timestamp.
 */
function storePreferences(preferences: CookiePreferences): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}

/**
 * CookieConsent — Banner displayed on first visit requiring explicit consent
 * before activating analytics or marketing cookies.
 *
 * Features:
 * - Accept all / Reject non-essential / Customize options
 * - Essential cookies always allowed (no consent needed)
 * - Analytics and marketing cookies blocked until consent given
 * - Preferences persisted in localStorage for minimum 6 months
 * - Accessible: keyboard navigable, ARIA labels, focus management
 * - Mobile-responsive fixed bottom banner
 *
 * Validates: Requirements 12.1, 12.7
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true,
    analytics: false,
    marketing: false,
    timestamp: 0,
  });

  useEffect(() => {
    const stored = getStoredPreferences();
    if (!stored) {
      setVisible(true);
    }
  }, []);

  const saveAndClose = useCallback((prefs: CookiePreferences) => {
    const withTimestamp: CookiePreferences = {
      ...prefs,
      timestamp: Date.now(),
    };
    storePreferences(withTimestamp);
    setVisible(false);
    setShowCustomize(false);

    // Dispatch a custom event so other parts of the app can react to consent changes
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('cookie-consent-updated', { detail: withTimestamp })
      );
    }
  }, []);

  const handleAcceptAll = useCallback(() => {
    saveAndClose({
      essential: true,
      analytics: true,
      marketing: true,
      timestamp: 0,
    });
  }, [saveAndClose]);

  const handleRejectNonEssential = useCallback(() => {
    saveAndClose({
      essential: true,
      analytics: false,
      marketing: false,
      timestamp: 0,
    });
  }, [saveAndClose]);

  const handleSaveCustom = useCallback(() => {
    saveAndClose(preferences);
  }, [saveAndClose, preferences]);

  const toggleCategory = useCallback((category: CookieCategory) => {
    if (COOKIE_CATEGORIES[category].required) return;
    setPreferences((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  }, []);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie consent"
      aria-describedby="cookie-consent-description"
      className="fixed inset-x-0 bottom-0 z-[100] animate-slide-up"
    >
      <div className="mx-auto max-w-4xl px-4 pb-4 sm:px-6">
        <div className="rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
          {/* Main banner */}
          <div className="p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <Cookie
                className="mt-0.5 h-5 w-5 shrink-0 text-primary-600"
                aria-hidden="true"
              />
              <div className="flex-1">
                <h2 className="text-base font-semibold text-foreground">
                  Cookie Preferences
                </h2>
                <p
                  id="cookie-consent-description"
                  className="mt-1 text-sm text-foreground/70"
                >
                  We use cookies to ensure essential platform functionality and, with your
                  consent, to analyse usage and deliver relevant content. You can accept
                  all, reject non-essential cookies, or customise your preferences.
                </p>
              </div>
            </div>

            {/* Customize panel */}
            {showCustomize && (
              <div className="mt-4 space-y-3 border-t border-gray-100 pt-4 dark:border-gray-800">
                {(Object.keys(COOKIE_CATEGORIES) as CookieCategory[]).map(
                  (category) => {
                    const config = COOKIE_CATEGORIES[category];
                    const isChecked = config.required || preferences[category];

                    return (
                      <label
                        key={category}
                        className="flex items-start gap-3 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={config.required}
                          onChange={() => toggleCategory(category)}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:opacity-60 disabled:cursor-not-allowed"
                          aria-label={`${config.label} cookies`}
                        />
                        <div>
                          <span className="text-sm font-medium text-foreground">
                            {config.label}
                            {config.required && (
                              <span className="ml-1.5 text-xs font-normal text-foreground/50">
                                (Always active)
                              </span>
                            )}
                          </span>
                          <p className="text-xs text-foreground/60">
                            {config.description}
                          </p>
                        </div>
                      </label>
                    );
                  }
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
              {!showCustomize ? (
                <button
                  type="button"
                  onClick={() => setShowCustomize(true)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-foreground/80 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors dark:border-gray-600 dark:hover:bg-gray-800"
                >
                  <Settings className="h-4 w-4" aria-hidden="true" />
                  Customise
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveCustom}
                  className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-foreground/80 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors dark:border-gray-600 dark:hover:bg-gray-800"
                >
                  Save Preferences
                </button>
              )}
              <button
                type="button"
                onClick={handleRejectNonEssential}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-foreground/80 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors dark:border-gray-600 dark:hover:bg-gray-800"
              >
                Reject Non-Essential
              </button>
              <button
                type="button"
                onClick={handleAcceptAll}
                className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-5 py-2 text-sm font-semibold text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
              >
                Accept All
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Utility hook to check if a specific cookie category has been consented to.
 * Returns false if no consent has been given yet.
 */
export function useCookieConsent(category: CookieCategory): boolean {
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    const checkConsent = () => {
      const stored = getStoredPreferences();
      if (!stored) {
        setConsented(category === 'essential');
        return;
      }
      setConsented(stored[category]);
    };

    checkConsent();

    // Listen for consent updates
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<CookiePreferences>).detail;
      setConsented(detail[category]);
    };

    window.addEventListener('cookie-consent-updated', handler);
    return () => window.removeEventListener('cookie-consent-updated', handler);
  }, [category]);

  return consented;
}

/**
 * Utility to get current cookie preferences (for use outside React components).
 * Returns null if no consent has been given.
 */
export function getCookiePreferences(): CookiePreferences | null {
  return getStoredPreferences();
}
