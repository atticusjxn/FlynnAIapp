/**
 * One-time Gmail OAuth consent capture.
 *
 * Pre-req: GMAIL_OAUTH_CLIENT_ID + GMAIL_OAUTH_CLIENT_SECRET in .env (Desktop
 * app credentials from console.cloud.google.com → APIs & Services → Credentials).
 *
 * Run: npm run gmail:oauth
 *
 * What happens:
 *   1. Prints an authorize URL.
 *   2. You open it, approve scopes (gmail.send + gmail.readonly), copy the code.
 *   3. Paste the code at the prompt.
 *   4. Script exchanges it for a refresh token, prints the env line to add to .env.
 */

import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { getOAuthClient, GMAIL_SCOPES } from '../lib/gmail.js';

async function main() {
  const oauth = getOAuthClient();
  const url = oauth.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // forces refresh_token even on re-auth
    scope: GMAIL_SCOPES,
  });

  console.log('\n1) Open this URL in your browser:\n');
  console.log(url);
  console.log('\n2) Approve the scopes. Google will display an authorisation code.');
  console.log('3) Paste it below and press Enter.\n');

  const rl = createInterface({ input, output });
  const code = (await rl.question('Code: ')).trim();
  rl.close();

  if (!code) {
    console.error('No code provided.');
    process.exit(1);
  }

  const { tokens } = await oauth.getToken(code);
  if (!tokens.refresh_token) {
    console.error(
      'No refresh_token returned. Revoke the app at https://myaccount.google.com/permissions and re-run.',
    );
    process.exit(1);
  }

  console.log('\n✅ Got refresh token. Add this line to gtm-automation/.env:\n');
  console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}\n`);
}

main().catch((err) => {
  console.error('FAILED', err);
  process.exit(1);
});
