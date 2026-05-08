/**
 * Daily Apify scrape → Instantly upload pipeline.
 * Rotates AU city × trade combinations and feeds 30 new leads/day into the
 * existing Flynn cold-email campaign.
 */

import 'dotenv/config';
import { ApifyClient } from 'apify-client';
import config from './apify-task-config.json' with { type: 'json' };
import { uploadLeadsToInstantly } from '../lib/instantly.js';

const APIFY_TOKEN = required('APIFY_TOKEN');
const APIFY_ACTOR_ID = process.env.APIFY_ACTOR_ID ?? 'compass~crawler-google-places';

interface ApifyPlace {
  title?: string;
  emails?: string[];
  phone?: string;
  city?: string;
  categoryName?: string;
  url?: string;
}

async function main() {
  const dayOfYear = getDayOfYear(new Date());
  const trade = config.rotation.trades[dayOfYear % config.rotation.trades.length];
  const cityIdx = Math.floor(dayOfYear / 7) % config.rotation.cities.length;
  const city = config.rotation.cities[cityIdx];

  console.log(`[apify-scrape] today's combo: ${trade} × ${city}`);

  const client = new ApifyClient({ token: APIFY_TOKEN });
  const run = await client.actor(APIFY_ACTOR_ID).call({
    ...config.input_template,
    searchStringsArray: [`${trade} ${city}`],
  });

  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  console.log(`[apify-scrape] scraped ${items.length} places`);

  const filtered = (items as ApifyPlace[])
    .filter((p) => p.emails && p.emails.length > 0)
    .filter(
      (p) =>
        !config.output_filter.exclude_chain_keywords.some((kw) =>
          (p.title || '').toLowerCase().includes(kw.toLowerCase()),
        ),
    )
    .slice(0, 30);

  const leads = filtered.map((p) => ({
    email: p.emails![0],
    firstName: extractFirstName(p.title || ''),
    company: p.title || '',
    phone: p.phone || '',
    city: city,
    trade: trade,
  }));

  console.log(`[apify-scrape] uploading ${leads.length} leads to Instantly`);
  const result = await uploadLeadsToInstantly(leads);
  console.log(`[apify-scrape] done. uploaded=${result.uploaded} skipped=${result.skipped}`);
}

function extractFirstName(businessName: string): string {
  // Try to extract a first name from common patterns: "Bob's Plumbing", "Mick the Sparky"
  const apostropheMatch = businessName.match(/^([A-Z][a-z]+)['']s\b/);
  if (apostropheMatch) return apostropheMatch[1];
  const theMatch = businessName.match(/^([A-Z][a-z]+) the\b/i);
  if (theMatch) return theMatch[1];
  return ''; // fallback — Instantly will skip personalisation
}

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

main().catch((err) => {
  console.error('[apify-scrape] FAILED', err);
  process.exit(1);
});
