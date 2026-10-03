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

// ---------------------------------------------------------------------------
// Paid web signup: flynnai.app/start lead form -> embedded Stripe Checkout
// (7-day trial, then A$79/mo) -> automatic receptionist provisioning.
// ---------------------------------------------------------------------------
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const { normalizePhone } = require('../services/authLink');
const { createProvisioner, forwardingCodesFor } = require('../services/webSignupProvision');

const RECEPTIONIST_MONTHLY_CENTS = Number(process.env.FLYNN_RECEPTIONIST_MONTHLY_CENTS || 7900);
const TRIAL_DAYS = 7;
const RETURN_URL = process.env.FLYNN_SIGNUP_RETURN_URL
  || 'https://flynnai.app/start/done?session_id={CHECKOUT_SESSION_ID}';

let stripeClient = null;
function stripe() {
  if (stripeClient) return stripeClient;
  if (!process.env.STRIPE_SECRET_KEY) return null;
  stripeClient = require('stripe')(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
  return stripeClient;
}

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const answersSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(160),
  mobile: z.string().trim().min(8).max(20),
  businessName: z.string().trim().min(1).max(120),
  businessType: z.string().trim().min(1).max(120),
  onMissedCall: z.array(z.enum(['take_message', 'text_summary', 'book_appointment'])).min(1).max(3),
  coverage: z.enum(['missed_calls', 'after_hours', 'always']),
  hours: z.object({
    days: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])).min(1).max(7),
    start: hhmm,
    end: hhmm,
  }).strict().optional(),
  voice: z.enum(['male', 'female']),
  notes: z.string().trim().max(1000).optional(),
}).strict();
const checkoutSchema = z.object({
  answers: answersSchema,
  ref: z.string().trim().max(60).optional(),
}).strict();

// Requests arrive via the flynnai.app Cloudflare worker; key on the visitor's IP
// it forwards, not the shared edge address.
const clientKey = (req) => String(req.headers['cf-connecting-ip'] || req.ip || 'unknown');
const signupLimiter = rateLimit({
  keyGenerator: clientKey,
  validate: false,
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in a few minutes.' },
});
const statusLimiter = rateLimit({ keyGenerator: clientKey, validate: false, windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });

function lineItem() {
  if (process.env.STRIPE_PRICE_RECEPTIONIST_MONTHLY) {
    return { price: process.env.STRIPE_PRICE_RECEPTIONIST_MONTHLY, quantity: 1 };
  }
  const recurring = { interval: 'month' };
  const priceData = process.env.STRIPE_PRODUCT_RECEPTIONIST
    ? { currency: 'aud', unit_amount: RECEPTIONIST_MONTHLY_CENTS, recurring, product: process.env.STRIPE_PRODUCT_RECEPTIONIST }
    : { currency: 'aud', unit_amount: RECEPTIONIST_MONTHLY_CENTS, recurring, product_data: { name: 'Flynn AI Receptionist' } };
  return { price_data: priceData, quantity: 1 };
}

async function notifyFounder({ subject, row, answers, phoneNumber }) {
  if (!process.env.RESEND_API_KEY) return;
  const { Resend } = require('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  const text = [
    `${answers.name} <${row.email}> ${row.mobile}`,
    `Business: ${answers.businessName} (${answers.businessType})`,
    `Coverage: ${answers.coverage}${answers.hours ? ` ${answers.hours.days.join(',')} ${answers.hours.start}-${answers.hours.end}` : ''}`,
    `On missed call: ${answers.onMissedCall.join(', ')}`,
    `Voice: ${answers.voice}`,
    `Flynn number: ${phoneNumber || 'NOT ASSIGNED'}`,
    `Ref: ${row.ref || '-'}`,
    answers.notes ? `Notes: ${answers.notes}` : '',
  ].filter(Boolean).join('\n');
  await resend.emails.send({
    from: process.env.FLYNN_NOTIFY_FROM || 'Flynn <hello@flynnai.app>',
    to: process.env.FLYNN_FOUNDER_EMAIL || 'atticusjxn@gmail.com',
    subject,
    text,
  });
}

let provisioner = null;
function getProvisioner() {
  if (provisioner) return provisioner;
  const { ensureBookingPage } = require('../services/bookingPage');
  const nango = require('../services/nango');
  provisioner = createProvisioner({
    supabase,
    twilioClient,
    ensureAuthUser,
    ensureBookingPage,
    createSetupLink: nango.createSetupLink,
    notifyFounder,
  });
  return provisioner;
}

