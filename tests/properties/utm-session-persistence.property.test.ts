/**
 * Property Test: UTM session persistence and attachment (Property 32)
 *
 * Validates: Requirements 10.4
 *
 * For any visitor arriving with UTM parameters in the URL, those parameters SHALL
 * be persisted for the browser session duration and attached to any subsequent
 * lead capture or registration event within that session.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';

// ─── Constants (mirrors useUtmCapture.ts) ────────────────────────────────────

const UTM_STORAGE_KEY = 'utm_params';

// ─── UTM Capture & Retrieval Logic (extracted from useUtmCapture.ts) ─────────

interface UtmParams {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
}

/**
 * Simulates the UTM capture logic from useUtmCapture hook's useEffect.
 * Parses UTM params from a URL search string and persists to sessionStorage.
 */
function captureUtmFromUrl(searchString: string, storage: Storage): void {
  const params = new URLSearchParams(searchString);
  const utm: UtmParams = {
    source: params.get('utm_source'),
    medium: params.get('utm_medium'),
    campaign: params.get('utm_campaign'),
    content: params.get('utm_content'),
    term: params.get('utm_term'),
  };

  // Only persist if at least one UTM param is present
  if (Object.values(utm).some(Boolean)) {
    storage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm));
  }
}

/**
 * Simulates the getUtmParams retrieval logic from useUtmCapture.ts.
 * Returns stored UTM params or null if none captured.
 */
function retrieveUtmParams(storage: Storage): UtmParams | null {
  const stored = storage.getItem(UTM_STORAGE_KEY);
  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as UtmParams;
  } catch {
    return null;
  }
}

/**
 * Simulates attaching UTM params to a lead capture or registration event.
 * This mirrors how lead forms and registration call getUtmParams() and include
 * the result in the submission payload.
 */
function attachUtmToEvent(
  eventData: Record<string, unknown>,
  storage: Storage
): Record<string, unknown> {
  const utm = retrieveUtmParams(storage);
  if (utm) {
    return { ...eventData, utm };
  }
  return { ...eventData, utm: null };
}

// ─── Mock SessionStorage ─────────────────────────────────────────────────────

