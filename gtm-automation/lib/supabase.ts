import { createClient } from '@supabase/supabase-js';

const url = required('SUPABASE_URL');
const key = required('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(url, key, { auth: { persistSession: false } });

/**
 * Returns trial-start and signup events from the last 24h, tagged with attribution source.
 * Source comes from the trial_signups.business_type custom field OR a UTM column on the
 * users table (utm_source). Adjust the column name to match your actual schema.
 */
export async function getYesterdayEvents(): Promise<Array<{ source: string }>> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Adjust this query to match your real schema. We're looking for trial_signups in the
  // last 24h. If you have a `utm_source` column on `users` or `trial_signups`, surface that.
  const { data, error } = await supabase
    .from('trial_signups')
    .select('id, created_at, utm_source, business_type')
    .gte('created_at', since);

  if (error) {
    console.warn('[supabase] trial_signups query failed', error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    source: (row as any).utm_source ?? (row as any).business_type ?? 'organic',
  }));
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}
