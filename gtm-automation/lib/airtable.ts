import Airtable from 'airtable';

const apiKey = required('AIRTABLE_API_KEY');
const baseId = required('AIRTABLE_BASE_ID');

const base = new Airtable({ apiKey }).base(baseId);

export interface FBGroup {
  id: string;
  name: string;
  url: string;
  memberCount: number;
  lastPostedAt: string | null;
  suggestedPostType: 'VALUE_QUESTION' | 'CASE_STUDY' | 'GENUINE_HELP';
}

export interface IGTarget {
  id: string;
  handle: string;
  profileUrl: string;
  followerCount: number;
  industry: string;
  region: string;
  suggestedScript: 'REV_SHARE' | 'FREE_MONTH' | 'FEEDBACK';
}

export async function surfaceTodaysFBGroups({
  count,
  daysSinceLastPost,
}: { count: number; daysSinceLastPost: number }): Promise<FBGroup[]> {
  const cutoff = new Date(Date.now() - daysSinceLastPost * 24 * 60 * 60 * 1000).toISOString();
  const records = await base('FBGroups')
    .select({
      filterByFormula: `AND({Joined} = 1, {Status} = 'active', OR({LastPostedAt} = '', IS_BEFORE({LastPostedAt}, '${cutoff}')))`,
      maxRecords: count,
      sort: [{ field: 'LastPostedAt', direction: 'asc' }],
    })
    .all();

  return records.map((r, idx) => ({
    id: r.id,
    name: r.get('Name') as string,
    url: r.get('URL') as string,
    memberCount: (r.get('MemberCount') as number) ?? 0,
    lastPostedAt: (r.get('LastPostedAt') as string) ?? null,
    suggestedPostType: rotatePostType(r.get('LastPostType') as string, idx),
  }));
}

function rotatePostType(last: string | undefined, idx: number): FBGroup['suggestedPostType'] {
  const types: FBGroup['suggestedPostType'][] = ['VALUE_QUESTION', 'CASE_STUDY', 'GENUINE_HELP'];
  // Skip the last type used in this group; if none, rotate by index
  const filtered = types.filter((t) => t !== last);
  return filtered[idx % filtered.length] ?? types[idx % types.length];
}

export async function surfaceTodaysIGTargets({ count }: { count: number }): Promise<IGTarget[]> {
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const records = await base('IGTargets')
    .select({
      filterByFormula: `OR({Status} = 'not-contacted', AND({Status} = 'dm-sent', IS_BEFORE({LastDMAt}, '${fiveDaysAgo}'), {ReplyAt} = ''))`,
      maxRecords: count * 2, // overfetch for industry mixing
    })
    .all();

  // Mix industries: 60% trades, 25% beauty, 15% other
  const mix = mixByIndustry(records, count);

  return mix.map((r, idx) => ({
    id: r.id,
    handle: r.get('Handle') as string,
    profileUrl:
      (r.get('ProfileURL') as string) ||
      `https://instagram.com/${(r.get('Handle') as string).replace('@', '')}`,
    followerCount: (r.get('FollowerCount') as number) ?? 0,
    industry: (r.get('Industry') as string) ?? 'other',
    region: (r.get('Region') as string) ?? 'AU',
    suggestedScript: rotateScript(idx),
  }));
}

function mixByIndustry(records: any[], target: number): any[] {
  const trades = records.filter((r) => r.get('Industry') === 'trades');
  const beauty = records.filter((r) => r.get('Industry') === 'beauty');
  const other = records.filter(
    (r) => r.get('Industry') !== 'trades' && r.get('Industry') !== 'beauty',
  );

  const tradesCount = Math.round(target * 0.6);
  const beautyCount = Math.round(target * 0.25);
  const otherCount = target - tradesCount - beautyCount;

  return [
    ...trades.slice(0, tradesCount),
    ...beauty.slice(0, beautyCount),
    ...other.slice(0, otherCount),
  ];
}

function rotateScript(idx: number): IGTarget['suggestedScript'] {
  // 50% REV_SHARE, 30% FREE_MONTH, 20% FEEDBACK
  const m = idx % 10;
  if (m < 5) return 'REV_SHARE';
  if (m < 8) return 'FREE_MONTH';
  return 'FEEDBACK';
}

export async function writeDailyLog(entry: {
  date: Date;
  trialStarts: number;
  trialStartsBreakdown: Record<string, number>;
  paidConversions: number;
  revenueAdded: number;
  runningTotal: number;
  coldEmailsSent: number;
  coldEmailReplies: number;
}): Promise<void> {
  await base('DailyLog').create([
    {
      fields: {
        Date: entry.date.toISOString().slice(0, 10),
        TrialStarts: entry.trialStarts,
        TrialStartsBreakdown: JSON.stringify(entry.trialStartsBreakdown),
        PaidConversions: entry.paidConversions,
        RevenueAdded: entry.revenueAdded,
        RunningTotal: entry.runningTotal,
        ColdEmailsSent: entry.coldEmailsSent,
        ColdEmailReplies: entry.coldEmailReplies,
      },
    },
  ]);
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}
