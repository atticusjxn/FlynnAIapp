-- Adds Supabase storage metadata for voicemail recordings.
alter table public.calls add column if not exists recording_sid text;
alter table public.calls add column if not exists recording_storage_path text;
alter table public.calls add column if not exists recording_signed_expires_at timestamptz;
alter table public.calls add column if not exists recording_expires_at timestamptz;
alter table public.calls add column if not exists recording_deleted_at timestamptz;
alter table public.calls add column if not exists status text;

-- Ensure status defaults to active when missing.
update public.calls
set status = coalesce(status, 'active')
where status is null;
