/**
 * Morning Brief — daily 7:30am AEST email summarising:
 *   1. Yesterday's metrics (trial starts, paid conversions, CAC)
 *   2. Today's cold-lead batch (surface 30 leads from gtm_cold_leads)
 *   3. 18 IG accounts to DM (manual, prefilled)
 *   4. 5 FB groups to engage (manual, prefilled)
 *   5. Anomalies + founder content prompts
 *
 * Run: npm run brief
 * Dry-run (no email send): npm run brief:dry
 */

import 'dotenv/config';
import {
  surfaceTodaysFBGroups,
  surfaceTodaysIGTargets,
  surfaceTodaysTradeIGTargets,
  writeDailyLog,
  getColdEmailStats,
} from './lib/gtm-supabase.js';
import { getYesterdayEvents } from './lib/supabase.js';
import { getYesterdayConversions, getRunningTotal } from './lib/revenuecat.js';
import { renderBrief, sendBrief } from './lib/email.js';

const isDry = process.argv.includes('--dry-run');

async function main() {
  const today = new Date();
  console.log(`[morning-brief] running for ${today.toISOString()} (dry=${isDry})`);

  const [fbGroups, igTargets, tradeIgTargets, coldEmailStats, supabaseEvents, rcConversions, runningTotal] =
    await Promise.all([
      surfaceTodaysFBGroups({ count: 5, daysSinceLastPost: 7 }),
      surfaceTodaysIGTargets({ count: 18 }),
      surfaceTodaysTradeIGTargets({ count: 20 }),
      getColdEmailStats(),
      getYesterdayEvents(),
      getYesterdayConversions().catch((e) => {
        console.warn('[brief] revenuecat fetch failed', e.message);
        return { count: 0, revenue: 0 };
      }),
      getRunningTotal().catch(() => 0),
    ]);

  const trialStartsBreakdown = aggregateTrialStarts(supabaseEvents);
  const trialStartsTotal = sumValues(trialStartsBreakdown);

  const brief = renderBrief({
    date: today,
    yesterday: {
      trialStarts: trialStartsTotal,
      trialStartsBreakdown,
      paidConversions: rcConversions.count,
      revenueAdded: rcConversions.revenue,
      runningTotal,
      goalTotal: Number(process.env.GOAL_PAID_CUSTOMERS ?? 100),
      goalDeadline: process.env.GOAL_DEADLINE ?? '2026-06-30',
    },
    coldEmail: coldEmailStats,
    igTargets,
    tradeIgTargets,
    fbGroups,
    anomalies: detectAnomalies({ runningTotal }),
    founderContentPrompts: pickFounderPrompts(today),
  });

  if (isDry) {
    console.log('[morning-brief] DRY RUN — would send:');
    console.log(brief.text);
    return;
  }

  await sendBrief(brief);
  await writeDailyLog({
    date: today,
    trialStarts: trialStartsTotal,
    trialStartsBreakdown,
    paidConversions: rcConversions.count,
    revenueAdded: rcConversions.revenue,
    runningTotal,
    coldEmailsSent: coldEmailStats.sentLast24h,
    coldEmailReplies: coldEmailStats.repliesLast24h,
  });

  console.log('[morning-brief] sent + logged');
}

function aggregateTrialStarts(events: Array<{ source: string }>): Record<string, number> {
  const breakdown: Record<string, number> = { coldEmail: 0, igDm: 0, organic: 0, paidAds: 0 };
  for (const event of events) {
    const source = (event.source || 'organic').toLowerCase();
    if (source.includes('email')) breakdown.coldEmail++;
    else if (source.includes('ig') || source.includes('instagram')) breakdown.igDm++;
    else if (
      source.includes('paid') || source.includes('asa') ||
      source.includes('meta') || source.includes('tiktok')
    ) {
      breakdown.paidAds++;
    } else breakdown.organic++;
  }
  return breakdown;
}

function sumValues(obj: Record<string, number>): number {
  return Object.values(obj).reduce((a, b) => a + b, 0);
}

function detectAnomalies({ runningTotal }: { runningTotal: number }): string[] {
  const anomalies: string[] = [];
  const goalStart = new Date(process.env.GOAL_START_DATE ?? '2026-05-08');
  const goalDeadline = new Date(process.env.GOAL_DEADLINE ?? '2026-06-30');
  const goal = Number(process.env.GOAL_PAID_CUSTOMERS ?? 100);
  const totalDays = (goalDeadline.getTime() - goalStart.getTime()) / (1000 * 60 * 60 * 24);
  const elapsedDays = (Date.now() - goalStart.getTime()) / (1000 * 60 * 60 * 24);
  const expected = Math.round((elapsedDays / totalDays) * goal);
  if (runningTotal < expected * 0.7 && elapsedDays > 7) {
    anomalies.push(
      `BEHIND PACE — at day ${Math.round(elapsedDays)} you should have ~${expected} customers, you have ${runningTotal}. Cut underperforming channels.`,
    );
  }
  return anomalies;
}

function pickFounderPrompts(today: Date): string[] {
  const prompts = [
    'Twitter thread: Walk through the most surprising thing a tradie said about Flynn this week',
    'LinkedIn post: 200 words on why you bootstrapped Flynn from your AI automations brand',
    'Instagram reel: Voice clip of Flynn handling a real call (with caller permission)',
    'YouTube short: Before/after — what your day looked like before vs. with Flynn',
    'Twitter thread: Numbers — calls captured, jobs booked, $ saved, in the last 30 days',
    'LinkedIn post: One thing AU tradies misunderstand about AI receptionists',
    'Instagram carousel: 5 ways AU tradies are losing leads right now (with stats)',
  ];
  const dayOfWeek = today.getDay();
  return [prompts[dayOfWeek % prompts.length], prompts[(dayOfWeek + 2) % prompts.length]];
}

main().catch((err) => {
  console.error('[morning-brief] FAILED', err);
  process.exit(1);
});
