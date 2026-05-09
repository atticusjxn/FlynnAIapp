/**
 * Daily lead scraper — Apify Google Maps actor + missed-call review filter.
 *
 * Replaces the Puppeteer/Yellow Pages scraper. Designed to run inside the
 * Claude Code routine sandbox (no Chrome required).
 *
 * Pipeline:
 *   1. Pick today's trade × city combo (rotates via pickDailyCombo).
 *   2. Run Apify "compass/crawler-google-places" — pull up to 60 places + 5 reviews each.
 *   3. Filter: reviewsCount < 50, has phone, has website, not a chain.
 *   4. Keep only places where at least one review matches the missed-call regex.
 *      Capture the matching snippet for personalisation.
 *   5. Fetch the business website, extract first email via regex (homepage + /contact fallback).
 *   6. Upsert to gtm_cold_leads with review_keywords / review_snippet populated.
 *   7. Loop combos until 20 qualified leads or 4 combos exhausted.
 *
 * Run: npm run scrape
 */

import 'dotenv/config';
import { supabase } from '../lib/gtm-supabase.js';
import { pickDailyCombo, TRADES, CITIES, getDayOfYear } from '../lib/scraper-helpers.js';

const APIFY_TOKEN = required('APIFY_TOKEN');
const TARGET_LEADS = Number(process.env.SCRAPE_TARGET_LEADS ?? 20);
const MAX_COMBOS = Number(process.env.SCRAPE_MAX_COMBOS ?? 4);

const EXCLUDE_KEYWORDS = [
  'bunnings', 'mitre 10', 'reece plumbing', 'dial before you dig',
  'energy australia', 'jim\'s group', 'hire a hubby',
];

// Reviews mentioning missed-call frustrations — Flynn's exact pain point.
const MISSED_CALL_REGEX =
  /couldn'?t\s+(reach|get\s+(?:a\s+)?hold\s+of)|never\s+(?:called|got)\s+back|didn'?t\s+answer|no\s+answer|kept\s+calling|straight\s+to\s+voicemail|no\s+one\s+(?:answered|picked\s+up)|hard\s+to\s+(?:reach|get\s+a?\s*hold)|unresponsive/i;

interface ApifyPlace {
  title: string;
  address?: string;
  phone?: string;
  website?: string;
  totalScore?: number;
  reviewsCount?: number;
  placeId?: string;
  reviews?: Array<{ text?: string; publishedAtDate?: string; stars?: number }>;
  categoryName?: string;
}

interface QualifiedLead {
  email: string;
  first_name?: string | null;
  company?: string | null;
  phone?: string | null;
  city?: string | null;
  trade?: string | null;
  website?: string | null;
  google_place_id?: string | null;
  reviews_count?: number | null;
  review_keywords?: string[] | null;
  review_snippet?: string | null;
  source?: string;
}

async function main() {
  const dayIdx = getDayOfYear(new Date());
  const combos = pickCombos(dayIdx, MAX_COMBOS);
  console.log(`[scrape] target ${TARGET_LEADS} leads · combos to try: ${combos.map((c) => `${c.trade}/${c.city}`).join(', ')}`);

  const collected: QualifiedLead[] = [];
  const seenEmails = new Set<string>();

  for (const { trade, city } of combos) {
    if (collected.length >= TARGET_LEADS) break;

    console.log(`\n[scrape] === ${trade} × ${city} ===`);
    const places = await runApifyGoogleMaps(trade, city);
    console.log(`[scrape] apify returned ${places.length} places`);

    for (const place of places) {
      if (collected.length >= TARGET_LEADS) break;

      const screened = screenPlace(place);
      if (!screened.passes) {
        continue;
      }

      const lead = await enrichWithEmail(place, trade, city, screened);
      if (!lead) continue;
      if (seenEmails.has(lead.email)) continue;

      seenEmails.add(lead.email);
      collected.push(lead);
      console.log(`[scrape] ✓ ${collected.length}/${TARGET_LEADS} — ${lead.company} → ${lead.email}`);
      if (lead.review_snippet) console.log(`         "${lead.review_snippet.slice(0, 110)}"`);
    }
  }

  console.log(`\n[scrape] qualified leads: ${collected.length}`);
  if (collected.length === 0) {
    console.log('[scrape] no leads — try widening combos or check Apify quota');
    return;
  }

  const { data, error } = await supabase
    .from('gtm_cold_leads')
    .upsert(collected, { onConflict: 'email', ignoreDuplicates: true })
    .select('id, email');

  if (error) {
    console.error('[scrape] supabase upsert failed', error);
    process.exit(1);
  }
  console.log(`[scrape] inserted ${data?.length ?? 0} new rows (rest were duplicates)`);
}

