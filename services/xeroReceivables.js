/**
 * Xero accounts-receivable reads (the missing half of the accounting tools —
 * the existing registry only WRITES bills/invoices). Powers two things:
 *   - the xero_list_invoices agent tool ("what's outstanding?")
 *   - the proactive payment-chasing scheduler (nudge the operator about overdue
 *     invoices on a cadence)
 *
 * Reusable from both an agent ctx and a raw cron loop: the core takes a
 * user_connections row (nango_connection_id + cached tenant id) and a supabase
 * client, so it never depends on the agent loop being in scope.
 */

const nango = require('./nango');

const XERO_API = 'https://api.xero.com/api.xro/2.0';

async function xeroGet(token, url, tenantId) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(tenantId ? { 'Xero-tenant-id': tenantId } : {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`Xero GET ${url} failed (${res.status}): ${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/**
 * Resolve (and cache) the Xero tenant id for a connection row.
 */
async function resolveTenantId({ connectionRow, token, supabase }) {
  let tenantId = connectionRow?.metadata?.xero_tenant_id;
  if (tenantId) return tenantId;
  const orgs = await xeroGet(token, 'https://api.xero.com/connections');
  tenantId = Array.isArray(orgs) ? orgs[0]?.tenantId : null;
  if (!tenantId) throw new Error('no xero organisation found on this login');
  if (connectionRow?.id && supabase) {
    const metadata = { ...(connectionRow.metadata || {}), xero_tenant_id: tenantId };
    await supabase.from('user_connections').update({ metadata, updated_at: new Date().toISOString() }).eq('id', connectionRow.id);
    connectionRow.metadata = metadata;
  }
  return tenantId;
}

function daysBetween(fromIso, toMs) {
  const due = new Date(fromIso).getTime();
  return Math.floor((toMs - due) / (24 * 60 * 60 * 1000));
}

/**
 * List outstanding sales invoices (ACCREC, AUTHORISED, AmountDue > 0).
 * @param {object} opts { connectionRow, supabase, onlyOverdue }
 * @returns {Promise<Array<{contactName, amountDueCents, currency, dueDate, daysOverdue, invoiceNumber, invoiceId}>>}
 */
async function listOutstandingInvoices({ connectionRow, supabase, onlyOverdue = false } = {}) {
  if (!connectionRow?.nango_connection_id) throw new Error('xero not connected');
  const token = await nango.getToken('xero', connectionRow.nango_connection_id);
  const tenantId = await resolveTenantId({ connectionRow, token, supabase });

  const where = encodeURIComponent('Type=="ACCREC" AND Status=="AUTHORISED"');
  const url = `${XERO_API}/Invoices?where=${where}&order=DueDate`;
  const json = await xeroGet(token, url, tenantId);

  const now = Date.now();
  const rows = (json?.Invoices || [])
    .map((inv) => {
      const amountDue = Number(inv.AmountDue) || 0;
      const daysOverdue = inv.DueDate ? daysBetween(inv.DueDate, now) : 0;
      return {
        contactName: inv.Contact?.Name || 'a client',
        amountDueCents: Math.round(amountDue * 100),
        currency: inv.CurrencyCode || null,
        dueDate: inv.DueDate ? String(inv.DueDate).slice(0, 10) : null,
        daysOverdue,
        invoiceNumber: inv.InvoiceNumber || null,
        invoiceId: inv.InvoiceID || null,
      };
    })
    .filter((r) => r.amountDueCents > 0)
    .filter((r) => (onlyOverdue ? r.daysOverdue > 0 : true));

  return rows;
}

module.exports = { listOutstandingInvoices, resolveTenantId };
