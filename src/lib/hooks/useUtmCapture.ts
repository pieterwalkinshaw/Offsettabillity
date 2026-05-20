'use client';

import { useEffect } from 'react';

const UTM_STORAGE_KEY = 'utm_params';

export interface UtmParams {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
}

/**
 * Hook that captures UTM parameters from the current URL on landing
 * and persists them in sessionStorage for the browser session duration.
 *
 * Should be called once in a top-level layout or page component.
 */
export function useUtmCapture(): void {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const utm: UtmParams = {
      source: params.get('utm_source'),
      medium: params.get('utm_medium'),
      campaign: params.get('utm_campaign'),
      content: params.get('utm_content'),
      term: params.get('utm_term'),
    };

    // Only persist if at least one UTM param is present
    if (Object.values(utm).some(Boolean)) {
      sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm));
    }
  }, []);
}

/**
 * Retrieves stored UTM parameters from sessionStorage.
 * Returns the UTM params object if present, or null if no UTM data was captured.
 *
 * Use this in registration and lead capture forms to attach UTM attribution.
 */
export function getUtmParams(): UtmParams | null {
  if (typeof sessionStorage === 'undefined') {
    return null;
  }

  const stored = sessionStorage.getItem(UTM_STORAGE_KEY);
  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as UtmParams;
  } catch {
    return null;
  }
}
