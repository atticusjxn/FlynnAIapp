const { once } = require('events');

let clientPromise;

const sqlString = (value) => {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  return `'${String(value).replace(/'/g, "''")}'`;
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

    const createTableSql = `
      create table if not exists public.calls (
        call_sid text primary key,
        from_number text,
        to_number text,
        recording_url text,
        duration_sec integer,
        recorded_at timestamptz
      );
    `;

    await client.callTool({
      name: 'execute_sql',
      arguments: {
        project_id: config.projectId,
        query: createTableSql,
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

  return result;
};

const upsertCallRecord = async ({
  callSid,
  fromNumber,
  toNumber,
  recordingUrl,
  durationSec,
  recordedAt,
}) => {
  if (!callSid) {
    throw new Error('callSid is required for upsert.');
  }

  const durationValue = Number.isFinite(durationSec) ? Number(durationSec) : null;

  const query = `
    insert into public.calls (call_sid, from_number, to_number, recording_url, duration_sec, recorded_at)
    values (
      ${sqlString(callSid)},
      ${sqlString(fromNumber)},
      ${sqlString(toNumber)},
      ${sqlString(recordingUrl)},
      ${durationValue === null ? 'NULL' : durationValue},
      ${sqlString(recordedAt)}
    )
    on conflict (call_sid) do update set
      from_number = excluded.from_number,
      to_number = excluded.to_number,
      recording_url = excluded.recording_url,
      duration_sec = excluded.duration_sec,
      recorded_at = excluded.recorded_at;
  `;

  await executeSql(query);
};

module.exports = {
  upsertCallRecord,
  executeSql,
};
