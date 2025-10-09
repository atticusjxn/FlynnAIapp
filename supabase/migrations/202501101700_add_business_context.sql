-- Add business context fields to users table for AI receptionist
alter table public.users
  add column if not exists business_profile_url text,
  add column if not exists business_context jsonb default '{}'::jsonb,
  add column if not exists business_context_updated_at timestamptz;

-- Add comment explaining the business_context structure
comment on column public.users.business_context is 'AI-extracted business context from Google Business Profile including services, hours, description, specialties, etc. Used for intelligent conversation handling.';
