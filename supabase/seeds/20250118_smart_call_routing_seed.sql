insert into public.call_routing_settings (user_id, mode, after_hours_mode, schedule, schedule_timezone, feature_enabled)
values
  ('00000000-0000-0000-0000-000000000000', 'smart_auto', 'voicemail', '{"timezone":"America/Los_Angeles","windows":[{"days":["mon","tue","wed","thu","fri"],"start":"08:00","end":"17:00"}]}', 'America/Los_Angeles', true)
on conflict (user_id) do update set
  mode = excluded.mode,
  after_hours_mode = excluded.after_hours_mode,
  schedule = excluded.schedule,
  schedule_timezone = excluded.schedule_timezone,
  feature_enabled = excluded.feature_enabled,
  updated_at = now();
