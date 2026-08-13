const express = require('express');
const twilio = require('twilio');
const { createClient } = require('@supabase/supabase-js');
const { ensureAuthUser } = require('../services/authLink');
const { sanitiseReply } = require('../services/flynnTone');

const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_SECRET;

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

const FLYNN_NUMBER = process.env.TWILIO_FLYNN_NUMBER || '+61480891471';
const SERVER_URL = process.env.SERVER_PUBLIC_URL || 'https://flynnai-telephony.fly.dev';

// Embedded logo (base64 JPEG). iOS Contacts only renders embedded photos, not
// remote PHOTO URIs, so we inline it. See services/flynnVcardPhoto.js.
const FLYNN_VCARD_PHOTO = require('../services/flynnVcardPhoto');

// Fold a long vCard line to 75 octets per RFC 2426 (continuation lines start
// with a single space). iOS is strict about this for embedded photos.
function foldVcardLine(line) {
  const chunks = [line.slice(0, 75)];
  for (let i = 75; i < line.length; i += 74) {
    chunks.push(' ' + line.slice(i, i + 74));
  }
  return chunks.join('\r\n');
}

// Serve the Flynn contact card (VCF) — sent on first text so they can save
// Flynn with the logo. SMS is the only client channel now, so this always
// carries the live Twilio number (see CLAUDE.md Non-Goals — the iMessage/
// BlueBubbles relay was retired; a prior version of this route could serve a
// vCard pointing at a dead iMessage inbox).
router.get('/contact.vcf', (req, res) => {
  const tel = FLYNN_NUMBER;
  const vcf = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'N:;Flynn;;;',
    'FN:Flynn',
    `TEL;TYPE=CELL:${tel}`,
    foldVcardLine(`PHOTO;ENCODING=b;TYPE=JPEG:${FLYNN_VCARD_PHOTO}`),
    'END:VCARD',
  ].join('\r\n');

  res.setHeader('Content-Type', 'text/vcard');
  res.setHeader('Content-Disposition', 'attachment; filename="Flynn.vcf"');
  res.send(vcf);
});

// POST /api/signup/start
// Upserts user by phone, sends welcome SMS + vCard MMS. No OTP — SMS receipt is the verification.
router.post('/start', async (req, res) => {
  const rawPhone = (req.body?.phone || '').trim();
  if (!rawPhone) {
    return res.status(400).json({ error: 'Phone number required' });
  }

  // Normalise to E.164
  const digits = rawPhone.replace(/\D/g, '');
  let phone;
  if (rawPhone.startsWith('+')) {
    phone = rawPhone;
  } else if (digits.startsWith('61') && digits.length === 11) {
    phone = `+${digits}`;
  } else if (digits.startsWith('0') && digits.length === 10) {
    phone = `+61${digits.slice(1)}`;
  } else if (digits.startsWith('64')) {
    phone = `+${digits}`;
  } else {
    phone = `+${digits}`;
  }

  // Basic sanity check (E.164 AU/NZ mobile)
  if (!/^\+6[14]\d{7,12}$/.test(phone)) {
    return res.status(400).json({ error: 'Enter a valid AU or NZ mobile number.' });
  }

  try {
    // Ensure an auth-backed, id-aligned user so they can later open the app with
    // no OTP (the magic-link handoff in services/authLink.js relies on this).
    if (supabase) {
      const ensured = await ensureAuthUser(phone).catch(() => null);
      if (ensured?.id) {
        const patch = { phone };
        if (ensured.created) {
          patch.signup_source = 'web';
          patch.onboarding_step = 'brain_pending';
        }
        await supabase.from('users').update(patch).eq('id', ensured.id).catch(() => {});
      } else {
        // Fallback: keep the old phone-keyed upsert so signup never hard-fails.
        await supabase.from('users').upsert(
          { phone, signup_source: 'web', onboarding_step: 'brain_pending' },
          { onConflict: 'phone', ignoreDuplicates: false }
        ).catch(() => {});
      }

      // Log to sms_messages table if it exists
      await supabase.from('sms_messages').insert({
        user_phone: phone,
        direction: 'out',
        body: 'Welcome SMS + vCard MMS',
      }).then(() => {}).catch(() => {});
    }

    if (!twilioClient) {
      console.warn('[WebSignup] Twilio not configured — skipping SMS');
      return res.json({ ok: true });
    }

    const vcfUrl = `${SERVER_URL}/api/signup/contact.vcf`;

    // 1. vCard MMS — lets user add Flynn as a contact with logo in one tap
    await twilioClient.messages.create({
      to: phone,
      from: FLYNN_NUMBER,
      body: "Save me as 'Flynn' and you're set.",
      mediaUrl: [vcfUrl],
    });

    // 2. Welcome SMS — warm, value-first, on-tone (no em dash, lowercase start)
    await twilioClient.messages.create({
      to: phone,
      from: FLYNN_NUMBER,
      body: sanitiseReply("hey, i'm flynn. i run the admin side of your work over text, replying to people, invoices, bookings, chasing stuff up, whatever eats your time. what do you do for work?"),
    });

    console.log('[WebSignup] Welcome SMS sent', { phone });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[WebSignup] Error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to send welcome message. Please try again.' });
  }
});

module.exports = router;
