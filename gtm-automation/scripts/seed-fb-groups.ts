/**
 * One-shot seeder for gtm_fb_groups.
 * Reads templates/seed-data/fb-groups-seed.csv and upserts rows by URL.
 *
 * Run: npm run seed:fb-groups
 *
 * Idempotent — safe to re-run. Won't overwrite `joined`, `last_posted_at`,
 * `last_post_type`, or `notes` once they've been edited via the dashboard.
 */

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { supabase } from '../lib/gtm-supabase.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = resolve(__dirname, '../templates/seed-data/fb-groups-seed.csv');

interface Row {
  name: string;
  url: string;
  member_count: number;
  industry: string;
  region: string;
  status: string;
  joined: boolean;
}

function parseCsv(text: string): Row[] {
  const lines = text.trim().split(/\r?\n/);
  const [, ...rest] = lines;
  return rest.map((line) => {
    const [name, url, mc, industry, region, status, joined] = line.split(',');
    return {
      name: name!.trim(),
      url: url!.trim(),
      member_count: Number(mc) || 0,
      industry: industry!.trim().toLowerCase(),
      region: region!.trim().toUpperCase(),
      status: status!.trim().toLowerCase(),
      joined: joined!.trim().toUpperCase() === 'TRUE',
    };
  });
}

async function main() {
  const csv = readFileSync(CSV_PATH, 'utf8');
  const rows = parseCsv(csv);
  console.log(`[seed] parsed ${rows.length} groups from CSV`);

  // Upsert by URL. Existing rows keep their joined/last_posted state.
  // We only insert if URL is new — never overwrite founder-edited fields.
  const { data: existing } = await supabase
    .from('gtm_fb_groups')
    .select('url')
    .in(
      'url',
      rows.map((r) => r.url),
    );
  const existingUrls = new Set((existing ?? []).map((r) => r.url));
  const toInsert = rows.filter((r) => !existingUrls.has(r.url));

  if (toInsert.length === 0) {
    console.log('[seed] nothing new — all URLs already present');
    return;
  }

  const { error } = await supabase.from('gtm_fb_groups').insert(toInsert);
  if (error) {
    console.error('[seed] insert failed', error);
    process.exit(1);
  }
  console.log(`[seed] inserted ${toInsert.length} new groups (skipped ${rows.length - toInsert.length})`);
}

main().catch((err) => {
  console.error('[seed] FAILED', err);
  process.exit(1);
});
