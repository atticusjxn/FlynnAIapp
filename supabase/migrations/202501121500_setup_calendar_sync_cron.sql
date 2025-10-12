-- Setup pg_cron for automatic calendar synchronization
-- Runs every 15 minutes to keep calendar events in sync

-- Enable pg_cron extension (if not already enabled)
create extension if not exists pg_cron;

-- Create a function to call the Edge Function for calendar sync
create or replace function public.trigger_calendar_sync()
returns void
language plpgsql
security definer
as $$
declare
  function_url text;
  cron_secret text;
  request_id bigint;
begin
  -- Get the Edge Function URL from environment or construct it
  -- Format: https://<project-ref>.supabase.co/functions/v1/calendar-sync
  function_url := current_setting('app.settings.edge_function_url', true);

  if function_url is null then
    function_url := 'https://' || current_setting('app.settings.project_ref', true) || '.supabase.co/functions/v1/calendar-sync';
  end if;

  -- Get cron secret for authentication
  cron_secret := current_setting('app.settings.cron_secret', true);

  -- Call the Edge Function using http extension
  perform
    net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || cron_secret
      ),
      body := '{}'::jsonb
    );

  raise notice 'Calendar sync triggered at %', now();
end;
$$;

-- Schedule the calendar sync job to run every 15 minutes
-- Format: '*/15 * * * *' = every 15 minutes
-- Adjust as needed: '*/5 * * * *' for every 5 minutes, '0 * * * *' for hourly
select cron.schedule(
  'calendar-sync-every-15-minutes',  -- Job name
  '*/15 * * * *',                     -- Cron expression (every 15 minutes)
  $$select public.trigger_calendar_sync()$$
);

-- Alternative: Manual trigger function that can be called directly
create or replace function public.sync_all_calendars_now()
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
begin
  -- Call the trigger function
  perform public.trigger_calendar_sync();

  return jsonb_build_object(
    'success', true,
    'message', 'Calendar sync triggered successfully',
    'triggered_at', now()
  );
end;
$$;

-- Grant execute permission to authenticated users (optional - for manual triggers)
grant execute on function public.sync_all_calendars_now() to authenticated;

-- Comment for documentation
comment on function public.trigger_calendar_sync() is 'Triggers the calendar-sync Edge Function to synchronize all active calendar integrations';
comment on function public.sync_all_calendars_now() is 'Manually trigger calendar sync for all integrations (can be called by authenticated users)';

-- List all scheduled cron jobs (for verification)
-- To view: select * from cron.job;

-- To remove the cron job (if needed):
-- select cron.unschedule('calendar-sync-every-15-minutes');

-- Note: You'll need to set these app settings in your Supabase dashboard:
-- 1. app.settings.edge_function_url or app.settings.project_ref
-- 2. app.settings.cron_secret (generate a secure random string)
--
-- Example SQL to set:
-- alter database postgres set app.settings.project_ref = 'your-project-ref';
-- alter database postgres set app.settings.cron_secret = 'your-secure-cron-secret';
