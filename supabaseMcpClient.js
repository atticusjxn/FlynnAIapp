const { once } = require('events');
const { randomUUID } = require('crypto');

let clientPromise;

const sqlString = (value) => {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  return `'${String(value).replace(/'/g, "''")}'`;
};

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
}) => {
  if (!callSid) {
    throw new Error('callSid is required for upsert.');
  }

  const durationValue = Number.isFinite(durationSec) ? Number(durationSec) : null;

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
      status
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
      status = coalesce(excluded.status, public.calls.status);
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
  summary,
  serviceType,
  status,
}) => {
  if (!callSid) {
    throw new Error('callSid is required for job insert.');
  }

  const jobId = id || randomUUID();

  const query = `
    insert into public.jobs (id, user_id, call_sid, customer_name, customer_phone, summary, service_type, status)
    values (
      ${sqlString(jobId)},
      ${sqlString(userId)},
      ${sqlString(callSid)},
      ${sqlString(customerName)},
      ${sqlString(customerPhone)},
      ${sqlString(summary)},
      ${sqlString(serviceType)},
      ${sqlString(status || 'new')}
    )
    on conflict (call_sid) do update set
      user_id = coalesce(excluded.user_id, public.jobs.user_id),
      customer_name = excluded.customer_name,
      customer_phone = excluded.customer_phone,
      summary = excluded.summary,
      service_type = excluded.service_type,
      status = excluded.status
    returning id;
  `;

  const result = await executeSql(query);
  return Array.isArray(result.rows) && result.rows.length > 0 ? result.rows[0] : { id: jobId };
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
  findExpiredRecordingCalls,
  markCallRecordingExpired,
  updateCallRecordingSignedUrl,
};
