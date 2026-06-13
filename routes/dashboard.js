/**
 * Customer-facing dashboard API + web login bounce.
 *
 *   GET  /api/dashboard/manifest      current manifest (lazy-regen if stale)
 *   GET  /api/dashboard/widget-data   live data for one widget binding
 *   POST /api/dashboard/regenerate    force a fresh manifest
 *   POST /api/dashboard/action        web-initiated tool execution (reuses the
 *                                     agent registry + connection/confirm gating)
 *   GET  /d/:code                     public login bounce -> 302 to the web app
 *
 * The /api/* endpoints are JWT-gated (authenticateJwt sets req.user.id = the
 * Supabase auth uid). Reads use the service-role client scoped to the caller's
 * user_id/phone, so the underlying tables stay RLS-locked (no anon exposure).
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const authenticateJwt = require('../middleware/authenticateJwt');
const registry = require('../services/agent/toolRegistry');
const agentLoop = require('../services/agent/agentLoop');
const nango = require('../services/nango');
const { decryptCredentials } = require('../services/credentialCrypto');
const generator = require('../services/dashboard/manifestGenerator');
const { generateDashboardLink } = require('../services/authLink');

const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_SECRET;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

const WINDOW_30D = () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

/** Resolve the caller's user row (id is the auth uid set by authenticateJwt). */
async function resolveUser(req) {
  if (!supabase) return null;
  const { data } = await supabase
    .from('users')
    .select('id, phone, business_brain')
    .eq('id', req.user.id)
    .maybeSingle();
  return data || null;
}

