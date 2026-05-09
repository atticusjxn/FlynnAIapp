/**
 * Daily Instagram trade-business scraper.
 *
 * Discovers IG accounts of AU trade businesses (plumbers, sparkies, etc.)
 * using three strategies, then asks Claude Haiku to write a custom DM for
 * each one, and upserts into public.gtm_ig_trade_targets.
 *
 * Run: npm run scrape:ig-trades
 *
 * Strategies (in priority order, run until we hit MAX):
 *   A. IG hashtag search  — visit explore/tags/<trade><city>, scrape post authors
 *   B. Cold-leads website mining — for each gtm_cold_leads.website, regex IG link
 *   C. IG location/keyword search — fallback if A+B yield <MAX
 *
 * Then for each candidate handle:
 *   - GET https://www.instagram.com/<handle>/ → parse bio, follower count
 *   - Filter (50 < followers < 50000, bio mentions trade keyword)
 *   - Call Claude Haiku to render a personalised opener
 *   - Upsert with onConflict: handle, ignoreDuplicates: true
 */

import 'dotenv/config';
import { type Browser, type Page } from 'puppeteer';
import { supabase } from '../lib/gtm-supabase.js';
import { UA, launchBrowser, pickDailyCombo, sleep } from '../lib/scraper-helpers.js';

const MAX_PER_RUN = Number(process.env.IG_TRADE_MAX_PER_RUN ?? 15);
const MIN_FOLLOWERS = 100;
const MAX_FOLLOWERS = 2000;

// Bio signals that the business already has a receptionist / booking layer
// (i.e. Flynn isn't a useful pitch) — skip them.
const RECEPTIONIST_SIGNAL_REGEX =
  /calendly\.|vagaro\.|fresha\.|booksy\.|square\.site|squareup\.|simplybook\.|setmore\.|acuity|book(?:ing)?[\s.]*now|setup\.app|gloss\.genius/i;

const TRADE_KEYWORDS = [
  'plumb', 'electric', 'sparky', 'sparkie', 'tradie', 'builder', 'carpenter',
  'paint', 'roof', 'handyman', 'landscap', 'clean', 'mechanic', 'pest',
  'tree', 'aircon', 'air condition', 'hvac', 'tile', 'concret', 'brick',
  'gutter', 'fence', 'deck', 'reno', 'construct',
];

interface Candidate {
  handle: string;
  discoveredVia: 'hashtag' | 'website' | 'location_search';
  hintWebsite?: string;  // for B; persisted on the row
}

interface EnrichedTarget {
  handle: string;
  profileUrl: string;
  businessName: string;
  bio: string;
  followerCount: number;
  externalUrl: string;
  discoveredVia: 'hashtag' | 'website' | 'location_search';
  websiteHint?: string;
}

