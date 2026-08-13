/**
 * Phone -> org resolution.
 *
 * The org-spine pivot (org_spine migrations 20260718*) puts every business on
 * one org-keyed row (`organizations` / `org_members`). An inbound text from the
 * boss's own number needs to resolve to `(orgId, memberId, role)` before the
 * agent can act on it — used on every inbound SMS turn (services/agent/agentLoop.js).
 *
 * Resolution order:
 *   1. `org_members.member_phone` direct match (status = 'active'). In practice
 *      this only ever hits for phones already backfilled by step 2 below —
 *      nothing currently writes `member_phone` for anyone but the org owner
 *      (the "Team Flynn" crew-invite flow that would have populated this for
 *      employees was cut; see a.md Gate 5.2).
 *   2. Fallback: `users.phone` -> `users.default_org_id` -> the matching
 *      `org_members` row. Backfills `member_phone` onto that row so step 1 is
 *      a direct hit next time.
 *   3. Unresolved: the phone belongs to nobody yet. Callers decide what that
 *      means (new business signup vs. unrecognised sender).
 *
 * This module does not create organizations for brand-new signups — that stays
 * with whatever onboarding flow is active (SMS, app) — it only resolves and
 * backfills membership for phones that already have an org somewhere.
 */

const { normalizePhone } = require('./authLink');

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

module.exports = { resolveOrgMember };
