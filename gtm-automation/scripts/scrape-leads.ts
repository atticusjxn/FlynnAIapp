/**
 * Daily lead scraper — replaces Apify with self-hosted Puppeteer.
 *
 * Strategy: try Google Maps first (more reliable selectors), fall back to Yellow
 * Pages AU. Rotates trade × city combos by day-of-year so each combo is hit
 * ~once every 2-3 weeks. Writes deduped leads to public.gtm_cold_leads.
 *
 * Run: npm run scrape
 *
 * In CI we use the runner's pre-installed google-chrome via PUPPETEER_EXECUTABLE_PATH.
 */

import 'dotenv/config';
import puppeteer, { type Browser, type Page } from 'puppeteer';
import { supabase } from '../lib/gtm-supabase.js';

const TRADES = [
  'plumber', 'electrician', 'air conditioning', 'carpenter', 'painter',
  'roofer', 'handyman', 'landscaper', 'cleaner', 'mobile mechanic',
  'pest control', 'tree service',
];
const CITIES = [
  'Sydney NSW', 'Melbourne VIC', 'Brisbane QLD', 'Perth WA', 'Adelaide SA',
  'Gold Coast QLD', 'Newcastle NSW', 'Canberra ACT', 'Wollongong NSW',
  'Geelong VIC', 'Hobart TAS', 'Townsville QLD', 'Cairns QLD', 'Sunshine Coast QLD',
];
const MAX_LEADS_PER_RUN = Number(process.env.SCRAPE_MAX_PER_RUN ?? 30);
const EXCLUDE_KEYWORDS = ['Bunnings', 'Mitre 10', 'Reece Plumbing', 'Dial Before You Dig', 'Energy Australia'];
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

interface Lead {
  email: string;
  first_name?: string;
  company?: string;
  phone?: string;
  city?: string;
  trade?: string;
}

async function main() {
  const dayOfYear = getDayOfYear(new Date());
  const trade = TRADES[dayOfYear % TRADES.length];
  const cityIdx = Math.floor(dayOfYear / 7) % CITIES.length;
  const city = CITIES[cityIdx];
  console.log(`[scrape] today's combo: ${trade} × ${city}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  });

  try {
    let leads: Lead[] = [];

    // Strategy 1: Google Maps (richer data, more reliable)
    console.log('[scrape] strategy 1: Google Maps');
    leads = await scrapeGoogleMaps(browser, trade, city);
    console.log(`[scrape] google-maps yielded ${leads.length} leads`);

    // Strategy 2: Yellow Pages AU fallback if Google Maps gave us few/none
    if (leads.length < 5) {
      console.log('[scrape] strategy 2: Yellow Pages AU (Google Maps yielded too few)');
      const yp = await scrapeYellowPages(browser, trade, city);
      console.log(`[scrape] yellow-pages yielded ${yp.length} leads`);
      const seen = new Set(leads.map((l) => l.email));
      for (const l of yp) {
        if (!seen.has(l.email)) {
          leads.push(l);
          seen.add(l.email);
        }
      }
    }

    leads = leads.slice(0, MAX_LEADS_PER_RUN);
    console.log(`[scrape] final batch: ${leads.length} leads`);

    if (leads.length === 0) {
      console.log('[scrape] no leads after all strategies — selectors may be stale, scraper needs review');
      return;
    }

    const { data, error } = await supabase
      .from('gtm_cold_leads')
      .upsert(leads, { onConflict: 'email', ignoreDuplicates: true })
      .select('id');

    if (error) {
      console.error('[scrape] supabase insert failed', error);
      process.exit(1);
    }
    console.log(`[scrape] inserted ${data?.length ?? 0} new leads (rest were duplicates)`);
  } finally {
    await browser.close();
  }
}

// ============== Google Maps strategy ==============

async function scrapeGoogleMaps(browser: Browser, trade: string, city: string): Promise<Lead[]> {
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  const url = `https://www.google.com/maps/search/${encodeURIComponent(`${trade} ${city}`)}`;
  console.log(`[gmaps] fetching ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await sleep(4000);

  // Scroll the results panel to load more places
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => {
      const panel = document.querySelector('[role="feed"]');
      if (panel) panel.scrollTop = panel.scrollHeight;
    });
    await sleep(1500);
  }

  // Extract place cards: name + website link
  const places = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('[role="feed"] > div'));
    const out: Array<{ name: string; website: string; phone: string }> = [];
    for (const el of items) {
      const name = (el.querySelector('.fontHeadlineSmall, [class*="qBF1Pd"]') as HTMLElement | null)?.innerText?.trim() || '';
      const websiteEl = el.querySelector('a[data-value="Website"], a[aria-label*="Website"]') as HTMLAnchorElement | null;
      const website = websiteEl?.href || '';
      const phoneEl = el.querySelector('[aria-label^="Phone:"]') as HTMLElement | null;
      const phone = phoneEl?.getAttribute('aria-label')?.replace(/^Phone:\s*/i, '') || '';
      if (name) out.push({ name, website, phone });
    }
    return out;
  });
  console.log(`[gmaps] found ${places.length} place cards (with websites: ${places.filter((p) => p.website).length})`);
  await page.close();

  return await extractEmailsFromWebsites(browser, places, trade, city);
}

// ============== Yellow Pages strategy ==============

async function scrapeYellowPages(browser: Browser, trade: string, city: string): Promise<Lead[]> {
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  const url = `https://www.yellowpages.com.au/search/listings?clue=${encodeURIComponent(trade)}&locationClue=${encodeURIComponent(city)}&pageNumber=1`;
  console.log(`[yp] fetching ${url}`);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 });
  await sleep(2000);

  const places = await page.evaluate(() => {
    // Try several selector patterns Yellow Pages has used
    const cardSelectors = [
      '[data-testid="listing-card"]',
      '.listing-content',
      'article[class*="listing"]',
      'div[class*="ListingCard"]',
      'div[class*="result-card"]',
    ];
    let cards: Element[] = [];
    for (const sel of cardSelectors) {
      const found = Array.from(document.querySelectorAll(sel));
      if (found.length > 0) { cards = found; break; }
    }

    return cards.slice(0, 50).map((card) => {
      const nameEl = card.querySelector('h3, h2, [data-testid="business-name"], a[class*="business-name"]');
      const name = (nameEl as HTMLElement | null)?.innerText?.trim() || '';
      const phoneEl = card.querySelector('a[href^="tel:"]');
      const phone = phoneEl?.getAttribute('href')?.replace('tel:', '') || '';
      const websiteEl = card.querySelector('a[href*="redirect"], a[data-testid="website-link"], a[rel="noopener"][target="_blank"]') as HTMLAnchorElement | null;
      const website = websiteEl?.href || '';
      return { name, phone, website };
    }).filter((c) => c.name);
  });
  console.log(`[yp] found ${places.length} listing cards`);
  await page.close();

  return await extractEmailsFromWebsites(browser, places, trade, city);
}

