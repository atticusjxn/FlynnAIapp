const { once } = require('events');
const { randomUUID } = require('crypto');
const { createClient } = require('@supabase/supabase-js');

let clientPromise;

const sqlString = (value) => {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  return `'${String(value).replace(/'/g, "''")}'`;
};

const jsonValue = (value) => {
  if (!value) {
    return `'{}'::jsonb`;
  }

  if (typeof value === 'string') {
    return `'${value.replace(/'/g, "''")}'::jsonb`;
  }

  try {
    const serialized = JSON.stringify(value);
    return `'${serialized.replace(/'/g, "''")}'::jsonb`;
  } catch (error) {
    console.warn('[Supabase] Failed to serialize JSON payload for call_events.', error);
    return `'{}'::jsonb`;
  }
};

const VALID_NOTIFICATION_PLATFORMS = new Set(['ios', 'android']);

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
        let textToParse = block.text;

        // Handle double-escaped JSON (MCP server wraps response in quotes)
        try {
          const firstParse = JSON.parse(textToParse);
          if (typeof firstParse === 'string') {
            textToParse = firstParse;
          }
        } catch (e) {
          // Not double-escaped, continue with original text
        }

        // Extract from untrusted-data tags
        const match = textToParse.match(/<untrusted-data-[^>]+>\s*\n(.+?)\n<\/untrusted-data-/s);
        if (match && match[1]) {
          try {
            const innerParsed = JSON.parse(match[1]);
            if (Array.isArray(innerParsed)) {
              return innerParsed;
            }
            if (innerParsed && Array.isArray(innerParsed.rows)) {
              return innerParsed.rows;
            }
          } catch (innerError) {
            console.warn('[Supabase MCP] Failed to parse data from untrusted-data tags:', innerError);
          }
        }

        // Fallback: try to parse the whole text
        try {
          const parsed = JSON.parse(textToParse);
          if (Array.isArray(parsed)) {
            return parsed;
          }
          if (parsed && Array.isArray(parsed.rows)) {
            return parsed.rows;
          }
        } catch (error) {
          // Ignore parse failures
        }
      }
    }
  }

  return [];
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
        SUPABASE_SERVICE_ROLE_KEY: config.supabaseKey, // Ensure service role for RLS bypass
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

    return { client, transport, config };
  })();

  try {
    return await clientPromise;
  } catch (error) {
    clientPromise = undefined;
    throw error;
  }
};

// Direct Supabase client (bypassing MCP for production use)
let directClient;

