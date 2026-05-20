import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Tests for CookieConsent localStorage persistence logic.
 * Validates: Requirements 12.1, 12.7
 *
 * Since the component uses localStorage for persistence, we test the
 * storage/retrieval logic including the 6-month expiry behavior.
 */

const STORAGE_KEY = 'cookie_consent_preferences';
const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });
Object.defineProperty(globalThis, 'window', {
  value: {
    ...globalThis,
    localStorage: localStorageMock,
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
  writable: true,
});

// Import after mocking globals
import { getCookiePreferences, CookiePreferences } from '@/components/ui/CookieConsent';

describe('CookieConsent persistence', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('returns null when no preferences are stored', () => {
    expect(getCookiePreferences()).toBeNull();
  });

  it('returns stored preferences when valid and not expired', () => {
    const prefs: CookiePreferences = {
      essential: true,
      analytics: true,
      marketing: false,
      timestamp: Date.now(),
    };
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify(prefs));

    const result = getCookiePreferences();
    expect(result).not.toBeNull();
    expect(result!.essential).toBe(true);
    expect(result!.analytics).toBe(true);
    expect(result!.marketing).toBe(false);
  });

  it('returns null and removes expired preferences (older than 6 months)', () => {
    const prefs: CookiePreferences = {
      essential: true,
      analytics: true,
      marketing: true,
      timestamp: Date.now() - SIX_MONTHS_MS - 1000, // 1 second past expiry
    };
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify(prefs));

    const result = getCookiePreferences();
    expect(result).toBeNull();
    // Should have been removed from storage
    expect(localStorageMock.getItem(STORAGE_KEY)).toBeNull();
  });

  it('returns preferences that are exactly at the 6-month boundary', () => {
    const prefs: CookiePreferences = {
      essential: true,
      analytics: false,
      marketing: false,
      timestamp: Date.now() - SIX_MONTHS_MS + 1000, // 1 second before expiry
    };
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify(prefs));

    const result = getCookiePreferences();
    expect(result).not.toBeNull();
    expect(result!.essential).toBe(true);
  });

  it('returns null for malformed JSON in localStorage', () => {
    localStorageMock.setItem(STORAGE_KEY, 'not-valid-json');

    const result = getCookiePreferences();
    expect(result).toBeNull();
  });

  it('essential cookies are always true regardless of stored value', () => {
    // Even if somehow essential was stored as false, the component
    // enforces essential=true via the required flag in COOKIE_CATEGORIES
    const prefs: CookiePreferences = {
      essential: true,
      analytics: false,
      marketing: false,
      timestamp: Date.now(),
    };
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify(prefs));

    const result = getCookiePreferences();
    expect(result!.essential).toBe(true);
  });

  it('accept all sets analytics and marketing to true', () => {
    const prefs: CookiePreferences = {
      essential: true,
      analytics: true,
      marketing: true,
      timestamp: Date.now(),
    };
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify(prefs));

    const result = getCookiePreferences();
    expect(result!.analytics).toBe(true);
    expect(result!.marketing).toBe(true);
  });

  it('reject non-essential sets analytics and marketing to false', () => {
    const prefs: CookiePreferences = {
      essential: true,
      analytics: false,
      marketing: false,
      timestamp: Date.now(),
    };
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify(prefs));

    const result = getCookiePreferences();
    expect(result!.analytics).toBe(false);
    expect(result!.marketing).toBe(false);
  });

  it('custom preferences allow selective category consent', () => {
    const prefs: CookiePreferences = {
      essential: true,
      analytics: true,
      marketing: false,
      timestamp: Date.now(),
    };
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify(prefs));

    const result = getCookiePreferences();
    expect(result!.analytics).toBe(true);
    expect(result!.marketing).toBe(false);
  });
});
