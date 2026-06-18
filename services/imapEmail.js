/**
 * IMAP/SMTP email — the long-tail fallback for AU operators who aren't on Gmail
 * or Microsoft 365 (Bigpond/Telstra, Optus, iCloud, Yahoo, and any cPanel/host
 * mailbox on their own domain). These providers have no OAuth, so Flynn stores a
 * one-time login (email + app/host password, captured once via the /setup page)
 * and sends through SMTP / reads through IMAP from the operator's real address.
 *
 * Host/port are auto-derived from the email domain so the user never types
 * server settings — they paste an address and an app password and it works.
 *
 * Gmail and Microsoft are deliberately NOT handled here: both have killed
 * basic-auth IMAP/SMTP (Google May 2025, Microsoft SMTP AUTH by end 2026), so
 * those always go through their OAuth connectors instead.
 */

const nodemailer = require('nodemailer');
const { ImapFlow } = require('imapflow');

// domain -> { imap, smtp, smtpPort }. smtpPort 465 = implicit TLS, 587 = STARTTLS.
// Unknown domains fall back to the cPanel/host convention mail.<domain>.
function mailHostsFor(email) {
  const domain = String(email || '').split('@')[1]?.toLowerCase() || '';
  const telstra = { imap: 'imap.telstra.com', smtp: 'smtp.telstra.com', smtpPort: 465 };
  const map = {
    'bigpond.com': telstra, 'bigpond.net.au': telstra, 'telstra.com': telstra, 'telstra.com.au': telstra,
    'icloud.com': { imap: 'imap.mail.me.com', smtp: 'smtp.mail.me.com', smtpPort: 587 },
    'me.com': { imap: 'imap.mail.me.com', smtp: 'smtp.mail.me.com', smtpPort: 587 },
    'mac.com': { imap: 'imap.mail.me.com', smtp: 'smtp.mail.me.com', smtpPort: 587 },
    'optusnet.com.au': { imap: 'mail.optusnet.com.au', smtp: 'mail.optusnet.com.au', smtpPort: 465 },
    'yahoo.com': { imap: 'imap.mail.yahoo.com', smtp: 'smtp.mail.yahoo.com', smtpPort: 465 },
    'yahoo.com.au': { imap: 'imap.mail.yahoo.com', smtp: 'smtp.mail.yahoo.com', smtpPort: 465 },
    'ymail.com': { imap: 'imap.mail.yahoo.com', smtp: 'smtp.mail.yahoo.com', smtpPort: 465 },
  };
  return map[domain] || { imap: `mail.${domain}`, smtp: `mail.${domain}`, smtpPort: 465 };
}

// Domains that must NOT use IMAP/SMTP — route them to the OAuth connectors.
function requiresOAuth(email) {
  const domain = String(email || '').split('@')[1]?.toLowerCase() || '';
  return ['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'hotmail.com.au', 'live.com', 'live.com.au', 'msn.com'].includes(domain);
}

async function sendEmail({ email, password, to, subject, body }) {
  const { smtp, smtpPort } = mailHostsFor(email);
  const transport = nodemailer.createTransport({
    host: smtp,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: email, pass: password },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
  });
  await transport.sendMail({ from: email, to, subject, text: body });
}

// Best-effort inbox read: pull the most recent messages and filter client-side
// by the query (IMAP server-side full-text search is uneven across hosts).
async function findEmails({ email, password, query, max = 5 }) {
  const { imap } = mailHostsFor(email);
  const client = new ImapFlow({
    host: imap, port: 993, secure: true,
    auth: { user: email, pass: password },
    logger: false,
    socketTimeout: 20000,
  });
  await client.connect();
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const total = client.mailbox.exists || 0;
      if (!total) return [];
      const from = Math.max(1, total - 50 + 1);
      const q = String(query || '').toLowerCase();
      const out = [];
      for await (const msg of client.fetch(`${from}:*`, { envelope: true })) {
        const e = msg.envelope || {};
        const fromAddr = e.from?.[0]?.address || '?';
        const subj = e.subject || '(no subject)';
        const date = e.date ? new Date(e.date).toISOString().slice(0, 10) : '';
        const line = `from ${fromAddr} | ${subj} | ${date}`;
        if (!q || `${fromAddr} ${subj}`.toLowerCase().includes(q)) out.push(line);
      }
      return out.slice(-max).reverse();
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

module.exports = { mailHostsFor, requiresOAuth, sendEmail, findEmails };
