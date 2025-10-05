const { once } = require('events');
const { randomUUID } = require('crypto');
const { parsePhoneNumberFromString } = require('libphonenumber-js');

let clientPromise;

const sqlString = (value) => {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  return `'${String(value).replace(/'/g, "''")}'`;
};

const VALID_NOTIFICATION_PLATFORMS = new Set(['ios', 'android']);

const CALL_ROUTING_MODES = new Set(['intake', 'voicemail', 'smart_auto']);
const CALLER_LABELS = new Set(['lead', 'client', 'personal', 'spam']);
const CALLER_ROUTING_OVERRIDES = new Set(['intake', 'voicemail', 'auto']);

const parseResultRows = (result) => {
  if (!result) {
    return [];
  }

  if (result.structuredContent && Array.isArray(result.structuredContent.rows)) {
    return result.structuredContent.rows;
  }

  if (Array.isArray(result.content)) {
    for (const block of result.content) {
      if (block && block.type === 'text' && typeof block.text === 'string') {
        try {
          const parsed = JSON.parse(block.text);
          if (parsed && Array.isArray(parsed.rows)) {
            return parsed.rows;
          }
        } catch (error) {
          // Ignore JSON parse failures; fallback to next block.
        }
      }
    }
  }

  return [];
};

const normalizePhoneNumber = (value, defaultCountry = 'US') => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
    if (parsed?.isValid()) {
      return parsed.number;
    }
  } catch (error) {
    console.warn('[Supabase] Failed to normalize phone number', { value, error: error?.message });
  }

  const digits = trimmed.replace(/[^0-9]/g, '');
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.startsWith('1') && digits.length === 11) {
    return `+${digits}`;
  }

  if (trimmed.startsWith('+') && digits.length >= 10) {
    return `+${digits}`;
  }

  return null;
};

const getSupabaseConfig = () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_KEY
    || process.env.SUPABASE_SECRET
    || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseAccessToken = process.env.SUPABASE_ACCESS_TOKEN;

  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL is not configured.');
  }

  if (!supabaseKey) {
    throw new Error('Supabase service key is not configured (set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY).');
  }

  const projectId = process.env.SUPABASE_PROJECT_ID
    || new URL(supabaseUrl).hostname.split('.')[0];

  return {
    supabaseUrl,
    supabaseKey,
    supabaseAccessToken,
    projectId,
  };
};

