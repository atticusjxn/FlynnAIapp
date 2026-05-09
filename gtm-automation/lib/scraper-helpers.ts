/**
 * Shared Puppeteer scraper helpers used by scrape-leads.ts (cold email)
 * and scrape-ig-trades.ts (Instagram trade businesses).
 */

import puppeteer, { type Browser } from 'puppeteer';

export const TRADES = [
  'plumber', 'electrician', 'air conditioning', 'carpenter', 'painter',
  'roofer', 'handyman', 'landscaper', 'cleaner', 'mobile mechanic',
  'pest control', 'tree service',
];

export const CITIES = [
  'Sydney NSW', 'Melbourne VIC', 'Brisbane QLD', 'Perth WA', 'Adelaide SA',
  'Gold Coast QLD', 'Newcastle NSW', 'Canberra ACT', 'Wollongong NSW',
  'Geelong VIC', 'Hobart TAS', 'Townsville QLD', 'Cairns QLD', 'Sunshine Coast QLD',
];

export const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

export function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function launchBrowser(): Promise<Browser> {
  return puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  });
}

/** Pick today's trade × city combo using day-of-year rotation. */
export function pickDailyCombo(date = new Date()): { trade: string; city: string } {
  const dayOfYear = getDayOfYear(date);
  return {
    trade: TRADES[dayOfYear % TRADES.length],
    city: CITIES[Math.floor(dayOfYear / 7) % CITIES.length],
  };
}
