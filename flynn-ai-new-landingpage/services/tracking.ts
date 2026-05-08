/**
 * Tracking helpers — UTM capture + Meta/TikTok/GA conversion events.
 *
 * Pixels are loaded from index.html. This file provides a typed wrapper so we
 * can fire conversion events from React without `as any` casts everywhere.
 */

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    ttq?: { track: (event: string, params?: Record<string, unknown>) => void };
    gtag?: (...args: unknown[]) => void;
    posthog?: { capture: (event: string, properties?: Record<string, unknown>) => void };
  }
}

export interface AttributionPayload {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  referrer?: string;
  landing_page?: string;
}

const UTM_KEYS: Array<keyof AttributionPayload> = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
];

/**
 * Reads UTM params from URL on first visit, stores in sessionStorage so we keep
 * attribution if the user navigates around before signing up.
 */
export function captureUTMs(): AttributionPayload {
  if (typeof window === 'undefined') return {};

  const stored = sessionStorage.getItem('flynn_attribution');
  if (stored) {
    try {
      return JSON.parse(stored) as AttributionPayload;
    } catch {
      // fall through and re-capture
    }
  }

  const params = new URLSearchParams(window.location.search);
  const attribution: AttributionPayload = {};
  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) attribution[key] = value;
  }
  attribution.referrer = document.referrer || undefined;
  attribution.landing_page = window.location.pathname;

  sessionStorage.setItem('flynn_attribution', JSON.stringify(attribution));
  return attribution;
}

/** Fire conversion events to all configured pixels. */
export function trackTrialSignup(params: { email: string; businessType: string }): void {
  // Meta Pixel — Lead event. Trial signup = top-of-funnel lead, NOT a Purchase.
  // The actual Purchase event fires from inside the iOS app via FBSDK.
  window.fbq?.('track', 'Lead', {
    content_name: 'trial_signup',
    content_category: params.businessType,
  });

  // TikTok Pixel — SubmitForm event.
  window.ttq?.track('SubmitForm', {
    content_id: 'trial_signup',
    content_type: params.businessType,
  });

  // GA4 — already fires from Trial.tsx but we centralise here too for consistency.
  window.gtag?.('event', 'trial_signup', {
    business_type: params.businessType,
  });

  // PostHog — funnel analytics.
  window.posthog?.capture('trial_signup_submitted', {
    business_type: params.businessType,
  });
}

/** Track when a user clicks the App Store / Google Play badge — high-intent event. */
export function trackStoreBadgeClick(store: 'apple' | 'google'): void {
  const event = store === 'apple' ? 'click_app_store' : 'click_google_play';
  window.fbq?.('trackCustom', 'AppStoreClick', { store });
  window.ttq?.track('ClickButton', { content_id: store });
  window.gtag?.('event', event);
  window.posthog?.capture(event);
}