const ensureClient = async () => {
  if (clientPromise) {
    return clientPromise;
  }

  clientPromise = (async () => {
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');

    const config = getSupabaseConfig();

    const transport = new StdioClientTransport({
      command: 'npx',
      args: ['-y', '@supabase/mcp-server-supabase'],
      env: {
        SUPABASE_URL: config.supabaseUrl,
        SUPABASE_KEY: config.supabaseKey,
        ...(config.supabaseAccessToken ? { SUPABASE_ACCESS_TOKEN: config.supabaseAccessToken } : {}),
      },
    });

    const client = new Client({
      name: 'flynnai-backend',
      version: '1.0.0',
    });

    await client.connect(transport);

    const cleanup = async () => {
      try {
        await client.close();
      } catch (error) {
        console.warn('[Supabase MCP] Error closing client during shutdown:', error);
      }
    };

    process.once('exit', cleanup);
    process.once('SIGINT', async () => {
      await cleanup();
      process.exit(0);
    });
    process.once('SIGTERM', async () => {
      await cleanup();
      process.exit(0);
    });

    const createCallsTableSql = `
      create table if not exists public.calls (
        call_sid text primary key,
        user_id uuid,
        from_number text,
        to_number text,
        recording_url text,
        duration_sec integer,
        recorded_at timestamptz,
        transcription_status text,
        transcription_updated_at timestamptz
      );
    `;

    await client.callTool({
      name: 'execute_sql',
      arguments: {
        project_id: config.projectId,
        query: createCallsTableSql,
      },
    });

    const alterCallsSql = `
      alter table public.calls add column if not exists user_id uuid;
      alter table public.calls add column if not exists transcription_status text;
      alter table public.calls add column if not exists transcription_updated_at timestamptz;
    `;

    await client.callTool({
      name: 'execute_sql',
      arguments: {
        project_id: config.projectId,
        query: alterCallsSql,
      },
    });

    const createTranscriptionsSql = `
      create table if not exists public.transcriptions (
        id uuid primary key,
        call_sid text not null references public.calls(call_sid) on delete cascade,
        engine text not null,
        "text" text not null,
        confidence double precision default 0.8,
        language text,
        created_at timestamptz default now() not null
      );
      create unique index if not exists transcriptions_call_sid_idx on public.transcriptions(call_sid);
    `;

    await client.callTool({
      name: 'execute_sql',
      arguments: {
        project_id: config.projectId,
        query: createTranscriptionsSql,
      },
    });

    const createJobsSql = `
      create table if not exists public.jobs (
        id uuid primary key default gen_random_uuid(),
        user_id uuid references public.users(id) on delete cascade,
        call_sid text references public.calls(call_sid) on delete cascade,
        customer_name text,
        customer_phone text,
        summary text,
        service_type text,
        status text default 'new' check (status in ('new', 'in_progress', 'completed')),
        created_at timestamptz default now() not null
      );

      create index if not exists jobs_user_id_idx on public.jobs(user_id);
      create unique index if not exists jobs_call_sid_unique on public.jobs(call_sid);
    `;

    await client.callTool({
      name: 'execute_sql',
      arguments: {
        project_id: config.projectId,
        query: createJobsSql,
      },
    });

    const alignJobsSql = `
      alter table public.jobs
        drop column if exists client_id,
        drop column if exists service_id,
        drop column if exists title,
        drop column if exists description,
        drop column if exists address,
        drop column if exists quoted_price,
        drop column if exists final_price,
        drop column if exists notes,
        drop column if exists updated_at;

      alter table public.jobs
        add column if not exists call_sid text,
        add column if not exists customer_name text,
        add column if not exists customer_phone text,
        add column if not exists summary text,
        add column if not exists service_type text,
        add column if not exists status text default 'new',
        add column if not exists created_at timestamptz default now();

      update public.jobs
         set status = coalesce(nullif(status, ''), 'new')
       where status is null or status not in ('new', 'in_progress', 'completed');

      update public.jobs
         set created_at = coalesce(created_at, now());

      alter table public.jobs
        alter column status set default 'new';

      alter table public.jobs
        alter column created_at set default now();

      alter table public.jobs
        alter column created_at set not null;

      alter table public.jobs
        drop constraint if exists jobs_user_id_fkey;

      alter table public.jobs
        add constraint jobs_user_id_fkey
          foreign key (user_id)
          references public.users(id)
          on delete cascade;

      alter table public.jobs
        drop constraint if exists jobs_call_sid_fkey;

      alter table public.jobs
        add constraint jobs_call_sid_fkey
          foreign key (call_sid)
          references public.calls(call_sid)
          on delete cascade;

      alter table public.jobs
        drop constraint if exists jobs_status_check;

      alter table public.jobs
        add constraint jobs_status_check
          check (status in ('new', 'in_progress', 'completed'));

      create index if not exists jobs_user_id_idx on public.jobs(user_id);
      create unique index if not exists jobs_call_sid_unique on public.jobs(call_sid);
    `;

    await client.callTool({
      name: 'execute_sql',
      arguments: {
        project_id: config.projectId,
        query: alignJobsSql,
      },
    });

    const createNotificationTokensSql = `
      create table if not exists public.notification_tokens (
        id uuid primary key default gen_random_uuid(),
        user_id uuid references public.users(id) on delete cascade,
        platform text,
        token text unique,
        created_at timestamptz default now()
      );

      alter table public.notification_tokens
        add column if not exists user_id uuid;

      alter table public.notification_tokens
        add column if not exists platform text;

      alter table public.notification_tokens
        add column if not exists token text;

      alter table public.notification_tokens
        add column if not exists created_at timestamptz default now();

      create unique index if not exists notification_tokens_token_key
        on public.notification_tokens(token);

      create index if not exists notification_tokens_user_id_idx
        on public.notification_tokens(user_id);
    `;

    await client.callTool({
      name: 'execute_sql',
      arguments: {
        project_id: config.projectId,
        query: createNotificationTokensSql,
      },
    });

    const createCallersSql = `
      create table if not exists public.callers (
        id uuid primary key default gen_random_uuid(),
        user_id uuid references public.users(id) on delete cascade,
        phone_number text not null,
        label text not null default 'lead' check (label in ('lead', 'client', 'personal', 'spam')),
        display_name text,
        routing_override text check (routing_override in ('intake', 'voicemail', 'auto')),
        first_seen_at timestamptz not null default now(),
        last_seen_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      create unique index if not exists callers_user_phone_idx
        on public.callers(user_id, phone_number);

      create index if not exists callers_user_label_idx
        on public.callers(user_id, label);
    `;

    await client.callTool({
      name: 'execute_sql',
      arguments: {
        project_id: config.projectId,
        query: createCallersSql,
      },
    });

    const alterCallsForRoutingSql = `
      alter table public.calls
        add column if not exists caller_id uuid references public.callers(id) on delete set null,
        add column if not exists route_mode text,
        add column if not exists route_decision text,
        add column if not exists route_reason text,
        add column if not exists route_fallback boolean default false,
        add column if not exists route_evaluated_at timestamptz,
        add column if not exists feature_flag_version text,
        add column if not exists metadata jsonb default '{}'::jsonb;

      create index if not exists calls_user_route_idx
        on public.calls(user_id, route_decision, recorded_at desc nulls last);

      create index if not exists calls_caller_idx
        on public.calls(caller_id);
    `;

    await client.callTool({
      name: 'execute_sql',
      arguments: {
        project_id: config.projectId,
        query: alterCallsForRoutingSql,
      },
    });

    const createCallRoutingSettingsSql = `
      create table if not exists public.call_routing_settings (
        user_id uuid primary key references public.users(id) on delete cascade,
        mode text not null default 'smart_auto' check (mode in ('intake', 'voicemail', 'smart_auto')),
        after_hours_mode text not null default 'voicemail' check (after_hours_mode in ('intake', 'voicemail')),
        schedule jsonb,
        schedule_timezone text,
        feature_enabled boolean default true,
        updated_at timestamptz not null default now(),
        created_at timestamptz not null default now()
      );
    `;

    await client.callTool({
      name: 'execute_sql',
      arguments: {
        project_id: config.projectId,
        query: createCallRoutingSettingsSql,
      },
    });

    const createVoicemailsSql = `
      create table if not exists public.call_voicemails (
        id uuid primary key default gen_random_uuid(),
        call_sid text unique references public.calls(call_sid) on delete cascade,
        user_id uuid references public.users(id) on delete cascade,
        caller_id uuid references public.callers(id) on delete set null,
        transcription_id uuid references public.transcriptions(id) on delete set null,
        recording_url text,
        transcription_text text,
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      );

      create index if not exists call_voicemails_user_idx on public.call_voicemails(user_id, created_at desc);
    `;

    await client.callTool({
      name: 'execute_sql',
      arguments: {
        project_id: config.projectId,
        query: createVoicemailsSql,
      },
    });

    const ensureCallRoutingRlsSql = `
      alter table public.callers enable row level security;
      alter table public.callers force row level security;
      do $$
      begin
        if not exists (
          select 1 from pg_policies
           where schemaname = 'public'
             and tablename = 'callers'
             and policyname = 'Callers owner select'
        ) then
          execute $$create policy "Callers owner select" on public.callers for select using (user_id = auth.uid())$$;
        end if;

        if not exists (
          select 1 from pg_policies
           where schemaname = 'public'
             and tablename = 'callers'
             and policyname = 'Callers owner insert'
        ) then
          execute $$create policy "Callers owner insert" on public.callers for insert with check (user_id = auth.uid())$$;
        end if;

        if not exists (
          select 1 from pg_policies
           where schemaname = 'public'
             and tablename = 'callers'
             and policyname = 'Callers owner update'
        ) then
          execute $$create policy "Callers owner update" on public.callers for update using (user_id = auth.uid()) with check (user_id = auth.uid())$$;
        end if;

        if not exists (
          select 1 from pg_policies
           where schemaname = 'public'
             and tablename = 'callers'
             and policyname = 'Callers owner delete'
        ) then
          execute $$create policy "Callers owner delete" on public.callers for delete using (user_id = auth.uid())$$;
        end if;
      end
      $$;

      alter table public.call_routing_settings enable row level security;
      alter table public.call_routing_settings force row level security;
      do $$
      begin
        if not exists (
          select 1 from pg_policies
           where schemaname = 'public'
             and tablename = 'call_routing_settings'
             and policyname = 'Call routing settings select'
        ) then
          execute $$create policy "Call routing settings select" on public.call_routing_settings for select using (user_id = auth.uid())$$;
        end if;

        if not exists (
          select 1 from pg_policies
           where schemaname = 'public'
             and tablename = 'call_routing_settings'
             and policyname = 'Call routing settings insert'
        ) then
          execute $$create policy "Call routing settings insert" on public.call_routing_settings for insert with check (user_id = auth.uid())$$;
        end if;

        if not exists (
          select 1 from pg_policies
           where schemaname = 'public'
             and tablename = 'call_routing_settings'
             and policyname = 'Call routing settings update'
        ) then
          execute $$create policy "Call routing settings update" on public.call_routing_settings for update using (user_id = auth.uid()) with check (user_id = auth.uid())$$;
        end if;

        if not exists (
          select 1 from pg_policies
           where schemaname = 'public'
             and tablename = 'call_routing_settings'
             and policyname = 'Call routing settings delete'
        ) then
          execute $$create policy "Call routing settings delete" on public.call_routing_settings for delete using (user_id = auth.uid())$$;
        end if;
      end
      $$;

      alter table public.call_voicemails enable row level security;
      alter table public.call_voicemails force row level security;
      do $$
      begin
        if not exists (
          select 1 from pg_policies
           where schemaname = 'public'
             and tablename = 'call_voicemails'
             and policyname = 'Call voicemails select'
        ) then
          execute $$create policy "Call voicemails select" on public.call_voicemails for select using (
            user_id = auth.uid()
            or exists (
              select 1 from public.calls c
               where c.call_sid = call_sid
                 and c.user_id = auth.uid()
            )
          )$$;
        end if;

        if not exists (
          select 1 from pg_policies
           where schemaname = 'public'
             and tablename = 'call_voicemails'
             and policyname = 'Call voicemails delete'
        ) then
          execute $$create policy "Call voicemails delete" on public.call_voicemails for delete using (user_id = auth.uid())$$;
        end if;
      end
      $$;
    `;

    await client.callTool({
      name: 'execute_sql',
      arguments: {
        project_id: config.projectId,
        query: ensureCallRoutingRlsSql,
      },
    });

    return { client, transport, config };
  })();

  try {
    return await clientPromise;
  } catch (error) {
    clientPromise = undefined;
    throw error;
  }
};

