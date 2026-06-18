/**
 * Tool-usage telemetry — fire-and-forget.
 *
 * Every tool execution in the agent loop (and web-initiated executions from the
 * dashboard) emits one row into tool_call_events. This is the signal the
 * dashboard manifest generator ranks on. It must NEVER throw into the agent
 * turn: the insert is not awaited and any failure is swallowed/logged.
 */

/**
 * @param {object} ctx   agent ctx ({ supabase, user, phone })
 * @param {object} event { toolName, capability, provider, success, source }
 */
function logToolEvent(ctx, { toolName, capability, provider, success, source } = {}) {
  try {
    if (!ctx?.supabase || !toolName || !capability) return;
    ctx.supabase
      .from('tool_call_events')
      .insert({
        user_id: ctx.user?.id || null,
        user_phone: ctx.phone,
        tool_name: toolName,
        capability,
        provider: provider || null,
        success: success !== false,
        source: source || 'llm',
      })
      .then(({ error }) => {
        if (error) console.warn('[toolEvents] insert failed:', error.message);
      })
      .catch((e) => console.warn('[toolEvents] insert threw:', e?.message || e));
  } catch (e) {
    // never let telemetry break a turn
    console.warn('[toolEvents] unexpected:', e?.message || e);
  }
}

module.exports = { logToolEvent };
