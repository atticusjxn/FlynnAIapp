const { once } = require('events');

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
  fromNumber,
  toNumber,
  recordingUrl,
  durationSec,
  recordedAt,
  transcriptionStatus,
}) => {
  if (!callSid) {
    throw new Error('callSid is required for upsert.');
  }

  const durationValue = Number.isFinite(durationSec) ? Number(durationSec) : null;

  const query = `
    insert into public.calls (call_sid, from_number, to_number, recording_url, duration_sec, recorded_at, transcription_status, transcription_updated_at)
    values (
      ${sqlString(callSid)},
      ${sqlString(fromNumber)},
      ${sqlString(toNumber)},
      ${sqlString(recordingUrl)},
      ${durationValue === null ? 'NULL' : durationValue},
      ${sqlString(recordedAt)},
      ${sqlString(transcriptionStatus)},
      ${transcriptionStatus ? 'now()' : 'NULL'}
    )
    on conflict (call_sid) do update set
      from_number = excluded.from_number,
      to_number = excluded.to_number,
      recording_url = excluded.recording_url,
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
      end;
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

module.exports = {
  upsertCallRecord,
  executeSql,
  getTranscriptByCallSid,
  insertTranscription,
  updateCallTranscriptionStatus,
};