const executeSql = async (query) => {
  const { client, config } = await ensureClient();

  const result = await client.callTool({
    name: 'execute_sql',
    arguments: {
      project_id: config.projectId,
      query,
    },
  });

  result.rows = parseResultRows(result);

  return result;
};

const getUserByTwilioNumber = async (phoneNumber) => {
  const normalized = normalizePhoneNumber(phoneNumber);
  if (!normalized) {
    return null;
  }

  const query = `
    select id, business_name, twilio_phone_number
      from public.users
     where twilio_phone_number = ${sqlString(normalized)}
     limit 1;
  `;

  const result = await executeSql(query);
  return result.rows?.[0] || null;
};

const getRoutingSettingsForUser = async (userId) => {
  if (!userId) {
    return null;
  }

  const query = `
    select user_id,
           mode,
           after_hours_mode,
           schedule,
           schedule_timezone,
           feature_enabled,
           updated_at
      from public.call_routing_settings
     where user_id = ${sqlString(userId)}
     limit 1;
  `;

  const result = await executeSql(query);
  return result.rows?.[0] || null;
};

const upsertRoutingSettings = async ({
  userId,
  mode,
  afterHoursMode,
  schedule,
  scheduleTimezone,
  featureEnabled,
}) => {
  if (!userId) {
    throw new Error('userId is required to upsert routing settings.');
  }

  const normalizedMode = mode && CALL_ROUTING_MODES.has(mode) ? mode : undefined;
  const normalizedAfterHours = afterHoursMode && ['intake', 'voicemail'].includes(afterHoursMode)
    ? afterHoursMode
    : undefined;

  const scheduleJson = schedule ? JSON.stringify(schedule) : null;

  const query = `
    insert into public.call_routing_settings (
      user_id,
      mode,
      after_hours_mode,
      schedule,
      schedule_timezone,
      feature_enabled,
      updated_at
    )
    values (
      ${sqlString(userId)},
      ${sqlString(normalizedMode || mode || 'smart_auto')},
      ${sqlString(normalizedAfterHours || afterHoursMode || 'voicemail')},
      ${scheduleJson ? sqlString(scheduleJson) : 'NULL'},
      ${sqlString(scheduleTimezone)},
      ${featureEnabled === undefined ? 'true' : (featureEnabled ? 'true' : 'false')},
      now()
    )
    on conflict (user_id) do update set
      mode = excluded.mode,
      after_hours_mode = excluded.after_hours_mode,
      schedule = excluded.schedule,
      schedule_timezone = excluded.schedule_timezone,
      feature_enabled = excluded.feature_enabled,
      updated_at = excluded.updated_at
    returning *;
  `;

  const result = await executeSql(query);
  return result.rows?.[0] || null;
};

