with duplicates as (
  select twilio_phone_number, count(*)
  from public.users
  where twilio_phone_number is not null
  group by twilio_phone_number
  having count(*) > 1
)
select u.id, u.email, u.twilio_phone_number
from public.users u
join duplicates d on d.twilio_phone_number = u.twilio_phone_number
order by u.twilio_phone_number;
