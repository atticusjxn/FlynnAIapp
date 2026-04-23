/**
 * IVR Handler — Mode A (SMS Link Follow-Up) on Telnyx Call Control.
 *
 * Telnyx model is webhook-driven. Our `/webhooks/telnyx/voice` endpoint receives
 * events like `call.initiated`, `call.answered`, `call.gather.ended`, `call.hangup`.
 * We respond by POSTing actions back to the Telnyx API (answer, speak,
 * gather_using_speak, hangup) with the call's `call_control_id`.
 *
 * The IVR script body comes from:
 *   1. `business_profiles.ivr_custom_script` (free-form text, preferred), or
 *   2. `ivr_templates.script_body` via `business_profiles.ivr_template_id`, or
 *   3. a hard-coded AU fallback.
 *
 * Placeholder tokens in the script body:
 *   {business_name}    → business_profiles.business_name
 *   {booking_option}   → " Press 1 and we'll text you a booking link."
 *   {quote_option}     → " Press 2 and we'll text you a quote form."
 *
 * We append "Press 3 to leave a voicemail." (or remapped digit) at the end.
 */

const { supabase } = require('./supabaseClient');
const telnyx = require('./telnyxClient');
const smsLinkSender = require('./smsLinkSender');
const { resolveHandlingMode } = require('./usageGuard');
const { sendToUser } = require('./pushNotifier');
const {
  ensureCallRow,
  logCallEvent,
  finalizeCallCost,
  evictCallCache,
} = require('./costTracker');

// Cartesia AU voice in en-AU for Telnyx built-in TTS fallback. Swap to Cartesia
// BYO-TTS once the voice agent WebSocket is wired (Phase 2 / Track B deeper work).
const TELNYX_DEFAULT_VOICE = process.env.TELNYX_IVR_VOICE || 'Polly.Nicole-Neural';
const TELNYX_DEFAULT_LANG = process.env.TELNYX_IVR_LANG || 'en-AU';

const AU_FALLBACK_SCRIPT =
  "You've reached {business_name}. Sorry we missed you.{booking_option}{quote_option}";

// ---------------------------------------------------------------------------
// Business profile lookup
// ---------------------------------------------------------------------------

async function resolveUserAndProfileByToNumber(toNumber) {
  // users.telnyx_phone_number carries the provisioned AU number when a user
  // has bought one through Flynn. Fall back to matching on the platform's
  // shared TELNYX_PHONE_NUMBER so single-tenant deployments still work.
  const { data: user } = await supabase
    .from('users')
    .select('id, business_name, call_handling_mode')
    .eq('telnyx_phone_number', toNumber)
    .maybeSingle();

  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase
    .from('business_profiles')
    .select(
      [
        'user_id',
        'business_name',
        'industry',
        'booking_link_url',
        'booking_link_enabled',
        'quote_link_url',
        'quote_link_enabled',
        'sms_booking_template',
        'sms_quote_template',
        'ivr_template_id',
        'ivr_custom_script',
        'recording_disclosure',
      ].join(', ')
    )
    .eq('user_id', user.id)
    .maybeSingle();

  return { user, profile };
}

async function resolveScript(profile) {
  if (profile?.ivr_custom_script) return profile.ivr_custom_script;
  if (profile?.ivr_template_id) {
    const { data: tmpl } = await supabase
      .from('ivr_templates')
      .select('script_body')
      .eq('id', profile.ivr_template_id)
      .maybeSingle();
    if (tmpl?.script_body) return tmpl.script_body;
  }
  return AU_FALLBACK_SCRIPT;
}

// ---------------------------------------------------------------------------
// Menu rendering
// ---------------------------------------------------------------------------

