-- "Flynn in your group chat" — ambient team note-taker.
--
-- The boss drops Flynn's iMessage number into a team group chat. Flynn observes
-- silently, extracts action items, and DMs the boss privately. Nothing here is
-- ever actioned off a group message directly — the boss confirms/executes in
-- their existing 1:1 thread, which flows through the existing tool loop.
--
-- Group traffic is kept OUT of sms_messages on purpose: that table is keyed on
-- user_phone and feeds the boss's 1:1 history (agentLoop.loadHistory) and the
-- re-engagement "has this user texted" check. Mixing group chatter in would
-- pollute both. Hence a dedicated group_messages table.
--
-- All tables are service-role only (RLS enabled, no policies).

-- One row per group Flynn has been added to.
CREATE TABLE IF NOT EXISTS public.group_chats (
  chat_guid text PRIMARY KEY,                         -- BlueBubbles group chat GUID (verbatim)
  owner_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  owner_phone text,                                   -- the boss (a registered Flynn user in the group)
  name text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'no_owner', 'left')),
  intro_sent boolean NOT NULL DEFAULT false,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,        -- { digest_hour: 17, live_urgent: true }
  last_digest_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS group_chats_owner_phone_idx ON public.group_chats (owner_phone);
CREATE INDEX IF NOT EXISTS group_chats_status_idx ON public.group_chats (status);

-- Members observed in a group (learned as they speak; participant lists from the
-- webhook are unreliable, so this fills in over time).
CREATE TABLE IF NOT EXISTS public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_guid text NOT NULL REFERENCES public.group_chats(chat_guid) ON DELETE CASCADE,
  member_phone text NOT NULL,
  display_name text,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('boss', 'member')),
  is_flynn_user boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT group_members_unique UNIQUE (chat_guid, member_phone)
);
CREATE INDEX IF NOT EXISTS group_members_chat_idx ON public.group_members (chat_guid);

-- Raw group messages — note-taker input. message_guid UNIQUE makes ingestion
-- idempotent against webhook double-fires.
CREATE TABLE IF NOT EXISTS public.group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_guid text NOT NULL,
  sender_phone text,
  sender_name text,
  body text,
  message_guid text,
  extracted boolean NOT NULL DEFAULT false,           -- has the note-taker swept this yet?
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT group_messages_guid_unique UNIQUE (message_guid)
);
CREATE INDEX IF NOT EXISTS group_messages_chat_created_idx
  ON public.group_messages (chat_guid, created_at DESC);
CREATE INDEX IF NOT EXISTS group_messages_unextracted_idx
  ON public.group_messages (chat_guid) WHERE extracted = false;

-- The suggestion queue. dedupe_key stops the same item being raised twice (e.g.
-- once by the live fast-path, once by the batch sweep).
CREATE TABLE IF NOT EXISTS public.group_action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_guid text NOT NULL REFERENCES public.group_chats(chat_guid) ON DELETE CASCADE,
  owner_phone text NOT NULL,
  source_message_ids uuid[] NOT NULL DEFAULT '{}',
  summary text NOT NULL,
  category text,                                      -- timesheet|order|booking|invoice|decision|fact|followup|other
  suggested_tool text,                               -- a toolRegistry tool name, or null
  suggested_args jsonb,
  urgency text NOT NULL DEFAULT 'routine' CHECK (urgency IN ('live', 'routine')),
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'sent', 'actioned', 'dismissed', 'expired')),
  dedupe_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT group_action_items_dedupe_unique UNIQUE (chat_guid, dedupe_key)
);
CREATE INDEX IF NOT EXISTS group_action_items_owner_status_idx
  ON public.group_action_items (owner_phone, status);

ALTER TABLE public.group_chats ENABLE ROW LEVEL SECURITY;          -- service-role only
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;        -- service-role only
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;       -- service-role only
ALTER TABLE public.group_action_items ENABLE ROW LEVEL SECURITY;   -- service-role only
