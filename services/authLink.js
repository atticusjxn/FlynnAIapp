/**
 * Flynn frictionless app sign-in.
 *
 * Flynn's primary identity is the phone number a user texts from. The iOS app,
 * however, runs entirely on Supabase Auth (Keychain session, RLS via auth.uid(),
 * Supabase access token as the backend Bearer). To let a user who has already
 * texted Flynn open the app and be "already in" — no OTP typed — we:
 *
 *   1. Ensure every phone-keyed user has a real auth.users record whose id is
 *      aligned with their public.users row (the on_auth_user_created trigger
 *      mirrors auth.users.id -> public.users.id).
 *   2. Mint a single-use Supabase magic-link token and deliver it to their phone
 *      as a `flynnai://auth/callback?token_hash=...` deep link. The app exchanges
 *      it for a genuine Supabase session via verifyOTP — leaving the app's entire
 *      data-access model unchanged.
 *
 * Phone users have no real email, so we assign a non-routable synthetic email
 * (<digits>@phone.flynnai.app) purely so Supabase's email-based generateLink works.
 * The phone stays the human identity (phone_confirm: true).
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_SECRET;

const admin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

const PHONE_EMAIL_DOMAIN = process.env.FLYNN_PHONE_EMAIL_DOMAIN || 'phone.flynnai.app';

/**
 * Normalise a raw phone string to E.164 (AU/NZ-aware, same rules as webSignup).
 * @param {string} raw
 * @returns {string|null}
 */
function normalizePhone(raw) {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, '');
  let phone;
  if (trimmed.startsWith('+')) {
    phone = `+${digits}`;
  } else if (digits.startsWith('61') && digits.length === 11) {
    phone = `+${digits}`;
  } else if (digits.startsWith('0') && digits.length === 10) {
    phone = `+61${digits.slice(1)}`;
  } else if (digits.startsWith('64')) {
    phone = `+${digits}`;
  } else if (digits) {
    phone = `+${digits}`;
  } else {
    return null;
  }
  return phone;
}

/**
 * Non-routable synthetic email used only so Supabase's email-based generateLink
 * works for a phone-only user. The phone remains the human identity.
 */
function syntheticEmail(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  return `${digits}@${PHONE_EMAIL_DOMAIN}`;
}

/**
 * Ensure a phone-keyed user has an aligned auth.users record.
 *
 * The on_auth_user_created trigger mirrors auth.users.id -> public.users.id, so
 * creating the auth user is what guarantees the id used by RLS (auth.uid()) matches
 * the id the app's data is keyed on. Returns { id, created } or null on failure.
 *
 * @param {string} phone E.164
 */
async function ensureAuthUser(phone) {
  if (!admin || !phone) return null;
  const email = syntheticEmail(phone);

  // 1. Existing public.users row? Check whether its id is a real auth user.
  const { data: existing } = await admin
    .from('users')
    .select('id')
    .eq('phone', phone)
    .maybeSingle();

  if (existing?.id) {
    const { data: au } = await admin.auth.admin.getUserById(existing.id).catch(() => ({ data: null }));
    if (au?.user) return { id: existing.id, created: false };

    // Orphan row (id is a plain uuid, not an auth user) — reconcile by creating
    // the auth user WITH that id so the trigger's `on conflict (id) do update`
    // realigns in place and all existing FKs stay valid.
    const recon = await admin.auth.admin.createUser({
      id: existing.id,
      phone,
      email,
      phone_confirm: true,
      email_confirm: true,
    });
    if (!recon.error && recon.data?.user) return { id: recon.data.user.id, created: true };
    console.warn('[authLink] reconcile-by-id failed for', phone, recon.error?.message);
    // Fall through: a fresh create would orphan the old row, so bail rather than split identity.
    return null;
  }

  // 2. No row yet — create a fresh auth user. The trigger mirrors it into public.users.
  const created = await admin.auth.admin.createUser({
    phone,
    email,
    phone_confirm: true,
    email_confirm: true,
  });
  if (!created.error && created.data?.user) return { id: created.data.user.id, created: true };

  // Already exists (race / prior create that didn't set users.phone yet) — resolve via auth email.
  const { data: list } = await admin.auth.admin
    .listUsers({ page: 1, perPage: 200 })
    .catch(() => ({ data: null }));
  const match = list?.users?.find((u) => u.email === email || u.phone === phone.replace('+', '') || u.phone === phone);
  if (match?.id) return { id: match.id, created: false };

  console.error('[authLink] ensureAuthUser failed for', phone, created.error?.message);
  return null;
}

/**
 * Ensure the user exists and mint a single-use app sign-in deep link for them.
 * Returns { url, httpsUrl, phone } or { error }.
 *
 * `url` is the raw custom-scheme link (works when the app is installed — e.g. the
 * in-app "text me a link" flow). `httpsUrl` is a server-hosted bounce that opens
 * the scheme and falls back to the App Store (for cold links where the app may not
 * be installed yet).
 */
async function generateAppLink(rawPhone) {
  if (!admin) return { error: 'auth not configured' };
  const phone = normalizePhone(rawPhone);
  if (!phone) return { error: 'invalid phone' };

  const ensured = await ensureAuthUser(phone);
  if (!ensured?.id) return { error: 'could not provision user' };

  const email = syntheticEmail(phone);
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error) return { error: error.message };

  const tokenHash = data?.properties?.hashed_token;
  if (!tokenHash) return { error: 'no token produced' };

  const qs = `token_hash=${encodeURIComponent(tokenHash)}&type=magiclink`;
  const serverUrl = (process.env.SERVER_PUBLIC_URL || process.env.SERVER_URL || 'https://flynnai-telephony.fly.dev').replace(/\/$/, '');
  return {
    url: `flynnai://auth/callback?${qs}`,
    httpsUrl: `${serverUrl}/app/open?${qs}`,
    phone,
  };
}

/**
 * Mint a single-use Supabase magic-link token for the WEB dashboard. Same
 * mechanism as generateAppLink, but the token_hash is handed to the web client
 * (flynnai.app/dashboard) which exchanges it via supabase.auth.verifyOtp to
 * establish a browser session. Returns { url, phone } or { error }.
 */
async function generateDashboardLink(rawPhone) {
  if (!admin) return { error: 'auth not configured' };
  const phone = normalizePhone(rawPhone);
  if (!phone) return { error: 'invalid phone' };

  const ensured = await ensureAuthUser(phone);
  if (!ensured?.id) return { error: 'could not provision user' };

  const email = syntheticEmail(phone);
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error) return { error: error.message };

  const tokenHash = data?.properties?.hashed_token;
  if (!tokenHash) return { error: 'no token produced' };

  const base = (process.env.DASHBOARD_URL || 'https://flynnai.app/dashboard').replace(/\/$/, '');
  // The web app reads these from the URL hash and calls verifyOtp.
  const url = `${base}/#token_hash=${encodeURIComponent(tokenHash)}&type=magiclink`;
  return { url, phone };
}

module.exports = { normalizePhone, syntheticEmail, ensureAuthUser, generateAppLink, generateDashboardLink };