function buildMenu(profile) {
  const hasBooking = !!(profile.booking_link_enabled && profile.booking_link_url);
  const hasQuote = !!(profile.quote_link_enabled && profile.quote_link_url);

  const digitMap = {};
  let nextDigit = 1;

  if (hasBooking) {
    digitMap[String(nextDigit)] = 'booking';
    nextDigit++;
  }
  if (hasQuote) {
    digitMap[String(nextDigit)] = 'quote';
    nextDigit++;
  }
  digitMap[String(nextDigit)] = 'voicemail';

  const bookingOption = hasBooking
    ? ` Press ${digitForAction(digitMap, 'booking')} and we'll text you a booking link.`
    : '';
  const quoteOption = hasQuote
    ? ` Press ${digitForAction(digitMap, 'quote')} and we'll text you a quote form.`
    : '';
  const voicemailOption = ` Press ${digitForAction(digitMap, 'voicemail')} to leave a voicemail.`;

  return { digitMap, bookingOption, quoteOption, voicemailOption };
}

function digitForAction(digitMap, action) {
  return Object.entries(digitMap).find(([, v]) => v === action)?.[0] || '';
}

function renderPrompt(script, profile, menu) {
  const businessName = profile?.business_name || 'us';
  return script
    .replace(/\{business_name\}/g, businessName)
    .replace(/\{booking_option\}/g, menu.bookingOption)
    .replace(/\{quote_option\}/g, menu.quoteOption);
}