async function main() {
  const { trade, city } = pickDailyCombo();
  const cityShort = city.split(' ')[0]; // "Sydney" from "Sydney NSW"
  console.log(`[ig-trades] today's combo: ${trade} × ${city}`);
  console.log(`[ig-trades] target ${MAX_PER_RUN} new handles`);

  // Skip handles already in the DB so we don't waste Claude calls re-rendering.
  const { data: existing } = await supabase
    .from('gtm_ig_trade_targets')
    .select('handle');
  const seen = new Set((existing ?? []).map((r) => r.handle.toLowerCase()));
  console.log(`[ig-trades] ${seen.size} handles already in db`);

  const browser = await launchBrowser();
  const candidates: Candidate[] = [];

  try {
    // Strategy A: hashtag scrape
    const hashtagHandles = await scrapeHashtags(browser, trade, cityShort);
    for (const h of hashtagHandles) {
      if (!seen.has(h.toLowerCase())) candidates.push({ handle: h, discoveredVia: 'hashtag' });
    }
    console.log(`[ig-trades] strategy A (hashtag): +${hashtagHandles.length} candidates`);

    // Strategy B: pull IG handles from existing cold-lead websites
    if (candidates.length < MAX_PER_RUN) {
      const websiteHits = await mineColdLeadWebsites(browser);
      for (const wh of websiteHits) {
        if (!seen.has(wh.handle.toLowerCase()) && !candidates.some((c) => c.handle === wh.handle)) {
          candidates.push({ handle: wh.handle, discoveredVia: 'website', hintWebsite: wh.website });
        }
      }
      console.log(`[ig-trades] strategy B (website): +${websiteHits.length} candidates`);
    }

    // Strategy C: keyword search (logged-out IG; flaky but free)
    if (candidates.length < MAX_PER_RUN) {
      const searchHits = await scrapeKeywordSearch(browser, trade, cityShort);
      for (const h of searchHits) {
        if (!seen.has(h.toLowerCase()) && !candidates.some((c) => c.handle === h)) {
          candidates.push({ handle: h, discoveredVia: 'location_search' });
        }
      }
      console.log(`[ig-trades] strategy C (search): +${searchHits.length} candidates`);
    }

    console.log(`[ig-trades] total candidates: ${candidates.length}`);
    if (candidates.length === 0) {
      console.log('[ig-trades] nothing new today — IG may be blocking logged-out scraping');
      return;
    }

    // Enrich each candidate by visiting their profile
    const enriched: EnrichedTarget[] = [];
    for (const c of candidates) {
      if (enriched.length >= MAX_PER_RUN) break;
      const profile = await fetchProfile(browser, c.handle);
      if (!profile) continue;
      if (profile.followerCount < MIN_FOLLOWERS || profile.followerCount > MAX_FOLLOWERS) {
        console.log(`[ig-trades] skip @${c.handle}: ${profile.followerCount} followers (out of bounds)`);
        continue;
      }
      const bioLower = (profile.bio + ' ' + profile.businessName).toLowerCase();
      if (!TRADE_KEYWORDS.some((kw) => bioLower.includes(kw))) {
        console.log(`[ig-trades] skip @${c.handle}: bio doesn't mention a trade`);
        continue;
      }
      const externalAndBio = `${profile.bio} ${profile.externalUrl}`;
      if (RECEPTIONIST_SIGNAL_REGEX.test(externalAndBio)) {
        console.log(`[ig-trades] skip @${c.handle}: already has a booking/receptionist layer`);
        continue;
      }
      enriched.push({
        handle: c.handle,
        profileUrl: `https://instagram.com/${c.handle.replace(/^@/, '')}`,
        businessName: profile.businessName,
        bio: profile.bio,
        followerCount: profile.followerCount,
        externalUrl: profile.externalUrl,
        discoveredVia: c.discoveredVia,
        websiteHint: c.hintWebsite,
      });
      console.log(`[ig-trades] ✓ @${c.handle}: ${profile.followerCount} followers, ${profile.businessName.slice(0, 40)}`);
    }

    console.log(`[ig-trades] ${enriched.length} survived enrichment + filters`);

    // Upsert candidates without ai_message — the Claude Code routine fills
    // ai_message in-session (no API billing) after the scrape completes.
    let inserted = 0;
    for (const t of enriched) {
      const { error } = await supabase.from('gtm_ig_trade_targets').upsert(
        {
          handle: t.handle,
          profile_url: t.profileUrl,
          business_name: t.businessName || null,
          trade,
          city: cityShort,
          region: 'AU',
          bio: t.bio || null,
          follower_count: t.followerCount,
          website: t.externalUrl || t.websiteHint || null,
          discovered_via: t.discoveredVia,
          ai_message: null,
          ai_message_generated_at: null,
          ai_model: null,
        },
        { onConflict: 'handle', ignoreDuplicates: true },
      );
      if (error) {
        console.error(`[ig-trades] insert failed for @${t.handle}`, error);
        continue;
      }
      inserted++;
    }

    console.log(`[ig-trades] inserted ${inserted} new targets — ai_message left null for routine to fill in-session`);
  } finally {
    await browser.close();
  }
}

// ============== Strategy A: Hashtag scrape ==============