// ============== Email extraction (shared) ==============

async function extractEmailsFromWebsites(
  browser: Browser,
  places: Array<{ name: string; website: string; phone: string }>,
  trade: string,
  city: string,
): Promise<Lead[]> {
  const leads: Lead[] = [];
  let visited = 0;
  for (const place of places) {
    if (leads.length >= MAX_LEADS_PER_RUN) break;
    if (!place.website) continue;
    if (EXCLUDE_KEYWORDS.some((kw) => place.name.toLowerCase().includes(kw.toLowerCase()))) continue;
    if (place.website.includes('facebook.com') || place.website.includes('instagram.com')) continue;

    visited++;
    const email = await tryExtractEmail(browser, place.website);
    if (email && !email.includes('example.com') && !email.includes('@2x') && !email.includes('@3x')) {
      leads.push({
        email: email.toLowerCase(),
        first_name: extractFirstName(place.name),
        company: place.name,
        phone: place.phone,
        city,
        trade,
      });
      console.log(`[email] ${leads.length}/${MAX_LEADS_PER_RUN}: ${place.name} → ${email}`);
    }
  }
  console.log(`[email] visited ${visited} websites, found ${leads.length} emails`);
  return leads;
}

async function tryExtractEmail(browser: Browser, website: string): Promise<string | null> {
  let page: Page | null = null;
  try {
    page = await browser.newPage();
    await page.setUserAgent(UA);
    await page.goto(website, { waitUntil: 'domcontentloaded', timeout: 12_000 });
    let email = await findEmailOnPage(page);
    if (!email) {
      try {
        const contactUrl = new URL('/contact', website).toString();
        await page.goto(contactUrl, { waitUntil: 'domcontentloaded', timeout: 8_000 });
        email = await findEmailOnPage(page);
      } catch { /* ignore */ }
    }
    return email;
  } catch {
    return null;
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

async function findEmailOnPage(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const text = document.body?.innerText || '';
    const html = document.body?.innerHTML || '';
    // Check innerText first (cleanest), then innerHTML for mailto: links
    const matches: string[] = [];
    const re = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
    for (const m of text.match(re) || []) matches.push(m);
    for (const m of html.match(/mailto:([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g) || []) {
      matches.push(m.replace('mailto:', ''));
    }
    if (matches.length === 0) return null;
    // Prefer the first non-noreply email
    const real = matches.find((m) => !/noreply|no-reply|do-not-reply|webmaster|postmaster/i.test(m));
    return (real || matches[0]).toLowerCase();
  });
}

// ============== Helpers ==============

function extractFirstName(businessName: string): string {
  const apos = businessName.match(/^([A-Z][a-z]+)['']s\b/);
  if (apos) return apos[1];
  const the = businessName.match(/^([A-Z][a-z]+) the\b/i);
  if (the) return the[1];
  return '';
}

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
  console.error('[scrape] FAILED', err);
  process.exit(1);
});
