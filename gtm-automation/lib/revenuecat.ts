/**
 * RevenueCat REST API v2 helpers.
 * Docs: https://www.revenuecat.com/reference
 *
 * Note: the v2 REST API requires server-side secret keys (sk_...).
 * Pricing: REST API is free for projects under threshold.
 */

const BASE_URL = 'https://api.revenuecat.com/v2';

const apiKey = required('REVENUECAT_API_KEY');
const projectId = required('REVENUECAT_PROJECT_ID');
const goalStart = new Date(process.env.GOAL_START_DATE ?? '2026-05-08');

export interface ConversionsResult {
  count: number;
  revenue: number;
}

export async function getYesterdayConversions(): Promise<ConversionsResult> {
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const events = await fetchEvents({ since });
  const conversions = events.filter(
    (e) => e.type === 'INITIAL_PURCHASE' || e.type === 'NON_RENEWING_PURCHASE',
  );
  const revenue = conversions.reduce((sum, e) => sum + (e.price_in_purchased_currency ?? 0), 0);
  return { count: conversions.length, revenue };
}

export async function getRunningTotal(): Promise<number> {
  // Count INITIAL_PURCHASE events since GOAL_START_DATE
  const events = await fetchEvents({ since: goalStart.getTime() });
  return events.filter((e) => e.type === 'INITIAL_PURCHASE').length;
}

interface RCEvent {
  type: string;
  event_timestamp_ms: number;
  price_in_purchased_currency?: number;
  store?: string;
}

async function fetchEvents({ since }: { since: number }): Promise<RCEvent[]> {
  const events: RCEvent[] = [];
  let cursor: string | undefined;
  let pages = 0;

  do {
    const url = new URL(`${BASE_URL}/projects/${projectId}/events`);
    url.searchParams.set('start_date_ms', String(since));
    if (cursor) url.searchParams.set('starting_after', cursor);

    const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!res.ok) {
      console.warn(`[revenuecat] events fetch failed ${res.status}`);
      break;
    }
    const data = (await res.json()) as { items: RCEvent[]; next_page?: string };
    events.push(...(data.items ?? []));
    cursor = data.next_page;
    pages++;
  } while (cursor && pages < 20);

  return events;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}
