/**
 * flynnai.app Cloudflare Worker.
 *
 * The site is a static SPA served from ./dist, but two path families must be
 * proxied through to the Flynn backend on Fly instead of falling through to
 * the SPA's index.html:
 *
 *   /i/*  hosted invoice pages (+ /i/<token>/og.png, /i/<token>/email)
 *   /p/*  the short alias for the same pages
 *
 * Without this, flynnai.app/i/<token> silently returns the marketing page —
 * which is what was happening — so every invoice link Flynn sent had to use the
 * raw flynnai-telephony.fly.dev hostname. A client receiving a bill from a
 * hosting subdomain is a real trust problem, hence routing them onto the brand
 * domain here.
 */

const BACKEND = 'https://flynnai-telephony.fly.dev';
const PROXY_PREFIXES = ['/i/', '/p/'];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (PROXY_PREFIXES.some((p) => url.pathname.startsWith(p))) {
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
