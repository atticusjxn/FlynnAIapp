// services/weatherScheduler.js
//
// Proactive weather-aware reschedule nudge — Flynn's hero proactive beat. Reads
// a user's upcoming outdoor jobs, checks the forecast (Open-Meteo, free, no
// key), and if rain is coming for a weather-sensitive job it DMs the operator
// offering to move it to the next clear day. A "yes" runs reschedule_job.
//
// Wired into the 60s cron hub in server.js; self-throttled to ~12h. Gated by
// FLYNN_WEATHER_NUDGE (default on; set =0 to disable). Demo accounts get an
// accelerated, force-fired path via nudgeUserNow() so a reviewer sees it within
// ~90s. Dedup via the weather_nudges table so a job is never nudged twice.

const { createClient } = require('@supabase/supabase-js');
const nango = require('./nango');
const googleCalendar = require('./googleCalendar');
const { sendToUser } = require('./flynnOutbound');
const { sanitiseReply } = require('./flynnTone');
const { timezoneFromPhone } = require('./agent/toolRegistry');

const MINUTE = 60 * 1000;
const SWEEP_INTERVAL_MS = 12 * 60 * MINUTE; // ~twice a day
const MAX_USERS_PER_TICK = 40;
const FORECAST_DAYS = 7;
const LOOKAHEAD_DAYS = 3;
const RAIN_PROB = 60;      // % precipitation probability that counts as "rain"
const RAIN_SUM_MM = 5;     // or this much precipitation
const CLEAR_PROB = 40;     // a "clear" day is below this
const CLEAR_SUM_MM = 2;

const OUTDOOR_TYPES = ['paint', 'roof', 'concret', 'landscap', 'pav', 'fenc', 'deck', 'garden', 'brick', 'render', 'gutter', 'excavat', 'turf', 'lawn', 'tiling'];
const JOB_KEYWORDS = ['paint', 'roof', 'deck', 'fence', 'concrete', 'pav', 'landscap', 'garden', 'render', 'exterior', 'outdoor', 'gutter', 'driveway', 'retaining', 'turf', 'lawn', 'slab', 'pergola', 'patio', 'yard'];

function matchesAny(text, list) {
  const t = String(text || '').toLowerCase();
  return list.some((k) => t.includes(k));
}

function isWeatherSensitive(brain, job) {
  const typeText = `${brain?.business_type || ''} ${(brain?.services || []).join(' ')}`;
  if (matchesAny(typeText, OUTDOOR_TYPES)) return true;
  return matchesAny(`${job?.summary || ''} ${job?.notes || ''}`, JOB_KEYWORDS);
}

function dayLabel(dateStr, tz) {
  try {
    return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-AU', { timeZone: tz, weekday: 'long' }).toLowerCase();
  } catch { return dateStr; }
}

// ---- Open-Meteo (free, no key) ----------------------------------------------
async function geocode(place) {
  if (!place) return null;
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  const hit = json?.results?.[0];
  return hit ? { lat: hit.latitude, lon: hit.longitude } : null;
}