const getCallerByPhone = async ({ userId, phoneNumber }) => {
  if (!userId) {
    throw new Error('userId is required to look up caller.');
  }

  const normalized = normalizePhoneNumber(phoneNumber);
  if (!normalized) {
    return null;
  }

  const query = `
    select id,
           user_id,
           phone_number,
           label,
           display_name,
           routing_override,
           first_seen_at,
           last_seen_at,
           created_at,
           updated_at
      from public.callers
     where user_id = ${sqlString(userId)}
       and phone_number = ${sqlString(normalized)}
     limit 1;
  `;

  const result = await executeSql(query);
  return result.rows?.[0] || null;
};

const upsertCaller = async ({
  userId,
  phoneNumber,
  label,
  displayName,
  routingOverride,
  seenAt,
}) => {
  if (!userId) {
    throw new Error('userId is required to upsert caller.');
  }

  const normalized = normalizePhoneNumber(phoneNumber);
  if (!normalized) {
    throw new Error('phoneNumber must be provided in E.164 format.');
  }

  const normalizedLabel = label && CALLER_LABELS.has(label) ? label : undefined;
  const normalizedOverride = routingOverride && CALLER_ROUTING_OVERRIDES.has(routingOverride)
    ? routingOverride
    : undefined;

  const nowIso = new Date().toISOString();

  const query = `
    insert into public.callers (
      id,
      user_id,
      phone_number,
      label,
      display_name,
      routing_override,
      first_seen_at,
      last_seen_at,
      created_at,
      updated_at
    )
    values (
      ${sqlString(randomUUID())},
      ${sqlString(userId)},
      ${sqlString(normalized)},
      ${sqlString(normalizedLabel || 'lead')},
      ${sqlString(displayName)},
      ${sqlString(normalizedOverride)},
      ${sqlString(seenAt || nowIso)},
      ${sqlString(seenAt || nowIso)},
      ${sqlString(nowIso)},
      ${sqlString(nowIso)}
    )
    on conflict (user_id, phone_number) do update set
      label = coalesce(excluded.label, public.callers.label),
      display_name = coalesce(excluded.display_name, public.callers.display_name),
      routing_override = coalesce(excluded.routing_override, public.callers.routing_override),
      last_seen_at = greatest(public.callers.last_seen_at, excluded.last_seen_at),
      updated_at = excluded.updated_at
    returning *;
  `;

  const result = await executeSql(query);
  return result.rows?.[0] || null;
};