async function scrapeHashtags(browser: Browser, trade: string, cityShort: string): Promise<string[]> {
  const tags = buildHashtags(trade, cityShort);
  const handles = new Set<string>();

  for (const tag of tags) {
    if (handles.size >= MAX_PER_RUN * 2) break;
    const url = `https://www.instagram.com/explore/tags/${tag}/`;
    let page: Page | null = null;
    try {
      page = await browser.newPage();
      await page.setUserAgent(UA);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      await sleep(2500);

      // Logged-out IG often shows a login wall. Scrape any visible post links anyway.
      const postLinks = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')) as HTMLAnchorElement[];
        return anchors.map((a) => a.href).slice(0, 20);
      });
      console.log(`[hashtag] #${tag}: ${postLinks.length} post links`);

      for (const link of postLinks.slice(0, 8)) {
        if (handles.size >= MAX_PER_RUN * 2) break;
        const handle = await fetchPostAuthor(browser, link);
        if (handle) handles.add(handle);
      }
    } catch (err) {
      console.warn(`[hashtag] #${tag} failed`, (err as Error).message);
    } finally {
      if (page) await page.close().catch(() => {});
    }
  }

  return Array.from(handles);
}

function buildHashtags(trade: string, cityShort: string): string[] {
  const tradeSlug = trade.replace(/\s+/g, '');
  const citySlug = cityShort.toLowerCase();
  return [
    `${citySlug}${tradeSlug}`,            // sydneyplumber
    `${tradeSlug}${citySlug}`,            // plumbersydney
    `${citySlug}tradie`,                  // sydneytradie
    `${tradeSlug}australia`,              // plumberaustralia
    `australian${tradeSlug}`,             // australianplumber
  ];
}

async function fetchPostAuthor(browser: Browser, postUrl: string): Promise<string | null> {
  let page: Page | null = null;
  try {
    page = await browser.newPage();
    await page.setUserAgent(UA);
    await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 12_000 });
    await sleep(800);
    const handle = await page.evaluate(() => {
      // Look at og:url meta or the canonical author header
      const og = (document.querySelector('meta[property="og:url"]') as HTMLMetaElement | null)?.content || '';
      const m = og.match(/instagram\.com\/([a-zA-Z0-9._]+)\/(?:p|reel)/);
      if (m) return m[1];
      // Fallback: first profile-style anchor
      const a = Array.from(document.querySelectorAll('a[href^="/"]')).find((el) => {
        const h = (el as HTMLAnchorElement).getAttribute('href') || '';
        return /^\/[a-zA-Z0-9._]+\/$/.test(h);
      }) as HTMLAnchorElement | undefined;
      return a ? a.getAttribute('href')!.replace(/\//g, '') : null;
    });
    return handle && /^[a-zA-Z0-9._]+$/.test(handle) ? handle : null;
  } catch {
    return null;
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

// ============== Strategy B: Mine cold-lead websites ==============

async function mineColdLeadWebsites(browser: Browser): Promise<Array<{ handle: string; website: string }>> {
  // Pull cold leads we haven't yet checked for an IG link.
  const { data, error } = await supabase
    .from('gtm_cold_leads')
    .select('id, company, trade, city')
    .is('instagram_checked_at', null)
    .limit(40);

  if (error || !data || data.length === 0) {
    console.log('[website] no unchecked cold leads with websites');
    return [];
  }

  // We need the website too — fetch in a second select since the original
  // schema includes it; older clients may have cached the column list.
  const { data: full } = await supabase
    .from('gtm_cold_leads')
    .select('id, company, trade, city, email')
    .in('id', data.map((d) => d.id));
  if (!full) return [];

  // The original gtm_cold_leads doesn't store website — but the email's
  // domain often gives us the site. Try both.
  const hits: Array<{ handle: string; website: string }> = [];
  for (const lead of full) {
    if (hits.length >= MAX_PER_RUN) break;
    const candidateUrls = guessWebsitesFromEmail(lead.email);
    let foundHandle: string | null = null;
    let usedSite = '';
    for (const url of candidateUrls) {
      foundHandle = await extractIGFromWebsite(browser, url);
      if (foundHandle) { usedSite = url; break; }
    }
    // Mark as checked regardless of result so we don't re-visit
    await supabase
      .from('gtm_cold_leads')
      .update({
        instagram_checked_at: new Date().toISOString(),
        instagram_handle: foundHandle,
      })
      .eq('id', lead.id);
    if (foundHandle) hits.push({ handle: foundHandle, website: usedSite });
  }
  return hits;
}

function guessWebsitesFromEmail(email: string): string[] {
  const domain = email.split('@')[1];
  if (!domain) return [];
  const generic = ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'bigpond.com', 'optusnet.com.au', 'icloud.com', 'live.com'];
  if (generic.includes(domain.toLowerCase())) return [];
  return [`https://${domain}`, `https://www.${domain}`];
}