async function dailyForecast(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
    + `&daily=precipitation_probability_max,precipitation_sum&timezone=auto&forecast_days=${FORECAST_DAYS}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  const d = json?.daily;
  if (!d?.time) return null;
  return d.time.map((date, i) => ({
    date,
    prob: Number(d.precipitation_probability_max?.[i] ?? 0),
    sum: Number(d.precipitation_sum?.[i] ?? 0),
  }));
}

const isRainy = (day) => day && (day.prob >= RAIN_PROB || day.sum >= RAIN_SUM_MM);
const isClear = (day) => day && day.prob < CLEAR_PROB && day.sum < CLEAR_SUM_MM;

class WeatherScheduler {
  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_SECRET;
    if (!supabaseUrl || !supabaseKey) {
      console.warn('[Weather] Supabase credentials not configured, service disabled');
      this.supabase = null;
    } else {
      this.supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
    }
    this._lastSweep = 0;
  }

  async processTick() {
    if (!this.supabase) return { sent: 0 };
    if (process.env.FLYNN_WEATHER_NUDGE === '0') return { disabled: true };
    const now = Date.now();
    if (now - this._lastSweep < SWEEP_INTERVAL_MS) return { skipped: 'throttled' };
    this._lastSweep = now;

    // Real users with a Google calendar connection (Apple/CalDAV deferred). Demo
    // users go through the accelerated nudgeUserNow() path instead.
    const { data: conns } = await this.supabase
      .from('user_connections')
      .select('user_phone, nango_connection_id')
      .eq('provider', 'google-calendar')
      .eq('status', 'connected')
      .limit(200);
    if (!conns || !conns.length) return { sent: 0 };

    const phones = [...new Set(conns.map((c) => c.user_phone))];
    const { data: users } = await this.supabase
      .from('users')
      .select('phone, business_brain, reengagement_opted_out, is_demo')
      .in('phone', phones);
    const byPhone = new Map((users || []).map((u) => [u.phone, u]));

    let sent = 0;
    for (const conn of conns) {
      if (sent >= MAX_USERS_PER_TICK) break;
      const user = byPhone.get(conn.user_phone);
      if (!user || user.is_demo || user.reengagement_opted_out) continue;
      try {
        const did = await this._sweepRealUser(conn.user_phone, user, conn);
        if (did) sent++;
      } catch (err) {
        console.error('[Weather] sweep failed for', conn.user_phone, err?.message || err);
      }
    }
    if (sent) console.log(`[Weather] nudged ${sent} operator(s)`);
    return { sent };
  }

  async _sweepRealUser(phone, user, conn) {
    const brain = user.business_brain || {};
    const tz = timezoneFromPhone(phone);
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + LOOKAHEAD_DAYS * 24 * 60 * MINUTE).toISOString();
    const token = await nango.getToken('google-calendar', conn.nango_connection_id || user.id);
    const events = await googleCalendar.listEvents(token, { timeMin, timeMax });

    for (const ev of events) {
      const job = { summary: ev.summary, notes: '', location: ev.location, date: ev.startISO.slice(0, 10), startISO: ev.startISO, endISO: ev.endISO };
      if (!isWeatherSensitive(brain, job)) continue;
      const place = ev.location || brain.location || brain.service_area;
      const geo = await geocode(place);
      if (!geo) continue;
      const forecast = await dailyForecast(geo.lat, geo.lon);
      if (!forecast) continue;
      const dayFc = forecast.find((d) => d.date === job.date);
      if (!isRainy(dayFc)) continue;
      const clear = forecast.find((d) => d.date > job.date && isClear(d));
      if (!clear) continue;
      if (await this._alreadyNudged(phone, ev.id, job.date)) continue;

      const newStartISO = this._shiftDate(job.startISO, job.date, clear.date);
      const newEndISO = job.endISO ? this._shiftDate(job.endISO, job.date, clear.date) : null;
      await this._nudge(phone, {
        job, tz, clearDate: clear.date,
        parkArgs: { provider: 'google-calendar', event_id: ev.id, summary: job.summary, location: job.location, new_start_iso: newStartISO, new_end_iso: newEndISO, clear_day_label: dayLabel(clear.date, tz) },
      });
      return true; // one nudge per user per sweep
    }
    return false;
  }

  _shiftDate(iso, fromDate, toDate) {
    return iso.replace(fromDate, toDate);
  }

  async _alreadyNudged(phone, eventKey, date) {
    const { data } = await this.supabase
      .from('weather_nudges')
      .select('id')
      .eq('user_phone', phone).eq('event_key', String(eventKey)).eq('nudge_date', date)
      .maybeSingle();
    return Boolean(data);
  }

  async _nudge(phone, { job, tz, clearDate, parkArgs }) {
    const when = dayLabel(job.date, tz);
    const clear = dayLabel(clearDate, tz);
    const loc = job.location ? ` in ${String(job.location).toLowerCase()}` : '';
    const what = job.summary ? `${String(job.summary).toLowerCase()}` : 'job';
    const message = `heads up, ${when}'s ${what}${loc} has rain forecast. want me to move it to ${clear}?`;

    await sendToUser(phone, sanitiseReply(message), { channel: 'imessage', supabase: this.supabase });

    // record dedup + park the reschedule so a "yes" runs deterministically
    await this.supabase.from('weather_nudges')
      .insert({ user_phone: phone, event_key: String(parkArgs.event_id || job.summary || 'job'), nudge_date: job.date })
      .then(() => {}, () => {});
    await this.supabase.from('pending_actions').delete()
      .eq('user_phone', phone).eq('tool_name', 'reschedule_job').eq('status', 'awaiting_confirmation')
      .then(() => {}, () => {});
    await this.supabase.from('pending_actions').insert({
      user_phone: phone,
      action_type: 'reschedule_job',
      action_data: parkArgs,
      confirmation_message: message,
      status: 'awaiting_confirmation',
      tool_name: 'reschedule_job',
      tool_args: parkArgs,
      expires_at: new Date(Date.now() + 24 * 60 * MINUTE).toISOString(),
    }).then(() => {}, (e) => console.warn('[Weather] park failed:', e?.message));
  }

  // Accelerated, force-fired path for the reviewer demo. Reads the seeded
  // outdoor job from business_brain._demo_jobs and always treats it as rained
  // out, so the beat is guaranteed within ~90s of provisioning.
  async nudgeUserNow(phone, { demo = false } = {}) {
    if (!this.supabase) return;
    const { data: user } = await this.supabase
      .from('users').select('phone, business_brain, is_demo').eq('phone', phone).maybeSingle();
    if (!user) return;
    const tz = timezoneFromPhone(phone);

    if (demo || user.is_demo) {
      const jobs = Array.isArray(user.business_brain?._demo_jobs) ? user.business_brain._demo_jobs : [];
      const job = jobs.find((j) => j.outdoor) || jobs[0];
      if (!job) return;
      const clearDate = this._nextDate(job.date);
      await this._nudge(phone, {
        job, tz, clearDate,
        parkArgs: { provider: 'demo', summary: job.summary, location: job.location, clear_day_label: dayLabel(clearDate, tz), demo: true },
      });
    }
  }

  _nextDate(dateStr) {
    const d = new Date(`${dateStr}T12:00:00`);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
}

module.exports = new WeatherScheduler();