const updateCallerRouting = async ({ callerId, label, routingOverride }) => {
  if (!callerId) {
    throw new Error('callerId is required to update caller routing.');
  }

  const normalizedLabel = label && CALLER_LABELS.has(label) ? label : undefined;
  const normalizedOverride = routingOverride && CALLER_ROUTING_OVERRIDES.has(routingOverride)
    ? routingOverride
    : undefined;

  const updates = [];
  if (normalizedLabel) {
    updates.push(`label = ${sqlString(normalizedLabel)}`);
  }
  if (routingOverride !== undefined) {
    updates.push(`routing_override = ${normalizedOverride ? sqlString(normalizedOverride) : 'NULL'}`);
  }

  if (updates.length === 0) {
    return null;
  }

  const query = `
    update public.callers
       set ${updates.join(', ')},
           updated_at = now()
     where id = ${sqlString(callerId)}
     returning *;
  `;

  const result = await executeSql(query);
  return result.rows?.[0] || null;
};

const insertVoicemail = async ({
  callSid,
  userId,
  callerId,
  transcriptionId,
  recordingUrl,
  transcriptionText,
}) => {
  if (!callSid) {
    throw new Error('callSid is required to store voicemail.');
  }

  const fallbackUserSelect = `(select user_id from public.calls where call_sid = ${sqlString(callSid)} limit 1)`;
  const userIdValue = userId ? sqlString(userId) : fallbackUserSelect;

  const query = `
    insert into public.call_voicemails (
      id,
      call_sid,
      user_id,
      caller_id,
      transcription_id,
      recording_url,
      transcription_text,
      created_at,
      updated_at
    )
    values (
      ${sqlString(randomUUID())},
      ${sqlString(callSid)},
      ${userIdValue},
      ${sqlString(callerId)},
      ${sqlString(transcriptionId)},
      ${sqlString(recordingUrl)},
      ${sqlString(transcriptionText)},
      now(),
      now()
    )
    on conflict (call_sid) do update set
      caller_id = coalesce(excluded.caller_id, public.call_voicemails.caller_id),
      transcription_id = coalesce(excluded.transcription_id, public.call_voicemails.transcription_id),
      recording_url = coalesce(excluded.recording_url, public.call_voicemails.recording_url),
      transcription_text = coalesce(excluded.transcription_text, public.call_voicemails.transcription_text),
      user_id = coalesce(
        excluded.user_id,
        public.call_voicemails.user_id,
        (select user_id from public.calls where call_sid = excluded.call_sid limit 1)
      ),
      updated_at = now()
    returning *;
  `;

  const result = await executeSql(query);
  return result.rows?.[0] || null;
};

const listVoicemailsForUser = async ({ userId, limit = 20, offset = 0 }) => {
  if (!userId) {
    throw new Error('userId is required to list voicemails.');
  }

  const query = `
    select v.id,
           v.call_sid,
           v.user_id,
           v.caller_id,
           v.transcription_id,
           v.recording_url,
           v.transcription_text,
           v.created_at,
           v.updated_at,
           c.phone_number as caller_phone,
           c.label as caller_label
      from public.call_voicemails v
      left join public.callers c on c.id = v.caller_id
     where v.user_id = ${sqlString(userId)}
     order by v.created_at desc
     limit ${Math.max(1, limit)} offset ${Math.max(0, offset)};
  `;

  const result = await executeSql(query);
  return result.rows || [];
};

const upsertCallRecord = async ({
  callSid,
  userId,
  fromNumber,
  toNumber,
  recordingUrl,
  recordingSid,
  recordingStoragePath,
  recordingSignedExpiresAt,
  recordingExpiresAt,
  durationSec,
  recordedAt,
  transcriptionStatus,
  status,
  callerId,
  routeMode,
  routeDecision,
  routeReason,
  routeFallback,
  routeEvaluatedAt,
  featureFlagVersion,
  metadata,
}) => {
  if (!callSid) {
    throw new Error('callSid is required for upsert.');
  }

  const durationValue = Number.isFinite(durationSec) ? Number(durationSec) : null;
  const metadataJson = metadata ? JSON.stringify(metadata) : null;
  const normalizedMode = routeMode && CALL_ROUTING_MODES.has(routeMode) ? routeMode : routeMode;

  const query = `
    insert into public.calls (
      call_sid,
      user_id,
      from_number,
      to_number,
      recording_url,
      recording_sid,
      recording_storage_path,
      recording_signed_expires_at,
      recording_expires_at,
      duration_sec,
      recorded_at,
      transcription_status,
      transcription_updated_at,
      status,
      caller_id,
      route_mode,
      route_decision,
      route_reason,
      route_fallback,
      route_evaluated_at,
      feature_flag_version,
      metadata
    )
    values (
      ${sqlString(callSid)},
      ${sqlString(userId)},
      ${sqlString(fromNumber)},
      ${sqlString(toNumber)},
      ${sqlString(recordingUrl)},
      ${sqlString(recordingSid)},
      ${sqlString(recordingStoragePath)},
      ${sqlString(recordingSignedExpiresAt)},
      ${sqlString(recordingExpiresAt)},
      ${durationValue === null ? 'NULL' : durationValue},
      ${sqlString(recordedAt)},
      ${sqlString(transcriptionStatus)},
      ${transcriptionStatus ? 'now()' : 'NULL'},
      ${sqlString(status)},
      ${sqlString(callerId)},
      ${sqlString(normalizedMode)},
      ${sqlString(routeDecision)},
      ${sqlString(routeReason)},
      ${routeFallback ? 'true' : 'false'},
      ${sqlString(routeEvaluatedAt)},
      ${sqlString(featureFlagVersion)},
      ${metadataJson ? sqlString(metadataJson) : "'{}'::jsonb"}
    )
    on conflict (call_sid) do update set
      user_id = coalesce(excluded.user_id, public.calls.user_id),
      from_number = excluded.from_number,
      to_number = excluded.to_number,
      recording_url = excluded.recording_url,
      recording_sid = coalesce(excluded.recording_sid, public.calls.recording_sid),
      recording_storage_path = coalesce(excluded.recording_storage_path, public.calls.recording_storage_path),
      recording_signed_expires_at = excluded.recording_signed_expires_at,
      recording_expires_at = excluded.recording_expires_at,
      duration_sec = excluded.duration_sec,
      recorded_at = excluded.recorded_at,
      transcription_status = case
        when excluded.transcription_status is not null then excluded.transcription_status
        else public.calls.transcription_status
      end,
      transcription_updated_at = case
        when excluded.transcription_status is not null
          and excluded.transcription_status is distinct from public.calls.transcription_status then now()
        else public.calls.transcription_updated_at
      end,
      status = coalesce(excluded.status, public.calls.status),
      caller_id = coalesce(excluded.caller_id, public.calls.caller_id),
      route_mode = coalesce(excluded.route_mode, public.calls.route_mode),
      route_decision = coalesce(excluded.route_decision, public.calls.route_decision),
      route_reason = coalesce(excluded.route_reason, public.calls.route_reason),
      route_fallback = excluded.route_fallback,
      route_evaluated_at = coalesce(excluded.route_evaluated_at, public.calls.route_evaluated_at),
      feature_flag_version = coalesce(excluded.feature_flag_version, public.calls.feature_flag_version),
      metadata = coalesce(excluded.metadata, public.calls.metadata);
  `;

  await executeSql(query);
};