function pickCombos(dayIdx: number, count: number): Array<{ trade: string; city: string }> {
  // Today's combo first, then rotate through next slots so we hit a varied set.
  const out: Array<{ trade: string; city: string }> = [];
  for (let i = 0; i < count; i++) {
    out.push({
      trade: TRADES[(dayIdx + i) % TRADES.length]!,
      city: CITIES[(Math.floor(dayIdx / 7) + i) % CITIES.length]!,
    });
  }
  return out;
}

// ============== Apify call ==============

async function runApifyGoogleMaps(trade: string, city: string): Promise<ApifyPlace[]> {
  const url = `https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${APIFY_TOKEN}`;
  const body = {
    searchStringsArray: [`${trade} ${city}`],
    maxCrawledPlacesPerSearch: 60,
    language: 'en',
    includeReviews: true,
    maxReviews: 5,
    scrapePlaceDetailPage: true,
    countryCode: 'au',
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`[apify] HTTP ${res.status}: ${text.slice(0, 200)}`);
    return [];
  }

  const data = (await res.json()) as ApifyPlace[];
  return Array.isArray(data) ? data : [];
}

// ============== Screening ==============

interface ScreenResult {
  passes: boolean;
  reviewSnippet?: string;
  reviewKeywords?: string[];
}

function screenPlace(place: ApifyPlace): ScreenResult {
  if (!place.title) return { passes: false };
  if (!place.phone) return { passes: false };
  if (!place.website) return { passes: false };
  if ((place.reviewsCount ?? 0) >= 50) return { passes: false };

  const nameLower = place.title.toLowerCase();
  if (EXCLUDE_KEYWORDS.some((kw) => nameLower.includes(kw))) return { passes: false };

  // Skip social-only websites (FB/IG = no real domain to email-extract)
  const wsLower = (place.website || '').toLowerCase();
  if (wsLower.includes('facebook.com') || wsLower.includes('instagram.com')) return { passes: false };

  // Find a missed-call review.
  const reviews = place.reviews ?? [];
  for (const r of reviews) {
    const text = r.text || '';
    const m = text.match(MISSED_CALL_REGEX);
    if (m) {
      const snippet = extractSnippet(text, m.index ?? 0);
      const keywords = m[0] ? [m[0].toLowerCase()] : [];
      return { passes: true, reviewSnippet: snippet, reviewKeywords: keywords };
    }
  }
  return { passes: false };
}

function extractSnippet(text: string, hitIndex: number): string {
  // Pull the sentence containing the hit, or ~160 chars around it.
  const start = Math.max(0, text.lastIndexOf('.', hitIndex) + 1);
  let end = text.indexOf('.', hitIndex);
  if (end === -1 || end - start > 220) end = Math.min(text.length, hitIndex + 160);
  return text.slice(start, end).trim().replace(/\s+/g, ' ');
}

// ============== Email extraction (no browser) ==============

const EMAIL_REGEX = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
const EMAIL_BLOCKLIST = /noreply|no-reply|do-not-reply|webmaster|postmaster|wix\.com|sentry\.io|godaddy/i;

async function enrichWithEmail(
  place: ApifyPlace,
  trade: string,
  city: string,
  screen: ScreenResult,
): Promise<QualifiedLead | null> {
  const email = await fetchEmail(place.website!);
  if (!email) return null;

  return {
    email: email.toLowerCase(),
    first_name: extractFirstName(place.title),
    company: place.title,
    phone: place.phone || null,
    city,
    trade,
    website: place.website,
    google_place_id: place.placeId || null,
    reviews_count: place.reviewsCount ?? null,
    review_keywords: screen.reviewKeywords ?? null,
    review_snippet: screen.reviewSnippet ?? null,
    source: 'apify-google-maps',
  };
}

async function fetchEmail(website: string): Promise<string | null> {
  for (const url of [website, joinPath(website, '/contact'), joinPath(website, '/contact-us')]) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FlynnGTM/1.0)' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const html = await res.text();
      const email = pickEmail(html);
      if (email) return email;
    } catch {
      // try next variant
    }
  }
  return null;
}

function pickEmail(html: string): string | null {
  const matches = new Set<string>();
  for (const m of html.match(EMAIL_REGEX) || []) matches.add(m);
  for (const m of html.match(/mailto:([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g) || []) {
    matches.add(m.replace('mailto:', ''));
  }
  const list = Array.from(matches).filter(
    (m) => !EMAIL_BLOCKLIST.test(m) && !/@2x|@3x|\.png|\.jpg|\.svg/i.test(m),
  );
  return list[0] ?? null;
}

function joinPath(base: string, path: string): string {
  try {
    return new URL(path, base).toString();
  } catch {
    return base;
  }
}

function extractFirstName(businessName: string): string | null {
  const apos = businessName.match(/^([A-Z][a-z]+)['']s\b/);
  if (apos) return apos[1]!;
  const the = businessName.match(/^([A-Z][a-z]+) the\b/i);
  if (the) return the[1]!;
  return null;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

main().catch((err) => {
  console.error('[scrape] FAILED', err);
  process.exit(1);
});