function encodeClientState(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64');
}
function decodeClientState(str) {
  if (!str) return null;
  try {
    return JSON.parse(Buffer.from(str, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Webhook event handlers
// ---------------------------------------------------------------------------

async function onCallInitiated(payload) {
  const callControlId = payload.call_control_id;
  const toNumber = payload.to;
  const fromNumber = payload.from;

  const { user, profile } = await resolveUserAndProfileByToNumber(toNumber);
  if (!user || !profile) {
    console.warn(`[IVR] No user/profile for ${toNumber}, rejecting call`);
    try { await telnyx.hangup(callControlId); } catch {}
    return;
  }

  const { mode: effectiveMode, usage } = await resolveHandlingMode(
    user.id,
    user.call_handling_mode
  );

  const callId = await ensureCallRow({
    telnyxCallControlId: callControlId,
    userId: user.id,
    fromNumber,
    toNumber,
    handlingMode: effectiveMode,
  });

  await logCallEvent({
    callId,
    userId: user.id,
    eventType: 'call_started',
    eventData: {
      from: fromNumber,
      to: toNumber,
      configured_mode: user.call_handling_mode,
      effective_mode: effectiveMode,
      ai_minutes_used: usage?.aiMinutesUsed ?? null,
      ai_minutes_monthly: usage?.aiMinutesMonthly ?? null,
    },
  });

  if (effectiveMode === 'ai_fallback_sms') {
    await logCallEvent({
      callId,
      userId: user.id,
      eventType: 'ai_cap_fallback',
      eventData: {
        reason: 'monthly_ai_minutes_exhausted',
        remaining_minutes: usage?.remainingMinutes ?? 0,
      },
    });
  }

  await telnyx.answer(callControlId, {
    client_state: encodeClientState({
      userId: user.id,
      callId,
      stage: 'answering',
      effectiveMode,
    }),
  });
}

async function onCallAnswered(payload) {
  const callControlId = payload.call_control_id;
  const state = decodeClientState(payload.client_state) || {};
  const { userId, callId, effectiveMode } = state;
  if (!userId || !callId) {
    console.error('[IVR] Missing userId/callId in client_state on call.answered');
    await telnyx.hangup(callControlId);
    return;
  }

  const { profile } = await resolveUserAndProfileByToNumber(payload.to);
  if (!profile) {
    await telnyx.hangup(callControlId);
    return;
  }

  const hasBooking = !!(profile.booking_link_enabled && profile.booking_link_url);
  const hasQuote = !!(profile.quote_link_enabled && profile.quote_link_url);
  if (!hasBooking && !hasQuote) {
    await logCallEvent({
      callId, userId,
      eventType: 'error',
      eventData: { reason: 'no_links_configured' },
    });
    await telnyx.speak(callControlId, {
      payload: "We can't take your call right now. Please try again later.",
      voice: TELNYX_DEFAULT_VOICE,
      language: TELNYX_DEFAULT_LANG,
    });
    // Telnyx will fire speak.ended; we hang up from there (see onSpeakEnded).
    return;
  }

  const menu = buildMenu(profile);
  const script = await resolveScript(profile);
  const prompt = renderPrompt(script, profile, menu) + menu.voicemailOption;

  await logCallEvent({
    callId, userId,
    eventType: 'ivr_prompted',
    eventData: { prompt, digit_map: menu.digitMap },
  });

  const validDigits = Object.keys(menu.digitMap).join('');

  await telnyx.gatherUsingSpeak(callControlId, {
    payload: prompt,
    voice: TELNYX_DEFAULT_VOICE,
    language: TELNYX_DEFAULT_LANG,
    maximum_digits: 1,
    minimum_digits: 1,
    timeout_millis: 6000,
    valid_digits: validDigits,
    invalid_payload: "Sorry, that's not a valid option.",
    client_state: encodeClientState({
      userId,
      callId,
      stage: 'menu',
      digitMap: menu.digitMap,
      effectiveMode,
    }),
  });
}

async function onGatherEnded(payload) {
  const callControlId = payload.call_control_id;
  const state = decodeClientState(payload.client_state) || {};
  const { userId, callId, digitMap, effectiveMode } = state;
  const isFallback = effectiveMode === 'ai_fallback_sms';
  if (!userId || !callId || !digitMap) {
    console.error('[IVR] Missing state on call.gather.ended');
    await telnyx.hangup(callControlId);
    return;
  }

  const digits = payload.digits || '';
  const action = digitMap[digits];

  await logCallEvent({
    callId, userId,
    eventType: 'dtmf_pressed',
    eventData: { digits, action: action || 'invalid' },
  });

  if (!action) {
    await telnyx.speak(callControlId, {
      payload: "Sorry, we didn't catch that. Goodbye.",
      voice: TELNYX_DEFAULT_VOICE,
      language: TELNYX_DEFAULT_LANG,
    });
    return;
  }

  // Load profile fresh for link URLs and caller number.
  const { profile } = await resolveUserAndProfileByToNumber(payload.to);
  const callerNumber = payload.from;
  const callerAvailable =
    callerNumber &&
    !['anonymous', 'unavailable', 'restricted'].includes(String(callerNumber).toLowerCase());

  if (action === 'voicemail') {
    await telnyx.speak(callControlId, {
      payload: 'Please leave your message after the tone. Press pound when finished.',
      voice: TELNYX_DEFAULT_VOICE,
      language: TELNYX_DEFAULT_LANG,
    });
    await telnyx.startRecording(callControlId, { format: 'mp3' });
    return;
  }

  const linkUrl =
    action === 'booking' ? profile?.booking_link_url : profile?.quote_link_url;
  if (!linkUrl) {
    await telnyx.speak(callControlId, {
      payload: "Sorry, that option isn't set up. Goodbye.",
      voice: TELNYX_DEFAULT_VOICE,
      language: TELNYX_DEFAULT_LANG,
    });
    return;
  }

  if (!callerAvailable) {
    const spokenUrl = new URL(linkUrl).host + new URL(linkUrl).pathname;
    await telnyx.speak(callControlId, {
      payload: `We couldn't text you because your number is blocked. Please visit ${spokenUrl}.`,
      voice: TELNYX_DEFAULT_VOICE,
      language: TELNYX_DEFAULT_LANG,
    });
    return;
  }

  if (action === 'booking') {
    await smsLinkSender.sendBookingLinkSMS(
      callerNumber,
      profile.business_name,
      linkUrl,
      userId,
      callControlId,
      { fallbackApology: isFallback }
    );
    await telnyx.speak(callControlId, {
      payload: "Thanks! We've just texted you a booking link. Talk soon.",
      voice: TELNYX_DEFAULT_VOICE,
      language: TELNYX_DEFAULT_LANG,
    });
  } else if (action === 'quote') {
    await smsLinkSender.sendQuoteLinkSMS(
      callerNumber,
      profile.business_name,
      linkUrl,
      userId,
      callControlId,
      { fallbackApology: isFallback }
    );
    await telnyx.speak(callControlId, {
      payload: "Thanks! We've just texted you a quote link. Pop in your details and we'll be in touch.",
      voice: TELNYX_DEFAULT_VOICE,
      language: TELNYX_DEFAULT_LANG,
    });
  }
}

async function onSpeakEnded(payload) {
  // After any `speak`, hang up (except when a gather is still outstanding —
  // Telnyx doesn't fire speak.ended for gather_using_speak's speech).
  try { await telnyx.hangup(payload.call_control_id); } catch {}
}

async function onCallHangup(payload) {
  const callControlId = payload.call_control_id;
  const state = decodeClientState(payload.client_state) || {};
  const { userId, callId, effectiveMode } = state;

  // Duration from Telnyx is in ms on hangup_cause payloads; fall back to 0.
  const durationSeconds = Math.round((payload.call_duration_secs ?? payload.duration_sec ?? 0));

  if (callId && userId) {
    await logCallEvent({
      callId, userId,
      eventType: 'call_ended',
      eventData: {
        hangup_cause: payload.hangup_cause,
        hangup_source: payload.hangup_source,
        duration_seconds: durationSeconds,
        effective_mode: effectiveMode,
      },
    });
    await finalizeCallCost({
      callId,
      durationSeconds,
      mode: effectiveMode || 'sms_links',
    });

    // Fire-and-forget: notify the user their phone just captured a lead.
    sendToUser({
      userId,
      category: 'new_call',
      title: 'New inbound call',
      body: payload.from ? `Flynn just handled a call from ${payload.from}.` : 'Flynn just handled a missed call.',
      data: { deepLink: `flynnai://call/${callId}` },
      threadId: 'calls',
    }).catch((err) => console.error('[IVR] push failed:', err.message));
  }

  evictCallCache(callControlId);
}

// ---------------------------------------------------------------------------
// Webhook dispatcher
// ---------------------------------------------------------------------------

async function handleTelnyxWebhook(event) {
  // event shape: { data: { event_type, payload: { ... } } }
  const eventType = event?.data?.event_type;
  const payload = event?.data?.payload;
  if (!eventType || !payload) {
    console.warn('[IVR] Malformed Telnyx webhook:', event);
    return;
  }

  try {
    switch (eventType) {
      case 'call.initiated':
        return await onCallInitiated(payload);
      case 'call.answered':
        return await onCallAnswered(payload);
      case 'call.gather.ended':
        return await onGatherEnded(payload);
      case 'call.speak.ended':
      case 'call.playback.ended':
        return await onSpeakEnded(payload);
      case 'call.hangup':
        return await onCallHangup(payload);
      case 'call.recording.saved':
        // TODO: hook into voicemail pipeline (transcription, jobs creation).
        console.log('[IVR] recording.saved', payload.recording_urls);
        return;
      default:
        // Ignore events we don't need to act on (dtmf.received, machine events, etc.)
        return;
    }
  } catch (err) {
    console.error(`[IVR] Handler for ${eventType} threw:`, err);
  }
}

module.exports = {
  handleTelnyxWebhook,
  // Keep explicit handlers exported for tests.
  onCallInitiated,
  onCallAnswered,
  onGatherEnded,
  onSpeakEnded,
  onCallHangup,
  // Pure helpers (no network) for unit tests.
  buildMenu,
  renderPrompt,
  resolveScript,
  AU_FALLBACK_SCRIPT,
};