const getTranscriptByCallSid = async (callSid) => {
  if (!callSid) {
    throw new Error('callSid is required for transcription lookup.');
  }

  const query = `
    select id, call_sid, engine, "text", confidence, language, created_at
    from public.transcriptions
    where call_sid = ${sqlString(callSid)}
    limit 1;
  `;

  const result = await executeSql(query);
  return Array.isArray(result.rows) && result.rows.length > 0 ? result.rows[0] : null;
};

const insertTranscription = async ({ id, callSid, engine, text, confidence, language }) => {
  if (!id) {
    throw new Error('id is required for transcription insert.');
  }

  if (!callSid) {
    throw new Error('callSid is required for transcription insert.');
  }

  const query = `
    insert into public.transcriptions (id, call_sid, engine, "text", confidence, language)
    values (
      ${sqlString(id)},
      ${sqlString(callSid)},
      ${sqlString(engine)},
      ${sqlString(text)},
      ${typeof confidence === 'number' ? confidence : '0.8'},
      ${sqlString(language)}
    )
    on conflict (call_sid) do update set
      engine = excluded.engine,
      "text" = excluded."text",
      confidence = excluded.confidence,
      language = excluded.language,
      created_at = now()
    returning id;
  `;

  const result = await executeSql(query);
  return Array.isArray(result.rows) && result.rows.length > 0 ? result.rows[0] : null;
};

const updateCallTranscriptionStatus = async ({ callSid, status }) => {
  if (!callSid) {
    throw new Error('callSid is required for transcription status update.');
  }

  const query = `
    update public.calls
    set
      transcription_status = ${sqlString(status)},
      transcription_updated_at = now()
    where call_sid = ${sqlString(callSid)};
  `;

  await executeSql(query);
};

const getCallBySid = async (callSid) => {
  if (!callSid) {
    throw new Error('callSid is required to lookup call metadata.');
  }

  const query = `
    select
      call_sid,
      user_id,
      from_number,
      to_number,
      recording_url,
      recording_sid,
      recording_storage_path,
      recording_signed_expires_at,
      recording_expires_at,
      duration_sec,
      recorded_at,
      transcription_status,
      status
    from public.calls
    where call_sid = ${sqlString(callSid)}
    limit 1;
  `;

  const result = await executeSql(query);
  return Array.isArray(result.rows) && result.rows.length > 0 ? result.rows[0] : null;
};

const getUserProfileById = async (userId) => {
  if (!userId) {
    throw new Error('userId is required to lookup user profile.');
  }

  const query = `
    select id, email, business_name, business_type, phone_number
    from public.users
    where id = ${sqlString(userId)}
    limit 1;
  `;

  const result = await executeSql(query);
  return Array.isArray(result.rows) && result.rows.length > 0 ? result.rows[0] : null;
};

const findExpiredRecordingCalls = async ({ cutoffIso, limit = 50 }) => {
  if (!cutoffIso) {
    throw new Error('cutoffIso is required to locate expired recordings.');
  }

  const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(Number(limit), 200)) : 50;

  const query = `
    select call_sid, recording_storage_path
    from public.calls
    where recording_storage_path is not null
      and recording_expires_at is not null
      and recording_expires_at <= ${sqlString(cutoffIso)}
      and coalesce(status, 'active') <> 'expired'
      and recording_deleted_at is null
    limit ${normalizedLimit};
  `;

  const result = await executeSql(query);
  return Array.isArray(result.rows) ? result.rows : [];
};

