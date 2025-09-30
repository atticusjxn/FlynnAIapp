with event_activity as (
  select ce.client_id,
         count(*) as job_count,
         max(coalesce(ce.end_time, ce.start_time, ce.created_at)) as last_job_date
  from calendar_events ce
  where ce.client_id is not null
  group by ce.client_id
),
recent_event as (
  select distinct on (ce.client_id)
         ce.client_id,
         coalesce(j.service_type, ce.title, 'Service job') as service_type,
         coalesce(ce.end_time, ce.start_time, ce.created_at) as occurred_at
  from calendar_events ce
  left join jobs j on j.id = ce.job_id
  where ce.client_id is not null
  order by ce.client_id, occurred_at desc
),
client_updates as (
  select c.id as client_id,
         coalesce(c.preferred_contact_method, 'phone') as preferred_contact_method,
         coalesce(c.business_type, u.business_type) as business_type,
         ea.job_count,
         re.service_type,
         ea.last_job_date
  from clients c
  left join users u on u.id = c.user_id
  left join event_activity ea on ea.client_id = c.id
  left join recent_event re on re.client_id = c.id
)
update clients c
set preferred_contact_method = client_updates.preferred_contact_method,
    business_type = client_updates.business_type,
    total_jobs = coalesce(client_updates.job_count, c.total_jobs),
    last_job_type = coalesce(client_updates.service_type, c.last_job_type),
    last_job_date = coalesce(client_updates.last_job_date, c.last_job_date)
from client_updates
where client_updates.client_id = c.id;