function requireDb(res) {
  if (!supabase) {
    res.status(500).json({ error: 'dashboard backend not configured' });
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// GET /api/dashboard/manifest
// ---------------------------------------------------------------------------
router.get('/api/dashboard/manifest', authenticateJwt, async (req, res) => {
  if (!requireDb(res)) return;
  try {
    const user = await resolveUser(req);
    if (!user?.phone) return res.status(404).json({ error: 'user not found' });

    let current = await generator.getCurrentManifest({ phone: user.phone, supabase });
    if (!current || generator.isManifestStale(current)) {
      const ready = await generator.isReadyForDashboard({ phone: user.phone, supabase });
      if (current || ready.ready) {
        await generator.generateManifest({ phone: user.phone, supabase, force: false });
        current = await generator.getCurrentManifest({ phone: user.phone, supabase });
      } else if (!current) {
        return res.json({ manifest: null, ready: false, reason: ready.reason });
      }
    }
    return res.json({
      manifest: current?.manifest || null,
      version: current?.version || null,
      generated_at: current?.generated_at || null,
      ready: true,
    });
  } catch (err) {
    console.error('[dashboard] manifest failed:', err?.message || err);
    return res.status(500).json({ error: 'could not load dashboard' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/dashboard/regenerate
// ---------------------------------------------------------------------------
router.post('/api/dashboard/regenerate', authenticateJwt, async (req, res) => {
  if (!requireDb(res)) return;
  try {
    const user = await resolveUser(req);
    if (!user?.phone) return res.status(404).json({ error: 'user not found' });
    const out = await generator.generateManifest({ phone: user.phone, supabase, force: true });
    return res.json(out);
  } catch (err) {
    console.error('[dashboard] regenerate failed:', err?.message || err);
    return res.status(500).json({ error: 'could not regenerate dashboard' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/dashboard/widget-data?type=<widget type>
// ---------------------------------------------------------------------------
router.get('/api/dashboard/widget-data', authenticateJwt, async (req, res) => {
  if (!requireDb(res)) return;
  try {
    const user = await resolveUser(req);
    if (!user?.phone) return res.status(404).json({ error: 'user not found' });
    const type = String(req.query.type || '');
    const widget = generator.WIDGETS.find((w) => w.type === type);
    if (!widget) return res.status(400).json({ error: 'unknown widget type' });
    const data = await resolveWidgetData(widget, user);
    return res.json({ type, data });
  } catch (err) {
    console.error('[dashboard] widget-data failed:', err?.message || err);
    return res.status(500).json({ error: 'could not load widget data' });
  }
});

async function resolveWidgetData(widget, user) {
  switch (widget.bindingSource) {
    case 'tool_call_events': {
      const cap = widget.bindingFilter?.capability;
      const { data } = await supabase
        .from('tool_call_events')
        .select('capability, created_at, success')
        .eq('user_phone', user.phone)
        .gte('created_at', WINDOW_30D());
      const rows = (data || []).filter((e) => !cap || widget.capabilities.includes(e.capability));
      return { count_30d: rows.length, last_used: rows[0]?.created_at || null };
    }
    case 'jobs': {
      if (!user.id) return { jobs: [] };
      let q = supabase
        .from('jobs')
        .select('id, customer_name, service_type, status, summary, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(25);
      const { data } = await q;
      return { jobs: data || [] };
    }
    case 'customer_context': {
      if (!user.id) return { clients: [] };
      const { data } = await supabase
        .from('customer_context')
        .select('subject_handle, subject_label, fact, confidence, updated_at')
        .eq('user_id', user.id)
        .eq('status', 'confirmed')
        .order('updated_at', { ascending: false })
        .limit(100);
      // Group facts by subject.
      const bySubject = new Map();
      for (const f of data || []) {
        const key = f.subject_handle || f.subject_label || 'unknown';
        if (!bySubject.has(key)) bySubject.set(key, { label: f.subject_label || key, facts: [] });
        bySubject.get(key).facts.push({ fact: f.fact, confidence: f.confidence });
      }
      return { clients: [...bySubject.values()] };
    }
    case 'user_connections': {
      const { data } = await supabase
        .from('user_connections')
        .select('provider, status, account_label, connected_at')
        .eq('user_phone', user.phone);
      return { connections: data || [] };
    }
    case 'business_brain': {
      const brain = user.business_brain || {};
      if (widget.bindingFilter?.key) return { [widget.bindingFilter.key]: brain[widget.bindingFilter.key] || null };
      // Strip internal bookkeeping keys.
      const clean = {};
      for (const [k, v] of Object.entries(brain)) if (!k.startsWith('_')) clean[k] = v;
      return { brain: clean };
    }
    default:
      return {};
  }
}

// ---------------------------------------------------------------------------
// POST /api/dashboard/action  { tool_name, args, confirmed? }
// Web-initiated tool execution — reuses the agent registry + gating.
// ---------------------------------------------------------------------------
router.post('/api/dashboard/action', authenticateJwt, async (req, res) => {
  if (!requireDb(res)) return;
  try {
    const user = await resolveUser(req);
    if (!user?.phone) return res.status(404).json({ error: 'user not found' });

    const { tool_name: toolName, args = {}, confirmed = false } = req.body || {};
    const entry = registry.findTool(toolName);
    if (!entry) return res.status(400).json({ error: 'unknown tool' });

    // Build the same ctx the agent loop uses.
    const connections = await agentLoop.loadConnections(supabase, user.phone);
    const userIntegrations = {};
    const { data: integrations } = await supabase
      .from('user_integrations')
      .select('integration_type, credentials_encrypted')
      .eq('user_phone', user.phone);
    for (const row of integrations || []) {
      try { userIntegrations[row.integration_type] = decryptCredentials(row.credentials_encrypted); } catch { /* skip */ }
    }
    const ctx = agentLoop.buildCtx({
      user, phone: user.phone, supabase, connections, userIntegrations, brain: user.business_brain || {},
    });

    // Connection gate.
    const provider = registry.providerFor(entry.capability, ctx, args);
    if (!registry.connectionFor(entry.capability, ctx, args)) {
      if (!provider && entry.capability.dynamicProvider) {
        return res.json({ needsInput: true, message: 'which supplier do you order from?' });
      }
      let connectLink = null;
      try {
        connectLink = await nango.createTextableConnectLink({ userId: user.id, phone: user.phone, provider });
      } catch { /* link optional */ }
      return res.json({ needsConnection: true, provider, connectLink });
    }

    // Confirm gate — irreversible tools require an explicit confirm from the UI.
    if (entry.tool.confirm && !confirmed) {
      const message = entry.tool.confirmMessage ? entry.tool.confirmMessage(args, ctx) : `run ${entry.tool.name}?`;
      return res.json({ needsConfirm: true, message });
    }

    const outcome = await agentLoop.safeExecute(entry, ctx, args);
    agentLoop.recordToolEvent(entry, ctx, args, outcome, 'web');
    if (outcome.ok === false) return res.status(502).json({ error: outcome.result || 'tool failed' });
    return res.json({ ok: true, result: outcome.userFacing || outcome.result || 'done' });
  } catch (err) {
    console.error('[dashboard] action failed:', err?.message || err);
    return res.status(500).json({ error: 'action failed' });
  }
});

// ---------------------------------------------------------------------------
// GET /d/:code  public login bounce
// ---------------------------------------------------------------------------
router.get('/d/:code', async (req, res) => {
  if (!supabase) return res.status(500).send('not configured');
  try {
    const { data } = await supabase
      .from('connect_links')
      .select('user_phone, expires_at')
      .eq('code', req.params.code)
      .maybeSingle();
    if (!data || new Date(data.expires_at).getTime() < Date.now()) {
      return res.status(410).send('this link has expired. ask flynn to send a fresh one');
    }
    const link = await generateDashboardLink(data.user_phone);
    if (link.error || !link.url) return res.status(500).send('could not sign you in');
    return res.redirect(302, link.url);
  } catch (err) {
    console.error('[dashboard] /d/:code failed:', err?.message || err);
    return res.status(500).send('something went wrong');
  }
});

module.exports = router;
