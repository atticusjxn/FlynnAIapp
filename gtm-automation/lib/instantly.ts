/**
 * Instantly.ai API helpers.
 * Docs: https://developer.instantly.ai/api/v2/
 */

const BASE_URL = 'https://api.instantly.ai/api/v2';

export interface InstantlyStats {
  sentLast24h: number;
  repliesLast24h: number;
  bounceRateLast7d: number;
  warmupBuffer: number; // 0..1 — close to 1 means we're near daily send cap
  hotReplies: number;
  campaignName: string;
}

export async function getInstantlyOvernightStats(): Promise<InstantlyStats> {
  const apiKey = required('INSTANTLY_API_KEY');
  const campaignId = required('INSTANTLY_CAMPAIGN_ID');

  // Endpoint: /campaigns/analytics
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [last24h, last7d, campaign] = await Promise.all([
    fetchAnalytics(apiKey, campaignId, yesterday),
    fetchAnalytics(apiKey, campaignId, sevenDaysAgo),
    fetchCampaign(apiKey, campaignId),
  ]);

  return {
    sentLast24h: last24h.emails_sent_count ?? 0,
    repliesLast24h: last24h.reply_count ?? 0,
    bounceRateLast7d: last7d.bounce_rate ?? 0,
    warmupBuffer:
      campaign?.daily_limit && last24h.emails_sent_count
        ? last24h.emails_sent_count / campaign.daily_limit
        : 0,
    hotReplies: last24h.interested_count ?? 0,
    campaignName: campaign?.name ?? 'Flynn',
  };
}

async function fetchAnalytics(apiKey: string, campaignId: string, since: string) {
  const res = await fetch(`${BASE_URL}/campaigns/analytics?campaign_id=${campaignId}&start_date=${since}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    console.warn(`[instantly] analytics fetch failed: ${res.status}`);
    return {} as any;
  }
  return res.json();
}

async function fetchCampaign(apiKey: string, campaignId: string) {
  const res = await fetch(`${BASE_URL}/campaigns/${campaignId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    console.warn(`[instantly] campaign fetch failed: ${res.status}`);
    return null;
  }
  return res.json();
}

/** Bulk-upload new leads (e.g. fresh Apify scrape) into the Flynn campaign. */
export async function uploadLeadsToInstantly(
  leads: Array<{ email: string; firstName?: string; company?: string; phone?: string; city?: string; trade?: string }>,
): Promise<{ uploaded: number; skipped: number }> {
  const apiKey = required('INSTANTLY_API_KEY');
  const campaignId = required('INSTANTLY_CAMPAIGN_ID');

  const res = await fetch(`${BASE_URL}/leads/bulk`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      campaign_id: campaignId,
      skip_if_in_workspace: true,
      leads: leads.map((l) => ({
        email: l.email,
        first_name: l.firstName ?? '',
        company_name: l.company ?? '',
        custom_variables: { phone: l.phone ?? '', city: l.city ?? '', trade: l.trade ?? '' },
      })),
    }),
  });

  if (!res.ok) {
    throw new Error(`[instantly] upload failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { uploaded?: number; skipped?: number };
  return { uploaded: data.uploaded ?? leads.length, skipped: data.skipped ?? 0 };
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}
