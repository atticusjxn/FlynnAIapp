-- The FlynnKeyboard extension is cut (Gate 5.1). draft_picks existed solely to
-- learn from keyboard draft picks (services/draftReplies.js composeFromShorthand,
-- now removed) — nothing writes to it anymore.

drop trigger if exists trg_draft_picks_set_owner on public.draft_picks;
drop function if exists public.draft_picks_set_owner();
drop table if exists public.draft_picks;
