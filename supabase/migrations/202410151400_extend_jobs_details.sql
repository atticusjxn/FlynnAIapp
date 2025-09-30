alter table public.jobs
  add column if not exists customer_email text,
  add column if not exists business_type text,
  add column if not exists scheduled_date date,
  add column if not exists scheduled_time text,
  add column if not exists location text,
  add column if not exists notes text,
  add column if not exists estimated_duration text,
  add column if not exists source text,
  add column if not exists follow_up_draft text,
  add column if not exists last_follow_up_at timestamptz,
  add column if not exists voicemail_transcript text,
  add column if not exists voicemail_recording_url text,
  add column if not exists captured_at timestamptz;