// Exposed for the Stripe webhook in server.js and for tests.
async function provisionFromCheckoutSession(session) {
  const signupId = session?.metadata?.flynn_signup_id;
  if (!signupId || session?.metadata?.flynn_signup !== 'web_v1' || !supabase) return null;
  return getProvisioner().provision(signupId, {
    customerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
    subscriptionId: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
  });
}

function publicStatus(row) {
  if (!row) return { state: 'pending' };
  const answers = row.answers || {};
  const out = { state: row.status, voice: answers.voice, coverage: answers.coverage };
  if (row.status === 'live' && row.phone_number) {
    out.phoneNumber = row.phone_number;
    out.forwardingCodes = forwardingCodesFor(row.phone_number);
    if (row.calendar_connect_url) out.calendarConnectUrl = row.calendar_connect_url;
  }
  if (row.status === 'failed') out.error = row.error === 'pool_empty' ? 'pool_empty' : 'provisioning_failed';
  return out;
}

// POST /api/signup/checkout
router.post('/checkout', signupLimiter, async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_input', fields: parsed.error.issues.map((i) => i.path.join('.')) });
  }
  const { answers, ref } = parsed.data;
  if (answers.coverage === 'after_hours' && !answers.hours) {
    return res.status(400).json({ error: 'invalid_input', fields: ['answers.hours'] });
  }
  const mobile = normalizePhone(answers.mobile);
  if (!mobile || !/^\+61[45]\d{8}$/.test(mobile)) {
    return res.status(400).json({ error: 'invalid_input', fields: ['answers.mobile'] });
  }
  const s = stripe();
  if (!s || !supabase || !process.env.STRIPE_PUBLISHABLE_KEY) {
    return res.status(503).json({ error: 'signup_unavailable' });
  }

  try {
    const { data: inserted, error: insErr } = await supabase
      .from('web_signups')
      .insert({ email: answers.email, mobile, answers: { ...answers, mobile }, ref: ref || null })
      .select('id')
      .single();
    if (insErr || !inserted?.id) {
      console.error('[WebSignup] could not store signup', insErr?.message);
      return res.status(503).json({ error: 'signup_unavailable' });
    }
    const metadata = { flynn_signup: 'web_v1', flynn_signup_id: inserted.id };

    const session = await s.checkout.sessions.create({
      ui_mode: 'embedded',
      mode: 'subscription',
      line_items: [lineItem()],
      customer_email: answers.email,
      payment_method_collection: 'always',
      subscription_data: { trial_period_days: TRIAL_DAYS, metadata },
      metadata,
      client_reference_id: inserted.id,
      return_url: RETURN_URL,
    }, { idempotencyKey: `web-signup-${inserted.id}` });

    await supabase.from('web_signups').update({ stripe_session_id: session.id }).eq('id', inserted.id);
    return res.json({
      clientSecret: session.client_secret,
      sessionId: session.id,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    });
  } catch (err) {
    console.error('[WebSignup] checkout create failed', err?.message);
    return res.status(502).json({ error: 'checkout_failed' });
  }
});

// GET /api/signup/status?session_id=cs_...
router.get('/status', statusLimiter, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const sessionId = String(req.query.session_id || '');
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId) || !supabase) {
    return res.status(400).json({ error: 'invalid_session' });
  }
  try {
    const { data: row } = await supabase.from('web_signups').select('*').eq('stripe_session_id', sessionId).maybeSingle();
    if (!row) return res.status(404).json({ error: 'not_found' });
    if (row.status !== 'pending') return res.json(publicStatus(row));

    // Webhook may not have landed yet: confirm with Stripe, then provision here.
    const s = stripe();
    if (!s) return res.json(publicStatus(row));
    const session = await s.checkout.sessions.retrieve(sessionId, { expand: ['subscription'] });
    const subStatus = session.subscription?.status;
    if (session.status !== 'complete' || !['trialing', 'active'].includes(subStatus)) {
      return res.json(publicStatus(row));
    }
    const after = await provisionFromCheckoutSession(session);
    return res.json(publicStatus(after || row));
  } catch (err) {
    console.error('[WebSignup] status failed', err?.message);
    return res.status(502).json({ error: 'status_unavailable' });
  }
});

module.exports = router;
module.exports.provisionFromCheckoutSession = provisionFromCheckoutSession;
module.exports._test = { checkoutSchema, publicStatus, lineItem, setStripeForTest: (s) => { stripeClient = s; } };