const markCallRecordingExpired = async ({ callSid, clearStoragePath = false }) => {
  if (!callSid) {
    throw new Error('callSid is required to mark recording expired.');
  }

  const updates = [
    "status = 'expired'",
    'recording_url = NULL',
    'recording_signed_expires_at = NULL',
    'recording_expires_at = coalesce(recording_expires_at, now())',
    'recording_deleted_at = now()'
  ];

  if (clearStoragePath) {
    updates.push('recording_storage_path = NULL');
  }

  const query = `
    update public.calls
    set ${updates.join(', ')}
    where call_sid = ${sqlString(callSid)};
  `;

  await executeSql(query);
};

const updateCallRecordingSignedUrl = async ({ callSid, signedUrl, signedExpiresAt }) => {
  if (!callSid) {
    throw new Error('callSid is required to update recording URL.');
  }

  const query = `
    update public.calls
    set
      recording_url = ${sqlString(signedUrl)},
      recording_signed_expires_at = ${signedExpiresAt ? sqlString(signedExpiresAt) : 'NULL'},
      status = case when coalesce(status, 'active') = 'expired' then 'expired' else coalesce(status, 'active') end
    where call_sid = ${sqlString(callSid)};
  `;

  await executeSql(query);
};

const getJobByCallSid = async (callSid) => {
  if (!callSid) {
    throw new Error('callSid is required to lookup job by call.');
  }

  const query = `
    select id, user_id, call_sid, customer_name, customer_phone, summary, service_type, status, created_at
    from public.jobs
    where call_sid = ${sqlString(callSid)}
    limit 1;
  `;

  const result = await executeSql(query);
  return Array.isArray(result.rows) && result.rows.length > 0 ? result.rows[0] : null;
};

const getJobById = async (id) => {
  if (!id) {
    throw new Error('id is required to lookup job.');
  }

  const query = `
    select id, user_id, call_sid, customer_name, customer_phone, summary, service_type, status, created_at
    from public.jobs
    where id = ${sqlString(id)}
    limit 1;
  `;

  const result = await executeSql(query);
  return Array.isArray(result.rows) && result.rows.length > 0 ? result.rows[0] : null;
};

const listJobsForUser = async ({ userId, status, limit = 20, offset = 0 }) => {
  if (!userId) {
    throw new Error('userId is required to list jobs.');
  }

  const parsedLimit = Number.parseInt(limit, 10);
  const parsedOffset = Number.parseInt(offset, 10);
  const normalizedLimit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(parsedLimit, 1), 100)
    : 20;
  const normalizedOffset = Number.isFinite(parsedOffset) && parsedOffset >= 0
    ? parsedOffset
    : 0;

  const conditions = [`user_id = ${sqlString(userId)}`];

  if (status) {
    conditions.push(`status = ${sqlString(status)}`);
  }

  const query = `
    select id, call_sid, customer_name, customer_phone, summary, service_type, status, created_at
    from public.jobs
    where ${conditions.join(' and ')}
    order by created_at desc, id desc
    limit ${normalizedLimit}
    offset ${normalizedOffset};
  `;

  const result = await executeSql(query);
  return Array.isArray(result.rows) ? result.rows : [];
};

const getJobForUser = async ({ jobId, userId }) => {
  if (!jobId) {
    throw new Error('jobId is required to lookup job.');
  }

  if (!userId) {
    throw new Error('userId is required to scope job lookup.');
  }

  const query = `
    select id, user_id, call_sid, customer_name, customer_phone, summary, service_type, status, created_at
    from public.jobs
    where id = ${sqlString(jobId)}
      and user_id = ${sqlString(userId)}
    limit 1;
  `;

  const result = await executeSql(query);
  return Array.isArray(result.rows) && result.rows.length > 0 ? result.rows[0] : null;
};

const updateJobStatusForUser = async ({ jobId, userId, status }) => {
  if (!jobId) {
    throw new Error('jobId is required to update job status.');
  }

  if (!userId) {
    throw new Error('userId is required to update job status.');
  }

  const query = `
    update public.jobs
       set status = ${sqlString(status)}
     where id = ${sqlString(jobId)}
       and user_id = ${sqlString(userId)}
     returning id, user_id, call_sid, customer_name, customer_phone, summary, service_type, status, created_at;
  `;

  const result = await executeSql(query);
  return Array.isArray(result.rows) && result.rows.length > 0 ? result.rows[0] : null;
};

