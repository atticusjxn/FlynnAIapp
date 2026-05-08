/**
 * Gmail API cold-email sender — replaces Instantly.
 *
 * Auth flow: one-time OAuth consent via `npm run gmail:oauth` writes a refresh
 * token to .env. From then on, sends use that refresh token to mint short-lived
 * access tokens — no further user interaction needed.
 *
 * Volume strategy: 30 sends/day cap from .env (GMAIL_DAILY_CAP). Each send
 * is plain text with a real signature, no images, no tracking pixel — the
 * Instantly playbook minus the warmup network. Existing Gmail accounts are
 * already warm for the founder's normal usage.
 */

import { google, gmail_v1 } from 'googleapis';

// REDIRECT_URI is only needed during the one-time consent flow (gmail-oauth.ts).
// For send time we have a refresh token already, so the redirect doesn't matter.
const REDIRECT_URI = process.env.GMAIL_OAUTH_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob';

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly', // for future reply polling
];

export function getOAuthClient() {
  // Lazy: only require OAuth env vars when the OAuth path is actually used.
  // The SMTP/App-Password path (lib/gmail-smtp.ts) doesn't need these.
  const clientId = required('GMAIL_OAUTH_CLIENT_ID');
  const clientSecret = required('GMAIL_OAUTH_CLIENT_SECRET');
  return new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
}

function getAuthedClient() {
  const refreshToken = required('GMAIL_REFRESH_TOKEN');
  const oauth = getOAuthClient();
  oauth.setCredentials({ refresh_token: refreshToken });
  return oauth;
}

export interface SendArgs {
  to: string;
  subject: string;
  bodyText: string;
  /** Optional plain-text reply-to. Defaults to GMAIL_FROM_EMAIL. */
  replyTo?: string;
}

export interface SendResult {
  messageId: string;
  threadId: string;
}

/**
 * Sends a single cold email. RFC 2822 plain text, no HTML, no tracking pixel.
 * Caller is responsible for rate-limiting and dedup against gtm_email_outreach.
 */
export async function sendColdEmail(args: SendArgs): Promise<SendResult> {
  const fromEmail = required('GMAIL_FROM_EMAIL');
  const fromName = process.env.GMAIL_FROM_NAME || '';
  const fromHeader = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

  const gmail = google.gmail({ version: 'v1', auth: getAuthedClient() });

  // RFC 2822 message. Subject is encoded with =?UTF-8?B? for safety.
  const subjectEncoded = `=?UTF-8?B?${Buffer.from(args.subject, 'utf8').toString('base64')}?=`;
  const lines = [
    `From: ${fromHeader}`,
    `To: ${args.to}`,
    `Subject: ${subjectEncoded}`,
    `Reply-To: ${args.replyTo || fromEmail}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    args.bodyText,
  ];
  const raw = Buffer.from(lines.join('\r\n'), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });

  const id = res.data.id;
  const threadId = res.data.threadId;
  if (!id || !threadId) {
    throw new Error('Gmail send returned no message id');
  }
  return { messageId: id, threadId };
}

/**
 * Counts how many messages we've sent in the last 24h via the configured
 * sender. Useful as a defensive check before send-daily-batch fires.
 */
export async function countSentLast24h(): Promise<number> {
  const gmail = google.gmail({ version: 'v1', auth: getAuthedClient() });
  // Gmail's `q` accepts the same syntax as the search bar.
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: 'in:sent newer_than:1d',
    maxResults: 500,
  });
  return res.data.resultSizeEstimate ?? res.data.messages?.length ?? 0;
}

export type GmailClient = gmail_v1.Gmail;

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}
