-- Widen draft_picks.source for the keyboard's new input modes.
--
-- The keyboard no longer captures conversations by screenshot or clipboard. It
-- now works two ways: the operator taps a chip that inserts real data (a pay
-- link, their free slots, their rate), or they type shorthand and Flynn expands
-- it into a send-ready message. Both are picks worth learning from, but the
-- original CHECK only allowed ('clipboard','screenshot'), and accept-draft
-- coerces anything unrecognised to 'clipboard' (server.js) — so without this the
-- new modes would be silently mislabelled and the substance-learning loop in
-- deriveLearnedPreferences() would train on a lie about where picks came from.
--
-- 'clipboard'/'screenshot' are kept so existing rows stay valid.

alter table public.draft_picks
  drop constraint if exists draft_picks_source_check;

alter table public.draft_picks
  add constraint draft_picks_source_check
  check (source in ('clipboard', 'screenshot', 'rewrite', 'chip'));
