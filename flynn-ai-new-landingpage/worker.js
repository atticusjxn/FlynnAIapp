/**
 * flynnai.app Cloudflare Worker.
 *
 * The site is a static SPA served from ./dist, but some path families must be
 * proxied through to the Flynn backend on Fly instead of falling through to
 * the SPA's index.html:
 *
 *   /i/*    hosted invoice pages (+ /i/<token>/og.png, /i/<token>/email)
 *   /p/*    the short alias for the same pages
 *   /ops*   the private ops dashboard (balances + funnel), passphrase-gated
 *           server-side — the Worker just proxies it, it doesn't gate anything
 *   /api/integrations/*  OAuth connect + callback endpoints
 *
 * Without this, flynnai.app/i/<token> silently returns the marketing page —
 * which is what was happening — so every invoice link Flynn sent had to use the
 * raw flynnai-telephony.fly.dev hostname. A client receiving a bill from a
 * hosting subdomain is a real trust problem, hence routing them onto the brand
 * domain here.
 *
 * The OAuth prefix exists for a harder reason than trust. Google will only
 * verify an app whose authorised domain and redirect URI are on a domain you
 * can prove you own, and fly.dev belongs to Fly.io — so while the Google
 * Calendar redirect URI points at flynnai-telephony.fly.dev, verification is
 * not merely unfinished, it is impossible, and the consent screen is stuck
 * showing "flynnai-telephony.fly.dev" with an unverified-app warning. Proxying
 * the callback here lets the redirect URI move to flynnai.app.
 */

const BACKEND = 'https://flynnai-telephony.fly.dev';
const PROXY_PREFIXES = ['/i/', '/p/', '/ops', '/api/integrations/'];

function isProxied(pathname) {
  return PROXY_PREFIXES.some((p) => pathname === p || pathname.startsWith(p.endsWith('/') ? p : `${p}/`));
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (isProxied(url.pathname)) {
      const target = new URL(url.pathname + url.search, BACKEND);
      const proxied = new Request(target, request);
      // Let the origin know the brand host so it can build absolute links
      // (og:image, the emailed link) on flynnai.app rather than the Fly host.
      proxied.headers.set('X-Forwarded-Host', url.host);
      proxied.headers.set('X-Forwarded-Proto', 'https');
      return fetch(proxied);
    }

    // Everything else: the static SPA.
    return env.ASSETS.fetch(request);
  },
};
