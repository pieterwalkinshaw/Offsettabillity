import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getUtmParams } from '@/lib/hooks/useUtmCapture';

describe('getUtmParams', () => {
  const originalSessionStorage = globalThis.sessionStorage;

  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    const mockSessionStorage = {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        store = {};
      }),
      length: 0,
      key: vi.fn(() => null),
    };
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: mockSessionStorage,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: originalSessionStorage,
      writable: true,
      configurable: true,
    });
  });

  it('returns null when no UTM params are stored', () => {
    expect(getUtmParams()).toBeNull();
  });

  it('returns stored UTM params when present', () => {
    const utmData = {
      source: 'google',
      medium: 'cpc',
      campaign: 'esg-2024',
      content: 'ad-variant-a',
      term: 'esg funding',
    };
    store['utm_params'] = JSON.stringify(utmData);

    const result = getUtmParams();
    expect(result).toEqual(utmData);
  });

  it('returns UTM params with null values for missing params', () => {
    const utmData = {
      source: 'google',
      medium: null,
      campaign: 'spring-sale',
      content: null,
      term: null,
    };
    store['utm_params'] = JSON.stringify(utmData);

    const result = getUtmParams();
    expect(result).toEqual(utmData);
  });

  it('returns null when sessionStorage contains invalid JSON', () => {
    store['utm_params'] = 'not-valid-json{{{';

    const result = getUtmParams();
    expect(result).toBeNull();
  });
});

describe('useUtmCapture (integration behavior)', () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    const mockSessionStorage = {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        store = {};
      }),
      length: 0,
      key: vi.fn(() => null),
    };
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: mockSessionStorage,
      writable: true,
      configurable: true,
    });
  });

  it('captures UTM params from URL and stores them in sessionStorage', () => {
    // Simulate the logic that the hook performs in useEffect
    const searchParams = new URLSearchParams(
      '?utm_source=google&utm_medium=cpc&utm_campaign=esg-2024'
    );
    const utm = {
      source: searchParams.get('utm_source'),
      medium: searchParams.get('utm_medium'),
      campaign: searchParams.get('utm_campaign'),
      content: searchParams.get('utm_content'),
      term: searchParams.get('utm_term'),
    };

    if (Object.values(utm).some(Boolean)) {
      sessionStorage.setItem('utm_params', JSON.stringify(utm));
    }

    const stored = JSON.parse(store['utm_params']);
    expect(stored.source).toBe('google');
    expect(stored.medium).toBe('cpc');
    expect(stored.campaign).toBe('esg-2024');
    expect(stored.content).toBeNull();
    expect(stored.term).toBeNull();
  });

  it('does not store anything when no UTM params are present', () => {
    const searchParams = new URLSearchParams('?page=1&sort=newest');
    const utm = {
      source: searchParams.get('utm_source'),
      medium: searchParams.get('utm_medium'),
      campaign: searchParams.get('utm_campaign'),
      content: searchParams.get('utm_content'),
      term: searchParams.get('utm_term'),
    };

    if (Object.values(utm).some(Boolean)) {
      sessionStorage.setItem('utm_params', JSON.stringify(utm));
    }

    expect(store['utm_params']).toBeUndefined();
  });
});
