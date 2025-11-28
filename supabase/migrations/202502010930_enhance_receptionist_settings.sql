-- Add receptionist mode and acknowledgement settings
alter table public.users
  add column if not exists receptionist_mode text
    constraint receptionist_mode_valid
      check (receptionist_mode in ('voicemail_only', 'ai_only', 'hybrid_choice'))
    default 'voicemail_only',
  add column if not exists receptionist_ack_library jsonb default '[]'::jsonb,
  add column if not exists receptionist_business_profile jsonb;
-- Ensure null modes fall back to voicemail_only
update public.users
   set receptionist_mode = 'voicemail_only'
 where receptionist_mode is null;
-- Guard against malformed acknowledgement payloads
create or replace function public.normalize_receptionist_ack_library()
returns trigger
language plpgsql
as $$
declare
  sanitized jsonb := '[]'::jsonb;
begin
  if new.receptionist_ack_library is not null then
    begin
      -- keep only string entries, trim whitespace
      sanitized := (
        select coalesce(jsonb_agg(trim(value::text, '"')), '[]'::jsonb)
        from jsonb_array_elements_text(new.receptionist_ack_library)
        where length(trim(value::text, '"')) > 0
      );
    exception
      when others then
        sanitized := '[]'::jsonb;
    end;
  end if;

  new.receptionist_ack_library := sanitized;
  return new;
end;
$$;
drop trigger if exists normalize_receptionist_ack_library on public.users;
create trigger normalize_receptionist_ack_library
before insert or update of receptionist_ack_library on public.users
for each row
execute procedure public.normalize_receptionist_ack_library();
