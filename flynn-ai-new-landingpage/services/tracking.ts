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

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || 'https://flynnai-telephony.fly.dev';

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : undefined;
}

/** Meta browser identifiers, with fbc synthesised from fbclid when the cookie isn't set yet. */
function metaIds(): { fbp?: string; fbc?: string; fbclid?: string } {
  const fbp = readCookie('_fbp');
  let fbc = readCookie('_fbc');
  const fbclid = new URLSearchParams(window.location.search).get('fbclid') || undefined;
  if (!fbc && fbclid) fbc = `fb.1.${Math.floor(Date.now() / 1000)}.${fbclid}`;
  return { fbp, fbc, fbclid };
}

function randomId(len: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const a = new Uint8Array(len);
  window.crypto.getRandomValues(a);
  let s = '';
  for (let i = 0; i < len; i++) s += chars[a[i] % chars.length];
  return s;
}

/**
 * The conversion the ads optimise on. Fires the Meta Pixel MessagedFlynn event
 * (full browser attribution) AND beacons the server so CAPI mirrors it with the
 * same event_id (deduped, survives iOS / ad-blockers). Returns a short ref to
 * embed in the pre-filled iMessage body so the later Activated event attributes
 * back to this click. Call synchronously on the tap, before navigating to the
 * sms: link.
 */
export function trackMessagedFlynn(): string {
  const ref = randomId(6);
  const eventId = window.crypto?.randomUUID?.() || `${Date.now()}-${ref}`;
  const ids = metaIds();

  // 1. Browser Pixel event (shares eventId with the server mirror for dedup).
  window.fbq?.('trackCustom', 'MessagedFlynn', { ref }, { eventID: eventId });
  window.ttq?.track('Contact', { content_id: 'message_flynn' });
  window.gtag?.('event', 'message_flynn');
  window.posthog?.capture('message_flynn_tapped', { ref });

  // 2. Server beacon → CAPI mirror + attribution bridge. sendBeacon survives the
  // page unload as iMessage opens; text/plain keeps it a CORS-simple request.
  try {
    const payload = JSON.stringify({
      ref,
      event_id: eventId,
      event_source_url: window.location.href,
      ...ids,
      utm: captureUTMs(),
    });
    const url = `${API_BASE_URL}/api/track/messaged`;
    const blob = new Blob([payload], { type: 'text/plain' });
    if (!(navigator.sendBeacon && navigator.sendBeacon(url, blob))) {
      fetch(url, { method: 'POST', body: payload, headers: { 'Content-Type': 'text/plain' }, keepalive: true }).catch(() => {});
    }
  } catch {
    // tracking must never block the tap
  }

  return ref;
}

/** Track when a user clicks the App Store / Google Play badge — high-intent event. */
export function trackStoreBadgeClick(store: 'apple' | 'google'): void {
  const event = store === 'apple' ? 'click_app_store' : 'click_google_play';
  window.fbq?.('trackCustom', 'AppStoreClick', { store });
  window.ttq?.track('ClickButton', { content_id: store });
  window.gtag?.('event', event);
  window.posthog?.capture(event);
}