const insertJob = async ({
  id,
  userId,
  callSid,
  customerName,
  customerPhone,
  customerEmail,
  summary,
  serviceType,
  status,
  businessType,
  scheduledDate,
  scheduledTime,
  location,
  notes,
  estimatedDuration,
  source,
  followUpDraft,
  lastFollowUpAt,
  voicemailTranscript,
  voicemailRecordingUrl,
  capturedAt,
}) => {
  if (!callSid) {
    throw new Error('callSid is required for job insert.');
  }

  const jobId = id || randomUUID();

  const resolvedBusinessType = businessType
    ? sqlString(businessType)
    : userId
      ? `(select business_type from public.users where id = ${sqlString(userId)} limit 1)`
      : 'NULL';

  const query = `
    insert into public.jobs (
      id,
      user_id,
      call_sid,
      customer_name,
      customer_phone,
      customer_email,
      summary,
      service_type,
      status,
      business_type,
      scheduled_date,
      scheduled_time,
      location,
      notes,
      estimated_duration,
      source,
      follow_up_draft,
      last_follow_up_at,
      voicemail_transcript,
      voicemail_recording_url,
      captured_at
    )
    values (
      ${sqlString(jobId)},
      ${sqlString(userId)},
      ${sqlString(callSid)},
      ${sqlString(customerName)},
      ${sqlString(customerPhone)},
      ${sqlString(customerEmail)},
      ${sqlString(summary)},
      ${sqlString(serviceType)},
      ${sqlString(status || 'new')},
      ${resolvedBusinessType},
      ${sqlString(scheduledDate)},
      ${sqlString(scheduledTime)},
      ${sqlString(location)},
      ${sqlString(notes)},
      ${sqlString(estimatedDuration)},
      ${sqlString(source)},
      ${sqlString(followUpDraft)},
      ${sqlString(lastFollowUpAt)},
      ${sqlString(voicemailTranscript)},
      ${sqlString(voicemailRecordingUrl)},
      coalesce(${sqlString(capturedAt)}, now())
    )
    on conflict (call_sid) do update set
      user_id = coalesce(excluded.user_id, public.jobs.user_id),
      customer_name = excluded.customer_name,
      customer_phone = excluded.customer_phone,
      customer_email = excluded.customer_email,
      summary = excluded.summary,
      service_type = excluded.service_type,
      status = excluded.status,
      business_type = coalesce(excluded.business_type, public.jobs.business_type),
      scheduled_date = coalesce(excluded.scheduled_date, public.jobs.scheduled_date),
      scheduled_time = coalesce(excluded.scheduled_time, public.jobs.scheduled_time),
      location = coalesce(excluded.location, public.jobs.location),
      notes = coalesce(excluded.notes, public.jobs.notes),
      estimated_duration = coalesce(excluded.estimated_duration, public.jobs.estimated_duration),
      source = coalesce(excluded.source, public.jobs.source),
      follow_up_draft = coalesce(excluded.follow_up_draft, public.jobs.follow_up_draft),
      last_follow_up_at = coalesce(excluded.last_follow_up_at, public.jobs.last_follow_up_at),
      voicemail_transcript = coalesce(excluded.voicemail_transcript, public.jobs.voicemail_transcript),
      voicemail_recording_url = coalesce(excluded.voicemail_recording_url, public.jobs.voicemail_recording_url),
      captured_at = coalesce(excluded.captured_at, public.jobs.captured_at)
    returning id;
  `;

  const result = await executeSql(query);
  return Array.isArray(result.rows) && result.rows.length > 0 ? result.rows[0] : { id: jobId };
};

const upsertNotificationToken = async ({ userId, platform, token }) => {
  if (!userId) {
    throw new Error('userId is required to upsert notification token.');
  }

  if (!token) {
    throw new Error('token is required to upsert notification token.');
  }

  const normalizedPlatform = typeof platform === 'string' ? platform.toLowerCase() : null;

  if (!normalizedPlatform || !VALID_NOTIFICATION_PLATFORMS.has(normalizedPlatform)) {
    throw new Error('platform must be one of ios or android.');
  }

  const query = `
    insert into public.notification_tokens (user_id, platform, token)
    values (
      ${sqlString(userId)},
      ${sqlString(normalizedPlatform)},
      ${sqlString(token)}
    )
    on conflict (token) do update set
      user_id = excluded.user_id,
      platform = excluded.platform,
      created_at = now()
    returning id, user_id, platform, token, created_at;
  `;

  const result = await executeSql(query);
  return Array.isArray(result.rows) && result.rows.length > 0 ? result.rows[0] : null;
};

const listNotificationTokensForUser = async ({ userId }) => {
  if (!userId) {
    throw new Error('userId is required to list notification tokens.');
  }

  const query = `
    select id, user_id, platform, token, created_at
    from public.notification_tokens
    where user_id = ${sqlString(userId)}
    order by created_at desc;
  `;

  const result = await executeSql(query);
  return Array.isArray(result.rows) ? result.rows : [];
};

module.exports = {
  normalizePhoneNumber,
  CALLER_LABELS,
  CALLER_ROUTING_OVERRIDES,
  CALL_ROUTING_MODES,
  executeSql,
  getUserByTwilioNumber,
  getRoutingSettingsForUser,
  upsertRoutingSettings,
  getCallerByPhone,
  upsertCaller,
  updateCallerRouting,
  insertVoicemail,
  listVoicemailsForUser,
  upsertCallRecord,
  getTranscriptByCallSid,
  insertTranscription,
  updateCallTranscriptionStatus,
  getCallBySid,
  getJobByCallSid,
  getJobById,
  listJobsForUser,
  getJobForUser,
  updateJobStatusForUser,
  insertJob,
  getUserProfileById,
  upsertNotificationToken,
  listNotificationTokensForUser,
  findExpiredRecordingCalls,
  markCallRecordingExpired,
  updateCallRecordingSignedUrl,
};