async function extractIGFromWebsite(browser: Browser, website: string): Promise<string | null> {
  let page: Page | null = null;
  try {
    page = await browser.newPage();
    await page.setUserAgent(UA);
    await page.goto(website, { waitUntil: 'domcontentloaded', timeout: 10_000 });
    const handle = await page.evaluate(() => {
      const html = document.body?.innerHTML || '';
      const m = html.match(/instagram\.com\/([a-zA-Z0-9._]+)/);
      if (!m) return null;
      const h = m[1];
      // Skip generic IG links
      if (['p', 'reel', 'explore', 'accounts', 'reels'].includes(h)) return null;
      return h;
    });
    return handle;
  } catch {
    return null;
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

// ============== Strategy C: Keyword search ==============

async function scrapeKeywordSearch(browser: Browser, trade: string, cityShort: string): Promise<string[]> {
  const url = `https://www.instagram.com/web/search/topsearch/?context=blended&query=${encodeURIComponent(`${trade} ${cityShort}`)}`;
  let page: Page | null = null;
  try {
    page = await browser.newPage();
    await page.setUserAgent(UA);
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12_000 });
    if (!res || !res.ok()) return [];
    const text = await page.evaluate(() => document.body.innerText);
    // Endpoint returns JSON when not blocked
    try {
      const json = JSON.parse(text) as { users?: Array<{ user?: { username?: string } }> };
      return (json.users ?? [])
        .map((u) => u.user?.username)
        .filter((u): u is string => !!u && /^[a-zA-Z0-9._]+$/.test(u))
        .slice(0, 20);
    } catch {
      return [];
    }
  } catch {
    return [];
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

// ============== Profile enrichment (shared) ==============

async function fetchProfile(
  browser: Browser,
  handle: string,
): Promise<{ businessName: string; bio: string; followerCount: number; externalUrl: string } | null> {
  const url = `https://www.instagram.com/${handle.replace(/^@/, '')}/`;
  let page: Page | null = null;
  try {
    page = await browser.newPage();
    await page.setUserAgent(UA);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12_000 });
    await sleep(800);
    const result = await page.evaluate(() => {
      // og:description on a public IG profile is something like:
      //   "1,234 Followers, 567 Following, 89 Posts - See Instagram photos and videos from Business Name (@handle)"
      const desc = (document.querySelector('meta[property="og:description"]') as HTMLMetaElement | null)?.content || '';
      const title = (document.querySelector('meta[property="og:title"]') as HTMLMetaElement | null)?.content || '';
      // Bio sometimes lives in og:description after the dash, but more reliably in twitter:description
      const twitterDesc = (document.querySelector('meta[name="twitter:description"], meta[property="twitter:description"]') as HTMLMetaElement | null)?.content || '';

      const followersMatch = desc.match(/([\d,.]+[KMkm]?)\s+Followers/);
      const businessNameMatch = title.match(/^([^(]+)\s*\(@/);
      // External URL appears in the page JSON; grab any non-IG outbound link
      const allLinks = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[];
      const externalUrl = allLinks
        .map((a) => a.href)
        .find((h) => h.startsWith('http') && !h.includes('instagram.com')) || '';

      return {
        businessName: businessNameMatch ? businessNameMatch[1].trim() : '',
        followersRaw: followersMatch ? followersMatch[1] : '0',
        bio: twitterDesc || desc,
        externalUrl,
      };
    });
    return {
      businessName: result.businessName,
      bio: result.bio,
      followerCount: parseFollowerCount(result.followersRaw),
      externalUrl: result.externalUrl,
    };
  } catch (err) {
    console.warn(`[profile] @${handle} fetch failed`, (err as Error).message);
    return null;
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

function parseFollowerCount(raw: string): number {
  const cleaned = raw.replace(/,/g, '').trim();
  const m = cleaned.match(/^([\d.]+)([KMkm]?)$/);
  if (!m) return 0;
  const base = parseFloat(m[1]);
  const suffix = m[2].toLowerCase();
  if (suffix === 'k') return Math.round(base * 1_000);
  if (suffix === 'm') return Math.round(base * 1_000_000);
  return Math.round(base);
}

main().catch((err) => {
  console.error('[ig-trades] FAILED', err);
  process.exit(1);
});
