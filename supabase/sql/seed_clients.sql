with new_clients(email, name, phone, address, business_type, preferred_contact_method, notes) as (
  values
    ('atticusjxn@gmail.com', 'Sarah Johnson', '+61 0497 779 071', '123 Oak Street, Springfield', 'home_property', 'text', 'Prefers afternoon appointments.'),
    ('admin@mates-rates.app', 'Michael Chen', '+1 (555) 345-6789', '456 Pine Avenue, Downtown', 'business_professional', 'email', 'Regular monthly booking.'),
    ('test@flynnai.com', 'Jennifer Rodriguez', '+1 (555) 456-7890', '789 Maple Drive, Suburban Heights', 'home_property', 'phone', 'Eco-friendly products only.')
),
inserted_clients as (
  insert into clients (
    id, user_id, name, phone, email, address, business_type,
    preferred_contact_method, notes, created_at, updated_at
  )
  select
    gen_random_uuid(),
    u.id,
    nc.name,
    nc.phone,
    nc.email,
    nc.address,
    nc.business_type,
    nc.preferred_contact_method,
    nc.notes,
    now(),
    now()
  from new_clients nc
  join public.users u on u.email = nc.email
  on conflict do nothing
  returning id, user_id, name
)
insert into calendar_events (
  id, user_id, client_id, title, description,
  start_time, end_time, location, color, created_at, updated_at
)
select
  gen_random_uuid(),
  ic.user_id,
  ic.id,
  concat('Consultation with ', ic.name),
  'Initial job discussion and scoping.',
  now() + interval '1 day',
  now() + interval '1 day 1 hour',
  'On-site',
  '#3B82F6',
  now(),
  now()
from inserted_clients ic
on conflict do nothing;