function createMockStorage(): Storage & { store: Record<string, string> } {
  const store: Record<string, string> = {};
  return {
    store,
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: (_index: number) => null,
  };
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate a non-empty UTM parameter value */
const utmValue = fc.stringMatching(/^[a-z0-9][a-z0-9_-]{0,49}$/).filter(s => s.length >= 1);

/** Generate a full set of UTM parameters (all 5 present) */
const fullUtmParams = fc.record({
  source: utmValue,
  medium: utmValue,
  campaign: utmValue,
  content: utmValue,
  term: utmValue,
});

/** Generate a partial set of UTM parameters (at least one present) */
const partialUtmParams = fc.record({
  source: fc.option(utmValue, { nil: undefined }),
  medium: fc.option(utmValue, { nil: undefined }),
  campaign: fc.option(utmValue, { nil: undefined }),
  content: fc.option(utmValue, { nil: undefined }),
  term: fc.option(utmValue, { nil: undefined }),
}).filter(params => Object.values(params).some(v => v !== undefined));

/** Generate non-UTM query parameters (should not trigger storage) */
const nonUtmQueryParams = fc.record({
  page: fc.option(fc.nat({ max: 100 }).map(String), { nil: undefined }),
  sort: fc.option(fc.constantFrom('newest', 'oldest', 'popular'), { nil: undefined }),
  category: fc.option(fc.constantFrom('energy-saving', 'education', 'health'), { nil: undefined }),
  ref: fc.option(fc.stringMatching(/^[a-z0-9]{3,10}$/), { nil: undefined }),
}).filter(params => Object.values(params).some(v => v !== undefined));

/** Build a URL search string from UTM params */
function buildUtmSearchString(params: Partial<Record<string, string | undefined>>): string {
  const searchParams = new URLSearchParams();
  if (params.source) searchParams.set('utm_source', params.source);
  if (params.medium) searchParams.set('utm_medium', params.medium);
  if (params.campaign) searchParams.set('utm_campaign', params.campaign);
  if (params.content) searchParams.set('utm_content', params.content);
  if (params.term) searchParams.set('utm_term', params.term);
  return `?${searchParams.toString()}`;
}

/** Build a URL search string from non-UTM params */
function buildNonUtmSearchString(params: Partial<Record<string, string | undefined>>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) searchParams.set(key, value);
  });
  return `?${searchParams.toString()}`;
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 32: UTM session persistence and attachment', () => {
  /**
   * **Validates: Requirements 10.4**
   * UTM params from URL are persisted in sessionStorage.
   */
  it('UTM params from URL are persisted in sessionStorage', () => {
    fc.assert(
      fc.property(fullUtmParams, (utmParams) => {
        const storage = createMockStorage();
        const searchString = buildUtmSearchString(utmParams);

        captureUtmFromUrl(searchString, storage);

        // Verify something was stored
        expect(storage.store[UTM_STORAGE_KEY]).toBeDefined();

        // Verify stored data is valid JSON
        const stored = JSON.parse(storage.store[UTM_STORAGE_KEY]);
        expect(stored).toBeDefined();
        expect(stored.source).toBe(utmParams.source);
        expect(stored.medium).toBe(utmParams.medium);
        expect(stored.campaign).toBe(utmParams.campaign);
        expect(stored.content).toBe(utmParams.content);
        expect(stored.term).toBe(utmParams.term);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 10.4**
   * Persisted UTM params are retrievable for the session duration.
   */
  it('persisted UTM params are retrievable for the session duration', () => {
    fc.assert(
      fc.property(partialUtmParams, (utmParams) => {
        const storage = createMockStorage();
        const searchString = buildUtmSearchString(utmParams);

        // Capture on landing
        captureUtmFromUrl(searchString, storage);

        // Retrieve later in the session (simulates subsequent page navigation)
        const retrieved = retrieveUtmParams(storage);

        // Should be retrievable
        expect(retrieved).not.toBeNull();
        expect(retrieved).toBeDefined();
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 10.4**
   * Retrieved UTM params match the original URL params exactly.
   */
  it('retrieved UTM params match the original URL params exactly', () => {
    fc.assert(
      fc.property(partialUtmParams, (utmParams) => {
        const storage = createMockStorage();
        const searchString = buildUtmSearchString(utmParams);

        // Capture on landing
        captureUtmFromUrl(searchString, storage);

        // Retrieve later
        const retrieved = retrieveUtmParams(storage);
        expect(retrieved).not.toBeNull();

        // Each provided param should match exactly
        if (utmParams.source !== undefined) {
          expect(retrieved!.source).toBe(utmParams.source);
        } else {
          expect(retrieved!.source).toBeNull();
        }

        if (utmParams.medium !== undefined) {
          expect(retrieved!.medium).toBe(utmParams.medium);
        } else {
          expect(retrieved!.medium).toBeNull();
        }

        if (utmParams.campaign !== undefined) {
          expect(retrieved!.campaign).toBe(utmParams.campaign);
        } else {
          expect(retrieved!.campaign).toBeNull();
        }

        if (utmParams.content !== undefined) {
          expect(retrieved!.content).toBe(utmParams.content);
        } else {
          expect(retrieved!.content).toBeNull();
        }

        if (utmParams.term !== undefined) {
          expect(retrieved!.term).toBe(utmParams.term);
        } else {
          expect(retrieved!.term).toBeNull();
        }
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 10.4**
   * When no UTM params in URL, nothing is stored.
   */
  it('when no UTM params in URL, nothing is stored', () => {
    fc.assert(
      fc.property(nonUtmQueryParams, (queryParams) => {
        const storage = createMockStorage();
        const searchString = buildNonUtmSearchString(queryParams);

        captureUtmFromUrl(searchString, storage);

        // Nothing should be stored
        expect(storage.store[UTM_STORAGE_KEY]).toBeUndefined();

        // Retrieval should return null
        const retrieved = retrieveUtmParams(storage);
        expect(retrieved).toBeNull();
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 10.4**
   * UTM params are attached to subsequent lead capture events within the session.
   */
  it('UTM params are attached to subsequent lead capture events', () => {
    fc.assert(
      fc.property(fullUtmParams, (utmParams) => {
        const storage = createMockStorage();
        const searchString = buildUtmSearchString(utmParams);

        // Step 1: Visitor arrives with UTM params (landing)
        captureUtmFromUrl(searchString, storage);

        // Step 2: Later in the session, visitor submits a lead form
        const leadEventData = {
          email: 'test@example.com',
          type: 'consultation',
          source: 'https://offsettabillity.co.za/categories/energy-saving',
        };

        const eventWithUtm = attachUtmToEvent(leadEventData, storage);

        // UTM params should be attached to the event
        expect(eventWithUtm.utm).not.toBeNull();
        const attachedUtm = eventWithUtm.utm as UtmParams;
        expect(attachedUtm.source).toBe(utmParams.source);
        expect(attachedUtm.medium).toBe(utmParams.medium);
        expect(attachedUtm.campaign).toBe(utmParams.campaign);
        expect(attachedUtm.content).toBe(utmParams.content);
        expect(attachedUtm.term).toBe(utmParams.term);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 10.4**
   * UTM params are attached to subsequent registration events within the session.
   */
  it('UTM params are attached to subsequent registration events', () => {
    fc.assert(
      fc.property(partialUtmParams, (utmParams) => {
        const storage = createMockStorage();
        const searchString = buildUtmSearchString(utmParams);

        // Step 1: Visitor arrives with UTM params
        captureUtmFromUrl(searchString, storage);

        // Step 2: Visitor navigates and eventually registers
        const registrationData = {
          email: 'newuser@company.co.za',
          name: 'Test User',
          role: 'funder',
          country: 'ZA',
        };

        const eventWithUtm = attachUtmToEvent(registrationData, storage);

        // UTM params should be attached
        expect(eventWithUtm.utm).not.toBeNull();
        const attachedUtm = eventWithUtm.utm as UtmParams;

        // Verify each param matches what was in the URL
        if (utmParams.source !== undefined) {
          expect(attachedUtm.source).toBe(utmParams.source);
        } else {
          expect(attachedUtm.source).toBeNull();
        }

        if (utmParams.medium !== undefined) {
          expect(attachedUtm.medium).toBe(utmParams.medium);
        } else {
          expect(attachedUtm.medium).toBeNull();
        }

        if (utmParams.campaign !== undefined) {
          expect(attachedUtm.campaign).toBe(utmParams.campaign);
        } else {
          expect(attachedUtm.campaign).toBeNull();
        }

        if (utmParams.content !== undefined) {
          expect(attachedUtm.content).toBe(utmParams.content);
        } else {
          expect(attachedUtm.content).toBeNull();
        }

        if (utmParams.term !== undefined) {
          expect(attachedUtm.term).toBe(utmParams.term);
        } else {
          expect(attachedUtm.term).toBeNull();
        }
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 10.4**
   * When no UTM params were captured, events get null UTM attachment.
   */
  it('events without prior UTM capture get null UTM attachment', () => {
    fc.assert(
      fc.property(nonUtmQueryParams, (queryParams) => {
        const storage = createMockStorage();
        const searchString = buildNonUtmSearchString(queryParams);

        // Visitor arrives without UTM params
        captureUtmFromUrl(searchString, storage);

        // Later submits a lead form
        const leadEventData = {
          email: 'visitor@example.com',
          type: 'newsletter',
          source: 'https://offsettabillity.co.za/',
        };

        const eventWithUtm = attachUtmToEvent(leadEventData, storage);

        // UTM should be null since none were captured
        expect(eventWithUtm.utm).toBeNull();
      }),
      { numRuns: 200 }
    );
  });
});
