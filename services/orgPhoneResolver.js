/**
 * Phone -> org resolution, the keystone for the shared "Team Flynn" number.
 *
 * The payments-first pivot (see ~/.claude/plans/iridescent-floating-moore.md and
 * memory flynn_positioning) puts every business on one org-keyed row
 * (`organizations` / `org_members`, org_spine migrations 20260718*). Any inbound
 * text — from the boss or from an invited crew member — needs to resolve to
 * `(orgId, memberId, role)` before the agent can act on it.
 *
 * Resolution order:
 *   1. `org_members.member_phone` direct match (status = 'active'). This is the
 *      fast path once a phone has been attached to a member — true for invited
 *      employees from day one, and for owners after their first resolve here
 *      (see step 2's backfill).
 *   2. Fallback for owner accounts that predate `member_phone`: `users.phone` ->
 *      `users.default_org_id` -> the matching `org_members` row. Backfills
 *      `member_phone` onto that row so step 1 is a direct hit next time.
 *   3. Unresolved: the phone belongs to nobody yet. Callers decide what that
 *      means (new business signup vs. "ask your boss to invite you").
 *
 * This module does not create organizations for brand-new signups — that stays
 * with whatever onboarding flow is active (SMS, app) — it only resolves and
 * backfills membership for phones that already have an org somewhere.
 */

const { normalizePhone, ensureAuthUser } = require('./authLink');

/**
 * @param {string} rawPhone
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<{ orgId: string, memberId: string, role: string, userId: string|null } | null>}
 */
async function resolveOrgMember(rawPhone, supabase) {
  const phone = normalizePhone(rawPhone);
  if (!phone || !supabase) return null;

  // 1. Direct member_phone match.
  const { data: directMember } = await supabase
    .from('org_members')
    .select('id, org_id, role, user_id')
    .eq('member_phone', phone)
    .eq('status', 'active')
    .maybeSingle();

  if (directMember) {
    return {
      orgId: directMember.org_id,
      memberId: directMember.id,
      role: directMember.role,
      userId: directMember.user_id,
    };
  }

  // 2. Fallback: an owner account created before member_phone existed. Look up
  // by users.phone -> users.default_org_id, then backfill member_phone so this
  // is a direct hit next time.
  const { data: userRow } = await supabase
    .from('users')
    .select('id, default_org_id')
    .eq('phone', phone)
    .maybeSingle();

  if (!userRow?.default_org_id) return null;

  const { data: memberRow } = await supabase
    .from('org_members')
    .select('id, org_id, role, user_id')
    .eq('org_id', userRow.default_org_id)
    .eq('user_id', userRow.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!memberRow) return null;

  // NOTE: PostgrestFilterBuilder is a thenable, not a real Promise — it has no
  // .catch(), so use the two-arg .then() form (as the rest of the codebase does)
  // or this throws instead of soft-failing.
  await supabase
    .from('org_members')
    .update({ member_phone: phone })
    .eq('id', memberRow.id)
    .is('member_phone', null)
    .then(() => {}, (err) => console.warn('[orgPhoneResolver] member_phone backfill failed:', err?.message));

  return {
    orgId: memberRow.org_id,
    memberId: memberRow.id,
    role: memberRow.role,
    userId: memberRow.user_id,
  };
}

/**
 * Boss invites a crew member by phone from the app. Creates a pending
 * `org_members` row keyed on the phone — the employee is fully resolvable via
 * `resolveOrgMember` as soon as they text in and OTP-verify, no login/app
 * required on their side (see CLAUDE.md "Team Flynn number").
 *
 * @param {{ orgId: string, phone: string, invitedByUserId?: string, role?: string, supabase: import('@supabase/supabase-js').SupabaseClient }} params
 */
async function inviteEmployeeByPhone({ orgId, phone, invitedByUserId, role = 'agent', supabase }) {
  const normalised = normalizePhone(phone);
  if (!orgId || !normalised || !supabase) {
    throw new Error('inviteEmployeeByPhone requires orgId, phone, and supabase');
  }

  const { data: existing } = await supabase
    .from('org_members')
    .select('id, status')
    .eq('org_id', orgId)
    .eq('member_phone', normalised)
    .maybeSingle();

  if (existing) {
    if (existing.status !== 'active') {
      await supabase
        .from('org_members')
        .update({ status: 'active', invited_by: invitedByUserId || null, invited_at: new Date().toISOString() })
        .eq('id', existing.id);
    }
    return { id: existing.id, orgId, phone: normalised, reinvited: true };
  }

  // org_members.user_id is NOT NULL, but the crew member has never logged in —
  // "no login, OTP only" per CLAUDE.md. Reuse the same phone-keyed auth-user
  // pattern SMS signup already relies on (services/authLink.js ensureAuthUser):
  // a real auth.users row aligned by id, so RLS (`is_org_member`, which checks
  // `auth.uid()`) works if the employee ever opens the app, without requiring
  // them to ever type an OTP to use Flynn over text.
  const ensured = await ensureAuthUser(normalised);
  if (!ensured?.id) {
    throw new Error(`inviteEmployeeByPhone: could not provision an auth user for ${normalised}`);
  }

  // Two-arg .then(), not .catch() — see the note in resolveOrgMember.
  await supabase
    .from('users')
    .update({ phone: normalised })
    .eq('id', ensured.id)
    .is('phone', null)
    .then(() => {}, () => {});

  const { data: inserted, error } = await supabase
    .from('org_members')
    .insert({
      org_id: orgId,
      user_id: ensured.id,
      member_phone: normalised,
      role,
      status: 'active',
      invited_by: invitedByUserId || null,
      invited_at: new Date().toISOString(),
      accepted_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) throw error;

  return { id: inserted.id, orgId, phone: normalised, reinvited: false };
}

module.exports = { resolveOrgMember, inviteEmployeeByPhone };