const getDirectClient = () => {
  if (directClient) {
    return directClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_KEY
    || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('[Supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  directClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('[Supabase] Direct client initialized');
  return directClient;
};

const executeSql = async (query) => {
  try {
    const client = getDirectClient();

    // Use Supabase's RPC to execute raw SQL via a Postgres function
    // Note: This requires a database function, so we'll use the REST API directly
    const { data, error } = await client.rpc('execute_sql', { sql: query });

    if (error) {
      // If the RPC function doesn't exist, we need to query tables directly
      // For now, return empty result and log the error
      console.error('[Supabase] SQL execution error:', error);
      return { rows: [], error };
    }

    console.log('[Supabase] Query successful, rows:', data?.length || 0);
    return { rows: data || [], error: null };
  } catch (error) {
    console.error('[Supabase] SQL execution failed:', error);
    return { rows: [], error };
  }
};

const upsertCallRecord = async ({
  callSid,
  userId,
  orgId,
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
}) => {
  if (!callSid) {
    throw new Error('callSid is required for upsert.');
  }

  const durationValue = Number.isFinite(durationSec) ? Number(durationSec) : null;
  const resolvedOrgIdValue = orgId
    ? sqlString(orgId)
    : userId
      ? `(select default_org_id from public.users where id = ${sqlString(userId)} limit 1)`
      : 'NULL';

  const query = `
    insert into public.calls (
      call_sid,
      user_id,
      org_id,
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
      status
    )
    values (
      ${sqlString(callSid)},
      ${sqlString(userId)},
      ${resolvedOrgIdValue},
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
      ${sqlString(status)}
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
      org_id = coalesce(excluded.org_id, public.calls.org_id);
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

const insertTranscription = async ({ id, callSid, engine, text, confidence, language, orgId }) => {
  if (!id) {
    throw new Error('id is required for transcription insert.');
  }

  if (!callSid) {
    throw new Error('callSid is required for transcription insert.');
  }

  const resolvedOrgId = orgId
    ? sqlString(orgId)
    : `(select org_id from public.calls where call_sid = ${sqlString(callSid)} limit 1)`;

  const query = `
    insert into public.transcriptions (id, call_sid, org_id, engine, "text", confidence, language)
    values (
      ${sqlString(id)},
      ${sqlString(callSid)},
      ${resolvedOrgId},
      ${sqlString(engine)},
      ${sqlString(text)},
      ${typeof confidence === 'number' ? confidence : '0.8'},
      ${sqlString(language)}
    )
    on conflict (call_sid) do update set
      org_id = coalesce(excluded.org_id, public.transcriptions.org_id),
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
      org_id,
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
    select
      u.id,
      u.default_org_id,
      u.email,
      u.business_name,
      u.business_type,
      u.phone_number,
      u.receptionist_configured,
      u.receptionist_mode,
      u.receptionist_voice,
      u.receptionist_greeting,
      u.receptionist_questions,
      u.receptionist_voice_profile_id,
      u.receptionist_ack_library,
      u.receptionist_business_profile,
      vp.voice_id as receptionist_voice_id,
      vp.status as receptionist_voice_status
    from public.users u
    left join public.voice_profiles vp
      on vp.id = u.receptionist_voice_profile_id
    where u.id = ${sqlString(userId)}
    limit 1;
  `;

  const result = await executeSql(query);
  return Array.isArray(result.rows) && result.rows.length > 0 ? result.rows[0] : null;
};

const getReceptionistProfileByNumber = async (phoneNumber) => {
  if (!phoneNumber) {
    throw new Error('phoneNumber is required to lookup receptionist profile.');
  }

  const normalized = phoneNumber.replace(/\s+/g, '');

  console.log('[Supabase] Looking up receptionist profile:', {
    originalPhoneNumber: phoneNumber,
    normalizedPhoneNumber: normalized,
  });

  try {
    const client = getDirectClient();

    // Query users table with voice_profiles join using Supabase query builder
    const { data, error } = await client
      .from('users')
      .select(`
        id,
        default_org_id,
        business_name,
        business_type,
        phone_number,
        twilio_phone_number,
        receptionist_configured,
        receptionist_mode,
        receptionist_voice,
        receptionist_greeting,
        receptionist_questions,
        receptionist_voice_profile_id,
        receptionist_ack_library,
        receptionist_business_profile,
        voice_profiles!receptionist_voice_profile_id (
          voice_id,
          status
        )
      `)
      .eq('twilio_phone_number', normalized)
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('[Supabase] Query error:', error);
      return null;
    }

    // Flatten the voice_profiles join
    let profile = null;
    if (data) {
      const voiceProfile = data.voice_profiles;
      profile = {
        ...data,
        receptionist_voice_id: voiceProfile?.voice_id || null,
        receptionist_voice_status: voiceProfile?.status || null,
      };
      delete profile.voice_profiles;
    }

    console.log('[Supabase] Query result:', {
      rowCount: profile ? 1 : 0,
      foundProfile: !!profile,
      profileData: profile,
    });

    return profile;
  } catch (error) {
    console.error('[Supabase] Failed to get receptionist profile:', error);
    return null;
  }
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
    select id, call_sid, customer_name, customer_phone, summary, service_type, status, created_at, org_id
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
  orgId,
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
  const resolvedOrgId = orgId
    ? sqlString(orgId)
    : callSid
      ? `(select org_id from public.calls where call_sid = ${sqlString(callSid)} limit 1)`
      : userId
        ? `(select default_org_id from public.users where id = ${sqlString(userId)} limit 1)`
        : 'NULL';

  const resolvedBusinessType = businessType
    ? sqlString(businessType)
    : userId
      ? `(select business_type from public.users where id = ${sqlString(userId)} limit 1)`
      : 'NULL';

  const query = `
    insert into public.jobs (
      id,
      user_id,
      org_id,
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
      ${resolvedOrgId},
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
      captured_at = coalesce(excluded.captured_at, public.jobs.captured_at),
      org_id = coalesce(excluded.org_id, public.jobs.org_id)
    returning id;
  `;

  const result = await executeSql(query);
  return Array.isArray(result.rows) && result.rows.length > 0 ? result.rows[0] : { id: jobId };
};

const upsertNotificationToken = async ({ userId, platform, token, orgId }) => {
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

  const resolvedOrgId = orgId
    ? sqlString(orgId)
    : `(select default_org_id from public.users where id = ${sqlString(userId)} limit 1)`;

  const query = `
    insert into public.notification_tokens (user_id, org_id, platform, token)
    values (
      ${sqlString(userId)},
      ${resolvedOrgId},
      ${sqlString(normalizedPlatform)},
      ${sqlString(token)}
    )
    on conflict (token) do update set
      user_id = excluded.user_id,
      org_id = coalesce(excluded.org_id, public.notification_tokens.org_id),
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

const recordCallEvent = async ({
  orgId,
  numberId,
  callSid,
  eventType,
  direction,
  payload,
  occurredAt,
}) => {
  if (!orgId) {
    throw new Error('orgId is required to record a call event.');
  }

  if (!eventType) {
    throw new Error('eventType is required to record a call event.');
  }

  const query = `
    insert into public.call_events (
      org_id,
      number_id,
      call_sid,
      event_type,
      direction,
      payload,
      occurred_at
    )
    values (
      ${sqlString(orgId)},
      ${numberId ? sqlString(numberId) : 'NULL'},
      ${callSid ? sqlString(callSid) : 'NULL'},
      ${sqlString(eventType)},
      ${direction ? sqlString(direction) : 'NULL'},
      ${jsonValue(payload)},
      ${occurredAt ? sqlString(occurredAt) : 'now()'}
    );
  `;

  await executeSql(query);
};

/**
 * Fetch business context for AI receptionist
 * @param {string} orgId - Organization ID
 * @returns {Promise<Object|null>} Business context data
 */
const getBusinessContextForOrg = async (orgId) => {
  if (!orgId) {
    return null;
  }

  try {
    const client = getDirectClient();

    // Call the database helper function to get formatted business context
    const { data, error } = await client
      .rpc('get_business_context_for_org', { p_org_id: orgId });

    if (error) {
      console.error('[Supabase] Error fetching business context:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[Supabase] Failed to fetch business context:', error);
    return null;
  }
};

module.exports = {
  upsertCallRecord,
  executeSql,
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
  getReceptionistProfileByNumber,
  upsertNotificationToken,
  listNotificationTokensForUser,
  findExpiredRecordingCalls,
  markCallRecordingExpired,
  updateCallRecordingSignedUrl,
  recordCallEvent,
  getBusinessContextForOrg,
};
