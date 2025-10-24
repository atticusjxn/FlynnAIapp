-- Create conversation_states table for AI receptionist interactions
create table if not exists public.conversation_states (
  id uuid primary key default gen_random_uuid(),
  call_sid text unique not null,
  user_id uuid references auth.users(id) on delete cascade,
  from_number text not null,
  to_number text not null,
  current_step integer not null default 0,
  total_steps integer not null default 0,
  questions jsonb not null default '[]'::jsonb,
  responses jsonb not null default '[]'::jsonb,
  voice_id text,
  greeting text,
  status text not null default 'active' check (status in ('active', 'completed', 'failed', 'abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Add indexes for performance
create index if not exists idx_conversation_states_call_sid on public.conversation_states(call_sid);
create index if not exists idx_conversation_states_user_id on public.conversation_states(user_id);
create index if not exists idx_conversation_states_status on public.conversation_states(status);
create index if not exists idx_conversation_states_created_at on public.conversation_states(created_at desc);

-- Enable RLS
alter table public.conversation_states enable row level security;

-- Policy: Users can view their own conversation states
create policy "Users can view own conversation states"
  on public.conversation_states
  for select
  using (auth.uid() = user_id);

-- Policy: Service role can do anything (for server-side operations)
create policy "Service role has full access to conversation states"
  on public.conversation_states
  for all
  using (auth.jwt()->>'role' = 'service_role');

-- Comment on table
comment on table public.conversation_states is 'Stores state for ongoing AI receptionist conversations';
