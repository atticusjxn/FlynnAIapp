-- "Flynn in your group chat" depended on the BlueBubbles relay for group-chat
-- webhooks, which is retired (Gate 5.3 — see CLAUDE.md Non-Goals). Nothing
-- writes to these tables anymore (services/groupAgent/ is deleted).

drop table if exists public.group_action_items;
drop table if exists public.group_messages;
drop table if exists public.group_members;
drop table if exists public.group_chats;
