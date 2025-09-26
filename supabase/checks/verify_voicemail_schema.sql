with required_columns as (
  select 'calls'::text as table_name, 'call_sid'::text as column_name union all
  select 'calls', 'user_id' union all
  select 'calls', 'from_number' union all
  select 'calls', 'to_number' union all
  select 'calls', 'recording_url' union all
  select 'calls', 'duration_sec' union all
  select 'calls', 'recorded_at' union all
  select 'calls', 'transcription_status' union all
  select 'transcriptions', 'id' union all
  select 'transcriptions', 'call_sid' union all
  select 'transcriptions', 'engine' union all
  select 'transcriptions', 'text' union all
  select 'transcriptions', 'confidence' union all
  select 'transcriptions', 'language' union all
  select 'transcriptions', 'created_at' union all
  select 'jobs', 'id' union all
  select 'jobs', 'user_id' union all
  select 'jobs', 'call_sid' union all
  select 'jobs', 'customer_name' union all
  select 'jobs', 'customer_phone' union all
  select 'jobs', 'summary' union all
  select 'jobs', 'service_type' union all
  select 'jobs', 'status' union all
  select 'jobs', 'created_at'
),
available_columns as (
  select table_name, column_name
  from information_schema.columns
  where table_schema = 'public'
)
select rc.table_name,
       json_agg(rc.column_name order by rc.column_name) as missing_columns
from required_columns rc
left join available_columns ac
  on ac.table_name = rc.table_name
 and ac.column_name = rc.column_name
where ac.column_name is null
group by rc.table_name
order by rc.table_name;
