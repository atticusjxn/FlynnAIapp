/**
 * Gmail SMTP sender using App Passwords. Simpler alternative to OAuth.
 *
 * Setup (one-time, ~30 seconds):
 *   1. Enable 2FA on your Google account if not already.
 *   2. Visit https://myaccount.google.com/apppasswords
 *   3. Generate a new App Password named "Flynn GTM" (16-character code)
 *   4. Add to gtm-automation/.env:
 *        GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx       (16 chars, no spaces)
 *        GMAIL_FROM_EMAIL=atticusjxn@gmail.com     (or your Workspace email)
 *        GMAIL_FROM_NAME=Atticus Jackson
 *
 * Used by send-daily-batch.ts when GMAIL_APP_PASSWORD is set in env. If
 * the OAuth refresh token (GMAIL_REFRESH_TOKEN) is set instead, the OAuth
 * path in lib/gmail.ts is used.
 */

import nodemailer, { type Transporter } from 'nodemailer';

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (cachedTransporter) return cachedTransporter;

  const fromEmail = required('GMAIL_FROM_EMAIL');
  const appPassword = required('GMAIL_APP_PASSWORD').replace(/\s+/g, ''); // strip spaces

  cachedTransporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // STARTTLS
    auth: {
      user: fromEmail,
      pass: appPassword,
    },
  });
  return cachedTransporter;
}

export interface SendArgs {
  to: string;
  subject: string;
  bodyText: string;
  replyTo?: string;
}

export interface SendResult {
  messageId: string;
  threadId: string;
}

export async function sendColdEmail(args: SendArgs): Promise<SendResult> {
  const fromEmail = required('GMAIL_FROM_EMAIL');
  const fromName = process.env.GMAIL_FROM_NAME || '';
  const fromHeader = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

  const info = await getTransporter().sendMail({
    from: fromHeader,
    to: args.to,
    replyTo: args.replyTo || fromEmail,
    subject: args.subject,
    text: args.bodyText,
    headers: {
      'List-Unsubscribe': `<mailto:${fromEmail}?subject=remove>`,
    },
  });

  return {
    messageId: info.messageId || '',
    threadId: info.messageId || '', // SMTP doesn't expose Gmail thread IDs
  };
}

/**
 * SMTP doesn't give us "messages sent in last 24h" — we'd need to poll Gmail
 * which requires a separate auth path. For SMTP mode we trust the daily cap +
 * the local Supabase outreach log as the source of truth.
 */
export async function countSentLast24h(): Promise<number> {
  // Caller can implement this via gtm_email_outreach query. Returning 0 here
  // means "no estimate; rely on the queue size + daily cap from Supabase".
  return 0;
}

export function isAppPasswordConfigured(): boolean {
  return !!process.env.GMAIL_APP_PASSWORD && !!process.env.GMAIL_FROM_EMAIL;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}
