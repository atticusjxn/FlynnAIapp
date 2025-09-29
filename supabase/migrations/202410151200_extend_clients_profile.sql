alter table public.clients
  add column if not exists business_type text,
  add column if not exists preferred_contact_method text check (preferred_contact_method in ('phone', 'text', 'email')),
  add column if not exists last_job_type text,
  add column if not exists last_job_date timestamptz,
  add column if not exists total_jobs integer; 
