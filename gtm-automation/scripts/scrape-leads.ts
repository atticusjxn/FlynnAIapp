/**
 * Daily lead scraper — replaces Apify with self-hosted Puppeteer.
 *
 * Strategy: hit Yellow Pages AU (more permissive than Google Maps for scraping),
 * rotate trade × city combos by day-of-year so each combo is hit ~once every 2-3 weeks.
 *
 * Writes new leads to public.gtm_cold_leads (deduped on email via UNIQUE constraint).
 *
 * Run: npm run scrape
 *
 * Note: this runs in GitHub Actions on Ubuntu where puppeteer's bundled Chromium works
 * out of the box. For local dev, install with: npm i puppeteer
 */

import 'dotenv/config';
import puppeteer from 'puppeteer';
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
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    // Use system Chrome on CI (PUPPETEER_EXECUTABLE_PATH set in workflow);
    // falls back to Puppeteer's bundled Chromium locally.
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    );

    const searchUrl = `https://www.yellowpages.com.au/search/listings?clue=${encodeURIComponent(trade)}&locationClue=${encodeURIComponent(city)}&pageNumber=1`;
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30_000 });

    // Yellow Pages listing cards have class names like "MuiPaper-root" but we'll scrape via
    // structured-data JSON-LD or fallback to HTML selectors.
    const listings = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[data-testid="listing-card"], .listing-content'));
      return cards.slice(0, 50).map((card) => {
        const name = card.querySelector('h3, [data-testid="business-name"]')?.textContent?.trim() || '';
        const phoneEl = card.querySelector('a[href^="tel:"]');
        const phone = phoneEl?.getAttribute('href')?.replace('tel:', '') || '';
        const websiteEl = card.querySelector('a[href*="redirect"], a[data-testid="website-link"]') as HTMLAnchorElement | null;
        const website = websiteEl?.href || '';
        return { name, phone, website };
      }).filter((c) => c.name);
    });

    console.log(`[scrape] found ${listings.length} listings on Yellow Pages`);

    // Visit each website and extract email
    const leads: Lead[] = [];
    for (const listing of listings) {
      if (leads.length >= MAX_LEADS_PER_RUN) break;
      if (!listing.website) continue;
      if (EXCLUDE_KEYWORDS.some((kw) => listing.name.toLowerCase().includes(kw.toLowerCase()))) continue;

      try {
        const sitePage = await browser.newPage();
        await sitePage.setUserAgent(
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        );
        await sitePage.goto(listing.website, { waitUntil: 'domcontentloaded', timeout: 15_000 });

        // Try to find email on landing page first
        let email = await sitePage.evaluate(() => {
          const text = document.body?.innerText || '';
          const m = text.match(/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/);
          return m ? m[1] : null;
        });

        // If not on landing, try /contact page
        if (!email) {
          try {
            const contactUrl = new URL('/contact', listing.website).toString();
            await sitePage.goto(contactUrl, { waitUntil: 'domcontentloaded', timeout: 10_000 });
            email = await sitePage.evaluate(() => {
              const text = document.body?.innerText || '';
              const m = text.match(/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/);
              return m ? m[1] : null;
            });
          } catch {
            // ignore
          }
        }

        await sitePage.close();

        if (email && !email.includes('example.com') && !email.includes('@2x') && !email.includes('@3x')) {
          leads.push({
            email: email.toLowerCase(),
            first_name: extractFirstName(listing.name),
            company: listing.name,
            phone: listing.phone,
            city,
            trade,
          });
          console.log(`[scrape] ${leads.length}/${MAX_LEADS_PER_RUN}: ${listing.name} → ${email}`);
        }
      } catch (e) {
        // Site failed to load, skip
      }
    }

    console.log(`[scrape] collected ${leads.length} leads with emails`);

    if (leads.length === 0) {
      console.log('[scrape] no leads, exiting');
      return;
    }

    // Insert into Supabase, ignore conflicts (UNIQUE on email)
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

main().catch((err) => {
  console.error('[scrape] FAILED', err);
  process.exit(1);
});
