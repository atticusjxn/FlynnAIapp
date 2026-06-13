const express = require('express');
const twilio = require('twilio');
const dotenv = require('dotenv');
const http = require('http');
const WebSocket = require('ws');
const crypto = require('crypto');
const { randomUUID } = crypto;
const Stripe = require('stripe');
const OpenAI = require('openai');
const { toFile } = require('openai');
let createDeepgramClient;
try {
  ({ createClient: createDeepgramClient } = require('@deepgram/sdk'));
} catch (err) {
  console.warn('[Startup] @deepgram/sdk not found; live transcription disabled unless installed.');
}
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const { ensureJobForTranscript } = require('./telephony/jobCreation');
const authenticateJwt = require('./middleware/authenticateJwt');
const attachRealtimeServer = require('./telephony/realtimeServer');
const { getLLMClient, PROVIDERS } = require('./llmClient');
const jwt = require('jsonwebtoken');
const { generateDrafts, profileRowToContext } = require('./services/draftReplies');
const { understandBusiness, FALLBACK_PROMPTS } = require('./services/onboarding');
const googleCalendar = require('./services/googleCalendar');
const { findOpenSlots, parseProposedTime, checkProposedTime, findNearestOpenSlot, buildAgreedEvent } = require('./services/slotProposer');
const { transcribeAudio } = require('./services/asrClient');
const { classifyIntent } = require('./services/intentRouter');
const { extractQuote } = require('./services/quoteExtractor');
const { composeOutbound } = require('./services/voiceCompose');
const { formatBusinessContext } = require('./services/businessContextFormatter');
const { extractFacts, matchFactsToConversation, formatRememberedContext } = require('./services/contextMemory');
const { extractQuoteStyle } = require('./services/quoteStyleExtractor');

const {
  upsertCallRecord,
  getTranscriptByCallSid,
  insertTranscription,
  updateCallTranscriptionStatus,
  getCallBySid,
  getJobByCallSid,
  listJobsForUser,
  getJobForUser,
  updateJobStatusForUser,
  getJobById,
  insertJob,
  getUserProfileById,
  upsertNotificationToken,
  findExpiredRecordingCalls,
  markCallRecordingExpired,
  updateCallRecordingSignedUrl,
  getReceptionistProfileByNumber,
  recordCallEvent,
  getBusinessContextForOrg,
  getBusinessContextForUser,
  resolveOrgIdForUser,
} = require('./supabaseMcpClient');
const { sendJobCreatedNotification } = require('./notifications/pushService');
const { scrapeWebsiteWithGemini } = require('./services/geminiUrlScraper');
const { generateReceptionistConfig } = require('./services/businessProfileGenerator');
const { generateSiteFromInstagram } = require('./services/sites/siteGenerationService');
const { generateSpeech: generateGeminiSpeech, resolveVoiceName: resolveGeminiVoice } = require('./services/geminiTTSService');
const reminderScheduler = require('./services/reminderScheduler');
const { getTrialExpiryEmailHTML } = require('./services/emails/trialExpiryTemplate');
const { Resend } = require('resend');

dotenv.config();

const decodeSupabaseRole = (key) => {
  if (!key) {
    console.warn('[Supabase] SUPABASE_SERVICE_ROLE_KEY is not set');
    return;
  }

  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
    console.log('[Supabase] Service key role detected:', payload?.role || 'unknown');
  } catch (error) {
    console.warn('[Supabase] Failed to decode service key role', error);
  }
};

decodeSupabaseRole(process.env.SUPABASE_SERVICE_ROLE_KEY);

if (process.env.SERVER_PUBLIC_URL) {
  console.log('[Telephony] SERVER_PUBLIC_URL configured:', process.env.SERVER_PUBLIC_URL);
} else {
  console.log('[Telephony] SERVER_PUBLIC_URL not set; recording callback URLs will mirror the incoming request host.');
}

const app = express();
app.set('trust proxy', true); // ensure req.protocol honors X-Forwarded-Proto from ngrok/Twilio
const port = process.env.PORT || 3000;
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const shouldValidateSignature = process.env.TWILIO_VALIDATE_SIGNATURE !== 'false';
const openaiApiKey = process.env.OPENAI_API_KEY;
const twilioMessagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
const twilioSmsFromNumber = process.env.TWILIO_SMS_FROM_NUMBER || process.env.TWILIO_FROM_NUMBER;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const stripeBasicPriceId = process.env.STRIPE_BASIC_PRICE_ID;
const stripeGrowthPriceId = process.env.STRIPE_GROWTH_PRICE_ID;
const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.FROM_EMAIL || 'notifications@flynnai.app';
const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_KEY
  || process.env.SUPABASE_SECRET;
const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
const receptionistEnabledGlobally = process.env.ENABLE_CONVERSATION_ORCHESTRATOR !== 'false';
const maxQuestionsPerTurn = Number.parseInt(process.env.MAX_QUESTIONS_PER_TURN ?? '1', 10);
const minAckVariety = Number.parseInt(process.env.MIN_ACK_VARIETY ?? '3', 10);

const parseIntegerEnv = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const computeReportPeriod = (period, customStartDate, customEndDate) => {
  const now = new Date();
  const startOfQuarter = (year, quarterIndex) => new Date(year, quarterIndex * 3, 1);
  const endOfQuarter = (year, quarterIndex) => new Date(year, quarterIndex * 3 + 3, 0, 23, 59, 59, 999);

  switch (period) {
    case 'currentQuarter': {
      const quarterIndex = Math.floor(now.getMonth() / 3);
      const year = now.getFullYear();
      return { start: startOfQuarter(year, quarterIndex), end: endOfQuarter(year, quarterIndex) };
    }
    case 'lastQuarter': {
      let quarterIndex = Math.floor(now.getMonth() / 3) - 1;
      let year = now.getFullYear();
      if (quarterIndex < 0) {
        quarterIndex = 3;
        year -= 1;
      }
      return { start: startOfQuarter(year, quarterIndex), end: endOfQuarter(year, quarterIndex) };
    }
    case 'currentFinancialYear': {
      // AU financial year: Jul 1 - Jun 30
      const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
      return { start: new Date(year, 6, 1), end: new Date(year + 1, 5, 30, 23, 59, 59, 999) };
    }
    case 'lastFinancialYear': {
      const year = now.getMonth() >= 6 ? now.getFullYear() - 1 : now.getFullYear() - 2;
      return { start: new Date(year, 6, 1), end: new Date(year + 1, 5, 30, 23, 59, 59, 999) };
    }
    case 'custom': {
      const start = customStartDate ? new Date(customStartDate) : null;
      const end = customEndDate ? new Date(customEndDate) : null;
      if (!start || Number.isNaN(start.getTime()) || !end || Number.isNaN(end.getTime())) {
        return null;
      }
      return { start, end: new Date(end.getTime()) };
    }
    default:
      return null;
  }
};

const voicemailBucket = process.env.VOICEMAIL_STORAGE_BUCKET || 'voicemails';
const voicemailSignedUrlTtlSeconds = parseIntegerEnv(process.env.VOICEMAIL_SIGNED_URL_TTL_SECONDS, 3600);
const voicemailRetentionDays = parseIntegerEnv(process.env.VOICEMAIL_RETENTION_DAYS, 30);

const allowedSummaryTypes = new Set(['Payments', 'Earnings']);
const allowedSummaryPeriods = new Set([
  'currentQuarter',
  'lastQuarter',
  'currentFinancialYear',
  'lastFinancialYear',
  'custom',
]);

const supabaseClientOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    headers: {
      apikey: supabaseServiceKey,
      Authorization: `Bearer ${supabaseServiceKey}`,
    },
  },
};

const supabaseStorageClient = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, supabaseClientOptions)
  : null;

// Alias for webhook handlers and other services that expect supabaseServiceClient
const supabaseServiceClient = supabaseStorageClient;

const deleteUserData = async (userId) => {
  if (!supabaseStorageClient) {
    throw new Error('Supabase client not configured for account deletion');
  }

  // First, release Twilio phone numbers associated with this user
  try {
    const { data: phoneNumbers, error: phoneError } = await supabaseStorageClient
      .from('phone_numbers')
      .select('id, twilio_sid, e164_number')
      .eq('provisioned_by', userId);

    if (!phoneError && phoneNumbers && phoneNumbers.length > 0) {
      for (const phone of phoneNumbers) {
        // Mark as released in database first
        await supabaseStorageClient
          .from('phone_numbers')
          .update({
            status: 'released',
            released_at: new Date().toISOString(),
            is_primary: false,
          })
          .eq('id', phone.id);

        // Release from Twilio if we have a Twilio SID
        if (phone.twilio_sid && twilioClient) {
          try {
            await twilioClient.incomingPhoneNumbers(phone.twilio_sid).remove();
            console.log('[AccountDeletion] Released Twilio number', {
              userId,
              phoneId: phone.id,
              number: phone.e164_number
            });
          } catch (twilioError) {
            console.warn('[AccountDeletion] Failed to release Twilio number', {
              userId,
              phoneId: phone.id,
              twilioSid: phone.twilio_sid,
              error: twilioError
            });
          }
        }
      }
    }
  } catch (error) {
    console.warn('[AccountDeletion] Failed to release phone numbers', { userId, error });
  }

  const tablesWithUserId = [
    'notification_tokens',
    'voice_profiles',
    'calls',
    'transcriptions',
    'call_events',
    'receptionist_configs',
    'call_flows',
    'phone_numbers',
    'business_profiles',
    'website_ingests',
    'onboarding_sessions',
    'jobs',
  ];

  for (const table of tablesWithUserId) {
    const { error } = await supabaseStorageClient.from(table).delete().eq('user_id', userId);
    if (error) {
      console.warn('[AccountDeletion] Failed to purge table', { table, userId, error });
    }
  }

  const { error: profileError } = await supabaseStorageClient.from('users').delete().eq('id', userId);
  if (profileError) {
    console.warn('[AccountDeletion] Failed to delete user profile row', { userId, error: profileError });
  }

  if (supabaseStorageClient.auth?.admin?.deleteUser) {
    try {
      await supabaseStorageClient.auth.admin.deleteUser(userId);
    } catch (error) {
      console.error('[AccountDeletion] Failed to delete auth user', { userId, error });
      throw error;
    }
  }
};

const stripeClient = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' })
  : null;

const resendClient = resendApiKey
  ? new Resend(resendApiKey)
  : null;

const planPriceMapping = {};
if (stripeBasicPriceId) {
  planPriceMapping[stripeBasicPriceId] = 'starter';
}
if (stripeGrowthPriceId) {
  planPriceMapping[stripeGrowthPriceId] = 'growth';
}

const knownPlanIds = new Set(['trial', 'starter', 'growth', 'enterprise']);

const resolvePlanFromPriceId = (priceId) => {
  if (!priceId) {
    return null;
  }
  return planPriceMapping[priceId] || null;
};

const normalizePlanId = (planId) => {
  if (!planId) {
    return null;
  }
  return knownPlanIds.has(planId) ? planId : null;
};

const updateOrganizationPlanById = async (orgId, planId) => {
  if (!supabaseStorageClient) {
    console.warn('[Billing] Supabase client unavailable; cannot update plan.');
    return false;
  }

  try {
    const { data, error } = await supabaseStorageClient
      .from('organizations')
      .update({
        plan: planId,
        billing_plan_id: planId, // Also update billing_plan_id for BillingService
        status: 'active'
      })
      .eq('id', orgId)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('[Billing] Failed to update organization plan', { orgId, planId, error });
      return false;
    }

    if (!data) {
      console.warn('[Billing] Organization not found for plan update', { orgId });
      return false;
    }

    console.log('[Billing] Updated organization plan', { orgId, planId });
    return true;
  } catch (error) {
    console.error('[Billing] Unexpected error updating organization plan', { orgId, planId, error });
    return false;
  }
};

const updateOrganizationPlanByEmail = async (email, planId) => {
  if (!supabaseStorageClient) {
    console.warn('[Billing] Supabase client unavailable; cannot update plan by email.');
    return false;
  }

  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    return false;
  }

  try {
    const { data: userRow, error } = await supabaseStorageClient
      .from('users')
      .select('default_org_id')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (error) {
      console.error('[Billing] Failed to lookup user for email', { email: normalizedEmail, error });
      return false;
    }

    if (!userRow?.default_org_id) {
      console.warn('[Billing] No default organization found for user email', { email: normalizedEmail });
      return false;
    }

    return updateOrganizationPlanById(userRow.default_org_id, planId);
  } catch (error) {
    console.error('[Billing] Unexpected error resolving user by email', { email: normalizedEmail, error });
    return false;
  }
};

const applyPlanToOrganizationContext = async ({ orgId, email, planId }) => {
  const normalizedPlan = normalizePlanId(planId);
  if (!normalizedPlan) {
    console.warn('[Billing] Attempted to apply unknown plan', { planId });
    return;
  }

  let updated = false;
  if (orgId) {
    updated = await updateOrganizationPlanById(orgId, normalizedPlan);
  }

  if (!updated && email) {
    updated = await updateOrganizationPlanByEmail(email, normalizedPlan);
  }

  if (!updated) {
    console.warn('[Billing] Unable to map Stripe payment to organization', { orgId, email, planId: normalizedPlan });
  }
};

const resolvePlanFromCheckoutSession = async (session) => {
  const metadataPlan = normalizePlanId(session?.metadata?.planId || session?.metadata?.plan || null);
  if (metadataPlan) {
    return metadataPlan;
  }

  const fallback = resolvePlanFromPriceId(session?.metadata?.priceId);
  if (fallback) {
    return fallback;
  }

  if (!stripeClient) {
    return null;
  }

  try {
    const expandedSession = await stripeClient.checkout.sessions.retrieve(session.id, {
      expand: ['line_items.data.price'],
    });

    const lineItems = expandedSession?.line_items?.data ?? [];
    for (const item of lineItems) {
      const priceId = item?.price?.id;
      const planId = resolvePlanFromPriceId(priceId);
      if (planId) {
        return planId;
      }
    }
  } catch (error) {
    console.error('[Billing] Failed to expand checkout session for plan resolution', { sessionId: session?.id, error });
  }

  return null;
};

const handleCheckoutSessionCompleted = async (session) => {
  const planId = await resolvePlanFromCheckoutSession(session);
  if (!planId) {
    console.warn('[Billing] Checkout completed without recognised plan', { sessionId: session?.id });
    return;
  }

  const orgId = session?.client_reference_id || session?.metadata?.organizationId || null;
  const email = (session?.customer_details?.email || session?.customer_email || '').toLowerCase();

  // Store Stripe customer ID and subscription details when created via checkout
  if (session.customer && orgId) {
    try {
      // Get the subscription ID from the session
      const subscriptionId = session.subscription;

      const updateData = {
        stripe_customer_id: session.customer,
        stripe_subscription_id: subscriptionId,
        subscription_status: 'trialing', // New subscriptions start with 14-day trial
        billing_plan_id: planId,
      };

      const { error } = await supabaseServiceClient
        .from('organizations')
        .update(updateData)
        .eq('id', orgId);

      if (error) {
        console.error('[Billing] Failed to store Stripe subscription details', { orgId, error });
      } else {
        console.log('[Billing] Stored subscription details with trial status', {
          orgId,
          subscriptionId,
          status: 'trialing',
          planId
        });

        // Also update the user's has_started_trial flag for setup progress tracking
        try {
          const { error: userUpdateError } = await supabaseServiceClient
            .from('users')
            .update({ has_started_trial: true })
            .eq('default_org_id', orgId);

          if (userUpdateError) {
            console.error('[Billing] Failed to update user has_started_trial flag', { orgId, error: userUpdateError });
          } else {
            console.log('[Billing] Updated user has_started_trial flag', { orgId });
          }
        } catch (userError) {
          console.error('[Billing] Error updating user has_started_trial flag', { orgId, error: userError });
        }
      }
    } catch (error) {
      console.error('[Billing] Error storing Stripe subscription details', { orgId, error });
    }
  }

  await applyPlanToOrganizationContext({
    orgId,
    email,
    planId,
  });
};

const handleSubscriptionUpdated = async (subscription) => {
  console.log('[Stripe Webhook] Processing subscription update', { subscriptionId: subscription.id });

  try {
    // Try to find organization first
    const { data: org, error: findError } = await supabaseServiceClient
      .from('organizations')
      .select('id, plan')
      .eq('stripe_customer_id', subscription.customer)
      .single();

    if (org && !findError) {
      // Map Stripe price ID to plan tier
      const priceId = subscription.items.data[0]?.price?.id;
      const planId = resolvePlanFromPriceId(priceId);

      if (!planId) {
        console.warn('[Stripe Webhook] Could not resolve plan from price', { priceId });
        return;
      }

      // Update organization with subscription data
      const { error: updateError } = await supabaseServiceClient
        .from('organizations')
        .update({
          stripe_subscription_id: subscription.id,
          subscription_status: subscription.status,
          plan: planId,
          billing_plan_id: planId, // Sync billing_plan_id for BillingService
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end || false,
        })
        .eq('id', org.id);

      if (updateError) {
        console.error('[Stripe Webhook] Failed to update organization', { orgId: org.id, error: updateError });
      } else {
        console.log('[Stripe Webhook] Organization updated successfully', { orgId: org.id, plan: planId });
      }
      return;
    }

    // If not an organization, try to find user
    const { data: user, error: userFindError } = await supabaseServiceClient
      .from('users')
      .select('id')
      .eq('stripe_customer_id', subscription.customer)
      .single();

    if (user && !userFindError) {
      // Update user with subscription data
      const { error: userUpdateError } = await supabaseServiceClient
        .from('users')
        .update({
          stripe_subscription_id: subscription.id,
          subscription_status: subscription.status,
          trial_end_date: subscription.trial_end
            ? new Date(subscription.trial_end * 1000).toISOString()
            : null,
        })
        .eq('id', user.id);

      if (userUpdateError) {
        console.error('[Stripe Webhook] Failed to update user', { userId: user.id, error: userUpdateError });
      } else {
        console.log('[Stripe Webhook] User subscription updated successfully', { userId: user.id, status: subscription.status });
      }
      return;
    }

    console.error('[Stripe Webhook] No organization or user found for customer', {
      customerId: subscription.customer
    });
  } catch (error) {
    console.error('[Stripe Webhook] Error handling subscription update', { error });
  }
};

const handleSubscriptionDeleted = async (subscription) => {
  console.log('[Stripe Webhook] Processing subscription deletion', { subscriptionId: subscription.id });

  try {
    // Try to find organization first
    const { data: org, error: findError } = await supabaseServiceClient
      .from('organizations')
      .select('id')
      .eq('stripe_subscription_id', subscription.id)
      .single();

    if (org && !findError) {
      // Downgrade to trial plan
      const { error: updateError } = await supabaseServiceClient
        .from('organizations')
        .update({
          plan: 'trial',
          subscription_status: 'canceled',
          stripe_subscription_id: null,
          cancel_at_period_end: false,
        })
        .eq('id', org.id);

      if (updateError) {
        console.error('[Stripe Webhook] Failed to downgrade organization', { orgId: org.id, error: updateError });
      } else {
        console.log('[Stripe Webhook] Organization downgraded to trial', { orgId: org.id });
      }
      return;
    }

    // If not an organization, try to find user
    const { data: user, error: userFindError } = await supabaseServiceClient
      .from('users')
      .select('id')
      .eq('stripe_subscription_id', subscription.id)
      .single();

    if (user && !userFindError) {
      // Mark user subscription as canceled
      const { error: userUpdateError } = await supabaseServiceClient
        .from('users')
        .update({
          subscription_status: 'canceled',
          stripe_subscription_id: null,
        })
        .eq('id', user.id);

      if (userUpdateError) {
        console.error('[Stripe Webhook] Failed to cancel user subscription', { userId: user.id, error: userUpdateError });
      } else {
        console.log('[Stripe Webhook] User subscription canceled', { userId: user.id });
      }
      return;
    }

    console.error('[Stripe Webhook] No organization or user found for subscription', {
      subscriptionId: subscription.id
    });
  } catch (error) {
    console.error('[Stripe Webhook] Error handling subscription deletion', { error });
  }
};

const handleInvoicePaid = async (invoice) => {
  console.log('[Stripe Webhook] Processing invoice paid', { invoiceId: invoice.id });

  try {
    const { data: org, error: findError } = await supabaseServiceClient
      .from('organizations')
      .select('id')
      .eq('stripe_customer_id', invoice.customer)
      .single();

    if (findError || !org) {
      console.error('[Stripe Webhook] Organization not found for customer', {
        customerId: invoice.customer,
        error: findError
      });
      return;
    }

    // Ensure subscription status is active if payment succeeded
    const { error: updateError } = await supabaseServiceClient
      .from('organizations')
      .update({ subscription_status: 'active' })
      .eq('id', org.id);

    if (updateError) {
      console.error('[Stripe Webhook] Failed to update subscription status', { orgId: org.id, error: updateError });
    }
  } catch (error) {
    console.error('[Stripe Webhook] Error handling invoice paid', { error });
  }
};

const handleInvoicePaymentFailed = async (invoice) => {
  console.log('[Stripe Webhook] Processing invoice payment failed', { invoiceId: invoice.id });

  try {
    // Try to find organization first
    const { data: org, error: findError } = await supabaseServiceClient
      .from('organizations')
      .select('id')
      .eq('stripe_customer_id', invoice.customer)
      .single();

    if (org && !findError) {
      // Update organization to past_due status
      const { error: updateError } = await supabaseServiceClient
        .from('organizations')
        .update({ subscription_status: 'past_due' })
        .eq('id', org.id);

      if (updateError) {
        console.error('[Stripe Webhook] Failed to update organization status', { orgId: org.id, error: updateError });
      } else {
        console.log('[Stripe Webhook] Organization marked as past_due', { orgId: org.id });
      }
      return;
    }

    // If not an organization, try to find user
    const { data: user, error: userFindError } = await supabaseServiceClient
      .from('users')
      .select('id')
      .eq('stripe_customer_id', invoice.customer)
      .single();

    if (user && !userFindError) {
      // Update user to past_due status
      const { error: userUpdateError } = await supabaseServiceClient
        .from('users')
        .update({ subscription_status: 'past_due' })
        .eq('id', user.id);

      if (userUpdateError) {
        console.error('[Stripe Webhook] Failed to update user status', { userId: user.id, error: userUpdateError });
      } else {
        console.log('[Stripe Webhook] User marked as past_due', { userId: user.id });
      }
      return;
    }

    console.error('[Stripe Webhook] No organization or user found for customer', {
      customerId: invoice.customer
    });
  } catch (error) {
    console.error('[Stripe Webhook] Error handling invoice payment failed', { error });
  }
};

const handleStripeWebhookEvent = async (event) => {
  console.log('[Stripe Webhook] Received event:', event.type);

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutSessionCompleted(event.data.object);
      break;

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object);
      break;

    case 'invoice.paid':
      await handleInvoicePaid(event.data.object);
      break;

    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data.object);
      break;

    default:
      console.log('[Stripe Webhook] Unhandled event type:', event.type);
      break;
  }
};

if (!twilioAccountSid || !twilioAuthToken) {
  console.warn('[Telephony] Twilio credentials are incomplete; recording downloads will fail until configured.');
}

if (!supabaseStorageClient) {
  console.warn('[Telephony] Supabase storage client is not configured; voicemail uploads will fail.');
}

let llmClient = null;
try {
  llmClient = getLLMClient();
  console.log('[LLM] Initialised AI provider.', { provider: llmClient.provider });
} catch (error) {
  console.warn('[LLM] Failed to initialise AI provider.', { error: error.message });
}

if (!openaiApiKey && (!llmClient || llmClient.provider !== PROVIDERS.GROK)) {
  console.warn('[Telephony] OPENAI_API_KEY is not configured; OpenAI features will be unavailable.');
}

let transcriptionClient = llmClient;
if (!transcriptionClient || transcriptionClient.provider === PROVIDERS.GROK || transcriptionClient.provider === PROVIDERS.GEMINI) {
  const fallbackKey = (process.env.OPENAI_API_KEY || '').trim();
  if (fallbackKey) {
    try {
      transcriptionClient = new OpenAI({ apiKey: fallbackKey });
      transcriptionClient.provider = PROVIDERS.OPENAI;
      console.log('[LLM] Using OpenAI fallback for transcription workloads.');
    } catch (error) {
      console.warn('[LLM] Failed to initialise OpenAI transcription fallback.', { error: error.message });
      transcriptionClient = null;
    }
  } else if (llmClient && (llmClient.provider === PROVIDERS.GROK || llmClient.provider === PROVIDERS.GEMINI)) {
    console.warn('[LLM] Non-OpenAI provider active without transcription fallback; voicemail transcription will be disabled.');
  }
}

const deepgramClient = deepgramApiKey && typeof createDeepgramClient === 'function'
  ? createDeepgramClient(deepgramApiKey)
  : null;
const twilioMessagingClient = twilioAccountSid && twilioAuthToken
  ? twilio(twilioAccountSid, twilioAuthToken)
  : null;

const voiceProfileBucket = process.env.VOICE_PROFILE_BUCKET || 'voice-profiles';
const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
const elevenLabsModelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_flash_v2_5';
const elevenLabsPresetVoices = {
  flynn_warm: process.env.ELEVENLABS_VOICE_FLYNN_WARM_ID,
  flynn_expert: process.env.ELEVENLABS_VOICE_FLYNN_EXPERT_ID,
  flynn_hype: process.env.ELEVENLABS_VOICE_FLYNN_HYPE_ID,
  // Koala persona aliases used by receptionist configs
  koala_warm: process.env.ELEVENLABS_VOICE_KOALA_WARM_ID,
  koala_expert: process.env.ELEVENLABS_VOICE_KOALA_EXPERT_ID,
  koala_hype: process.env.ELEVENLABS_VOICE_KOALA_HYPE_ID,
};

const azureSpeechKey = process.env.AZURE_SPEECH_KEY ? process.env.AZURE_SPEECH_KEY.trim() : '';
const azureSpeechRegion = process.env.AZURE_SPEECH_REGION ? process.env.AZURE_SPEECH_REGION.trim() : '';
const azureSpeechEndpoint = process.env.AZURE_SPEECH_ENDPOINT ? process.env.AZURE_SPEECH_ENDPOINT.trim() : '';
const azureDefaultVoice = process.env.AZURE_TTS_DEFAULT_VOICE || 'en-AU-NatashaNeural';
const azurePresetVoices = {
  flynn_warm: process.env.AZURE_VOICE_FLYNN_WARM || azureDefaultVoice,
  flynn_expert: process.env.AZURE_VOICE_FLYNN_EXPERT || 'en-AU-WilliamNeural',
  flynn_hype: process.env.AZURE_VOICE_FLYNN_HYPE || 'en-AU-CarlyNeural',
  // Simple gender-based voices for Azure
  male: 'en-AU-WilliamNeural',
  female: 'en-AU-NatashaNeural',
};

// Gemini TTS Configuration (Google's latest superior TTS)
const geminiApiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';
const geminiTtsModel = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
const geminiDefaultVoice = process.env.GEMINI_TTS_DEFAULT_VOICE || 'Kore';
const geminiPresetVoices = {
  flynn_warm: 'Sulafat',     // Warm voice
  flynn_expert: 'Kore',      // Firm, professional
  flynn_hype: 'Puck',        // Upbeat, energetic
  koala_warm: 'Sulafat',
  koala_expert: 'Kore',
  koala_hype: 'Puck',
  male: 'Orus',              // Firm male-sounding
  female: 'Aoede',           // Breezy female-sounding
};

const resolveTtsProvider = () => {
  const explicit = (process.env.TTS_PROVIDER || '').trim().toLowerCase();
  const hasGemini = Boolean(geminiApiKey);
  const hasAzure = Boolean(azureSpeechKey && (azureSpeechRegion || azureSpeechEndpoint));
  const hasEleven = Boolean(elevenLabsApiKey);

  if (!hasGemini && !hasAzure && !hasEleven) {
    return 'none';
  }

  if (explicit === 'gemini' && hasGemini) {
    return 'gemini';
  }
  if (explicit === 'azure' && hasAzure) {
    return 'azure';
  }
  if (explicit === 'elevenlabs' && hasEleven) {
    return 'elevenlabs';
  }

  // Default: prefer Gemini (superior quality), then Azure, then ElevenLabs
  if (hasGemini) return 'gemini';
  if (hasAzure) return 'azure';
  if (hasEleven) return 'elevenlabs';
  return 'none';
};

const ttsProvider = resolveTtsProvider();
const ttsCacheTtlMs = parseIntegerEnv(process.env.TTS_CACHE_TTL_MS, 15 * 60 * 1000);
const ttsCacheMaxEntries = parseIntegerEnv(process.env.TTS_CACHE_MAX_ENTRIES, 256);
const activePresetVoices =
  ttsProvider === 'gemini' ? geminiPresetVoices :
    ttsProvider === 'azure' ? azurePresetVoices :
      elevenLabsPresetVoices;
const voiceConfig = {
  provider: ttsProvider,
  presetVoices: activePresetVoices,
  cacheControl: {
    ttlMs: ttsCacheTtlMs,
    maxEntries: ttsCacheMaxEntries,
  },
  gemini: {
    apiKey: geminiApiKey,
    model: geminiTtsModel,
    defaultVoice: geminiDefaultVoice,
    presetVoices: geminiPresetVoices,
  },
  azure: {
    key: azureSpeechKey,
    region: azureSpeechRegion,
    endpoint: azureSpeechEndpoint,
    defaultVoice: azureDefaultVoice,
    presetVoices: azurePresetVoices,
  },
  elevenLabs: {
    apiKey: elevenLabsApiKey,
    modelId: elevenLabsModelId,
    presetVoices: elevenLabsPresetVoices,
  },
};

console.log('[TTS] Provider configuration detected.', {
  provider: voiceConfig.provider,
  hasGemini: Boolean(voiceConfig.gemini.apiKey),
  hasAzure: Boolean(voiceConfig.azure.key && (voiceConfig.azure.endpoint || voiceConfig.azure.region)),
  hasElevenLabs: Boolean(voiceConfig.elevenLabs.apiKey),
  cacheTtlMs: voiceConfig.cacheControl.ttlMs,
  cacheMaxEntries: voiceConfig.cacheControl.maxEntries,
});

const escapeSsmlForAzure = (text) => text
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/\"/g, '&quot;')
  .replace(/'/g, '&apos;');

const buildAzureSsml = (voiceName, text) => {
  const voice = voiceName || 'en-AU-NatashaNeural';
  const langParts = Array.isArray(voice.split('-')) ? voice.split('-').slice(0, 2) : ['en', 'AU'];
  const lang = langParts.filter(Boolean).join('-') || 'en-AU';
  return `<speak version=\"1.0\" xml:lang=\"${lang}\"><voice name=\"${voice}\">${escapeSsmlForAzure(text)}</voice></speak>`;
};

const DEFAULT_ACK_LIBRARY = [
  'Got it!',
  'Perfect, thanks!',
  'Understood.',
  'That helps, thank you.',
  'Great, keep going.',
  'Heard you loud and clear.',
  'Awesome, let me note that.',
  'Thanks, just a sec.',
  'Okay, appreciate the detail.',
  'Brilliant, one moment.',
];

const receptionistSessionCache = new Map(); // callSid -> metadata

const buildRealtimeStreamUrl = (req, callSid, userId) => {
  const base = process.env.SERVER_PUBLIC_URL
    ? process.env.SERVER_PUBLIC_URL.trim().replace(/\/$/, '')
    : `${req.protocol}://${req.get('host')}`;

  const wsBase = base.replace(/^http/, 'ws').replace(/^https/, 'wss');
  const url = new URL('/realtime/twilio', wsBase);
  if (callSid) {
    url.searchParams.set('callSid', callSid);
  }
  if (userId) {
    url.searchParams.set('userId', userId);
  }
  return url.toString();
};

const normalizeAckLibrary = (profile) => {
  if (!profile) {
    return DEFAULT_ACK_LIBRARY;
  }

  const provided = Array.isArray(profile.receptionist_ack_library)
    ? profile.receptionist_ack_library
    : [];

  const cleaned = provided
    .map((entry) => (typeof entry === 'string' ? entry.trim() : null))
    .filter((entry) => entry && entry.length > 0);

  if (cleaned.length >= minAckVariety) {
    return cleaned;
  }

  const merged = [...cleaned];
  for (const fallback of DEFAULT_ACK_LIBRARY) {
    if (merged.length >= minAckVariety) {
      break;
    }
    if (!merged.includes(fallback)) {
      merged.push(fallback);
    }
  }

  return merged.length > 0 ? merged : DEFAULT_ACK_LIBRARY;
};

const respondWithVoicemail = (req, res, inboundParams) => {
  const response = new twilio.twiml.VoiceResponse();

  response.say('Hi, you\'ve reached FlynnAI. Please leave a message after the tone.');
  response.record({
    action: buildRecordingCallbackUrl(req),
    method: 'POST',
    playBeep: true,
  });

  res.type('text/xml');
  res.send(response.toString());
};


const cacheReceptionistSession = ({ callSid, profile, toNumber }) => {
  if (!callSid || !profile) {
    return;
  }

  const ackLibrary = normalizeAckLibrary(profile);
  const questions = Array.isArray(profile.receptionist_questions)
    ? profile.receptionist_questions.filter((q) => typeof q === 'string' && q.trim().length > 0)
    : [];

  receptionistSessionCache.set(callSid, {
    callSid,
    userId: profile.id,
    orgId: profile.default_org_id || profile.org_id || null,
    toNumber,
    startedAt: Date.now(),
    ackLibrary,
    greeting: (profile.receptionist_greeting || '').trim(),
    voiceOption: profile.receptionist_voice || 'flynn_warm',
    voiceProfileId: profile.receptionist_voice_profile_id || null,
    voiceId: profile.receptionist_voice_id || null,
    voiceStatus: profile.receptionist_voice_status || null,
    questions,
    maxQuestionsPerTurn,
    minAckVariety,
    businessProfile: profile.receptionist_business_profile || null,
    businessName: profile.business_name || null,
    businessType: profile.business_type || null,
    mode: profile.call_handling_mode || profile.receptionist_mode || 'sms_links',
    ackHistory: [],
  });
};

const respondWithAiReceptionist = ({ req, res, inboundParams, profile, callSid }) => {
  const response = new twilio.twiml.VoiceResponse();
  const streamUrl = buildRealtimeStreamUrl(req, callSid, profile?.id);

  console.log('[Telephony] Starting AI receptionist for call.', {
    callSid,
    userId: profile?.id,
    streamUrl,
    voiceOption: profile?.receptionist_voice,
    hasGreeting: Boolean(profile?.receptionist_greeting),
    questionsCount: Array.isArray(profile?.receptionist_questions) ? profile.receptionist_questions.length : 0,
  });

  // IMPORTANT: Cache the session BEFORE sending TwiML response
  cacheReceptionistSession({ callSid, profile, toNumber: inboundParams.To || inboundParams.Called });

  // Start call recording via Twilio REST API (runs in parallel with stream)
  if (twilioMessagingClient && callSid) {
    const recordingCallbackUrl = buildRecordingCallbackUrl(req);
    twilioMessagingClient.calls(callSid)
      .recordings
      .create({
        recordingStatusCallback: recordingCallbackUrl,
        recordingStatusCallbackMethod: 'POST',
      })
      .then((recording) => {
        console.log('[Telephony] Call recording started via API.', {
          callSid,
          recordingSid: recording.sid,
        });
      })
      .catch((error) => {
        console.error('[Telephony] Failed to start call recording.', {
          callSid,
          error: error.message,
        });
      });
  }

  const connect = response.connect();
  const stream = connect.stream({
    url: streamUrl,
    track: 'inbound_track', // Only receive caller audio to prevent feedback loop
    statusCallback: `${req.protocol}://${req.get('host')}/telephony/stream-status`,
    statusCallbackMethod: 'POST',
  });

  stream.parameter({ name: 'callSid', value: callSid || '' });
  if (profile?.id) {
    stream.parameter({ name: 'userId', value: profile.id });
  }

  const twimlOutput = response.toString();
  console.log('[Telephony] Sending TwiML response:', { callSid, twiml: twimlOutput });

  res.type('text/xml');
  res.send(twimlOutput);
};

const handleRealtimeConversationComplete = async ({ callSid, userId, orgId, transcript, turns, reason }) => {
  if (!callSid) {
    return;
  }

  let callContext = null;
  try {
    callContext = await getCallBySid(callSid);
  } catch (error) {
    console.warn('[Realtime] Unable to load call context for event logging.', { callSid, error });
  }

  // Log AI call usage for billing
  if (orgId && userId) {
    try {
      const durationSeconds = callContext?.call_duration || 0;
      const callCostCents = 40; // $0.40 AUD per call
      const billingMonth = new Date();
      billingMonth.setDate(1);
      billingMonth.setHours(0, 0, 0, 0);

      await supabaseClient.from('ai_call_usage').insert({
        organization_id: orgId,
        user_id: userId,
        call_sid: callSid,
        call_duration_seconds: durationSeconds,
        call_cost_cents: callCostCents,
        billing_period_month: billingMonth.toISOString().split('T')[0],
      }).then(({ error }) => {
        if (error) {
          console.warn('[Billing] Failed to log call usage.', { callSid, orgId, error });
        } else {
          console.log('[Billing] Call usage logged successfully.', {
            callSid,
            orgId,
            userId,
            cost: `$${(callCostCents / 100).toFixed(2)} AUD`,
          });
        }
      });
    } catch (usageError) {
      console.error('[Billing] Error logging call usage.', { callSid, orgId, error: usageError });
    }
  }

  try {
    const existingTranscript = await getTranscriptByCallSid(callSid);

    if (!existingTranscript && transcript && transcript.trim().length > 0) {
      await insertTranscription({
        id: randomUUID(),
        callSid,
        userId: userId || null,
        orgId: orgId || null,
        engine: 'realtime',
        text: transcript.trim(),
        confidence: 0.92,
        language: 'en',
      });
    }

    await updateCallTranscriptionStatus({ callSid, status: 'completed' }).catch((error) => {
      console.warn('[Realtime] Failed to update transcription status.', { callSid, error });
    });

    await upsertCallRecord({
      callSid,
      userId: userId || null,
      orgId: orgId || null,
      status: reason === 'complete' ? 'completed' : 'ended',
    }).catch((error) => {
      console.error('[Realtime] Failed to upsert call record on conversation complete.', { callSid, userId, orgId, error });
    });

    if (transcript && transcript.trim().length > 4) {
      if (llmClient) {
        await ensureJobForTranscript({
          callSid,
          transcriptText: transcript,
          llmClient,
          userId,
          orgId,
        });
      } else {
        console.warn('[Jobs] Skipping job creation; no LLM client configured.', { callSid });
      }
    }

    await logCallEvent({
      orgId: callContext?.org_id || null,
      callSid,
      eventType: 'call_completed',
      direction: 'inbound',
      payload: {
        reason,
        turnCount: Array.isArray(turns) ? turns.length : 0,
        transcriptLength: transcript ? transcript.length : 0,
      },
    });

    // Explicitly end the live call to avoid lingering streams once we finish
    if (twilioMessagingClient && callSid) {
      try {
        await twilioMessagingClient.calls(callSid).update({ status: 'completed' });
        console.log('[Realtime] Ended Twilio call via REST API.', { callSid });
      } catch (error) {
        // 404 (code 20404) means call already ended naturally - this is fine, not an error
        if (error.status === 404 || error.code === 20404) {
          console.log('[Realtime] Call already ended naturally.', { callSid });
        } else {
          console.warn('[Realtime] Failed to end Twilio call via REST API.', { callSid, error });
        }
      }
    }
  } catch (error) {
    console.error('[Realtime] Failed to persist realtime conversation data.', { callSid, error });
  } finally {
    receptionistSessionCache.delete(callSid);
  }
};

if (stripeClient && stripeWebhookSecret) {
  app.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const signature = req.headers['stripe-signature'];

    let event;
    try {
      event = stripeClient.webhooks.constructEvent(req.body, signature, stripeWebhookSecret);
    } catch (error) {
      console.error('[Stripe] Webhook signature verification failed', error);
      return res.status(400).send(`Webhook Error: ${error.message}`);
    }

    try {
      await handleStripeWebhookEvent(event);
      return res.status(200).json({ received: true });
    } catch (error) {
      console.error('[Stripe] Failed processing webhook event', error);
      return res.status(500).json({ error: 'Webhook handler error' });
    }
  });
} else {
  app.post('/stripe/webhook', (req, res) => {
    res.status(501).json({ error: 'Stripe webhook not configured' });
  });
}

const { handleAssn2: handleAppStoreAssn2, handleClientVerify: handleAppStoreVerify } = require('./telephony/webhooks/appstoreWebhook');
app.post('/webhooks/appstore', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    req.body = JSON.parse(req.body.toString('utf8'));
  } catch (err) {
    return res.status(400).json({ error: 'invalid_json' });
  }
  return handleAppStoreAssn2(req, res);
});

// Supabase Auth "Send SMS" hook → sends OTP via Twilio.
// Standard Webhooks signature format: header `webhook-signature` = "v1,<base64sig>",
// signed payload = `${webhook-id}.${webhook-timestamp}.${rawBody}`,
// HMAC key = base64-decode of secret stripped of "v1,whsec_" prefix.
app.post('/api/auth/send-sms-hook', express.raw({ type: 'application/json' }), async (req, res) => {
  const secret = process.env.SUPABASE_AUTH_SMS_HOOK_SECRET;
  if (!secret) return res.status(500).json({ error: 'hook_not_configured' });

  const id = req.headers['webhook-id'];
  const timestamp = req.headers['webhook-timestamp'];
  const sigHeader = req.headers['webhook-signature'];
  if (!id || !timestamp || !sigHeader) return res.status(401).json({ error: 'missing_headers' });

  const rawSecret = secret.replace(/^v1,whsec_/, '').replace(/^whsec_/, '');
  const signedPayload = `${id}.${timestamp}.${req.body.toString('utf8')}`;
  const expected = crypto.createHmac('sha256', Buffer.from(rawSecret, 'base64'))
    .update(signedPayload).digest('base64');
  const sigs = String(sigHeader).split(' ').map(s => s.replace(/^v1,/, ''));
  const valid = sigs.some(s => s.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
  if (!valid) return res.status(401).json({ error: 'invalid_signature' });

  let payload;
  try { payload = JSON.parse(req.body.toString('utf8')); }
  catch { return res.status(400).json({ error: 'invalid_json' }); }

  const phone = payload?.user?.phone;
  const otp = payload?.sms?.otp;
  if (!phone || !otp) return res.status(400).json({ error: 'missing_phone_or_otp' });

  // OTP is sent via Twilio (Flynn's sole SMS provider).
  if (!twilioMessagingClient || !process.env.TWILIO_FROM_NUMBER) {
    console.error('[Supabase send-sms] Twilio not configured');
    return res.status(500).json({ error: 'sms_provider_not_configured' });
  }
  try {
    await twilioMessagingClient.messages.create({
      to: phone.startsWith('+') ? phone : `+${phone}`,
      from: process.env.TWILIO_FROM_NUMBER,
      body: `Your Flynn verification code is ${otp}. It expires in 10 minutes.`,
    });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[Supabase send-sms] Twilio send failed:', err?.message || err);
    return res.status(500).json({ error: 'sms_send_failed' });
  }
});

app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: '15mb' }));

app.post('/webhooks/appstore/verify', authenticateJwt, handleAppStoreVerify);

const { handleClientVerify: handlePlayVerify, handleRtdn: handlePlayRtdn } = require('./telephony/webhooks/playbillingWebhook');
app.post('/webhooks/playbilling/verify', authenticateJwt, handlePlayVerify);
app.post('/webhooks/playbilling/rtdn', handlePlayRtdn);

// ========================================
// Web Sign-up (phone number → welcome SMS + vCard MMS, no OTP)
// ========================================
const webSignupRoutes = require('./routes/webSignup');
app.use('/api/signup', webSignupRoutes);

// ========================================
// Inbound SMS from Flynn number (+61480891471)
// ========================================
const smsInboundRoutes = require('./routes/smsInbound');
app.use('/webhooks/sms', smsInboundRoutes);

const iMessageInboundRoutes = require('./routes/iMessageInbound');
app.use('/webhooks/imessage', iMessageInboundRoutes);

// ========================================
// Integrations via Nango Cloud (OAuth backbone for the iMessage agent).
// Env-flagged: without NANGO_SECRET_KEY these routes don't exist.
// Registers /connect/:provider (textable connect links) and /webhooks/nango.
// ========================================
if ((process.env.NANGO_SECRET_KEY || '').trim()) {
  const integrationsNangoRoutes = require('./routes/integrationsNango');
  app.use('/', integrationsNangoRoutes);
  // Unified secure "connect your tools" page (/setup) — OAuth buttons +
  // encrypted credential forms, so logins are never entered over text.
  const connectPageRoutes = require('./routes/connectPage');
  app.use('/', connectPageRoutes);
}

// ========================================
// Frictionless app sign-in (no OTP) — text the user a single-use magic deep link
// that opens the app already signed in. See services/authLink.js.
// ========================================
const { generateAppLink: mintAppLink } = require('./services/authLink');

// POST /api/auth/app-link  { phone }
// Mints + texts a sign-in link to the given number. Like an OTP request, the only
// way to use the link is to receive it on that phone, so this is intentionally open.
app.post('/api/auth/app-link', async (req, res) => {
  const rawPhone = (req.body?.phone || '').trim();
  if (!rawPhone) return res.status(400).json({ error: 'Phone number required' });

  try {
    const link = await mintAppLink(rawPhone);
    if (link?.error || !link?.url) {
      return res.status(400).json({ error: link?.error || 'Could not create sign-in link' });
    }

    const body = `tap to open Flynn, you're already signed in: ${link.url}`;
    let delivered = false;

    // Prefer iMessage (Flynn's home turf); fall back to SMS.
    try {
      const bb = require('./services/blueBubbles');
      await bb.sendMessage(link.phone, body);
      delivered = true;
    } catch (bbErr) {
      console.warn('[AppLink] BlueBubbles send failed, trying SMS:', bbErr?.message);
    }

    if (!delivered && twilioMessagingClient) {
      const fromNumber = process.env.TWILIO_FLYNN_NUMBER || twilioSmsFromNumber || '+61480891471';
      await twilioMessagingClient.messages.create({ to: link.phone, from: fromNumber, body });
      delivered = true;
    }

    if (!delivered) return res.status(500).json({ error: 'No messaging channel configured' });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[AppLink] Error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to send sign-in link' });
  }
});

// GET /app/open?token_hash=...&type=magiclink
// HTTPS bounce for cold links (texted before the app is installed): opens the
// custom scheme and falls back to the App Store.
app.get('/app/open', (req, res) => {
  const tokenHash = (req.query.token_hash || '').toString();
  const type = (req.query.type || 'magiclink').toString();
  const scheme = `flynnai://auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(type)}`;
  const appStore = process.env.FLYNN_APP_STORE_URL || 'https://apps.apple.com/app/flynn';
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Opening Flynn…</title>
<script>
  window.location.replace(${JSON.stringify(scheme)});
  setTimeout(function(){ window.location.href = ${JSON.stringify(appStore)}; }, 1500);
</script></head>
<body style="font-family:-apple-system,system-ui,sans-serif;text-align:center;padding:48px;color:#1A1A1A;background:#F4E6CE">
  <p>Opening Flynn…</p>
  <p><a href="${scheme}">Tap here if it doesn't open automatically</a></p>
</body></html>`);
});

// Serve public/ directory (contact card, etc.)
app.use('/public', express.static(path.join(__dirname, 'public')));

// ========================================
// Booking Page Routes (Public API)
// ========================================
const bookingRoutes = require('./routes/bookingRoutes');
app.use('/api/booking', bookingRoutes);

const appleSearchAdsAttributionRoutes = require('./routes/appleSearchAdsAttributionRoutes');
app.use('/api/attribution', appleSearchAdsAttributionRoutes);

// Customer-facing dashboard API + /d/<code> web login bounce. Routes declare
// their own full paths (/api/dashboard/* and /d/:code), so mount at root.
const dashboardRoutes = require('./routes/dashboard');
app.use('/', dashboardRoutes);

// ========================================
// Payments Summary CSV (Mates Rates compatibility)
// ========================================
app.post('/downloadPaymentSummary', async (req, res) => {
  try {
    const {
      type,
      period,
      customStartDate,
      customEndDate,
    } = req.body || {};

    if (!allowedSummaryTypes.has(type)) {
      return res.status(400).json({ err: 'Invalid type. Use "Payments" or "Earnings".' });
    }

    if (!allowedSummaryPeriods.has(period)) {
      return res.status(400).json({ err: 'Invalid period selection.' });
    }

    const range = computeReportPeriod(period, customStartDate, customEndDate);
    if (!range) {
      return res.status(400).json({ err: 'Invalid or missing dates for custom period.' });
    }

    // TODO: Replace placeholder data with real transaction records when the data source is available.
    const rows = [
      ['Date', 'Type', 'Title', 'Client', 'Worker', 'Amount', 'Commission', 'Status', 'JobId'],
    ];

    // Example placeholder row for easier manual verification
    rows.push([
      range.start.toISOString().slice(0, 10),
      type,
      'Example job',
      'N/A',
      'N/A',
      '0.00',
      '0.00',
      'N/A',
      'sample-id',
    ]);

    const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="payment_summary.csv"');
    return res.status(200).send(csv);
  } catch (error) {
    console.error('[PaymentsSummary] Failed to generate summary', error);
    return res.status(500).json({ err: 'Failed to generate payment summary.' });
  }
});

// ========================================
// Jobber Integration OAuth Endpoints
// ========================================

const JOBBER_CLIENT_ID = process.env.EXPO_PUBLIC_JOBBER_CLIENT_ID;
const JOBBER_CLIENT_SECRET = process.env.JOBBER_CLIENT_SECRET;
const JOBBER_REDIRECT_URI = process.env.EXPO_PUBLIC_JOBBER_REDIRECT_URI || 'https://flynnai-telephony.fly.dev/integrations/jobber/callback';
const JOBBER_TOKEN_URL = 'https://api.getjobber.com/api/oauth/token';
const JOBBER_API_BASE = 'https://api.getjobber.com/api/graphql';

/**
 * Jobber OAuth Callback
 * Handles the redirect from Jobber after user authorizes the app
 */
app.get('/integrations/jobber/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  console.log('[Jobber OAuth] Callback received:', {
    hasCode: !!code,
    state,
    error,
    error_description
  });

  // Handle authorization errors
  if (error) {
    console.error('[Jobber OAuth] Authorization error:', error, error_description);
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Jobber Connection Failed</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                   padding: 40px; text-align: center; background: #f5f5f5; }
            .container { max-width: 500px; margin: 0 auto; background: white;
                        padding: 40px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            h1 { color: #ef4444; font-size: 24px; margin-bottom: 16px; }
            p { color: #64748b; line-height: 1.6; }
            .error { background: #fee2e2; padding: 16px; border-radius: 8px; margin: 20px 0; }
            .error-code { font-family: monospace; color: #991b1b; }
            a { color: #2563eb; text-decoration: none; font-weight: 500; }
            a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>❌ Connection Failed</h1>
            <p>Failed to connect your Jobber account.</p>
            <div class="error">
              <strong>Error:</strong> <span class="error-code">${error}</span><br>
              ${error_description ? `<strong>Details:</strong> ${error_description}` : ''}
            </div>
            <p>Please try again or contact support if the issue persists.</p>
            <p><a href="javascript:window.close()">Close this window</a></p>
          </div>
        </body>
      </html>
    `);
  }

  if (!code) {
    console.error('[Jobber OAuth] No authorization code received');
    return res.status(400).send('Missing authorization code');
  }

  if (!JOBBER_CLIENT_ID || !JOBBER_CLIENT_SECRET) {
    console.error('[Jobber OAuth] Jobber credentials not configured');
    return res.status(500).send('Jobber integration not configured on server');
  }

  try {
    // Exchange authorization code for access token
    console.log('[Jobber OAuth] Exchanging code for token...');
    const tokenResponse = await fetch(JOBBER_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: JOBBER_CLIENT_ID,
        client_secret: JOBBER_CLIENT_SECRET,
        redirect_uri: JOBBER_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error('[Jobber OAuth] Token exchange failed:', errorData);
      throw new Error(`Token exchange failed: ${errorData.error_description || errorData.error || tokenResponse.statusText}`);
    }

    const tokenData = await tokenResponse.json();
    console.log('[Jobber OAuth] Token received successfully');

    const { access_token, refresh_token, expires_in } = tokenData;
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Get account info from Jobber
    console.log('[Jobber OAuth] Fetching account info...');
    const accountQuery = `
      query {
        account {
          id
          name
        }
      }
    `;

    const accountResponse = await fetch(JOBBER_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`,
        'X-JOBBER-GRAPHQL-VERSION': '2024-09-10',
      },
      body: JSON.stringify({ query: accountQuery }),
    });

    if (!accountResponse.ok) {
      throw new Error(`Failed to fetch account info: ${accountResponse.statusText}`);
    }

    const accountData = await accountResponse.json();
    if (accountData.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(accountData.errors)}`);
    }

    const accountInfo = accountData.data.account;
    console.log('[Jobber OAuth] Account info retrieved:', accountInfo);

    // Extract org_id from state parameter (should be passed from frontend)
    // For now, we'll need to handle this based on session or require org_id in state
    const orgId = state; // Assuming state contains org_id

    if (!orgId) {
      console.error('[Jobber OAuth] No org_id in state parameter');
      return res.status(400).send('Missing organization identifier');
    }

    // Save connection to database
    console.log('[Jobber OAuth] Saving connection to database...');
    const { data: connection, error: dbError } = await supabaseAdmin
      .from('integration_connections')
      .upsert({
        org_id: orgId,
        provider: 'jobber',
        type: 'field_service',
        status: 'connected',
        access_token,
        refresh_token,
        token_expires_at: expiresAt,
        account_id: accountInfo.id,
        account_name: accountInfo.name,
        metadata: accountInfo,
        last_sync_at: null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'org_id,provider',
      })
      .select()
      .single();

    if (dbError) {
      console.error('[Jobber OAuth] Database error:', dbError);
      throw new Error(`Failed to save connection: ${dbError.message}`);
    }

    console.log('[Jobber OAuth] Connection saved successfully:', connection.id);

    // Return success page
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Jobber Connected Successfully</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                   padding: 40px; text-align: center; background: #f5f5f5; }
            .container { max-width: 500px; margin: 0 auto; background: white;
                        padding: 40px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            h1 { color: #10b981; font-size: 24px; margin-bottom: 16px; }
            p { color: #64748b; line-height: 1.6; }
            .success { background: #d1fae5; padding: 16px; border-radius: 8px; margin: 20px 0; color: #065f46; }
            .account { font-weight: 600; color: #1e293b; }
            .cta { display: inline-block; margin-top: 24px; padding: 12px 24px;
                   background: #2563eb; color: white; border-radius: 8px;
                   text-decoration: none; font-weight: 500; }
            .cta:hover { background: #1e40af; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✅ Jobber Connected!</h1>
            <p>Your Jobber account has been successfully connected to Flynn AI.</p>
            <div class="success">
              <strong>Account:</strong> <span class="account">${accountInfo.name}</span>
            </div>
            <p>Jobs created from missed calls will now automatically sync to your Jobber account.</p>
            <a href="javascript:window.close()" class="cta">Close & Return to Flynn AI</a>
          </div>
        </body>
      </html>
    `);

  } catch (error) {
    console.error('[Jobber OAuth] Error during callback processing:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Connection Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                   padding: 40px; text-align: center; background: #f5f5f5; }
            .container { max-width: 500px; margin: 0 auto; background: white;
                        padding: 40px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            h1 { color: #ef4444; font-size: 24px; margin-bottom: 16px; }
            p { color: #64748b; line-height: 1.6; }
            .error { background: #fee2e2; padding: 16px; border-radius: 8px; margin: 20px 0; }
            .error-msg { font-family: monospace; color: #991b1b; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>❌ Connection Error</h1>
            <p>An error occurred while connecting your Jobber account.</p>
            <div class="error">
              <div class="error-msg">${error.message}</div>
            </div>
            <p>Please try again or contact support@flynnai.com if the issue persists.</p>
            <p><a href="javascript:window.close()">Close this window</a></p>
          </div>
        </body>
      </html>
    `);
  }
});

/**
 * Jobber Webhook Endpoints
 * Handle real-time updates from Jobber (jobs created/updated, clients created/updated)
 */
app.post('/webhooks/jobber/job-created', async (req, res) => {
  console.log('[Jobber Webhook] Job created:', req.body);
  // TODO: Implement job created webhook handler
  res.status(200).json({ received: true });
});

app.post('/webhooks/jobber/job-updated', async (req, res) => {
  console.log('[Jobber Webhook] Job updated:', req.body);
  // TODO: Implement job updated webhook handler
  res.status(200).json({ received: true });
});

app.post('/webhooks/jobber/client-created', async (req, res) => {
  console.log('[Jobber Webhook] Client created:', req.body);
  // TODO: Implement client created webhook handler
  res.status(200).json({ received: true });
});

app.post('/webhooks/jobber/client-updated', async (req, res) => {
  console.log('[Jobber Webhook] Client updated:', req.body);
  // TODO: Implement client updated webhook handler
  res.status(200).json({ received: true });
});

// ========================================
// AI Testing API (for in-app receptionist testing)
// ========================================

// Transcribe audio using Whisper
app.post('/ai/transcribe', authenticateJwt, async (req, res) => {
  const multer = require('multer');
  const upload = multer({ storage: multer.memoryStorage() });

  upload.single('file')(req, res, async (err) => {
    if (err) {
      console.error('[AI/Transcribe] Upload error:', err);
      return res.status(400).json({ error: 'Failed to upload audio file' });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No audio file provided' });
      }

      const llmClient = getLLMClient();
      const fileBuffer = req.file.buffer;

      // Convert buffer to File object for OpenAI
      const audioFile = await toFile(fileBuffer, 'audio.m4a', { type: 'audio/m4a' });

      const transcription = await llmClient.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
      });

      res.status(200).json({
        text: transcription.text || '',
      });
    } catch (error) {
      console.error('[AI/Transcribe] Error:', error);
      res.status(500).json({
        error: 'Failed to transcribe audio',
        details: error.message,
      });
    }
  });
});

// Generate AI chat response
app.post('/ai/chat', authenticateJwt, async (req, res) => {
  try {
    const { messages, model = 'gpt-4o-mini', temperature = 0.7, max_tokens = 150 } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const llmClient = getLLMClient();

    const response = await llmClient.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens,
    });

    res.status(200).json(response);
  } catch (error) {
    console.error('[AI/Chat] Error:', error);
    res.status(500).json({
      error: 'Failed to generate AI response',
      details: error.message,
    });
  }
});

// Extract job details from conversation
app.post('/ai/extract-job', authenticateJwt, async (req, res) => {
  try {
    const { transcript } = req.body;

    if (!transcript) {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    const llmClient = getLLMClient();

    const extractionPrompt = `Extract job booking details from this conversation transcript. Return ONLY valid JSON with these fields:
{
  "clientName": string or null,
  "clientPhone": string or null,
  "clientEmail": string or null,
  "serviceType": string or null,
  "scheduledDate": string (YYYY-MM-DD) or null,
  "scheduledTime": string (HH:MM) or null,
  "location": string or null,
  "notes": string or null,
  "urgency": "low" | "medium" | "high" | null,
  "confidence": number (0-1)
}

Transcript:
${transcript}`;

    const response = await llmClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that extracts structured job data from conversation transcripts. Always respond with valid JSON.' },
        { role: 'user', content: extractionPrompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const extracted = JSON.parse(response.choices[0].message.content || '{}');

    res.status(200).json({
      job: extracted,
    });
  } catch (error) {
    console.error('[AI/ExtractJob] Error:', error);
    res.status(500).json({
      error: 'Failed to extract job details',
      details: error.message,
    });
  }
});

// Deepgram TTS (for test modal)
app.post('/ai/deepgram-tts', authenticateJwt, async (req, res) => {
  try {
    const { text, voice = 'aura-2-theia-en' } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Map flynn voice IDs to Deepgram Aura voices (Australian accents)
    const deepgramVoiceMap = {
      flynn_warm: 'aura-2-theia-en',      // Australian female - warm, friendly
      flynn_expert: 'aura-2-arcas-en',    // Australian male - professional, firm
      flynn_hype: 'aura-2-asteria-en',    // Australian female - energetic, upbeat
    };

    // Resolve voice: use mapping if flynn_* ID provided, otherwise use direct voice name
    const resolvedVoice = deepgramVoiceMap[voice] || voice;

    const { createClient } = require('@deepgram/sdk');
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

    const response = await deepgram.speak.request(
      { text },
      {
        model: resolvedVoice,
        encoding: 'linear16',
        sample_rate: 24000,
      }
    );

    const stream = await response.getStream();
    const audioBuffer = await getAudioBuffer(stream);
    const base64Audio = audioBuffer.toString('base64');
    const audioUrl = `data:audio/wav;base64,${base64Audio}`;

    res.json({ audioUrl });
  } catch (error) {
    console.error('[AI/DeepgramTTS] Error:', error);
    res.status(500).json({
      error: 'Failed to generate speech',
      details: error.message,
    });
  }
});

// Helper function to convert stream to buffer
async function getAudioBuffer(stream) {
  const reader = stream.getReader();
  const chunks = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  return Buffer.concat(chunks);
}

// ========================================
// Website Scraping & Business Profile API
// ========================================

// FlynnAI Sites: Instagram -> Gemini -> site spec
app.post('/api/sites/generate', authenticateJwt, async (req, res) => {
  const { handle, imageLimit = 12 } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!handle) {
    return res.status(400).json({ error: 'Instagram handle is required' });
  }

  const normalizedHandle = String(handle).replace(/^@/, '').trim();

  try {
    const result = await generateSiteFromInstagram({
      handle: normalizedHandle,
      imageLimit: Math.min(Math.max(Number.parseInt(imageLimit, 10) || 12, 1), 25),
    });

    res.status(200).json({
      success: true,
      handle: normalizedHandle,
      ...result,
    });
  } catch (error) {
    console.error('[Sites] Failed to generate site from Instagram', { error });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate site',
    });
  }
});

/**
 * Scrape a business website and extract relevant information
 * Uses OpenAI to intelligently parse website content
 */
/**
 * Scrape website and generate AI receptionist configuration
 * POST /api/scrape-website
 * Body: { url: string, applyConfig?: boolean }
 */
app.post('/api/scrape-website', authenticateJwt, async (req, res) => {
  const { url, applyConfig = false } = req.body;
  const userId = req.user?.id;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  console.log('[API] Scraping website and generating config:', { url, userId, applyConfig });

  try {
    // Check 24-hour scrape cache in business_profiles
    if (supabaseStorageClient) {
      const { data: cached } = await supabaseStorageClient
        .from('business_profiles')
        .select('scraped_context, updated_at')
        .eq('user_id', userId)
        .maybeSingle();
      if (cached?.scraped_context && cached?.updated_at) {
        const ageMs = Date.now() - new Date(cached.updated_at).getTime();
        if (ageMs < 86400000) {
          console.log('[API] Returning cached scrape for user:', userId);
          const sc = cached.scraped_context;
          return res.status(200).json({
            success: true,
            url,
            scraped_at: cached.updated_at,
            cached: true,
            config: {
              businessProfile: sc.businessProfile || {},
              greetingScript: sc.greetingScript || '',
              intakeQuestions: sc.intakeQuestions || [],
            },
            scrapedData: sc.rawScrape || {},
          });
        }
      }
    }

    // Step 1: Scrape the website using Gemini URL Context
    const scrapedData = await scrapeWebsiteWithGemini(url);

    // Step 2: Generate receptionist configuration
    const config = await generateReceptionistConfig(scrapedData);

    // Step 3: Optionally apply config to user's settings
    if (applyConfig) {
      if (!supabaseStorageClient) {
        throw new Error('Supabase client not configured');
      }

      // Write to users table (legacy receptionist fields)
      const { error: usersError } = await supabaseStorageClient
        .from('users')
        .update({
          receptionist_greeting: config.greetingScript,
          receptionist_questions: config.intakeQuestions,
          receptionist_business_profile: config.businessProfile,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (usersError) {
        console.error('[API] Failed to apply config to users:', usersError);
        throw new Error('Failed to apply configuration to user settings');
      }

      // Write to business_profiles — this is what the voice agent reads
      const parsedServices = (scrapedData.services || []).map((name) =>
        typeof name === 'string' ? { name, description: '', price_range: '' } : name
      );
      const inferredIndustry = inferBusinessType(scrapedData);
      const businessName =
        config.businessProfile?.public_name ||
        scrapedData.metadata?.siteName ||
        scrapedData.metadata?.title ||
        null;
      const aiInstructions = buildAiInstructions(config.businessProfile);

      // Build a default IVR (Mode A — SMS Link follow-up) script from the
      // scraped greeting. This is the default mode for new users; without a
      // script the inbound webhook falls back to a generic greeting.
      const ivrScript =
        `${config.greetingScript || `G'day, you've reached ${businessName || 'us'}.`} ` +
        `For a booking link, press 1. For a quote, press 2. Or leave a voicemail.`;

      const { error: bpError } = await supabaseStorageClient
        .from('business_profiles')
        .upsert(
          {
            user_id: userId,
            business_name: businessName,
            business_type: inferredIndustry,
            website_url: url,
            services: parsedServices,
            pricing_notes: config.businessProfile?.pricing_summary || null,
            ai_instructions: aiInstructions,
            ai_greeting_text: config.greetingScript,
            ai_followup_questions: config.intakeQuestions,
            ivr_custom_script: ivrScript,
            website_scrape_data: {
              rawScrape: scrapedData,
              businessProfile: config.businessProfile,
              greetingScript: config.greetingScript,
              intakeQuestions: config.intakeQuestions,
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

      if (bpError) {
        console.warn('[API] Failed to write to business_profiles (non-fatal):', bpError.message);
      } else {
        console.log('[API] Successfully wrote business profile for voice agent:', userId);
      }
    }

    res.status(200).json({
      success: true,
      url,
      scraped_at: scrapedData.scrapedAt,
      cached: false,
      config: {
        businessProfile: config.businessProfile,
        greetingScript: config.greetingScript,
        intakeQuestions: config.intakeQuestions,
      },
      scrapedData,
      applied: applyConfig,
    });
  } catch (error) {
    console.error('[API] Error scraping website:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to scrape website and generate configuration',
    });
  }
});

/** Map scraped service keywords to a business industry slug */
function inferBusinessType(scrapedData) {
  const text = [
    scrapedData.content || '',
    (scrapedData.services || []).join(' '),
    scrapedData.metadata?.title || '',
  ].join(' ').toLowerCase();

  if (/plumb|drain|pipe|hot water|leak/.test(text)) return 'plumbing';
  if (/electr|wiring|solar|switchboard/.test(text)) return 'electrical';
  if (/build|construct|renovt|reno |extension|carpent/.test(text)) return 'building';
  if (/air con|hvac|refriger|cool|heat pump/.test(text)) return 'hvac';
  if (/paint|coating/.test(text)) return 'painting';
  if (/landscap|garden|lawn|tree/.test(text)) return 'landscaping';
  if (/clean|janitorial/.test(text)) return 'cleaning';
  if (/hair|beauty|salon|nails|lash|brow/.test(text)) return 'beauty';
  return 'service_business';
}

/** Format brand_voice + value_propositions into AI instruction prose */
function buildAiInstructions(businessProfile) {
  if (!businessProfile) return null;
  const parts = [];
  if (businessProfile.brand_voice?.tone) {
    parts.push(`Tone: ${businessProfile.brand_voice.tone}.`);
  }
  if (businessProfile.brand_voice?.personality) {
    parts.push(`Personality: ${businessProfile.brand_voice.personality}.`);
  }
  if (Array.isArray(businessProfile.value_propositions) && businessProfile.value_propositions.length) {
    parts.push(`Key selling points: ${businessProfile.value_propositions.join(', ')}.`);
  }
  return parts.length ? parts.join(' ') : null;
}

/**
 * Start a demo voice session — returns WS URL for the in-app live voice demo.
 * POST /api/demo/start-voice-session
 */
app.post('/api/demo/start-voice-session', authenticateJwt, (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  // Prefer PUBLIC_BASE_URL when set (tunnel/prod); fall back to the incoming
  // request's own host so the Simulator doesn't get handed a localhost URL
  // that can't be reached from inside the simulated device network.
  const configured = process.env.PUBLIC_BASE_URL || process.env.SERVER_PUBLIC_URL;
  const baseUrl = configured || `${req.protocol}://${req.get('host')}`;
  const wsUrl = baseUrl.replace(/^http/, 'ws') + '/realtime/native-test';

  console.log('[DemoVoice] start-voice-session', { userId, wsUrl, configured: Boolean(configured) });

  res.json({
    userId,
    wsUrl,
    greeting: req.body?.greeting || null,
    mode: req.body?.mode || 'ai_only',
  });
});

/**
 * Update business profile completion fields (hours, services, call-out fee etc.)
 * PATCH /api/business-profile
 */
app.patch('/api/business-profile', authenticateJwt, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!supabaseStorageClient) return res.status(500).json({ error: 'Database not configured' });

  const allowed = ['business_name', 'business_type', 'services', 'hours_json', 'service_areas',
    'faqs', 'pricing_notes', 'ai_instructions', 'ai_greeting_text', 'ivr_custom_script',
    'website_url'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  // Back-compat: older clients send `industry`; the real column is `business_type`.
  if (req.body.industry !== undefined && updates.business_type === undefined) {
    updates.business_type = req.body.industry;
  }
  updates.updated_at = new Date().toISOString();

  const { error } = await supabaseStorageClient
    .from('business_profiles')
    .upsert({ user_id: userId, ...updates }, { onConflict: 'user_id' });

  if (error) {
    console.error('[API] Failed to update business profile:', error);
    return res.status(500).json({ error: 'Failed to update business profile' });
  }

  res.json({ success: true });
});

/**
 * Apply generated receptionist configuration to user settings
 * POST /api/receptionist/apply-config
 * Body: { greetingScript: string, intakeQuestions: string[], businessProfile: object }
 */
app.post('/api/receptionist/apply-config', authenticateJwt, async (req, res) => {
  const { greetingScript, intakeQuestions, businessProfile } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!greetingScript && !intakeQuestions && !businessProfile) {
    return res.status(400).json({ error: 'At least one configuration field is required' });
  }

  console.log('[API] Applying receptionist config:', { userId, hasGreeting: !!greetingScript, questionsCount: intakeQuestions?.length || 0 });

  try {
    if (!supabaseStorageClient) {
      throw new Error('Supabase client not configured');
    }

    const updates = {
      updated_at: new Date().toISOString(),
    };

    if (greetingScript) {
      updates.receptionist_greeting = greetingScript;
    }

    if (intakeQuestions && Array.isArray(intakeQuestions)) {
      updates.receptionist_questions = intakeQuestions;
    }

    if (businessProfile) {
      updates.receptionist_business_profile = businessProfile;
    }

    const { error } = await supabaseStorageClient
      .from('users')
      .update(updates)
      .eq('id', userId);

    if (error) {
      console.error('[API] Failed to apply config:', error);
      throw new Error('Failed to apply configuration');
    }

    console.log('[API] Successfully applied receptionist config');

    res.status(200).json({
      success: true,
      applied: Object.keys(updates).filter(k => k !== 'updated_at'),
    });
  } catch (error) {
    console.error('[API] Error applying config:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to apply configuration',
    });
  }
});

/**
 * Get business profile for organization (called by AI during calls)
 */
app.get('/api/business-profile/:orgId', async (req, res) => {
  const { orgId } = req.params;

  if (!orgId) {
    return res.status(400).json({ error: 'Organization ID required' });
  }

  try {
    console.log('[Business Profile] Fetching profile for org:', orgId);

    // Use the Supabase function to get business context
    const { data, error } = await supabaseAdmin.rpc('get_business_context_for_org', {
      p_org_id: orgId,
    });

    if (error) {
      console.error('[Business Profile] Database error:', error);
      throw new Error(error.message);
    }

    if (!data) {
      return res.status(404).json({ error: 'Business profile not found' });
    }

    res.status(200).json(data);
  } catch (error) {
    console.error('[Business Profile] Error:', error);
    res.status(500).json({ error: 'Failed to get business profile' });
  }
});

// ========================================
// Keyboard Co-pilot Endpoints (text-reply drafting)
// ========================================

const KEYBOARD_TOKEN_TTL_DAYS = parseIntegerEnv(process.env.KEYBOARD_TOKEN_TTL_DAYS, 60);
const MAX_DRAFT_MESSAGES = 20;
const MAX_ACCEPTED_TONE_SAMPLES = 8;
const FREE_DRAFTS_PER_DAY = parseIntegerEnv(process.env.FREE_DRAFTS_PER_DAY, 10);

/**
 * Is the user on an active/trialing subscription (Pro = unlimited drafts)?
 * Resolves via their org's subscription_status. Fails open to false (free tier).
 */
async function isUserEntitled(userId) {
  try {
    if (!supabaseStorageClient) return false;
    const { data: userRow } = await supabaseStorageClient
      .from('users')
      .select('default_org_id')
      .eq('id', userId)
      .maybeSingle();
    const orgId = userRow?.default_org_id;
    if (!orgId) return false;
    const { data: org } = await supabaseStorageClient
      .from('organizations')
      .select('subscription_status')
      .eq('id', orgId)
      .maybeSingle();
    return ['active', 'trialing'].includes(org?.subscription_status);
  } catch (error) {
    console.warn('[Keyboard] entitlement check failed (treating as free):', error?.message);
    return false;
  }
}

/** Today's draft count for a user (free-tier accounting). */
async function draftsUsedToday(userId) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabaseStorageClient
      .from('draft_usage')
      .select('count')
      .eq('user_id', userId)
      .eq('usage_date', today)
      .maybeSingle();
    return data?.count ?? 0;
  } catch (_) {
    return 0;
  }
}

/**
 * Best-effort: compute genuinely-open Google Calendar slots for a user, to feed
 * into draft generation or return to the app. Returns [] (never throws) if the
 * user has no Google connection or anything fails — Apple-only users propose
 * from business hours on-device instead.
 */
const DEFAULT_BUSINESS_HOURS = {
  monday:    { open: '8:00am', close: '6:00pm' },
  tuesday:   { open: '8:00am', close: '6:00pm' },
  wednesday: { open: '8:00am', close: '6:00pm' },
  thursday:  { open: '8:00am', close: '6:00pm' },
  friday:    { open: '8:00am', close: '6:00pm' },
  saturday:  { closed: true },
  sunday:    { closed: true },
};

async function computeGoogleSlots(userId, businessHours, { days = 7, durationMins = 60, maxSlots = 5 } = {}) {
  try {
    if (!supabaseStorageClient) return { slots: [], busy: [], timeZone: 'Australia/Sydney', connected: false };
    const { connection } = await googleCalendar.getConnectionForUser(supabaseStorageClient, userId);
    if (!connection) return { slots: [], busy: [], timeZone: 'Australia/Sydney', connected: false };

    const timeZone = connection?.metadata?.timeZone || 'Australia/Sydney';
    const accessToken = await googleCalendar.ensureFreshAccessToken(supabaseStorageClient, connection);
    const now = new Date();
    const timeMax = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const busy = await googleCalendar.queryFreeBusy(accessToken, {
      timeMin: now.toISOString(),
      timeMax: timeMax.toISOString(),
      calendarId: connection.account_id || 'primary',
    });
    const effectiveHours = (businessHours && Object.keys(businessHours).length > 0) ? businessHours : DEFAULT_BUSINESS_HOURS;
    const slots = findOpenSlots({
      businessHours: effectiveHours,
      busy,
      timeZone,
      durationMins,
      from: now,
      days,
      maxSlots,
    });
    // Return `busy` too so callers can check a specific customer-proposed time
    // without a second free/busy round-trip.
    return { slots, busy, timeZone, connected: true, calendarId: connection.account_id || 'primary' };
  } catch (error) {
    console.warn('[Keyboard] computeGoogleSlots failed (non-fatal):', error?.status || '', error?.message);
    return { slots: [], busy: [], timeZone: 'Australia/Sydney', connected: false };
  }
}

/**
 * If the customer named a concrete time, check it against the user's real
 * calendar and return a directive for the drafting model: confirm it when free,
 * or counter-offer the nearest open slot when it's booked / out of hours.
 * Returns '' when there's no Google connection, no parseable time, or on any
 * failure — drafting then falls back to the generic "confirm a named time" rule.
 */
// Returns { note, proposed, status }. `note` is the CALENDAR CHECK line for the
// draft prompt; `proposed`/`status` are surfaced so the caller can offer a
// one-tap calendar booking when (and only when) the named time is genuinely free.
function buildAvailabilityNote({ latestMessage, businessHours, busy, timeZone, connected }) {
  const empty = { note: '', proposed: null, status: null };
  if (!latestMessage) return empty;
  const now = new Date();
  const proposed = parseProposedTime(latestMessage, { now, timeZone });
  if (!proposed) return empty;

  // No Google connected → we can't check free/busy, but we still parsed a concrete
  // time. Surface it as 'unknown' so an Apple-only user can still book it (the
  // endpoint only offers it when the model also signals a firm agreement).
  if (!connected) return { note: '', proposed, status: 'unknown' };

  const effectiveHours = (businessHours && Object.keys(businessHours).length > 0) ? businessHours : DEFAULT_BUSINESS_HOURS;
  const status = checkProposedTime({
    start: proposed.start,
    end: proposed.end,
    businessHours: effectiveHours,
    busy: busy || [],
    timeZone,
  });

  if (status === 'free') {
    return {
      note: `CALENDAR CHECK: the customer is asking about ${proposed.label}. That time is genuinely free in the owner's calendar — confirm it as booked in.`,
      proposed,
      status,
    };
  }

  const alt = findNearestOpenSlot({
    desired: proposed.start,
    businessHours: effectiveHours,
    busy: busy || [],
    timeZone,
    from: now,
  });
  const reason = status === 'closed' ? "that's outside the owner's working hours" : "the owner is already booked then";
  const note = alt
    ? `CALENDAR CHECK: the customer is asking about ${proposed.label}, but ${reason}. Do NOT accept that time. Apologise briefly and offer ${alt.label} instead.`
    : `CALENDAR CHECK: the customer is asking about ${proposed.label}, but ${reason}. Do NOT accept that time. Apologise briefly and offer to find another time.`;
  return { note, proposed, status };
}

/**
 * Dashboard activity feed for the iOS Home tab.
 *
 * iMessage-side data (sms_messages, pending_actions) is keyed by user_phone while
 * the app authenticates by auth.uid(). We resolve req.user.id -> users.phone here
 * with the service-role client so the app never has to reconcile the two keyings.
 * GET /api/dashboard/activity
 */
app.get('/api/dashboard/activity', authenticateJwt, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!supabaseStorageClient) return res.status(500).json({ error: 'Database not configured' });

  try {
    const { data: userRow } = await supabaseStorageClient
      .from('users')
      .select('phone')
      .eq('id', userId)
      .maybeSingle();

    const phone = userRow?.phone;
    if (!phone) {
      return res.json({ recentReplies: [], awaitingConfirmation: [] });
    }

    const [repliesRes, pendingRes] = await Promise.all([
      supabaseStorageClient
        .from('sms_messages')
        .select('body, channel, created_at')
        .eq('user_phone', phone)
        .eq('direction', 'out')
        .order('created_at', { ascending: false })
        .limit(8),
      supabaseStorageClient
        .from('pending_actions')
        .select('action_type, confirmation_message, created_at, expires_at')
        .eq('user_phone', phone)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    const recentReplies = (repliesRes.data || []).map((r) => ({
      body: r.body,
      channel: r.channel || 'imessage',
      createdAt: r.created_at,
    }));

    const awaitingConfirmation = (pendingRes.data || []).map((p) => ({
      actionType: p.action_type,
      message: p.confirmation_message,
      createdAt: p.created_at,
    }));

    return res.json({ recentReplies, awaitingConfirmation });
  } catch (err) {
    console.error('[DashboardActivity] Error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to load activity' });
  }
});

/**
 * Mint a long-lived JWT the sandboxed keyboard extension can use to call the
 * backend (it can't run the Supabase SDK / refresh short-lived tokens). Signed
 * with SUPABASE_JWT_SECRET so authenticateJwt verifies it unchanged. Called by
 * the main app (with a valid session) on foreground; re-minted as needed.
 * POST /api/keyboard/provision-token
 */
app.post('/api/keyboard/provision-token', authenticateJwt, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  console.log('[Keyboard] provision-token for user', userId);

  const secret = process.env.SUPABASE_JWT_SECRET || process.env.SUPABASE_ANON_JWT_SECRET;
  if (!secret) return res.status(500).json({ error: 'Authentication not configured' });

  const expiresInSeconds = KEYBOARD_TOKEN_TTL_DAYS * 24 * 60 * 60;
  const token = jwt.sign(
    { sub: userId, flynn_kbd: true, role: 'authenticated' },
    secret,
    { algorithm: 'HS256', expiresIn: expiresInSeconds }
  );

  res.json({
    token,
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
  });
});

/**
 * No-auth diagnostic ping from ScreenshotDraftIntent.perform() — tells us
 * whether the App Intent process is executing at all.
 * POST /api/intent-ping
 */
app.post('/api/intent-ping', (req, res) => {
  console.log('[Intent] perform() executing — ping received');
  res.sendStatus(200);
});

/**
 * Extract conversation text from a screenshot using Qwen VL OCR.
 * Called by the ScreenshotDraftIntent (App Intent) immediately after capture.
 * Body: { imageBase64: string }  (PNG encoded as base64, up to ~10 MB)
 * Returns: { text: string }
 * POST /api/keyboard/ocr-screenshot
 */
app.post('/api/keyboard/ocr-screenshot', authenticateJwt, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const imageBase64 = req.body?.imageBase64;
  if (!imageBase64 || typeof imageBase64 !== 'string' || imageBase64.length < 100) {
    return res.status(400).json({ error: 'imageBase64 required' });
  }

  try {
    const client = getLLMClient('compatible');
    const ocrModel = process.env.OCR_VL_MODEL || 'qwen-vl-ocr';
    const response = await client.chat.completions.create({
      model: ocrModel,
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${imageBase64}` },
            },
            {
              type: 'text',
              text: 'This is a screenshot of a messaging app. Extract the full conversation in order.\n\nRules:\n- Messages on the RIGHT (sent by the owner): prefix with "Me: "\n- Messages on the LEFT (from the customer): no prefix\n- Photos, images, or media ATTACHED to a message: describe what they show on a separate line tagged with who sent it — e.g. "[Customer sent photo: Evolve Half Rack (TALL) gym equipment, full unit visible — this is the item they mentioned]" or "[Me sent photo: quote document]"\n- Link previews or product cards embedded in a message: describe them in square brackets — e.g. "[Customer shared product link: Evolve Half Rack (TALL) from evolvefitness.com.au — this appears to be the equipment they are asking about]"\n- Ignore UI chrome: status bar, battery, signal strength, time, contact name/avatar, app labels (iMessage/SMS/WhatsApp), delivery/read receipts, Send button\n\nReturn only the conversation content, one message or attachment per line. Be specific about what photos and product cards show — this context is critical so the reply does not ask for information already given.',
            },
          ],
        },
      ],
    });

    const text = (response?.choices?.[0]?.message?.content ?? '').trim();
    if (!text) {
      console.warn('[Keyboard] ocr-screenshot: empty response from model');
      return res.status(422).json({ error: 'No text extracted from image' });
    }

    console.log('[Keyboard] ocr-screenshot extracted', text.length, 'chars for user', userId);
    res.json({ text });

    // Fire-and-forget: save capture to screenshots table + extract confirmed facts.
    (async () => {
      try {
        const summaryClient = getLLMClient('compatible');
        const summaryResp = await summaryClient.chat.completions.create({
          enable_thinking: false,
          max_tokens: 50,
          messages: [
            { role: 'system', content: 'Summarise this message conversation in one short sentence (12 words max). Focus on what the customer wants.' },
            { role: 'user', content: text.slice(0, 1500) },
          ],
        });
        const summary = summaryResp?.choices?.[0]?.message?.content?.trim() || null;
        await supabaseStorageClient.from('screenshots').insert({
          user_id: userId,
          extracted_text: text.slice(0, 8000),
          summary,
        });
      } catch (_) { /* best-effort */ }

      extractFacts({ messages: [text] })
        .then(async ({ facts }) => {
          for (const f of (facts || []).slice(0, 5)) {
            try {
              await supabaseStorageClient.from('customer_context').insert({
                user_id: userId,
                subject_handle: f.subject ? f.subject.toLowerCase().replace(/\s+/g, ' ').trim() : null,
                subject_label: f.subject || null,
                fact: f.fact,
                confidence: f.confidence,
                status: 'confirmed',
                source: 'screenshot',
              });
            } catch (_) {}
          }
        })
        .catch(() => {});
    })();
  } catch (err) {
    console.error('[Keyboard] ocr-screenshot failed:', err?.message || err);
    return res.status(500).json({ error: 'OCR failed' });
  }
});

/**
 * Generate tone-matched reply drafts for the customer's (possibly fragmented)
 * messages. Used by the keyboard extension. Privacy: customer message text is
 * used only to build the prompt and is NOT persisted.
 * POST /api/keyboard/draft-replies
 * Body: { messages: string[], proposedSlots?: string[], draftCount?: number,
 *         source?: 'clipboard'|'screenshot' }
 */
app.post('/api/keyboard/draft-replies', authenticateJwt, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!supabaseStorageClient) return res.status(500).json({ error: 'Database not configured' });

  const rawMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const messages = rawMessages
    .filter((m) => typeof m === 'string' && m.trim().length > 0)
    .slice(-MAX_DRAFT_MESSAGES);
  if (messages.length === 0) {
    return res.status(400).json({ error: 'No customer messages provided' });
  }

  // Slots may be supplied by the client (e.g. computed on-device from Apple
  // EventKit). If not, and the user has Google connected, compute them server-side.
  let proposedSlots = Array.isArray(req.body?.proposedSlots)
    ? req.body.proposedSlots.filter((s) => typeof s === 'string' && s.trim()).slice(0, 5)
    : [];
  const draftCount = Math.min(Math.max(parseInt(req.body?.draftCount, 10) || 4, 1), 4);
  // How the conversation was captured: 'screenshot' (gesture) or 'clipboard'
  // (copy→keyboard). Tweaks the prompt framing; defaults to clipboard.
  const source = req.body?.source === 'screenshot' ? 'screenshot' : 'clipboard';

  console.log('[Keyboard] draft-replies request', {
    source,
    messageCount: messages.length,
    messagePreview: messages.map((m) => m.slice(0, 120)).join(' | '),
  });

  try {
    // Free-tier gate: unlimited for entitled users; capped per day otherwise.
    const entitled = await isUserEntitled(userId);
    if (!entitled) {
      const used = await draftsUsedToday(userId);
      if (used >= FREE_DRAFTS_PER_DAY) {
        return res.status(402).json({
          limitReached: true,
          error: 'Free daily draft limit reached',
          freeDraftsPerDay: FREE_DRAFTS_PER_DAY,
        });
      }
    }

    // Business Brain.
    const { data: profileRow } = await supabaseStorageClient
      .from('business_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    // Calendar awareness: when the user has Google connected, fetch their real
    // free/busy once and use it both to (a) propose open slots and (b) check any
    // specific time the customer named in their latest message.
    let availabilityNote = '';
    // When the customer named a time that's genuinely free, these let us offer a
    // one-tap calendar booking (the time is taken from here, never the LLM).
    let agreedProposed = null;
    let agreedStatus = null;
    if (proposedSlots.length === 0) {
      const { slots, busy, timeZone, connected } = await computeGoogleSlots(userId, profileRow?.hours_json);
      proposedSlots = slots.map((s) => s.label);
      const availability = buildAvailabilityNote({
        latestMessage: messages[messages.length - 1],
        businessHours: profileRow?.hours_json,
        busy,
        timeZone,
        connected,
      });
      availabilityNote = availability.note;
      agreedProposed = availability.proposed;
      agreedStatus = availability.status;
    }

    // Tone samples: all onboarding samples + the most recent accepted ones
    // (the learning loop). Newest-first; cap accepted so the prompt stays small.
    const { data: sampleRows } = await supabaseStorageClient
      .from('tone_samples')
      .select('sample_text, source, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(40);

    const onboarding = [];
    const accepted = [];
    for (const row of sampleRows || []) {
      if (!row?.sample_text) continue;
      if (row.source === 'accepted') accepted.push(row.sample_text);
      else onboarding.push(row.sample_text);
    }
    const toneSamples = [...onboarding, ...accepted.slice(0, MAX_ACCEPTED_TONE_SAMPLES)];

    // Remembered context: confirmed facts about this customer that clearly match the
    // conversation. Best-effort — never break drafting if the table/query is absent.
    let rememberedContext = '';
    try {
      const { data: factRows } = await supabaseStorageClient
        .from('customer_context')
        .select('fact, subject_handle, subject_label')
        .eq('user_id', userId)
        .eq('status', 'confirmed')
        .limit(200);
      rememberedContext = formatRememberedContext(matchFactsToConversation(factRows || [], messages));
    } catch (_) { /* memory table not present yet / query failed — proceed without */ }

    const { drafts, booking, usage } = await generateDrafts({
      profileRow: profileRow || {},
      toneSamples,
      // The accepted samples are exactly the replies the user has picked before —
      // used to derive substance preferences (length, price, time, emoji, greeting).
      pickedSamples: accepted,
      messages,
      proposedSlots,
      availabilityNote,
      rememberedContext,
      draftCount,
      source,
    });

    if (!drafts || drafts.length === 0) {
      return res.status(502).json({ error: 'Draft generation returned no results' });
    }

    // Count this draft against the free daily cap (entitled users are unlimited).
    if (!entitled) {
      try { await supabaseStorageClient.rpc('bump_draft_usage', { p_user_id: userId }); } catch (_) {}
    }

    // Offer a one-tap calendar booking when the customer's named time was validated
    // as genuinely free (Google connected). For Apple-only users we can't check
    // free/busy, so we offer it only when the model also detected a firm agreement
    // (`booking` present) — the user still confirms before anything is written.
    let agreedEvent = buildAgreedEvent({ proposed: agreedProposed, status: agreedStatus, booking });
    if (!agreedEvent && agreedStatus === 'unknown' && agreedProposed && booking) {
      agreedEvent = buildAgreedEvent({ proposed: agreedProposed, status: 'free', booking });
    }

    res.json({ drafts, usage, agreedEvent });

    // Passive learning (after responding, never blocks the draft): pull durable facts
    // from the FULL screenshot conversation and stage them as unconfirmed for the
    // owner to keep/discard. Skipped for clipboard fragments (too little context).
    // All best-effort — a missing customer_context table is a no-op.
    if (source === 'screenshot') {
      extractFacts({ messages })
        .then(async ({ facts }) => {
          for (const f of facts.slice(0, 5)) {
            try {
              await supabaseStorageClient.from('customer_context').insert({
                user_id: userId,
                subject_handle: f.subject ? f.subject.toLowerCase().replace(/\s+/g, ' ').trim() : null,
                subject_label: f.subject || null,
                fact: f.fact,
                confidence: f.confidence,
                status: 'confirmed',
                source: 'screenshot',
              });
            } catch (_) { /* table not present yet — ignore */ }
          }
        })
        .catch(() => {});
    }
  } catch (error) {
    console.error('[Keyboard] draft-replies failed:', error?.status || '', error?.message);
    res.status(500).json({ error: 'Failed to generate drafts' });
  }
});

/**
 * Learning loop: record a draft the user actually tapped/sent so future drafts
 * lean toward that style (voice) AND substance. The accepted text is stored as a
 * tone sample (source='accepted'); the full candidate set + picked index + source
 * + conversation are stored in draft_picks for contrastive/substance learning.
 * POST /api/keyboard/accept-draft
 * Body: { text: string, candidates?: string[], pickedIndex?: number,
 *         source?: 'clipboard'|'screenshot', messages?: string[] }
 */
app.post('/api/keyboard/accept-draft', authenticateJwt, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!supabaseStorageClient) return res.status(500).json({ error: 'Database not configured' });

  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text) return res.status(400).json({ error: 'No draft text provided' });

  // Optional richer learning signals (back-compatible: clipboard path may omit them).
  const candidates = Array.isArray(req.body?.candidates)
    ? req.body.candidates.filter((c) => typeof c === 'string').map((c) => c.slice(0, 1000)).slice(0, 8)
    : [];
  const messages = Array.isArray(req.body?.messages)
    ? req.body.messages.filter((m) => typeof m === 'string').map((m) => m.slice(0, 2000)).slice(0, 20)
    : [];
  const pickedIndex = Number.isInteger(req.body?.pickedIndex) ? req.body.pickedIndex : null;
  const source = req.body?.source === 'screenshot' ? 'screenshot' : 'clipboard';

  try {
    const { error } = await supabaseStorageClient
      .from('tone_samples')
      .insert({ user_id: userId, sample_text: text.slice(0, 1000), source: 'accepted' });
    if (error) {
      console.error('[Keyboard] accept-draft insert failed:', error.message);
      return res.status(500).json({ error: 'Failed to record accepted draft' });
    }

    // Best-effort: never fail the request if the richer record can't be written.
    try {
      await supabaseStorageClient.from('draft_picks').insert({
        user_id: userId,
        messages,
        candidates,
        picked_index: pickedIndex,
        picked_text: text.slice(0, 1000),
        source,
      });
    } catch (pickErr) {
      console.warn('[Keyboard] draft_picks insert failed (non-fatal):', pickErr?.message);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Keyboard] accept-draft failed:', error?.message);
    res.status(500).json({ error: 'Failed to record accepted draft' });
  }
});

/**
 * Add a calendar event directly to the user's Google Calendar from the keyboard
 * extension. The keyboard can't open the main app, so it calls this instead.
 * POST /api/keyboard/add-calendar-event
 * Body: { title, startISO, durationMin, location?, customer? }
 */
app.post('/api/keyboard/add-calendar-event', authenticateJwt, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!supabaseStorageClient) return res.status(500).json({ error: 'Database not configured' });

  const { title, startISO, durationMin, location, customer } = req.body || {};
  if (!title || !startISO) return res.status(400).json({ error: 'title and startISO required' });

  try {
    const { connection } = await googleCalendar.getConnectionForUser(supabaseStorageClient, userId);
    if (!connection) {
      return res.status(404).json({ error: 'Google Calendar not connected', code: 'not_connected' });
    }

    const accessToken = await googleCalendar.ensureFreshAccessToken(supabaseStorageClient, connection);
    const timeZone = connection?.metadata?.timeZone || 'Australia/Sydney';
    const durationMs = (parseInt(durationMin, 10) || 60) * 60 * 1000;
    const startDate = new Date(startISO);
    const endISO = new Date(startDate.getTime() + durationMs).toISOString();
    const summary = customer ? `${title} — ${customer}` : title;

    const result = await googleCalendar.insertEvent(accessToken, {
      calendarId: connection.account_id || 'primary',
      summary,
      description: customer ? `Customer: ${customer}` : '',
      startISO,
      endISO,
      timeZone,
      location: location || undefined,
    });

    console.log('[Keyboard] add-calendar-event inserted for user', userId, result.id);
    res.json({ success: true, eventId: result.id, htmlLink: result.htmlLink });
  } catch (error) {
    console.error('[Keyboard] add-calendar-event failed:', error?.status || '', error?.message);
    res.status(500).json({ error: 'Failed to add event to Google Calendar' });
  }
});

/**
 * Desktop: return the user's next N free 1-hour calendar slots for the draft
 * popup's slot-proposal feature.
 * POST /api/calendar/free-busy
 * Body: { windowDays?: number, timezone?: string }
 * Returns: { slots: string[] }  — e.g. ["Thursday 2pm", "Friday 10am", ...]
 */
app.post('/api/calendar/free-busy', authenticateJwt, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!supabaseStorageClient) return res.status(500).json({ error: 'Database not configured' });

  const windowDays = Math.min(Math.max(1, parseInt(req.body?.windowDays) || 7), 30);
  const timezone = typeof req.body?.timezone === 'string' ? req.body.timezone : 'UTC';

  try {
    const { getConnectionForUser, ensureFreshAccessToken, queryFreeBusy } = require('./services/googleCalendar');
    const { connection } = await getConnectionForUser(supabaseStorageClient, userId);
    if (!connection) {
      return res.json({ slots: [] });
    }

    const accessToken = await ensureFreshAccessToken(supabaseStorageClient, connection);

    // Query busy intervals for the next windowDays
    const now = new Date();
    const until = new Date(now.getTime() + windowDays * 24 * 3600 * 1000);
    const busyIntervals = await queryFreeBusy(accessToken, {
      timeMin: now.toISOString(),
      timeMax: until.toISOString(),
    });

    // Build free slots: walk working hours (8am–6pm local) in 1h steps
    const WORK_START = 8;
    const WORK_END = 18;
    const SLOT_HOURS = 1;
    const MAX_SLOTS = 5;

    const slots = [];
    let cursor = roundUpToNextHour(now);

    while (slots.length < MAX_SLOTS && cursor < until) {
      const localHour = getLocalHour(cursor, timezone);
      if (localHour < WORK_START || localHour + SLOT_HOURS > WORK_END) {
        cursor = advanceToNextWorkdayStart(cursor, timezone, WORK_START);
        continue;
      }
      const slotEnd = new Date(cursor.getTime() + SLOT_HOURS * 3600 * 1000);
      const busy = busyIntervals.some((b) => {
        const bs = new Date(b.start);
        const be = new Date(b.end);
        return cursor < be && slotEnd > bs;
      });
      if (!busy) {
        slots.push(formatSlot(cursor, timezone));
      }
      cursor = new Date(cursor.getTime() + 3600 * 1000);
    }

    return res.json({ slots });
  } catch (err) {
    console.error('[calendar/free-busy]', err.message);
    return res.json({ slots: [] }); // non-fatal: desktop will fall back to EventKit
  }
});

function roundUpToNextHour(date) {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

function getLocalHour(date, timezone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: timezone }).formatToParts(date);
    return parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  } catch {
    return date.getUTCHours();
  }
}

function advanceToNextWorkdayStart(date, timezone, startHour) {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  // Set to startHour in the given timezone by using a temp formatter
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      timeZone: timezone,
    });
    const parts = formatter.formatToParts(d);
    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    const dateStr = `${year}-${month}-${day}T${String(startHour).padStart(2, '0')}:00:00`;
    return new Date(dateStr + 'Z'); // approximation; good enough for slot listing
  } catch {
    d.setUTCHours(startHour, 0, 0, 0);
    return d;
  }
}

function formatSlot(date, timezone) {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: timezone });
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone,
  });

  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  const dayLabel = isToday ? 'today' : isTomorrow ? 'tomorrow' : dayFormatter.format(date);
  const timeLabel = timeFormatter.format(date).replace(':00', '').toLowerCase();
  return `${dayLabel} ${timeLabel}`;
}

/**
 * Onboarding: turn a one-line "what do you do" (+ optional scraped website data)
 * into a starter Business Brain and 3 trade-tailored sample customer texts the
 * user replies to (so we capture their voice in context). Never dead-ends —
 * returns generic fallback prompts if the model is unavailable.
 * POST /api/onboarding/understand
 * Body: { description: string, websiteData?: object }
 */
app.post('/api/onboarding/understand', authenticateJwt, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  if (!description) return res.status(400).json({ error: 'A short description is required' });

  try {
    const understanding = await understandBusiness({
      description,
      websiteData: req.body?.websiteData,
    });
    if (understanding && understanding.samplePrompts.length === 3) {
      return res.json(understanding);
    }
    // Partial/failed parse → still return something usable.
    return res.json({
      businessType: understanding?.businessType ?? null,
      services: understanding?.services ?? [],
      pricingNote: understanding?.pricingNote ?? null,
      hoursSummary: understanding?.hoursSummary ?? null,
      samplePrompts: understanding?.samplePrompts?.length
        ? understanding.samplePrompts
        : FALLBACK_PROMPTS,
    });
  } catch (error) {
    console.error('[Onboarding] understand failed:', error?.status || '', error?.message);
    // Don't block onboarding — hand back generic prompts.
    res.json({
      businessType: null,
      services: [],
      pricingNote: null,
      hoursSummary: null,
      samplePrompts: FALLBACK_PROMPTS,
    });
  }
});

/**
 * Propose genuinely-open Google Calendar slots for the user (the "offer a real
 * time" feature). Apple-only users get connected:false and propose on-device.
 * POST /api/calendar/propose-slots
 * Body: { durationMins?: number, days?: number, maxSlots?: number }
 */
app.post('/api/calendar/propose-slots', authenticateJwt, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!supabaseStorageClient) return res.status(500).json({ error: 'Database not configured' });

  const durationMins = Math.min(Math.max(parseInt(req.body?.durationMins, 10) || 60, 15), 480);
  const days = Math.min(Math.max(parseInt(req.body?.days, 10) || 7, 1), 21);
  const maxSlots = Math.min(Math.max(parseInt(req.body?.maxSlots, 10) || 3, 1), 5);

  try {
    const { data: profileRow } = await supabaseStorageClient
      .from('business_profiles')
      .select('hours_json')
      .eq('user_id', userId)
      .maybeSingle();

    const { slots, timeZone, connected } = await computeGoogleSlots(
      userId,
      profileRow?.hours_json,
      { durationMins, days, maxSlots }
    );
    res.json({
      connected,
      timeZone,
      slots: slots.map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString(), label: s.label })),
    });
  } catch (error) {
    console.error('[Calendar] propose-slots failed:', error?.message);
    res.status(500).json({ error: 'Failed to propose slots' });
  }
});

/**
 * Create a calendar event (used after a time is agreed). Writes to Google
 * server-side so it can be triggered from the keyboard. Apple Calendar writes
 * happen on-device in the app via EventKit, not here.
 * POST /api/calendar/events
 * Body: { summary, description?, startISO, endISO, location?, timeZone? }
 */
app.post('/api/calendar/events', authenticateJwt, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!supabaseStorageClient) return res.status(500).json({ error: 'Database not configured' });

  const { summary, description, startISO, endISO, location, timeZone } = req.body || {};
  if (!summary || !startISO || !endISO) {
    return res.status(400).json({ error: 'summary, startISO and endISO are required' });
  }

  try {
    const { connection } = await googleCalendar.getConnectionForUser(supabaseStorageClient, userId);
    if (!connection) {
      return res.status(409).json({ error: 'Google Calendar not connected', code: 'not_connected' });
    }
    const accessToken = await googleCalendar.ensureFreshAccessToken(supabaseStorageClient, connection);
    const event = await googleCalendar.insertEvent(accessToken, {
      calendarId: connection.account_id || 'primary',
      summary,
      description: description || '',
      startISO,
      endISO,
      location,
      timeZone: timeZone || connection?.metadata?.timeZone || 'Australia/Sydney',
    });
    res.json({ eventId: event.id, htmlLink: event.htmlLink, status: event.status });
  } catch (error) {
    console.error('[Calendar] event insert failed:', error?.status || '', error?.message);
    res.status(500).json({ error: 'Failed to create calendar event' });
  }
});

// ========================================
// Billing & Subscription Endpoints
// ========================================

/**
 * Create Stripe checkout session for subscription
 */
app.post('/api/billing/create-checkout-session', authenticateJwt, async (req, res) => {
  const { priceId } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!priceId) {
    return res.status(400).json({ error: 'Price ID required' });
  }

  if (!stripeClient) {
    return res.status(503).json({ error: 'Stripe not configured' });
  }

  try {
    console.log('[Billing] Creating checkout session', { userId, priceId });

    // Get user's organization
    const { data: userData, error: userError } = await supabaseServiceClient
      .from('users')
      .select('default_org_id, email')
      .eq('id', userId)
      .single();

    if (userError || !userData?.default_org_id) {
      console.error('[Billing] User or organization not found', { userId, error: userError });
      return res.status(404).json({ error: 'User organization not found' });
    }

    // Check if customer already exists
    const { data: orgData } = await supabaseServiceClient
      .from('organizations')
      .select('stripe_customer_id')
      .eq('id', userData.default_org_id)
      .single();

    let customerId = orgData?.stripe_customer_id;

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await stripeClient.customers.create({
        email: userData.email,
        metadata: {
          user_id: userId,
          org_id: userData.default_org_id,
        },
      });
      customerId = customer.id;

      // Store customer ID
      await supabaseServiceClient
        .from('organizations')
        .update({ stripe_customer_id: customerId })
        .eq('id', userData.default_org_id);

      console.log('[Billing] Created Stripe customer', { customerId, orgId: userData.default_org_id });
    }

    // Create checkout session with 14-day trial
    const session = await stripeClient.checkout.sessions.create({
      customer: customerId,
      client_reference_id: userData.default_org_id,
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 14,
        trial_settings: {
          end_behavior: {
            missing_payment_method: 'cancel', // Cancel subscription if no payment method after trial
          },
        },
        metadata: {
          org_id: userData.default_org_id,
          user_id: userId,
          trial_start: new Date().toISOString(),
        },
      },
      payment_method_collection: 'always', // Require payment method upfront
      success_url: `${process.env.API_BASE_URL || 'flynnai://billing'}?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.API_BASE_URL || 'flynnai://billing'}?canceled=true`,
      metadata: {
        org_id: userData.default_org_id,
        user_id: userId,
        has_trial: 'true',
      },
    });

    console.log('[Billing] Checkout session created', { sessionId: session.id });

    res.status(200).json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('[Billing] Error creating checkout session', { error });
    res.status(500).json({
      error: 'Failed to create checkout session',
      message: error.message,
    });
  }
});

/**
 * Create Stripe Customer Portal session
 */
app.post('/api/billing/create-portal-session', authenticateJwt, async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!stripeClient) {
    return res.status(503).json({ error: 'Stripe not configured' });
  }

  try {
    console.log('[Billing] Creating portal session', { userId });

    // Get user's organization and Stripe customer ID
    const { data: userData, error: userError } = await supabaseServiceClient
      .from('users')
      .select('default_org_id')
      .eq('id', userId)
      .single();

    if (userError || !userData?.default_org_id) {
      console.error('[Billing] User not found', { userId, error: userError });
      return res.status(404).json({ error: 'User not found' });
    }

    const { data: orgData, error: orgError } = await supabaseServiceClient
      .from('organizations')
      .select('stripe_customer_id')
      .eq('id', userData.default_org_id)
      .single();

    if (orgError || !orgData?.stripe_customer_id) {
      console.error('[Billing] Stripe customer not found', { orgId: userData.default_org_id, error: orgError });
      return res.status(404).json({ error: 'No active subscription found' });
    }

    // Create portal session
    const session = await stripeClient.billingPortal.sessions.create({
      customer: orgData.stripe_customer_id,
      return_url: `${process.env.API_BASE_URL || 'flynnai://billing'}`,
    });

    console.log('[Billing] Portal session created', { sessionId: session.id });

    res.status(200).json({
      url: session.url,
    });
  } catch (error) {
    console.error('[Billing] Error creating portal session', { error });
    res.status(500).json({
      error: 'Failed to create portal session',
      message: error.message,
    });
  }
});

/**
 * Get subscription status for authenticated user
 */
app.get('/api/billing/subscription-status', authenticateJwt, async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    // Get user's organization
    const { data: userData, error: userError } = await supabaseServiceClient
      .from('users')
      .select('default_org_id')
      .eq('id', userId)
      .single();

    if (userError || !userData?.default_org_id) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get organization with subscription details
    const { data: orgData, error: orgError } = await supabaseServiceClient
      .from('organizations')
      .select('plan, subscription_status, current_period_end, cancel_at_period_end, stripe_subscription_id')
      .eq('id', userData.default_org_id)
      .single();

    if (orgError || !orgData) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.status(200).json({
      plan: orgData.plan || 'trial',
      status: orgData.subscription_status || 'inactive',
      currentPeriodEnd: orgData.current_period_end,
      cancelAtPeriodEnd: orgData.cancel_at_period_end || false,
      hasActiveSubscription: !!orgData.stripe_subscription_id,
    });
  } catch (error) {
    console.error('[Billing] Error getting subscription status', { error });
    res.status(500).json({
      error: 'Failed to get subscription status',
      message: error.message,
    });
  }
});

// Twilio Phone Number Provisioning Endpoints

// ===========================
// Phone number provisioning (production path)
// ===========================
// NOTE: the route is still named `/api/telnyx/provision-number` because the
// shipped iOS app (OnboardingStore.provisionPhoneNumber) calls that exact URL.
// Telnyx was removed — this now provisions exclusively via Twilio AU Mobile.

/**
 * Provision a Twilio phone number for the authenticated user.
 *
 * Idempotent: if `users.twilio_phone_number` is already set, returns it
 * without re-purchasing. Used by both the RN and iOS Swift onboarding flows
 * after the paywall step succeeds.
 *
 * Optional body:
 *   { countryCode?: 'AU' }   defaults to 'AU' (only AU supported)
 *
 * Response:
 *   200 { phoneNumber: '+61...', phoneNumberSid: '<sid>' }
 *   429 { error: 'no_available_numbers' }   if Twilio has no AU Mobile numbers
 *   500 { error: 'order_failed', message }  on Twilio API error
 *
 * POST /api/telnyx/provision-number
 */
app.post('/api/telnyx/provision-number', authenticateJwt, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const countryCode = (req.body?.countryCode || 'AU').toUpperCase();

  try {
    // Idempotency — return the existing number if already provisioned.
    const { data: existing, error: existingErr } = await supabaseServiceClient
      .from('users')
      .select('email, business_name, twilio_phone_number, twilio_number_sid')
      .eq('id', userId)
      .single();

    if (existingErr) {
      console.error('[Provision] Failed to load user:', existingErr);
      return res.status(500).json({ error: 'user_lookup_failed', message: existingErr.message });
    }

    if (existing?.twilio_phone_number) {
      return res.status(200).json({
        phoneNumber: existing.twilio_phone_number,
        phoneNumberSid: existing.twilio_number_sid || null,
        idempotent: true,
      });
    }

    // Dev-mode short-circuit — only burn real provisioning $$ for non-allowlisted
    // users. The TELNYX_DEV_* env names are legacy (dev shared-number toggle only).
    if (process.env.TELNYX_DEV_MODE === 'true' && process.env.TELNYX_DEV_SHARED_NUMBER) {
      const allowList = (process.env.DEV_TEST_EMAILS || '')
        .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
      if (existing?.email && allowList.includes(existing.email.toLowerCase())) {
        const sharedNumber = process.env.TELNYX_DEV_SHARED_NUMBER;
        const sharedSid = process.env.TELNYX_DEV_SHARED_SID || `DEV-${userId.slice(0, 8)}`;
        await supabaseServiceClient
          .from('users')
          .update({
            twilio_phone_number: sharedNumber,
            twilio_number_sid: sharedSid,
            has_provisioned_phone: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);
        console.log('[Provision] DEV_MODE: assigned shared number', { userId, sharedNumber });
        return res.status(200).json({ phoneNumber: sharedNumber, phoneNumberSid: sharedSid, devMode: true });
      }
    }

    // Twilio AU Mobile provisioning. AU Mobile (the 04xx prefix) is the only AU
    // Twilio number type that supports SMS, and it uses our approved Mates Rates
    // regulatory bundle. Telnyx was removed — Twilio is Flynn's sole provider.
    if (countryCode !== 'AU') {
      return res.status(400).json({ error: 'unsupported_country', message: 'Only AU provisioning is supported' });
    }
    if (!twilioMessagingClient) {
      return res.status(503).json({ error: 'twilio_not_configured' });
    }
    const bundleSid = process.env.TWILIO_AU_BUNDLE_SID;
    const addressSid = process.env.TWILIO_AU_ADDRESS_SID;
    if (!bundleSid || !addressSid) {
      return res.status(500).json({ error: 'twilio_au_compliance_missing' });
    }

    const available = await twilioMessagingClient
      .availablePhoneNumbers('AU')
      .mobile.list({ smsEnabled: true, voiceEnabled: true, limit: 1 });
    if (!available.length) {
      console.warn('[Provision] No available Twilio AU Mobile numbers');
      return res.status(429).json({ error: 'no_available_numbers' });
    }
    const candidate = available[0].phoneNumber;

    const voiceUrl = `${process.env.SERVER_PUBLIC_URL || 'https://flynnai-telephony.fly.dev'}/telephony/inbound-voice`;
    const statusCallbackUrl = `${process.env.SERVER_PUBLIC_URL || 'https://flynnai-telephony.fly.dev'}/telephony/stream-status`;
    const incoming = await twilioMessagingClient.incomingPhoneNumbers.create({
      phoneNumber: candidate,
      voiceUrl,
      voiceMethod: 'POST',
      statusCallback: statusCallbackUrl,
      statusCallbackMethod: 'POST',
      bundleSid,
      addressSid,
    });

    await supabaseServiceClient
      .from('users')
      .update({
        twilio_phone_number: incoming.phoneNumber,
        twilio_number_sid: incoming.sid,
        has_provisioned_phone: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    console.log('[Provision] Twilio AU Mobile number provisioned', {
      userId,
      phoneNumber: incoming.phoneNumber,
      phoneNumberSid: incoming.sid,
    });

    return res.status(200).json({
      phoneNumber: incoming.phoneNumber,
      phoneNumberSid: incoming.sid,
      provider: 'twilio',
    });
  } catch (err) {
    console.error('[Provision] Failed:', err);
    return res.status(500).json({ error: 'order_failed', message: err.message });
  }
});

// Deprecated shim — old clients still hitting /api/twilio/purchase-number
// get forwarded to the Telnyx path. Safe to remove once all clients ship 2.0.0.
app.post('/api/twilio/purchase-number-legacy-redirect', authenticateJwt, (req, res) => {
  req.url = '/api/telnyx/provision-number';
  return app._router.handle(req, res);
});

/**
 * Search for available Twilio phone numbers
 * POST /api/twilio/search-numbers
 */
app.post('/api/twilio/search-numbers', authenticateJwt, async (req, res) => {
  const { countryCode = 'US', limit = 5, voiceEnabled = true } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!twilioMessagingClient) {
    return res.status(503).json({ error: 'Twilio not configured' });
  }

  try {
    console.log('[Twilio] Searching for available numbers', { userId, countryCode, limit });

    // Search for available phone numbers
    const availableNumbers = await twilioMessagingClient
      .availablePhoneNumbers(countryCode)
      .local
      .list({
        voiceEnabled,
        limit: parseInt(limit, 10),
      });

    const formattedNumbers = availableNumbers.map(num => ({
      phone_number: num.phoneNumber,
      friendly_name: num.friendlyName,
      locality: num.locality,
      region: num.region,
      postal_code: num.postalCode,
      iso_country: num.isoCountry,
      capabilities: num.capabilities,
    }));

    console.log('[Twilio] Found available numbers', { count: formattedNumbers.length });

    res.status(200).json({
      availableNumbers: formattedNumbers,
      countryCode,
    });
  } catch (error) {
    console.error('[Twilio] Failed to search numbers', error);
    res.status(500).json({
      error: 'Failed to search for available phone numbers',
      message: error.message,
    });
  }
});

/**
 * Purchase a Twilio phone number with address registration
 * POST /api/twilio/purchase-number
 */
app.post('/api/twilio/purchase-number', authenticateJwt, async (req, res) => {
  const { phoneNumber, userId, address, city, state, postalCode, country } = req.body;
  const authenticatedUserId = req.user?.id;

  if (!authenticatedUserId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Ensure the authenticated user matches the userId in the request
  if (authenticatedUserId !== userId) {
    return res.status(403).json({ error: 'Unauthorized: User ID mismatch' });
  }

  if (!phoneNumber) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  if (!twilioMessagingClient) {
    return res.status(503).json({ error: 'Twilio not configured' });
  }

  try {
    // Dev shared-number short-circuit: skip provisioning for allow-listed test
    // emails so we don't burn $2/number on every onboarding test pass.
    if (process.env.TELNYX_DEV_MODE === 'true' && process.env.TELNYX_DEV_SHARED_NUMBER) {
      const allowList = (process.env.DEV_TEST_EMAILS || '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);

      const { data: devUser } = await supabaseServiceClient
        .from('users')
        .select('email')
        .eq('id', userId)
        .single();

      if (devUser?.email && allowList.includes(devUser.email.toLowerCase())) {
        const sharedNumber = process.env.TELNYX_DEV_SHARED_NUMBER;
        const sharedSid = process.env.TELNYX_DEV_SHARED_SID || `DEV-${userId.slice(0, 8)}`;
        console.log('[Twilio] DEV MODE: assigning shared number', { userId, sharedNumber });

        await supabaseServiceClient
          .from('users')
          .update({
            twilio_phone_number: sharedNumber,
            twilio_number_sid: sharedSid,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);

        return res.status(200).json({
          phoneNumber: sharedNumber,
          phoneNumberSid: sharedSid,
          devMode: true,
        });
      }
    }

    console.log('[Twilio] Starting phone number purchase', { userId, phoneNumber, hasAddress: !!address });

    let addressSid = null;

    // Create Twilio Address if address fields provided (required for AU and other countries)
    if (address && city && state && postalCode && country) {
      console.log('[Twilio] Creating address for regulatory compliance', { country, city, state });

      // Get user's business name for the address
      const { data: userData, error: userError } = await supabaseServiceClient
        .from('users')
        .select('business_name, email')
        .eq('id', userId)
        .single();

      if (userError) {
        console.error('[Twilio] Failed to fetch user data', userError);
        throw new Error('Failed to fetch user information');
      }

      const customerName = userData?.business_name || userData?.email || 'Flynn AI Customer';

      // Create address with Twilio
      const twilioAddress = await twilioMessagingClient.addresses.create({
        customerName,
        street: address,
        city,
        region: state,
        postalCode,
        isoCountry: country,
      });

      addressSid = twilioAddress.sid;
      console.log('[Twilio] Address created successfully', { addressSid });
    }

    // Purchase the phone number
    const voiceUrl = `${process.env.SERVER_PUBLIC_URL || 'https://flynnai-telephony.fly.dev'}/telephony/inbound-voice`;
    const statusCallbackUrl = `${process.env.SERVER_PUBLIC_URL || 'https://flynnai-telephony.fly.dev'}/telephony/stream-status`;

    const purchaseParams = {
      phoneNumber,
      voiceUrl,
      voiceMethod: 'POST',
      statusCallback: statusCallbackUrl,
      statusCallbackMethod: 'POST',
    };

    // Add address SID if we created one
    if (addressSid) {
      purchaseParams.addressSid = addressSid;
    }

    console.log('[Twilio] Purchasing phone number', { phoneNumber, addressSid });

    const incomingNumber = await twilioMessagingClient.incomingPhoneNumbers.create(purchaseParams);

    console.log('[Twilio] Phone number purchased successfully', {
      phoneNumberSid: incomingNumber.sid,
      phoneNumber: incomingNumber.phoneNumber,
    });

    // Update user record with the new Twilio number
    await supabaseServiceClient
      .from('users')
      .update({
        twilio_phone_number: incomingNumber.phoneNumber,
        twilio_number_sid: incomingNumber.sid,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    res.status(200).json({
      phoneNumber: incomingNumber.phoneNumber,
      phoneNumberSid: incomingNumber.sid,
      addressSid,
      cost: 1.00, // Approximate cost, actual cost varies
    });
  } catch (error) {
    console.error('[CRITICAL ERROR] Error purchasing phone number:', error);
    res.status(500).json({
      error: 'Failed to purchase phone number',
      message: error.message,
    });
  }
});

// ===========================
// Deepgram TTS API Endpoint
// ===========================
app.post('/api/deepgram/generate-speech', authenticateJwt, async (req, res) => {
  try {
    const { text, voice = 'aura-2-theia-en' } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text is required and must be a non-empty string' });
    }

    const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
    if (!deepgramApiKey) {
      console.error('[Deepgram TTS] DEEPGRAM_API_KEY not configured');
      return res.status(500).json({ error: 'Deepgram API key not configured' });
    }

    // Call Deepgram TTS API
    const deepgramResponse = await fetch(
      `https://api.deepgram.com/v1/speak?model=${voice}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${deepgramApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      }
    );

    if (!deepgramResponse.ok) {
      const errorText = await deepgramResponse.text();
      console.error('[Deepgram TTS] API error:', deepgramResponse.status, errorText);
      return res.status(deepgramResponse.status).json({
        error: 'Deepgram TTS failed',
        message: errorText,
      });
    }

    // Get audio buffer
    const audioBuffer = await deepgramResponse.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');

    console.log('[Deepgram TTS] Generated speech successfully');
    res.status(200).json({
      audio: audioBase64,
      contentType: 'audio/mpeg',
      voice,
    });
  } catch (error) {
    console.error('[Deepgram TTS] Error generating speech:', error);
    res.status(500).json({
      error: 'Failed to generate speech',
      message: error.message,
    });
  }
});

// Health check endpoint for Railway
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Account deletion page for Google Play compliance
app.get('/account-deletion', (req, res) => {
  const htmlPath = path.join(__dirname, 'public', 'account-deletion.html');
  if (fs.existsSync(htmlPath)) {
    res.sendFile(htmlPath);
  } else {
    // Fallback inline HTML if file doesn't exist
    res.send(`
      <!DOCTYPE html>
      <html><head><title>Account Deletion - FlynnAI</title></head>
      <body style="font-family: sans-serif; max-width: 800px; margin: 40px auto; padding: 20px;">
        <h1>Delete Your FlynnAI Account</h1>
        <h2>In-App Deletion</h2>
        <p>Open the FlynnAI app → Settings → Account Settings → Delete Account</p>
        <h2>Email Request</h2>
        <p>Send an email to <a href="mailto:support@flynnai.app">support@flynnai.app</a> with subject "Account Deletion Request"</p>
        <p>Include your registered email address and we'll process your request within 48 hours.</p>
      </body></html>
    `);
  }
});

const JOB_STATUS_VALUES = new Set(['new', 'in_progress', 'completed']);

// Origin used to build absolute callback URLs in IVR TwiML (Gather/Redirect/Record
// `action`s). Returns '' when SERVER_PUBLIC_URL is unset — Twilio then resolves the
// relative paths against the inbound webhook host.
const ivrActionBaseUrl = () =>
  process.env.SERVER_PUBLIC_URL ? process.env.SERVER_PUBLIC_URL.trim().replace(/\/+$/, '') : '';

const buildRecordingCallbackUrl = (req) => {
  const callbackPath = '/telephony/recording-complete';
  const baseUrl = process.env.SERVER_PUBLIC_URL ? process.env.SERVER_PUBLIC_URL.trim() : undefined;

  if (baseUrl) {
    try {
      const callbackUrl = new URL(callbackPath, baseUrl).toString();
      return callbackUrl;
    } catch (error) {
      console.warn('[Telephony] Failed to build recording callback URL from SERVER_PUBLIC_URL:', error);
    }
  }

  const fallbackUrl = `${req.protocol}://${req.get('host')}${callbackPath}`;
  return fallbackUrl;
};

const isAudioResponse = (response, url) => {
  if (!response) {
    return false;
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.toLowerCase().startsWith('audio/')) {
    return true;
  }

  return /\.(mp3|wav)(\?|$)/i.test(url);
};

const downloadTwilioRecording = async (recordingUrl, recordingSid) => {
  if (!recordingUrl) {
    throw new Error('RecordingUrl is required to download audio.');
  }

  if (!twilioAccountSid || !twilioAuthToken) {
    throw new Error('Twilio credentials are not configured.');
  }

  // First, try using Twilio SDK to fetch the recording (works with regional endpoints)
  if (recordingSid && twilioMessagingClient) {
    try {
      console.log('[Telephony] Attempting to download recording via Twilio SDK.', {
        recordingSid,
        recordingUrl,
      });

      const recording = await twilioMessagingClient.recordings(recordingSid).fetch();

      // Get the media URL with proper authentication
      const mediaUrl = `https://api.twilio.com${recording.uri.replace('.json', '.mp3')}`;

      const authHeader = `Basic ${Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64')}`;

      const response = await fetch(mediaUrl, {
        headers: {
          Authorization: authHeader,
        },
      });

      if (response.ok && isAudioResponse(response, mediaUrl)) {
        console.log('[Telephony] Successfully downloaded recording via Twilio SDK.', {
          recordingSid,
          url: mediaUrl,
        });
        return { response, resolvedUrl: mediaUrl };
      }

      console.warn('[Telephony] Twilio SDK recording fetch returned unexpected response.', {
        url: mediaUrl,
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
      });
    } catch (sdkError) {
      console.warn('[Telephony] Failed to download recording via Twilio SDK, falling back to direct URL fetch.', {
        recordingSid,
        error: sdkError.message,
      });
    }
  }

  // Fallback: Try direct URL fetch with Basic Auth
  const authHeader = `Basic ${Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64')}`;
  const candidateUrls = [recordingUrl];

  if (!/\.(mp3|wav)(\?|$)/i.test(recordingUrl)) {
    candidateUrls.push(`${recordingUrl}.mp3`);
    candidateUrls.push(`${recordingUrl}.wav`);
  }

  for (const url of candidateUrls) {
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: authHeader,
        },
      });

      if (response.ok && isAudioResponse(response, url)) {
        return { response, resolvedUrl: url };
      }

      response.body?.cancel?.().catch(() => { });

      console.warn('[Telephony] Twilio recording fetch returned unexpected response.', {
        url,
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
      });
    } catch (error) {
      console.warn('[Telephony] Failed to download recording from Twilio URL.', {
        url,
        error,
      });
    }
  }

  throw new Error('Unable to download recording from Twilio.');
};

const inferAudioExtension = (resolvedUrl, response) => {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('wav')) {
    return 'wav';
  }

  if (contentType.includes('mpeg') || contentType.includes('mp3')) {
    return 'mp3';
  }

  const urlMatch = resolvedUrl.match(/\.([a-z0-9]+)(?:\?|$)/i);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1].toLowerCase();
  }

  return 'mp3';
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const buildVoicemailStoragePath = ({ callSid, recordingSid, extension }) => {
  const now = new Date();
  const dateFolder = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
  ].join('/');

  const baseName = (recordingSid || callSid || randomUUID()).replace(/[^a-zA-Z0-9-_]/g, '');
  return `${dateFolder}/${baseName}.${extension}`;
};

const createSignedUrlForPath = async (storagePath, ttlSeconds = voicemailSignedUrlTtlSeconds) => {
  if (!supabaseStorageClient) {
    throw new Error('Supabase storage client is not configured.');
  }

  const expiresIn = Math.max(60, Number.isFinite(ttlSeconds) ? ttlSeconds : 3600);

  const { data, error } = await supabaseStorageClient
    .storage
    .from(voicemailBucket)
    .createSignedUrl(storagePath, expiresIn);

  if (error) {
    throw error;
  }

  const signedUrl = data?.signedUrl || null;
  const expirationIso = data?.expiration
    ? new Date(data.expiration * 1000).toISOString()
    : new Date(Date.now() + expiresIn * 1000).toISOString();

  return { signedUrl, expiresAt: expirationIso };
};

const persistRecordingToSupabaseStorage = async ({
  callSid,
  recordingSid,
  resolvedUrl,
  response,
}) => {
  if (!supabaseStorageClient) {
    throw new Error('Supabase storage client is not configured.');
  }

  const extension = inferAudioExtension(resolvedUrl, response);
  const contentType = response.headers.get('content-type') || `audio/${extension === 'wav' ? 'wav' : 'mpeg'}`;

  const buffer = Buffer.from(await response.arrayBuffer());
  const storagePath = buildVoicemailStoragePath({ callSid, recordingSid, extension });

  const { error: uploadError } = await supabaseStorageClient
    .storage
    .from(voicemailBucket)
    .upload(storagePath, buffer, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { signedUrl, expiresAt } = await createSignedUrlForPath(storagePath);

  const recordingExpiresAt = voicemailRetentionDays > 0
    ? new Date(Date.now() + voicemailRetentionDays * MS_PER_DAY).toISOString()
    : null;

  return {
    storagePath,
    signedUrl,
    signedExpiresAt: expiresAt,
    recordingExpiresAt,
    contentType,
    extension,
    size: buffer.length,
  };
};

const purgeExpiredRecordings = async () => {
  if (!supabaseStorageClient) {
    return;
  }

  if (!voicemailRetentionDays || voicemailRetentionDays <= 0) {
    return;
  }

  try {
    const cutoffIso = new Date().toISOString();
    const candidates = await findExpiredRecordingCalls({ cutoffIso, limit: 50 });

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return;
    }

    for (const candidate of candidates) {
      const callSid = candidate?.call_sid;
      const storagePath = candidate?.recording_storage_path;

      if (!callSid) {
        continue;
      }

      try {
        if (storagePath) {
          const { error: removeError } = await supabaseStorageClient
            .storage
            .from(voicemailBucket)
            .remove([storagePath]);

          if (removeError) {
            console.error('[Telephony] Failed to delete expired voicemail from storage.', {
              callSid,
              storagePath,
              error: removeError,
            });
            continue;
          }

          await markCallRecordingExpired({ callSid, clearStoragePath: true });
        } else {
          await markCallRecordingExpired({ callSid, clearStoragePath: false });
        }
      } catch (callError) {
        console.error('[Telephony] Failed to mark voicemail recording expired.', {
          callSid,
          error: callError,
        });
      }
    }
  } catch (error) {
    console.error('[Telephony] Failed to purge expired recordings.', { error });
  }
};

const scheduleRetentionSweep = () => {
  if (!voicemailRetentionDays || voicemailRetentionDays <= 0) {
    return;
  }

  setTimeout(() => {
    purgeExpiredRecordings().catch((error) => {
      console.error('[Telephony] Retention sweep threw an error.', { error });
    });
  }, 0);
};

const sendConfirmationSms = async ({ to, body }) => {
  if (!twilioMessagingClient) {
    throw new Error('Twilio messaging client is not configured.');
  }

  if (!to) {
    throw new Error('Destination phone number is required.');
  }

  const payload = { to, body };

  if (twilioMessagingServiceSid) {
    payload.messagingServiceSid = twilioMessagingServiceSid;
  } else if (twilioSmsFromNumber) {
    payload.from = twilioSmsFromNumber;
  } else {
    throw new Error('Configure TWILIO_MESSAGING_SERVICE_SID or TWILIO_SMS_FROM_NUMBER to send SMS.');
  }

  const message = await twilioMessagingClient.messages.create(payload);
  return message;
};

const logCallEvent = async ({
  orgId,
  numberId = null,
  callSid = null,
  eventType,
  direction = null,
  payload = {},
}) => {
  if (!orgId || !eventType) {
    return;
  }

  try {
    await recordCallEvent({
      orgId,
      numberId,
      callSid,
      eventType,
      direction,
      payload,
      occurredAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('[CallEvents] Failed to record event.', {
      orgId,
      numberId,
      callSid,
      eventType,
      error: error?.message || error,
    });
  }
};

const handleInboundVoice = async (req, res) => {
  console.log('[Telephony] Inbound voice webhook request received.', { method: req.method });

  const inboundParams = req.method === 'GET' ? req.query || {} : req.body || {};

  try {
    if (shouldValidateSignature && twilioAuthToken) {
      const signature = req.headers['x-twilio-signature'];
      if (!signature) {
        console.warn('[Telephony] Missing X-Twilio-Signature header on inbound request.');
        return res.status(403).send('Twilio signature missing');
      }

      const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      const isValid = twilio.validateRequest(twilioAuthToken, signature, url, inboundParams);

      if (!isValid) {
        console.warn('[Telephony] Twilio signature validation failed for inbound voice webhook.', {
          url,
          signature,
        });
        return res.status(403).send('Twilio signature validation failed');
      }
    } else if (!twilioAuthToken) {
      console.warn('[Telephony] TWILIO_AUTH_TOKEN is not set; skipping signature validation.');
    } else {
      console.warn('[Telephony] Twilio signature validation disabled via TWILIO_VALIDATE_SIGNATURE=false.');
    }

    const callSid = inboundParams.CallSid;
    const toNumber = inboundParams.To || inboundParams.Called || inboundParams.ToFormatted || null;
    const fromNumber = inboundParams.From || inboundParams.Caller || inboundParams.CallerNumber || null;
    const stage = req.query?.stage || 'initial';
    const stageDecision = req.query?.decision || null;
    const profileUserId = req.query?.user || null;

    let receptionistProfile = null;

    if (toNumber) {
      try {
        receptionistProfile = await getReceptionistProfileByNumber(toNumber);
      } catch (profileError) {
        console.error('[Telephony] Failed to load receptionist profile for number.', {
          toNumber,
          error: profileError,
        });
      }
    }

    if (!receptionistProfile && profileUserId) {
      try {
        receptionistProfile = await getUserProfileById(profileUserId);
      } catch (profileLookupError) {
        console.warn('[Telephony] Failed to fetch profile via user id fallback.', {
          profileUserId,
          error: profileLookupError,
        });
      }
    }

    const orgId = receptionistProfile?.default_org_id || null;

    if (callSid) {
      await upsertCallRecord({
        callSid,
        userId: receptionistProfile?.id || null,
        orgId,
        fromNumber,
        toNumber,
        status: 'ringing',
      }).catch((error) => {
        console.warn('[Telephony] Failed to upsert initial call record.', { callSid, error });
      });
    }

    await logCallEvent({
      orgId,
      callSid,
      eventType: 'call_inbound_received',
      direction: 'inbound',
      payload: {
        fromNumber,
        toNumber,
        stage,
        callHandlingMode: receptionistProfile?.call_handling_mode || receptionistProfile?.receptionist_mode || null,
        conversationalPath: Boolean(receptionistProfile),
      },
    });

    const receptionistConfigured = Boolean(receptionistProfile?.receptionist_configured);

    // Get call_handling_mode (renamed from receptionist_mode)
    // Priority: call_handling_mode > receptionist_mode (legacy) > default
    let callHandlingMode = receptionistProfile?.call_handling_mode || receptionistProfile?.receptionist_mode;
    if (!callHandlingMode) {
      // Default to sms_links for new accounts, voicemail_only for unconfigured accounts
      callHandlingMode = receptionistConfigured ? 'sms_links' : 'voicemail_only';
    }

    // Legacy support: map old receptionist_mode values to new call_handling_mode
    const legacyModeMap = {
      'ai_only': 'ai_receptionist',
      'hybrid_choice': 'ai_receptionist', // For now, treat hybrid as AI until we implement the choice UI
      'voicemail_only': 'voicemail_only'
    };
    if (legacyModeMap[callHandlingMode]) {
      callHandlingMode = legacyModeMap[callHandlingMode];
    }

    // Check each service individually for better debugging
    const hasLLMProvider = Boolean(llmClient);
    const hasDeepgram = Boolean(deepgramClient);
    // Deepgram Voice Agent API handles both STT and TTS, so we only need Deepgram + LLM (Gemini)
    const conversationalPathAvailable = receptionistConfigured
      && receptionistEnabledGlobally
      && hasLLMProvider
      && hasDeepgram;

    // Comprehensive logging for debugging routing decisions
    console.log('[Telephony] Call routing decision:', {
      callSid,
      toNumber,
      fromNumber,
      hasReceptionistProfile: Boolean(receptionistProfile),
      receptionistConfigured,
      callHandlingMode,
      receptionistEnabledGlobally,
      hasLLM: hasLLMProvider,
      llmProvider: llmClient?.provider || 'unknown',
      hasDeepgram,
      conversationalPathAvailable,
      profileUserId: receptionistProfile?.id,
      profileGreeting: receptionistProfile?.receptionist_greeting ? 'present' : 'missing',
      profileVoice: receptionistProfile?.receptionist_voice || 'not set',
    });

    if (!receptionistProfile) {
      console.log('[Telephony] No receptionist profile found for number, routing to voicemail.', { toNumber });
      return respondWithVoicemail(req, res, inboundParams);
    }

    // Route based on call_handling_mode
    if (callHandlingMode === 'voicemail_only') {
      await logCallEvent({
        orgId,
        callSid,
        eventType: 'call_routed_voicemail',
        direction: 'inbound',
        payload: { reason: 'voicemail_only_mode', callHandlingMode },
      });
      console.log('[Telephony] Call handling mode is voicemail_only, routing to voicemail.', { callSid });
      return respondWithVoicemail(req, res, inboundParams);
    }

    if (callHandlingMode === 'sms_links') {
      // Mode A: SMS Link Follow-Up (IVR with booking/quote links)
      console.log('[Telephony] Call handling mode is sms_links, routing to IVR.', { callSid });

      // Fetch business profile for link configuration. Prefer org_id (the
      // multitenant key); fall back to user_id for accounts that only have
      // the denormalized row populated.
      const { data: businessProfile } = orgId
        ? await supabaseClient
            .from('business_profiles')
            .select('*')
            .eq('org_id', orgId)
            .maybeSingle()
            .catch(() => ({ data: null }))
        : await supabaseClient
            .from('business_profiles')
            .select('*')
            .eq('user_id', receptionistProfile.id)
            .maybeSingle()
            .catch(() => ({ data: null }));

      await logCallEvent({
        orgId,
        callSid,
        eventType: 'call_routed_ivr',
        direction: 'inbound',
        payload: {
          reason: 'sms_links_mode',
          callHandlingMode,
          hasBookingLink: Boolean(businessProfile?.booking_link_enabled && businessProfile?.booking_link_url),
          hasQuoteLink: Boolean(businessProfile?.quote_link_enabled && businessProfile?.quote_link_url)
        },
      });

      // Mode A IVR: play the booking/quote menu and collect one DTMF digit.
      const twilioIvr = require('./telephony/twilioIvrHandler');
      const twiml = await twilioIvr.generateIVRTwiML({
        businessProfile,
        userId: receptionistProfile.id,
        actionBaseUrl: ivrActionBaseUrl(),
      });

      res.type('text/xml');
      return res.send(twiml);
    }

    if (callHandlingMode === 'ai_receptionist') {
      // Mode B: AI Receptionist (existing behavior)
      // Check if conversational path is available
      if (!conversationalPathAvailable) {
        await logCallEvent({
          orgId,
          callSid,
          eventType: 'call_routed_voicemail',
          direction: 'inbound',
          payload: {
            reason: 'conversational_path_unavailable',
            receptionistConfigured,
            receptionistEnabledGlobally,
            hasLLM: hasLLMProvider,
            hasDeepgram,
          },
        });
        console.warn('[Telephony] AI receptionist unavailable, routing to voicemail.', {
          callSid,
          reason: {
            receptionistConfigured,
            receptionistEnabledGlobally,
            hasLLM: hasLLMProvider,
            hasDeepgram,
          },
        });
        return respondWithVoicemail(req, res, inboundParams);
      }

      // Continue to AI receptionist below (existing code)
    } else {
      // Unknown mode, fallback to voicemail
      console.warn('[Telephony] Unknown call handling mode, routing to voicemail.', { callHandlingMode, callSid });
      return respondWithVoicemail(req, res, inboundParams);
    }

    // Check subscription status before allowing AI receptionist
    if (orgId) {
      try {
        const { data: org, error: orgError } = await supabaseClient
          .from('organizations')
          .select('billing_plan_id, subscription_status')
          .eq('id', orgId)
          .single();

        if (orgError) {
          console.warn('[Telephony] Failed to check organization billing status.', { orgId, error: orgError });
        } else {
          const isPaidPlan = org?.billing_plan_id && org.billing_plan_id !== 'trial';
          const isActiveSubscription = ['active', 'trialing'].includes(org?.subscription_status);

          if (!isPaidPlan || !isActiveSubscription) {
            console.log('[Telephony] Organization subscription inactive, routing to voicemail.', {
              callSid,
              orgId,
              billingPlan: org?.billing_plan_id,
              subscriptionStatus: org?.subscription_status,
            });

            await logCallEvent({
              orgId,
              callSid,
              eventType: 'call_routed_voicemail',
              direction: 'inbound',
              payload: {
                reason: 'subscription_inactive',
                billingPlan: org?.billing_plan_id,
                subscriptionStatus: org?.subscription_status,
              },
            });

            return respondWithVoicemail(req, res, inboundParams);
          }
        }
      } catch (billingCheckError) {
        console.error('[Telephony] Error checking billing status.', { orgId, error: billingCheckError });
        // On error, allow call through to avoid breaking existing users
      }
    }

    if (callSid) {
      await upsertCallRecord({
        callSid,
        userId: receptionistProfile?.id || null,
        orgId,
        fromNumber,
        toNumber,
        status: 'ai_engaged',
      }).catch((error) => {
        console.warn('[Telephony] Failed to update call status to ai_engaged.', { callSid, error });
      });

      await logCallEvent({
        orgId,
        callSid,
        eventType: 'ai_receptionist_engaged',
        direction: 'inbound',
        payload: { callHandlingMode },
      });
    }

    return respondWithAiReceptionist({
      req,
      res,
      inboundParams,
      profile: receptionistProfile,
      callSid,
    });
  } catch (error) {
    console.error('[Telephony] Failed to process inbound voice request.', error);
    return respondWithVoicemail(req, res, inboundParams);
  }
};

app.post('/telephony/inbound-voice', handleInboundVoice);
app.get('/telephony/inbound-voice', handleInboundVoice);

// IVR endpoints for Mode A (SMS Link Follow-Up)
app.post('/ivr/handle-dtmf', async (req, res) => {
  const { Digits, CallSid, From } = req.body || {};
  const userId = req.query?.userId || null;

  console.log('[IVR] DTMF input received:', { digits: Digits, callSid: CallSid, from: From, userId });

  try {
    const twilioIvr = require('./telephony/twilioIvrHandler');
    const businessProfile = await twilioIvr.getBusinessProfileByUserId(userId);
    const { twiml } = await twilioIvr.handleDTMFInput({
      digits: Digits,
      businessProfile,
      userId,
      callSid: CallSid,
      fromNumber: From,
      actionBaseUrl: ivrActionBaseUrl(),
    });

    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    console.error('[IVR] Failed to handle DTMF input:', error);

    // Fallback to voicemail on error so the caller is still captured.
    const response = new twilio.twiml.VoiceResponse();
    response.say({ voice: 'Polly.Joanna' }, 'Sorry, there was an error. Please leave a message after the tone.');
    response.record({ action: buildRecordingCallbackUrl(req), method: 'POST', playBeep: true, maxLength: 300 });

    res.type('text/xml');
    res.send(response.toString());
  }
});

app.post('/ivr/timeout', async (req, res) => {
  const { CallSid } = req.body || {};
  const userId = req.query?.userId || null;

  console.log('[IVR] Timeout occurred:', { callSid: CallSid, userId });

  try {
    const twilioIvr = require('./telephony/twilioIvrHandler');
    const twiml = await twilioIvr.handleIVRTimeout({ actionBaseUrl: ivrActionBaseUrl() });

    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    console.error('[IVR] Failed to handle timeout:', error);

    const response = new twilio.twiml.VoiceResponse();
    response.say({ voice: 'Polly.Joanna' }, 'Thank you for calling. Goodbye.');
    response.hangup();

    res.type('text/xml');
    res.send(response.toString());
  }
});

app.post('/telephony/stream-status', async (req, res) => {
  const { CallSid, StreamSid, AccountSid, Status } = req.body || {};

  console.log('[Telephony] Stream status callback received:', {
    callSid: CallSid,
    streamSid: StreamSid,
    accountSid: AccountSid,
    status: Status,
    body: req.body,
  });

  res.status(200).send('OK');
});

app.post('/voice/profiles/:voiceProfileId/clone', authenticateJwt, async (req, res) => {
  if (!supabaseStorageClient) {
    console.error('[VoiceClone] Supabase client not configured');
    return res.status(500).json({ error: 'Voice cloning unavailable' });
  }

  if (!elevenLabsApiKey) {
    console.error('[VoiceClone] ELEVENLABS_API_KEY not configured');
    return res.status(500).json({ error: 'Voice cloning not configured' });
  }

  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const voiceProfileId = req.params.voiceProfileId;

  try {
    const { data: profile, error: fetchError } = await supabaseStorageClient
      .from('voice_profiles')
      .select('id, user_id, label, status, sample_path, voice_id, created_at, updated_at')
      .eq('id', voiceProfileId)
      .single();

    if (fetchError || !profile) {
      console.warn('[VoiceClone] Voice profile not found', { voiceProfileId, fetchError });
      return res.status(404).json({ error: 'Voice profile not found' });
    }

    if (profile.user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!profile.sample_path) {
      return res.status(400).json({ error: 'Voice sample missing' });
    }

    await supabaseStorageClient
      .from('voice_profiles')
      .update({ status: 'cloning', updated_at: new Date().toISOString() })
      .eq('id', voiceProfileId);

    const { data: sampleData, error: downloadError } = await supabaseStorageClient
      .storage
      .from(voiceProfileBucket)
      .download(profile.sample_path);

    if (downloadError || !sampleData) {
      console.error('[VoiceClone] Failed to download voice sample', { voiceProfileId, downloadError });
      await supabaseStorageClient
        .from('voice_profiles')
        .update({ status: 'error', updated_at: new Date().toISOString() })
        .eq('id', voiceProfileId);
      return res.status(500).json({ error: 'Failed to download voice sample' });
    }

    const sampleBuffer = Buffer.from(await sampleData.arrayBuffer());
    const fileName = path.basename(profile.sample_path) || `voice-sample-${voiceProfileId}.m4a`;

    const form = new FormData();
    form.append('name', profile.label || `Flynn voice ${voiceProfileId}`);
    if (elevenLabsModelId) {
      form.append('model_id', elevenLabsModelId);
    }

    let filePart;
    if (typeof File !== 'undefined') {
      filePart = new File([sampleBuffer], fileName, { type: 'audio/m4a' });
    } else if (typeof Blob !== 'undefined') {
      filePart = new Blob([sampleBuffer], { type: 'audio/m4a' });
    } else {
      filePart = sampleBuffer;
    }

    form.append('files', filePart, fileName);

    const formHeaders = typeof form.getHeaders === 'function' ? form.getHeaders() : undefined;

    const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: {
        'xi-api-key': elevenLabsApiKey,
        ...(formHeaders || {}),
      },
      body: form,
    });

    if (!response.ok) {
      const errorPayload = await response.text();
      console.error('[VoiceClone] ElevenLabs clone request failed', {
        status: response.status,
        body: errorPayload,
      });

      await supabaseStorageClient
        .from('voice_profiles')
        .update({ status: 'error', updated_at: new Date().toISOString() })
        .eq('id', voiceProfileId);

      return res.status(response.status).json({ error: 'Voice clone request failed', details: errorPayload });
    }

    const payload = await response.json();
    const voiceId = payload?.voice_id || payload?.voice?.id || payload?.voice?.voice_id || null;

    const { data: updatedProfile, error: updateError } = await supabaseStorageClient
      .from('voice_profiles')
      .update({
        status: voiceId ? 'ready' : 'processed',
        voice_id: voiceId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', voiceProfileId)
      .select('id, user_id, label, provider, status, sample_path, voice_id, created_at, updated_at')
      .single();

    if (updateError) {
      console.error('[VoiceClone] Failed to update voice profile after cloning', { updateError });
      return res.status(500).json({ error: 'Voice clone completed but failed to update profile' });
    }

    return res.json({ profile: updatedProfile, providerResponse: payload });
  } catch (error) {
    console.error('[VoiceClone] Unexpected error during cloning', { error });
    try {
      await supabaseStorageClient
        .from('voice_profiles')
        .update({ status: 'error', updated_at: new Date().toISOString() })
        .eq('id', voiceProfileId);
    } catch (updateError) {
      console.error('[VoiceClone] Failed to set error status on voice profile', { updateError });
    }

    return res.status(500).json({ error: 'Failed to clone voice profile' });
  }
});

app.post('/voice/preview', authenticateJwt, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { text, voiceOption, voiceProfileId } = req.body || {};

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'Preview text is required' });
  }

  if (!voiceOption || typeof voiceOption !== 'string') {
    return res.status(400).json({ error: 'Voice option is required' });
  }

  const providerPriority =
    voiceConfig.provider === 'gemini' ? ['gemini', 'azure', 'elevenlabs'] :
      voiceConfig.provider === 'azure' ? ['azure', 'gemini', 'elevenlabs'] :
        ['elevenlabs', 'gemini', 'azure'];

  const resolveVoiceForPreview = (provider) => {
    if (provider === 'gemini') {
      const presets = voiceConfig.gemini?.presetVoices || voiceConfig.presetVoices || {};
      return presets?.[voiceOption]
        || voiceConfig.gemini?.defaultVoice
        || presets.flynn_expert
        || presets.flynn_warm
        || Object.values(presets).find(Boolean)
        || 'Kore';
    }

    if (provider === 'azure') {
      const presets = voiceConfig.azure?.presetVoices || voiceConfig.presetVoices || {};
      return presets?.[voiceOption]
        || voiceConfig.azure?.defaultVoice
        || presets.flynn_warm
        || presets.flynn_expert
        || Object.values(presets).find(Boolean)
        || voiceConfig.azure?.defaultVoice
        || null;
    }

    if (provider === 'elevenlabs') {
      const presets = voiceConfig.elevenLabs?.presetVoices || voiceConfig.presetVoices || {};
      return presets?.[voiceOption]
        || presets.flynn_expert
        || presets.flynn_warm
        || Object.values(presets).find(Boolean)
        || null;
    }

    return null;
  };

  const synthesizeGeminiPreview = async (voiceName) => {
    const gemini = voiceConfig.gemini || {};
    if (!gemini.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const result = await generateGeminiSpeech(gemini.apiKey, text, {
      voiceName: voiceName || gemini.defaultVoice,
      model: gemini.model,
      outputFormat: 'wav',
      style: 'professional and friendly',
    });

    return {
      audio: result.audio,
      contentType: result.contentType,
    };
  };

  const synthesizeAzurePreview = async (voiceName) => {
    const azure = voiceConfig.azure || {};
    if (!azure.key || !(azure.endpoint || azure.region)) {
      throw new Error('Azure Speech credentials not configured');
    }

    const endpoint = azure.endpoint || `https://${azure.region}.tts.speech.microsoft.com/cognitiveservices/v1`;
    const headers = {
      'Ocp-Apim-Subscription-Key': azure.key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'FlynnAI-Preview/1.0',
    };

    if (!azure.endpoint && azure.region) {
      headers['Ocp-Apim-Subscription-Region'] = azure.region;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: buildAzureSsml(voiceName, text),
    });

    if (!response.ok) {
      throw new Error(await response.text() || `Azure TTS failed with status ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      audio: buffer.toString('base64'),
      contentType: response.headers.get('content-type') || 'audio/mpeg',
    };
  };

  const synthesizeElevenLabsPreview = async (voiceId) => {
    const eleven = voiceConfig.elevenLabs || {};
    if (!eleven.apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': eleven.apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: eleven.modelId || 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.8,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(await response.text() || `ElevenLabs preview failed with status ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      audio: buffer.toString('base64'),
      contentType: response.headers.get('content-type') || 'audio/mpeg',
    };
  };

  try {
    let voiceId;

    if (voiceOption === 'custom_voice') {
      if (voiceConfig.provider !== 'elevenlabs') {
        return res.status(400).json({ error: 'Custom voice previews are only supported for ElevenLabs voices.' });
      }

      if (!voiceProfileId) {
        return res.status(400).json({ error: 'Custom voice profile is required' });
      }

      if (!supabaseStorageClient) {
        console.error('[VoicePreview] Supabase client not configured');
        return res.status(500).json({ error: 'Voice preview unavailable' });
      }

      const { data: profile, error: profileError } = await supabaseStorageClient
        .from('voice_profiles')
        .select('id, user_id, status, voice_id')
        .eq('id', voiceProfileId)
        .single();

      if (profileError || !profile) {
        console.warn('[VoicePreview] Voice profile not found', { voiceProfileId, profileError });
        return res.status(404).json({ error: 'Voice profile not found' });
      }

      if (profile.user_id !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      if (profile.status !== 'ready' || !profile.voice_id) {
        return res.status(400).json({ error: 'Voice profile is not ready for playback' });
      }

      voiceId = profile.voice_id;
      const preview = await synthesizeElevenLabsPreview(voiceId);
      return res.json(preview);
    }

    for (const provider of providerPriority) {
      try {
        if (provider === 'gemini') {
          const voiceName = resolveVoiceForPreview('gemini');
          if (!voiceName) {
            continue;
          }
          const preview = await synthesizeGeminiPreview(voiceName);
          return res.json(preview);
        }

        if (provider === 'azure') {
          const voiceName = resolveVoiceForPreview('azure');
          if (!voiceName) {
            continue;
          }
          const preview = await synthesizeAzurePreview(voiceName);
          return res.json(preview);
        }

        if (provider === 'elevenlabs') {
          const presetVoiceId = resolveVoiceForPreview('elevenlabs');
          if (!presetVoiceId) {
            continue;
          }
          const preview = await synthesizeElevenLabsPreview(presetVoiceId);
          return res.json(preview);
        }
      } catch (error) {
        console.error(`[VoicePreview] ${provider} preview failed`, { error: error.message || error });
      }
    }

    return res.status(500).json({ error: 'Voice preview failed' });
  } catch (error) {
    console.error('[VoicePreview] Unexpected error', { error });
    return res.status(500).json({ error: 'Failed to generate voice preview' });
  }
});

app.get('/telephony/calls/:callSid/recording', authenticateJwt, async (req, res) => {
  const callSid = req.params?.callSid;

  if (!callSid) {
    return res.status(400).json({ error: 'CallSid is required' });
  }

  try {
    const userId = req.user?.id;
    const callRecord = await getCallBySid(callSid);

    if (!callRecord || (callRecord.user_id && callRecord.user_id !== userId)) {
      return res.status(404).json({ error: 'Call not found' });
    }

    if (!callRecord.recording_storage_path) {
      return res.status(404).json({ error: 'No stored recording for this call' });
    }

    if (!supabaseStorageClient) {
      console.error('[Telephony] Supabase storage client is not configured; cannot issue signed URL.');
      return res.status(500).json({ error: 'Voicemail storage unavailable' });
    }

    const { signedUrl, expiresAt } = await createSignedUrlForPath(callRecord.recording_storage_path);

    await updateCallRecordingSignedUrl({
      callSid,
      signedUrl,
      signedExpiresAt: expiresAt,
    });

    return res.status(200).json({
      callSid,
      signedUrl,
      expiresAt,
    });
  } catch (error) {
    console.error('[Telephony] Failed to generate signed voicemail URL.', { callSid, error });
    return res.status(500).json({ error: 'Failed to generate voicemail URL' });
  }
});

app.post('/telephony/recording-complete', async (req, res) => {
  console.log('[Telephony] Recording complete webhook request received.');

  try {
    if (shouldValidateSignature && twilioAuthToken) {
      const signature = req.headers['x-twilio-signature'];
      if (!signature) {
        console.warn('[Telephony] Missing X-Twilio-Signature header on recording complete request.');
        return res.status(403).send('Twilio signature missing');
      }

      const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      const isValid = twilio.validateRequest(twilioAuthToken, signature, url, req.body);

      if (!isValid) {
        console.warn('[Telephony] Twilio signature validation failed for recording complete webhook.', {
          url,
          signature,
        });
        return res.status(403).send('Twilio signature validation failed');
      }
    } else if (!twilioAuthToken) {
      console.warn('[Telephony] TWILIO_AUTH_TOKEN is not set; skipping signature validation.');
    } else {
      console.warn('[Telephony] Twilio signature validation disabled via TWILIO_VALIDATE_SIGNATURE=false.');
    }

    const {
      CallSid,
      From,
      To,
      RecordingSid,
      RecordingUrl,
      RecordingDuration,
      Timestamp,
    } = req.body || {};

    if (!CallSid) {
      console.warn('[Telephony] Recording complete payload missing CallSid.');
      return res.status(400).json({ error: 'CallSid is required' });
    }

    console.log('[Telephony] Recording metadata received:', {
      CallSid,
      From,
      To,
      RecordingSid,
      RecordingUrl,
      RecordingDuration,
      Timestamp,
    });

    const durationSec = Number.isFinite(Number(RecordingDuration)) ? Number(RecordingDuration) : null;
    const recordedAt = Timestamp || new Date().toISOString();

    if (!supabaseStorageClient) {
      console.error('[Telephony] Supabase storage client is not configured; cannot store voicemail.');
      await upsertCallRecord({
        callSid: CallSid,
        fromNumber: From,
        toNumber: To,
        recordingSid: RecordingSid,
        durationSec,
        recordedAt,
        status: 'failed',
      });
      await updateCallTranscriptionStatus({ callSid: CallSid, status: 'failed' }).catch(() => { });
      return res.status(500).json({ error: 'Voicemail storage unavailable' });
    }

    if (!RecordingUrl) {
      console.warn('[Telephony] RecordingUrl missing from webhook payload.');
      await upsertCallRecord({
        callSid: CallSid,
        fromNumber: From,
        toNumber: To,
        recordingSid: RecordingSid,
        durationSec,
        recordedAt,
        status: 'failed',
      });
      await updateCallTranscriptionStatus({ callSid: CallSid, status: 'failed' }).catch(() => { });
      return res.status(400).json({ error: 'RecordingUrl is required' });
    }

    let recordingResponse;
    let resolvedUrl;
    let storageMetadata;

    try {
      ({ response: recordingResponse, resolvedUrl } = await downloadTwilioRecording(RecordingUrl, RecordingSid));
      storageMetadata = await persistRecordingToSupabaseStorage({
        callSid: CallSid,
        recordingSid: RecordingSid,
        resolvedUrl,
        response: recordingResponse.clone(),
      });
    } catch (storageError) {
      console.error('[Telephony] Failed to persist voicemail recording.', {
        callSid: CallSid,
        error: storageError,
      });

      await upsertCallRecord({
        callSid: CallSid,
        fromNumber: From,
        toNumber: To,
        recordingSid: RecordingSid,
        durationSec,
        recordedAt,
        status: 'failed',
      });

      await updateCallTranscriptionStatus({ callSid: CallSid, status: 'failed' }).catch(() => { });

      return res.status(500).json({ error: 'Failed to store recording' });
    }

    await upsertCallRecord({
      callSid: CallSid,
      fromNumber: From,
      toNumber: To,
      recordingUrl: storageMetadata?.signedUrl,
      recordingSid: RecordingSid,
      recordingStoragePath: storageMetadata?.storagePath,
      recordingSignedExpiresAt: storageMetadata?.signedExpiresAt,
      recordingExpiresAt: storageMetadata?.recordingExpiresAt,
      durationSec,
      recordedAt,
      status: 'active',
    });

    let callEventContext = null;
    try {
      callEventContext = await getCallBySid(CallSid);
    } catch (contextError) {
      console.warn('[Telephony] Unable to load call context for recording event.', {
        callSid: CallSid,
        error: contextError,
      });
    }

    await logCallEvent({
      orgId: callEventContext?.org_id || null,
      callSid: CallSid,
      eventType: 'recording_stored',
      direction: 'inbound',
      payload: {
        durationSec,
        recordingSid: RecordingSid,
        storagePath: storageMetadata?.storagePath,
      },
    });

    scheduleRetentionSweep();

    const existingTranscript = await getTranscriptByCallSid(CallSid);
    if (existingTranscript) {
      console.log('[Telephony] Transcript already exists for call; skipping regeneration.');
      await updateCallTranscriptionStatus({ callSid: CallSid, status: 'completed' });
      return res.status(200).json({ status: 'transcribed' });
    }

    if (!transcriptionClient || !transcriptionClient.audio || !transcriptionClient.audio.transcriptions) {
      console.error('[Telephony] No transcription provider configured; cannot transcribe.');
      await updateCallTranscriptionStatus({ callSid: CallSid, status: 'failed' });
      return res.status(500).json({ error: 'Transcription service unavailable' });
    }

    await updateCallTranscriptionStatus({ callSid: CallSid, status: 'processing' });

    try {
      const fileNameBase = RecordingSid || CallSid || 'recording';
      const extension = storageMetadata?.extension || inferAudioExtension(resolvedUrl, recordingResponse);
      const fileName = extension ? `${fileNameBase}.${extension}` : fileNameBase;
      const contentType = storageMetadata?.contentType || recordingResponse.headers.get('content-type') || undefined;

      const audioFile = await toFile(recordingResponse, fileName, contentType ? { type: contentType } : undefined);

      const transcriptionResponse = await transcriptionClient.audio.transcriptions.create({
        file: audioFile,
        model: 'gpt-4o-mini-transcribe',
      });

      const transcriptText = (transcriptionResponse && transcriptionResponse.text) ? transcriptionResponse.text.trim() : '';
      const transcriptLanguage = transcriptionResponse && transcriptionResponse.language
        ? transcriptionResponse.language
        : 'en';

      if (!transcriptText) {
        throw new Error('Transcription response did not include text.');
      }

      await insertTranscription({
        id: randomUUID(),
        callSid: CallSid,
        userId: callEventContext?.user_id || null,
        orgId: callEventContext?.org_id || null,
        engine: 'whisper',
        text: transcriptText,
        confidence: 0.8,
        language: transcriptLanguage,
      });

      await updateCallTranscriptionStatus({ callSid: CallSid, status: 'completed' });

      await logCallEvent({
        orgId: callEventContext?.org_id || null,
        callSid: CallSid,
        eventType: 'transcription_completed',
        direction: 'inbound',
        payload: {
          recordingSid: RecordingSid,
          transcriptLength: transcriptText.length,
          language: transcriptLanguage,
        },
      });

      console.log('[Telephony] Transcription stored successfully for call.', { callSid: CallSid });

      if (llmClient) {
        try {
          await ensureJobForTranscript({
            callSid: CallSid,
            transcriptText,
            llmClient,
          });
        } catch (jobCreationError) {
          console.error('[Jobs] Failed to create job from transcript.', {
            callSid: CallSid,
            error: jobCreationError,
          });

          await logCallEvent({
            orgId: callEventContext?.org_id || null,
            callSid: CallSid,
            eventType: 'job_creation_failed',
            direction: 'inbound',
            payload: { reason: jobCreationError?.message || 'unknown' },
          });
        }
      } else {
        console.warn('[Jobs] Skipping job creation; no LLM client configured.', { callSid: CallSid });
      }

      return res.status(200).json({ status: 'transcribed' });
    } catch (transcriptionError) {
      console.error('[Telephony] Failed to transcribe recording.', {
        callSid: CallSid,
        error: transcriptionError,
      });
      await updateCallTranscriptionStatus({ callSid: CallSid, status: 'failed' });

      await logCallEvent({
        orgId: callEventContext?.org_id || null,
        callSid: CallSid,
        eventType: 'transcription_failed',
        direction: 'inbound',
        payload: {
          recordingSid: RecordingSid,
          error: transcriptionError?.message || 'unknown',
        },
      });
      return res.status(500).json({ error: 'Failed to transcribe recording' });
    }
  } catch (error) {
    console.error('[Telephony] Failed to handle recording complete webhook:', error);
    return res.status(500).json({ error: 'Failed to process recording' });
  }
});

app.post('/me/notifications/token', authenticateJwt, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { token, platform } = req.body || {};
  const trimmedToken = typeof token === 'string' ? token.trim() : '';
  const normalizedPlatform = typeof platform === 'string' ? platform.toLowerCase() : '';

  if (!trimmedToken) {
    return res.status(400).json({ error: 'token is required' });
  }

  if (!['ios', 'android'].includes(normalizedPlatform)) {
    return res.status(400).json({ error: 'platform must be ios or android' });
  }

  try {
    await upsertNotificationToken({ userId, platform: normalizedPlatform, token: trimmedToken });
    return res.status(204).end();
  } catch (error) {
    console.error('[Notifications] Failed to upsert notification token.', { userId, error });
    return res.status(500).json({ error: 'Failed to register device token' });
  }
});

app.post('/api/notifications/trial-expiry', async (req, res) => {
  const { userId, email, daysRemaining } = req.body || {};

  if (!userId || !email || typeof daysRemaining !== 'number') {
    return res.status(400).json({ error: 'userId, email, and daysRemaining are required' });
  }

  if (!resendClient) {
    console.error('[TrialExpiry] Resend client not configured');
    return res.status(500).json({ error: 'Email service not configured' });
  }

  try {
    const htmlContent = getTrialExpiryEmailHTML(daysRemaining);
    const subject = daysRemaining === 5
      ? 'Your Flynn AI trial ends in 5 days'
      : daysRemaining === 1
      ? 'Your Flynn AI trial ends tomorrow!'
      : 'Your Flynn AI trial has ended';

    await resendClient.emails.send({
      from: fromEmail,
      to: email,
      subject,
      html: htmlContent,
    });

    console.log(`[TrialExpiry] Email sent to ${email} (${daysRemaining} days remaining)`);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[TrialExpiry] Failed to send email:', error);
    return res.status(500).json({ error: 'Failed to send trial expiry email' });
  }
});

app.post('/me/account/delete', authenticateJwt, async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!supabaseStorageClient) {
    return res.status(503).json({ error: 'Account deletion is not available right now' });
  }

  try {
    await deleteUserData(userId);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[AccountDeletion] Failed to delete account', { userId, error });
    return res.status(500).json({ error: 'Failed to delete account' });
  }
});

app.get('/jobs', authenticateJwt, async (req, res) => {
  const userId = req.user.id;
  const statusParam = typeof req.query.status === 'string' ? req.query.status.trim() : undefined;
  const normalizedStatus = statusParam ? statusParam.toLowerCase() : undefined;

  if (normalizedStatus && !JOB_STATUS_VALUES.has(normalizedStatus)) {
    return res.status(400).json({ error: 'Invalid status filter' });
  }

  const limitParam = typeof req.query.limit === 'string' ? req.query.limit : undefined;
  const offsetParam = typeof req.query.offset === 'string' ? req.query.offset : undefined;

  const parsedLimit = Number.parseInt(limitParam ?? '', 10);
  const parsedOffset = Number.parseInt(offsetParam ?? '', 10);

  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.min(parsedLimit, 100)
    : 20;
  const offset = Number.isFinite(parsedOffset) && parsedOffset >= 0
    ? parsedOffset
    : 0;

  try {
    const jobs = await listJobsForUser({
      userId,
      status: normalizedStatus,
      limit,
      offset,
    });

    return res.status(200).json({
      jobs,
      pagination: {
        limit,
        offset,
        count: jobs.length,
      },
    });
  } catch (error) {
    console.error('[Jobs] Failed to list jobs.', {
      userId,
      error,
    });
    return res.status(500).json({ error: 'Failed to load jobs' });
  }
});

app.get('/jobs/:id', authenticateJwt, async (req, res) => {
  const userId = req.user.id;
  const jobId = req.params?.id;

  if (!jobId) {
    return res.status(400).json({ error: 'Job ID is required' });
  }

  try {
    const job = await getJobForUser({ jobId, userId });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    return res.status(200).json({ job });
  } catch (error) {
    console.error('[Jobs] Failed to fetch job.', {
      userId,
      jobId,
      error,
    });
    return res.status(500).json({ error: 'Failed to load job' });
  }
});

app.patch('/jobs/:id', authenticateJwt, async (req, res) => {
  const userId = req.user.id;
  const jobId = req.params?.id;

  if (!jobId) {
    return res.status(400).json({ error: 'Job ID is required' });
  }

  const requestedStatus = req.body && typeof req.body.status === 'string'
    ? req.body.status.trim().toLowerCase()
    : undefined;

  if (!requestedStatus) {
    return res.status(400).json({ error: 'Status is required' });
  }

  if (!JOB_STATUS_VALUES.has(requestedStatus)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  try {
    const updatedJob = await updateJobStatusForUser({
      jobId,
      userId,
      status: requestedStatus,
    });

    if (!updatedJob) {
      return res.status(404).json({ error: 'Job not found' });
    }

    return res.status(200).json({ job: updatedJob });
  } catch (error) {
    console.error('[Jobs] Failed to update job status.', {
      userId,
      jobId,
      requestedStatus,
      error,
    });
    return res.status(500).json({ error: 'Failed to update job' });
  }
});

app.post('/jobs/:id/notify', authenticateJwt, async (req, res) => {
  const userId = req.user?.id;
  const jobId = req.params?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!jobId) {
    return res.status(400).json({ error: 'Job ID is required' });
  }

  try {
    const job = await getJobById(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.user_id && job.user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await sendJobCreatedNotification({ userId: job.user_id, job });
    return res.status(200).json(result);
  } catch (error) {
    console.error('[Notifications] Failed to send job notification.', { jobId, error });
    return res.status(500).json({ error: 'Failed to send notification' });
  }
});

app.post('/jobs/:id/confirm', async (req, res) => {
  const jobId = req.params?.id;

  if (!jobId) {
    return res.status(400).json({ error: 'Job ID is required' });
  }

  if (!twilioMessagingClient) {
    console.error('[Jobs] Twilio messaging client unavailable; cannot send confirmation SMS.');
    return res.status(500).json({ error: 'Messaging not configured' });
  }

  try {
    const jobRecord = await getJobById(jobId);

    if (!jobRecord) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (!jobRecord.customer_phone) {
      return res.status(400).json({ error: 'Job is missing customer_phone' });
    }

    const smsBody = "Hi, we received your voicemail and created a job card. We'll be in touch soon.";

    await sendConfirmationSms({
      to: jobRecord.customer_phone,
      body: smsBody,
    });

    console.log('[Jobs] Confirmation SMS queued.', {
      jobId: jobRecord.id,
      callSid: jobRecord.call_sid,
    });

    return res.status(200).json({ status: 'queued' });
  } catch (error) {
    console.error('[Jobs] Failed to send confirmation SMS.', {
      jobId,
      error,
    });

    if (error && error.message && /configure/i.test(error.message)) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(500).json({ error: 'Failed to send confirmation SMS' });
  }
});

// ============================================================================
// SECURE API ENDPOINTS FOR MOBILE APP
// ============================================================================

const attachSecureApiRoutes = require('./secureApiRoutes');
attachSecureApiRoutes(app, {
  twilioAccountSid,
  twilioAuthToken,
  twilioSmsFromNumber,
  authenticateJwt,
  getLLMClient,
  twilio,
});

// ============================================================================
// Stripe Subscription Management Routes
// ============================================================================
const attachStripeSubscriptionRoutes = require('./routes/stripeRoutes');
attachStripeSubscriptionRoutes(app, {
  authenticateJwt,
  supabaseAdmin: supabaseStorageClient,
});

// ============================================================================
// Reminder System API Endpoints
// ============================================================================

// GET /api/reminders/settings - Get reminder settings for organization
app.get('/api/reminders/settings', authenticateJwt, async (req, res) => {
  try {
    const orgId = req.user?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    const { data, error } = await supabaseStorageClient
      .from('reminder_settings')
      .select('*')
      .eq('org_id', orgId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = not found, which is OK
      throw error;
    }

    // Return default settings if none exist
    if (!data) {
      return res.status(200).json({
        enabled: true,
        default_enabled: true,
        confirmation_enabled: true,
        one_day_before_enabled: true,
        one_day_before_time: '18:00',
        morning_of_enabled: false,
        morning_of_time: '08:00',
        two_hours_before_enabled: false,
        custom_reminders: [],
        skip_weekends_for_morning: false,
        respect_quiet_hours: true,
        quiet_hours_start: '21:00',
        quiet_hours_end: '08:00',
        post_job_enabled: false,
        post_job_delay_hours: 2,
        confirmation_template: 'Hi {{clientName}}! Your {{serviceType}} appointment is confirmed for {{date}} at {{time}} at {{location}}. Reply YES to confirm.',
        one_day_before_template: 'Hi {{clientName}}! Reminder: We\'ll see you tomorrow at {{time}} for {{serviceType}} at {{location}}.',
        morning_of_template: 'Good morning {{clientName}}! We\'re looking forward to seeing you today at {{time}} for {{serviceType}}.',
        two_hours_before_template: 'Hi {{clientName}}! We\'ll be there in about 2 hours for your {{serviceType}} appointment.',
        on_the_way_template: 'Hi {{clientName}}! We\'re on our way to your location. We\'ll arrive in approximately {{eta}} minutes.',
        post_job_template: 'Thanks for choosing {{businessName}}! Your job is complete. We\'d love your feedback!',
      });
    }

    res.status(200).json(data);
  } catch (error) {
    console.error('[Reminders] Error fetching reminder settings:', error);
    res.status(500).json({ error: 'Failed to fetch reminder settings' });
  }
});

// PUT /api/reminders/settings - Update reminder settings
app.put('/api/reminders/settings', authenticateJwt, async (req, res) => {
  try {
    const orgId = req.user?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    const settings = req.body;

    const { data, error } = await supabaseStorageClient
      .from('reminder_settings')
      .upsert({
        org_id: orgId,
        ...settings,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log('[Reminders] Settings updated for org:', orgId);
    res.status(200).json(data);
  } catch (error) {
    console.error('[Reminders] Error updating reminder settings:', error);
    res.status(500).json({ error: 'Failed to update reminder settings' });
  }
});

// GET /api/jobs/:jobId/reminders - List reminders for a job
app.get('/api/jobs/:jobId/reminders', authenticateJwt, async (req, res) => {
  try {
    const { jobId } = req.params;
    const orgId = req.user?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    const { data, error } = await supabaseStorageClient
      .from('scheduled_reminders')
      .select('*')
      .eq('org_id', orgId)
      .eq('job_id', jobId)
      .order('scheduled_for', { ascending: true });

    if (error) {
      throw error;
    }

    res.status(200).json(data || []);
  } catch (error) {
    console.error('[Reminders] Error fetching job reminders:', error);
    res.status(500).json({ error: 'Failed to fetch job reminders' });
  }
});

// POST /api/jobs/:jobId/reminders/reschedule - Reschedule reminders for a job
app.post('/api/jobs/:jobId/reminders/reschedule', authenticateJwt, async (req, res) => {
  try {
    const { jobId } = req.params;
    const orgId = req.user?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    const result = await reminderScheduler.scheduleRemindersForJob(jobId, orgId);

    console.log('[Reminders] Rescheduled reminders for job:', jobId);
    res.status(200).json(result);
  } catch (error) {
    console.error('[Reminders] Error rescheduling reminders:', error);
    res.status(500).json({ error: 'Failed to reschedule reminders' });
  }
});

// POST /api/jobs/:jobId/reminders/on-the-way - Send "on the way" notification
app.post('/api/jobs/:jobId/reminders/on-the-way', authenticateJwt, async (req, res) => {
  try {
    const { jobId } = req.params;
    const { eta = 15 } = req.body;

    const result = await reminderScheduler.sendOnTheWayNotification(jobId, eta);

    console.log('[Reminders] Sent on-the-way notification for job:', jobId);
    res.status(200).json(result);
  } catch (error) {
    console.error('[Reminders] Error sending on-the-way notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// DELETE /api/reminders/:reminderId - Cancel a reminder
app.delete('/api/reminders/:reminderId', authenticateJwt, async (req, res) => {
  try {
    const { reminderId } = req.params;
    const orgId = req.user?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    const { error } = await supabaseStorageClient
      .from('scheduled_reminders')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', reminderId)
      .eq('org_id', orgId);

    if (error) {
      throw error;
    }

    console.log('[Reminders] Cancelled reminder:', reminderId);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Reminders] Error cancelling reminder:', error);
    res.status(500).json({ error: 'Failed to cancel reminder' });
  }
});

// GET /api/reminders/stats - Get reminder statistics
app.get('/api/reminders/stats', authenticateJwt, async (req, res) => {
  try {
    const orgId = req.user?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    const { startDate, endDate } = req.query;
    const stats = await reminderScheduler.getReminderStats(
      orgId,
      startDate ? new Date(startDate).toISOString() : null,
      endDate ? new Date(endDate).toISOString() : null
    );

    res.status(200).json(stats);
  } catch (error) {
    console.error('[Reminders] Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch reminder statistics' });
  }
});

// ============================================================================
// Integration OAuth Callbacks
// ============================================================================

// Google Calendar OAuth — connect initiation.
// The app calls this (authed) to get the Google consent URL, then opens it in an
// ASWebAuthenticationSession. `state` carries the org_id so the callback can
// store the tokens against the right org. Scopes are minimal: read free/busy +
// write the events the user confirms.
const GOOGLE_CAL_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ');

app.get('/api/integrations/google-calendar/connect', authenticateJwt, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  const redirectUri = process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return res.status(500).json({ error: 'Google Calendar OAuth is not configured on the server' });
  }

  const orgId = await resolveOrgIdForUser(userId);
  if (!orgId) return res.status(400).json({ error: 'No organization found for user' });

  const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_CAL_SCOPES,
    access_type: 'offline',     // get a refresh_token
    prompt: 'consent',          // force refresh_token even on re-consent
    include_granted_scopes: 'true',
    state: String(orgId),
  }).toString();

  res.json({ authUrl });
});

// Renders the OAuth callback landing page. It bounces straight back into the
// Flynn app via the `flynnai://` scheme — ASWebAuthenticationSession intercepts
// that navigation and closes the sheet — with a visible fallback link for any
// other browser.
const calendarCallbackPage = ({ ok, title, message }) => {
  const deepLink = `flynnai://calendar-connected?status=${ok ? 'success' : 'error'}`;
  return `<!doctype html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1">
<script>setTimeout(function(){ window.location.href = ${JSON.stringify(deepLink)}; }, 50);</script>
</head>
<body style="font-family: system-ui; padding: 40px; text-align: center;">
  <div style="max-width: 480px; margin: 0 auto;">
    <h1 style="color:#1e293b; margin-bottom:12px;">${title}</h1>
    <p style="color:#64748b; font-size:16px; line-height:1.5;">${message}</p>
    <p style="margin-top:24px;"><a href="${deepLink}" style="color:#2563EB; font-weight:600;">Return to Flynn</a></p>
  </div>
</body></html>`;
};

// Google Calendar OAuth Callback
app.get('/api/integrations/google-calendar/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    console.error('[GoogleCalendar] OAuth error:', error);
    return res.status(400).send(calendarCallbackPage({
      ok: false,
      title: 'Authorization Failed',
      message: 'Google Calendar wasn’t connected. You can close this window and try again.',
    }));
  }

  if (!code) {
    return res.status(400).send(`
      <html>
        <body style="font-family: system-ui; padding: 40px; text-align: center;">
          <h1>Missing Authorization Code</h1>
          <p>No authorization code received from Google.</p>
          <p>You can close this window and try again.</p>
        </body>
      </html>
    `);
  }

  try {
    // Exchange authorization code for tokens
    const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
    const GOOGLE_REDIRECT_URI = process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI;

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
      throw new Error('Google Calendar OAuth credentials not configured');
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      throw new Error(`Token exchange failed: ${errorData.error_description || errorData.error}`);
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokens;

    // Get calendar info
    const calendarResponse = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
      },
    });

    if (!calendarResponse.ok) {
      throw new Error('Failed to fetch calendar info');
    }

    const calendarInfo = await calendarResponse.json();

    // Parse org_id from state parameter
    const orgId = state;
    if (!orgId) {
      throw new Error('Missing organization ID in state parameter');
    }

    // Calculate expiry timestamp
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Save connection to database
    const { data: connection, error: dbError } = await supabaseStorageClient
      .from('integration_connections')
      .upsert({
        org_id: orgId,
        provider: 'google_calendar',
        type: 'calendar',
        status: 'connected',
        access_token,
        refresh_token,
        token_expires_at: expiresAt,
        account_id: calendarInfo.id,
        account_name: calendarInfo.summary,
        metadata: {
          id: calendarInfo.id,
          summary: calendarInfo.summary,
          timeZone: calendarInfo.timeZone,
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'org_id,provider' })
      .select()
      .single();

    if (dbError) {
      console.error('[GoogleCalendar] Database error:', dbError);
      throw new Error('Failed to save calendar connection');
    }

    // Flip the per-user flag the iOS app reads from `users` so the
    // dashboard / settings calendar prompt accurately reflects "connected".
    try {
      const { data: orgUsers } = await supabaseStorageClient
        .from('users')
        .select('id')
        .eq('default_org_id', orgId);
      if (orgUsers && orgUsers.length) {
        await supabaseStorageClient
          .from('users')
          .update({ google_calendar_connected: true, calendar_sync_enabled: true })
          .in('id', orgUsers.map(u => u.id));
      }
    } catch (flagErr) {
      console.warn('[GoogleCalendar] Failed to flip user flags:', flagErr.message);
    }

    console.log('[GoogleCalendar] Connection saved successfully:', {
      orgId,
      calendarName: calendarInfo.summary,
    });

    // Success — bounce back into the app.
    res.send(calendarCallbackPage({
      ok: true,
      title: 'Calendar Connected!',
      message: `Your Google Calendar “${calendarInfo.summary}” is connected. Returning to Flynn…`,
    }));
  } catch (error) {
    console.error('[GoogleCalendar] OAuth callback error:', error);
    res.status(500).send(calendarCallbackPage({
      ok: false,
      title: 'Connection Failed',
      message: 'Something went wrong connecting Google Calendar. You can close this window and try again.',
    }));
  }
});

if (require.main === module) {
  const httpServer = http.createServer(app);

  // Wrap WebSocket setup in try-catch to prevent startup failures
  if (receptionistEnabledGlobally) {
    try {
      attachRealtimeServer({
        httpServer,
        sessionCache: receptionistSessionCache,
        deepgramClient,
        onConversationComplete: handleRealtimeConversationComplete,
        getBusinessContextForOrg,
        getBusinessContextForUser,
        resolveOrgIdForUser,
      });
      console.log('[Server] Realtime WebSocket server attached successfully');
    } catch (error) {
      console.error('[Server] Failed to attach realtime server, continuing without it:', error.message);
    }
  } else {
    console.log('[Server] Realtime receptionist disabled via ENABLE_CONVERSATION_ORCHESTRATOR');
  }

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`[Server] FlynnAI telephony server listening on port ${port}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[Server] Health check available at http://localhost:${port}/health`);
  });

  httpServer.on('error', (error) => {
    console.error('[Server] Failed to start HTTP server:', error);
    process.exit(1);
  });

  // ============================================================================
  // Cron Job: Process Pending Reminders
  // ============================================================================

  const bookingReminderScheduler = require('./services/bookingReminderScheduler');
  const reengagementScheduler = require('./services/reengagementScheduler');
  const groupDigestScheduler = require('./services/groupAgent/digestScheduler');

  // Process reminders every minute
  setInterval(async () => {
    try {
      await reminderScheduler.processPendingReminders();
      await bookingReminderScheduler.processPendingBookingReminders();
      // Re-engage stalled signups (internally throttled to ~10 min between sweeps).
      await reengagementScheduler.processReengagement();
      // Group note-taker: batch-extract action items + send the daily boss digest
      // (internally throttled to ~3 min between sweeps).
      await groupDigestScheduler.processTick();
    } catch (error) {
      console.error('[Cron] Reminder processor error:', error);
    }
  }, 60 * 1000); // Every 60 seconds

  console.log('[Server] Reminder processor scheduled (runs every 60 seconds)');
}

// ============================================================================
// Quotes & Invoices — PDF generation + SMS sending
// ============================================================================

const buildBusinessHeader = (org, user) => ({
  business_name: org?.business_name || user?.full_name || 'Flynn',
  business_phone: org?.phone_number || user?.phone || '',
  business_email: org?.email || user?.email || '',
  business_address: org?.address || '',
});

const buildDocumentHTML = (kind, doc) => {
  const items = (doc.line_items || []).map(li =>
    `<tr><td>${escapeHtml(li.description)}</td><td>${li.quantity}</td><td>$${(li.unit_price || 0).toFixed(2)}</td><td>$${(li.total || 0).toFixed(2)}</td></tr>`
  ).join('');
  const isInvoice = kind === 'invoice';
  const dateLabel = isInvoice ? 'Due' : 'Valid until';
  const dateValue = isInvoice ? doc.due_date : doc.valid_until;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1E293B;padding:40px}
    .header{display:flex;justify-content:space-between;border-bottom:3px solid #ff4500;padding-bottom:20px;margin-bottom:30px}
    .biz-name{font-size:28px;font-weight:700;color:#1E293B}
    .doc-title{font-size:36px;font-weight:700;color:#ff4500;text-transform:uppercase}
    .doc-num{color:#64748B;margin-top:4px}
    .meta{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:30px}
    .meta-block h3{font-size:11px;text-transform:uppercase;color:#64748B;margin-bottom:6px}
    table{width:100%;border-collapse:collapse;margin:24px 0}
    th{background:#F8FAFC;text-align:left;padding:12px;font-size:12px;text-transform:uppercase;color:#475569;border-bottom:2px solid #E2E8F0}
    td{padding:12px;border-bottom:1px solid #E2E8F0;font-size:14px}
    .totals{margin-left:auto;width:300px;margin-top:24px}
    .totals-row{display:flex;justify-content:space-between;padding:8px 0;font-size:14px}
    .totals-row.grand{border-top:2px solid #1E293B;font-size:18px;font-weight:700;padding-top:14px;margin-top:8px}
    .notes{margin-top:40px;padding:16px;background:#F8FAFC;border-left:3px solid #ff4500;font-size:13px;color:#475569}
    .footer{margin-top:60px;padding-top:20px;border-top:1px solid #E2E8F0;text-align:center;color:#94A3B8;font-size:11px}
  </style></head><body>
  <div class="header">
    <div>
      <div class="biz-name">${escapeHtml(doc.business_name)}</div>
      ${doc.business_phone ? `<div style="color:#64748B;font-size:13px;margin-top:4px">${escapeHtml(doc.business_phone)}</div>` : ''}
      ${doc.business_email ? `<div style="color:#64748B;font-size:13px">${escapeHtml(doc.business_email)}</div>` : ''}
    </div>
    <div style="text-align:right">
      <div class="doc-title">${isInvoice ? 'Invoice' : 'Quote'}</div>
      <div class="doc-num">${escapeHtml(doc.number)}</div>
    </div>
  </div>
  <div class="meta">
    <div class="meta-block"><h3>Bill to</h3>
      <div style="font-weight:600">${escapeHtml(doc.customer_name || 'Customer')}</div>
      ${doc.customer_phone ? `<div style="color:#64748B;font-size:13px">${escapeHtml(doc.customer_phone)}</div>` : ''}
    </div>
    <div class="meta-block" style="text-align:right">
      <h3>${isInvoice ? 'Issued' : 'Date'}</h3>
      <div>${formatDate(doc.issued_date)}</div>
      ${dateValue ? `<h3 style="margin-top:10px">${dateLabel}</h3><div>${formatDate(dateValue)}</div>` : ''}
    </div>
  </div>
  ${doc.title ? `<h2 style="margin-bottom:12px">${escapeHtml(doc.title)}</h2>` : ''}
  <table><thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead><tbody>${items}</tbody></table>
  <div class="totals">
    <div class="totals-row"><span>Subtotal</span><span>$${(doc.subtotal || 0).toFixed(2)}</span></div>
    ${doc.tax_rate > 0 ? `<div class="totals-row"><span>GST (${doc.tax_rate}%)</span><span>$${(doc.tax_amount || 0).toFixed(2)}</span></div>` : ''}
    <div class="totals-row grand"><span>Total</span><span>$${(doc.total || 0).toFixed(2)}</span></div>
    ${isInvoice && doc.amount_paid ? `<div class="totals-row" style="color:#10B981"><span>Paid</span><span>-$${doc.amount_paid.toFixed(2)}</span></div>
       <div class="totals-row grand"><span>Amount due</span><span>$${(doc.amount_due || 0).toFixed(2)}</span></div>` : ''}
  </div>
  ${doc.notes ? `<div class="notes"><strong>Notes:</strong> ${escapeHtml(doc.notes)}</div>` : ''}
  <div class="footer">Generated by Flynn · flynnai.app</div>
  </body></html>`;
};

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

let _puppeteerBrowser = null;
async function htmlToPDFBuffer(html) {
  const puppeteer = require('puppeteer');
  if (!_puppeteerBrowser) {
    // PUPPETEER_EXECUTABLE_PATH is set in Dockerfile to /usr/bin/chromium.
    // Locally, puppeteer falls back to its bundled Chromium.
    _puppeteerBrowser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  }
  const page = await _puppeteerBrowser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    return await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' } });
  } finally {
    await page.close();
  }
}

const resolveUserOrg = async (userId) => {
  const { data, error } = await supabaseStorageClient
    .from('users')
    .select('default_org_id, full_name, email, phone, business_name, address, twilio_phone_number')
    .eq('id', userId)
    .single();
  if (error || !data?.default_org_id) {
    throw new Error('User organization not found');
  }
  return { orgId: data.default_org_id, user: data };
};

const buildDocFromRow = (row, kind, user) => ({
  type: kind,
  number: kind === 'invoice' ? row.invoice_number : row.quote_number,
  title: row.title,
  business_name: user.business_name || user.full_name || 'Flynn',
  business_phone: user.twilio_phone_number || user.phone || '',
  business_email: user.email || '',
  business_address: user.address || '',
  customer_name: row.client_name || 'Customer',
  customer_phone: row.client_phone || row.sent_to || '',
  line_items: row.line_items || [],
  subtotal: Number(row.subtotal || 0),
  tax_rate: Number(row.tax_rate || 0),
  tax_amount: Number(row.tax_amount || 0),
  total: Number(row.total || 0),
  amount_paid: row.amount_paid ? Number(row.amount_paid) : 0,
  amount_due: row.amount_due ? Number(row.amount_due) : 0,
  issued_date: row.issued_date || row.created_at,
  valid_until: row.valid_until,
  due_date: row.due_date,
  notes: row.notes,
});

const generatePDFAndUpload = async (kind, row, user) => {
  const doc = buildDocFromRow(row, kind, user);
  const html = buildDocumentHTML(kind, doc);
  const pdfBuffer = await htmlToPDFBuffer(html);
  const filename = `${kind === 'invoice' ? 'invoices' : 'quotes'}/${row.id}/${doc.number}.pdf`;
  const { error: uploadError } = await supabaseStorageClient.storage
    .from('documents')
    .upload(filename, pdfBuffer, { contentType: 'application/pdf', upsert: true });
  if (uploadError) throw uploadError;
  const { data: urlData } = supabaseStorageClient.storage.from('documents').getPublicUrl(filename);
  const pdfUrl = urlData?.publicUrl;
  await supabaseStorageClient.from(kind === 'invoice' ? 'invoices' : 'quotes')
    .update({ pdf_url: pdfUrl }).eq('id', row.id);
  return { pdfBuffer, pdfUrl };
};

// ---- Quote endpoints ----

app.post('/api/quotes/:id/pdf', authenticateJwt, async (req, res) => {
  try {
    const { user } = await resolveUserOrg(req.user.id);
    const { data: quote, error } = await supabaseStorageClient.from('quotes').select('*').eq('id', req.params.id).single();
    if (error || !quote) return res.status(404).json({ error: 'Quote not found' });
    const { pdfBuffer, pdfUrl } = await generatePDFAndUpload('quote', quote, user);
    res.json({ pdfUrl, pdfData: pdfBuffer.toString('base64') });
  } catch (err) {
    console.error('[Quotes] PDF generation failed', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/quotes/:id/send', authenticateJwt, async (req, res) => {
  try {
    const { toPhone } = req.body;
    if (!toPhone) return res.status(400).json({ error: 'toPhone is required' });
    const { user } = await resolveUserOrg(req.user.id);
    const { data: quote, error } = await supabaseStorageClient.from('quotes').select('*').eq('id', req.params.id).single();
    if (error || !quote) return res.status(404).json({ error: 'Quote not found' });
    const { pdfBuffer, pdfUrl } = await generatePDFAndUpload('quote', quote, user);
    const businessName = user.business_name || user.full_name || 'Flynn';
    const smsBody = `Hi! Here's your quote ${quote.quote_number} from ${businessName}: ${pdfUrl}`;
    await sendConfirmationSms({ to: toPhone, body: smsBody });
    await supabaseStorageClient.from('quotes').update({
      sent_at: new Date().toISOString(),
      sent_to: toPhone,
      status: quote.status === 'draft' ? 'sent' : quote.status,
    }).eq('id', req.params.id);
    res.json({ pdfUrl, pdfData: pdfBuffer.toString('base64') });
  } catch (err) {
    console.error('[Quotes] Send failed', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/quotes/:id/convert', authenticateJwt, async (req, res) => {
  try {
    const { orgId, user } = await resolveUserOrg(req.user.id);
    const { data: quote, error: qErr } = await supabaseStorageClient.from('quotes').select('*').eq('id', req.params.id).single();
    if (qErr || !quote) return res.status(404).json({ error: 'Quote not found' });
    const { data: numResult } = await supabaseStorageClient.rpc('generate_invoice_number', { p_org_id: orgId });
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);
    const { data: invoice, error: insErr } = await supabaseStorageClient.from('invoices').insert({
      org_id: orgId,
      invoice_number: numResult,
      title: quote.title,
      client_id: quote.client_id,
      client_name: quote.client_name,
      client_phone: quote.client_phone,
      quote_id: quote.id,
      line_items: quote.line_items,
      subtotal: quote.subtotal,
      tax_rate: quote.tax_rate,
      tax_amount: quote.tax_amount,
      total: quote.total,
      amount_paid: 0,
      amount_due: quote.total,
      notes: quote.notes,
      due_date: dueDate.toISOString(),
      issued_date: new Date().toISOString(),
      status: 'draft',
    }).select().single();
    if (insErr) throw insErr;
    res.json(invoice);
  } catch (err) {
    console.error('[Quotes] Convert failed', err);
    res.status(500).json({ error: err.message });
  }
});

// ---- Invoice endpoints ----

app.post('/api/invoices/:id/pdf', authenticateJwt, async (req, res) => {
  try {
    const { user } = await resolveUserOrg(req.user.id);
    const { data: invoice, error } = await supabaseStorageClient.from('invoices').select('*').eq('id', req.params.id).single();
    if (error || !invoice) return res.status(404).json({ error: 'Invoice not found' });
    const { pdfBuffer, pdfUrl } = await generatePDFAndUpload('invoice', invoice, user);
    res.json({ pdfUrl, pdfData: pdfBuffer.toString('base64') });
  } catch (err) {
    console.error('[Invoices] PDF generation failed', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/invoices/:id/send', authenticateJwt, async (req, res) => {
  try {
    const { toPhone } = req.body;
    if (!toPhone) return res.status(400).json({ error: 'toPhone is required' });
    const { user } = await resolveUserOrg(req.user.id);
    const { data: invoice, error } = await supabaseStorageClient.from('invoices').select('*').eq('id', req.params.id).single();
    if (error || !invoice) return res.status(404).json({ error: 'Invoice not found' });
    const { pdfBuffer, pdfUrl } = await generatePDFAndUpload('invoice', invoice, user);
    const businessName = user.business_name || user.full_name || 'Flynn';
    const smsBody = `Hi! Here's your invoice ${invoice.invoice_number} from ${businessName}: ${pdfUrl}`;
    await sendConfirmationSms({ to: toPhone, body: smsBody });
    await supabaseStorageClient.from('invoices').update({
      sent_at: new Date().toISOString(),
      sent_to: toPhone,
      status: invoice.status === 'draft' ? 'sent' : invoice.status,
    }).eq('id', req.params.id);
    res.json({ pdfUrl, pdfData: pdfBuffer.toString('base64') });
  } catch (err) {
    console.error('[Invoices] Send failed', err);
    res.status(500).json({ error: err.message });
  }
});

// ---- Voice command surface ----
// One universal endpoint behind the app's floating mic: transcribe → classify the
// intent → do it. Vertical-agnostic (quote / calendar / reply / note). Reuses the
// quote+PDF stack, the calendar slot parser, the draft model, and the memory store.
const _voiceMulter = require('multer');
const voiceAudioUpload = _voiceMulter({
  storage: _voiceMulter.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 }, // a held mic clip is small; 12MB is generous
});

/**
 * POST /api/voice/command  (multipart: field "audio")
 * Returns { intent, transcript, summary, ...intent-specific fields }.
 */
app.post('/api/voice/command', authenticateJwt, voiceAudioUpload.single('audio'), async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!supabaseStorageClient) return res.status(500).json({ error: 'Database not configured' });
  const buffer = req.file?.buffer;
  if (!buffer || !buffer.length) return res.status(400).json({ error: 'No audio provided' });
  const mimeType = req.file.mimetype || 'audio/m4a';
  // Text field set by the iOS client when this is a follow-up to a needsInfo response.
  const priorContext = req.body?.context?.trim() || null;

  try {
    // Value-first gate: a shared daily free quota across Flynn's AI actions; Pro is
    // unlimited. Reuses the same counter as keyboard drafts.
    const entitled = await isUserEntitled(userId);
    if (!entitled) {
      const used = await draftsUsedToday(userId);
      if (used >= FREE_DRAFTS_PER_DAY) {
        return res.status(402).json({
          limitReached: true,
          error: 'Free daily limit reached',
          freeDraftsPerDay: FREE_DRAFTS_PER_DAY,
        });
      }
    }

    const { data: profileRow } = await supabaseStorageClient
      .from('business_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    const businessName = profileRow?.business_name || null;
    const timeZone = profileRow?.timezone || process.env.DEFAULT_TIMEZONE || 'Australia/Sydney';

    // 1) Transcribe (Qwen3-ASR by default; business name biases recognition).
    const { text: transcript } = await transcribeAudio({ buffer, mimeType, context: businessName });
    if (!transcript) {
      return res.json({ intent: 'unknown', transcript: '', summary: '', message: "Didn't catch that — try again." });
    }

    // 2) Classify the spoken command into one intent + fields.
    // For follow-up commands, prepend the prior turn so the model has full context.
    const fullContext = priorContext ? `${priorContext}\n${transcript}` : transcript;
    const routed = await classifyIntent({ transcript: fullContext, businessName });

    // Count this command against the shared free quota (entitled users unlimited).
    if (!entitled) {
      try { await supabaseStorageClient.rpc('bump_draft_usage', { p_user_id: userId }); } catch (_) {}
    }

    const result = { intent: routed.intent, transcript, summary: routed.summary };

    // 3) Dispatch.
    if (routed.intent === 'calendar') {
      const proposed = routed.datetimeText
        ? parseProposedTime(routed.datetimeText, { now: new Date(), timeZone })
        : null;
      if (proposed) {
        // Same shape the keyboard booking uses → the app reuses the confirm card.
        result.event = {
          title: routed.title || (routed.customer ? `Booking — ${routed.customer}` : 'Booking'),
          startISO: proposed.start.toISOString(),
          durationMin: 60,
          location: null,
          customer: routed.customer,
        };
      } else {
        result.needsTime = true; // app asks the user to confirm/pick a time
      }
    } else if (routed.intent === 'quote') {
      // The owner's learned quoting style (any vertical) shapes wording, units, tax
      // and terms. Best-effort — absent table just means a generic quote.
      let quoteStyle = null;
      try {
        const { data: tmpl } = await supabaseStorageClient
          .from('quote_templates').select('style_json').eq('user_id', userId).maybeSingle();
        quoteStyle = tmpl?.style_json || null;
      } catch (_) { /* no style learned yet */ }

      const pricingContext = formatBusinessContext(profileRowToContext(profileRow || {}));
      const quote = await extractQuote({ transcript: fullContext, pricingContext, defaultTaxRate: 10, quoteStyle });
      // If every line item is a $0 placeholder the command was too sparse — ask one focused question.
      const allPlaceholder = !quote || quote.lineItems.length === 0 ||
        quote.lineItems.every((li) => li.description?.startsWith('[set price]'));
      if (allPlaceholder) {
        const who = routed.customer ? ` for ${routed.customer}` : '';
        return res.json({
          intent: 'needsInfo',
          transcript,
          question: `What's the job${who}? E.g. "3hrs at $60/hr" or "full clean, flat rate $200"`,
        });
      }
      const { orgId } = await resolveUserOrg(userId);
      const { data: quoteNumber } = await supabaseStorageClient.rpc('generate_quote_number', { p_org_id: orgId });
      const { data: inserted, error: insertErr } = await supabaseStorageClient
        .from('quotes')
        .insert({
          org_id: orgId,
          quote_number: quoteNumber,
          title: quote.title,
          client_name: quote.clientName,
          line_items: quote.lineItems,
          subtotal: quote.subtotal,
          tax_rate: quote.taxRate,
          tax_amount: quote.taxAmount,
          total: quote.total,
          notes: quote.notes || quoteStyle?.closing_notes || null,
          terms: quoteStyle?.terms_text || null,
          status: 'draft',
          created_by: userId,
        })
        .select('*')
        .single();
      if (insertErr) throw insertErr;
      result.quoteId = inserted.id;
      result.quote = {
        number: inserted.quote_number,
        title: inserted.title,
        clientName: inserted.client_name,
        lineItems: inserted.line_items,
        total: Number(inserted.total),
      };
    } else if (routed.intent === 'reply') {
      const businessContext = formatBusinessContext(profileRowToContext(profileRow || {}));
      const { data: sampleRows } = await supabaseStorageClient
        .from('tone_samples')
        .select('sample_text')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      const toneSamples = (sampleRows || []).map((r) => r.sample_text).filter(Boolean);
      const { drafts } = await composeOutbound({
        instruction: transcript,
        recipient: routed.recipient,
        businessContext,
        toneSamples,
      });
      result.drafts = drafts;
      result.recipient = routed.recipient;
    } else if (routed.intent === 'note') {
      const fact = routed.note || transcript;
      const subjectLabel = routed.customer;
      const subjectHandle = subjectLabel ? subjectLabel.toLowerCase().replace(/\s+/g, ' ').trim() : null;
      const { data: noteRow } = await supabaseStorageClient
        .from('customer_context')
        .insert({
          user_id: userId,
          subject_handle: subjectHandle,
          subject_label: subjectLabel,
          fact,
          confidence: 0.9,
          status: 'confirmed', // the owner spoke it deliberately
          source: 'voice',
        })
        .select('id')
        .single();
      result.noteId = noteRow?.id || null;
      result.note = fact;
      result.subject = subjectLabel;
    }

    res.json(result);
  } catch (error) {
    console.error('[Voice] command failed:', error?.status || '', error?.message);
    res.status(500).json({ error: 'Voice command failed' });
  }
});

// ---- "What Flynn remembers" (customer_context) ----

/** GET /api/memory — the owner's remembered facts, newest first. */
app.get('/api/memory', authenticateJwt, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!supabaseStorageClient) return res.status(500).json({ error: 'Database not configured' });
  try {
    const { data, error } = await supabaseStorageClient
      .from('customer_context')
      .select('id, subject_handle, subject_label, fact, confidence, status, source, created_at')
      .eq('user_id', userId)
      .neq('status', 'dismissed')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;
    res.json({ facts: data || [] });
  } catch (error) {
    console.error('[Memory] list failed:', error?.message);
    res.status(500).json({ error: 'Failed to load memory' });
  }
});

/** POST /api/memory — add a fact (manual) or edit an existing one. */
app.post('/api/memory', authenticateJwt, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!supabaseStorageClient) return res.status(500).json({ error: 'Database not configured' });
  const fact = typeof req.body?.fact === 'string' ? req.body.fact.trim().slice(0, 300) : '';
  if (!fact) return res.status(400).json({ error: 'A fact is required' });
  const subjectLabel = typeof req.body?.subject === 'string' && req.body.subject.trim()
    ? req.body.subject.trim().slice(0, 120) : null;
  const subjectHandle = subjectLabel ? subjectLabel.toLowerCase().replace(/\s+/g, ' ').trim() : null;
  const id = typeof req.body?.id === 'string' ? req.body.id : null;
  try {
    if (id) {
      const { data, error } = await supabaseStorageClient
        .from('customer_context')
        .update({ fact, subject_label: subjectLabel, subject_handle: subjectHandle, updated_at: new Date().toISOString() })
        .eq('id', id).eq('user_id', userId)
        .select('id').single();
      if (error) throw error;
      return res.json({ id: data?.id, updated: true });
    }
    const { data, error } = await supabaseStorageClient
      .from('customer_context')
      .insert({ user_id: userId, fact, subject_label: subjectLabel, subject_handle: subjectHandle, confidence: 1, status: 'confirmed', source: 'manual' })
      .select('id').single();
    if (error) throw error;
    res.json({ id: data?.id, created: true });
  } catch (error) {
    console.error('[Memory] upsert failed:', error?.message);
    res.status(500).json({ error: 'Failed to save fact' });
  }
});

/** POST /api/memory/:id/status — keep ('confirmed') or discard ('dismissed') a fact. */
app.post('/api/memory/:id/status', authenticateJwt, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!supabaseStorageClient) return res.status(500).json({ error: 'Database not configured' });
  const status = req.body?.status === 'confirmed' ? 'confirmed'
    : req.body?.status === 'dismissed' ? 'dismissed' : null;
  if (!status) return res.status(400).json({ error: 'status must be confirmed or dismissed' });
  try {
    const { error } = await supabaseStorageClient
      .from('customer_context')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('user_id', userId);
    if (error) throw error;
    res.json({ ok: true });
  } catch (error) {
    console.error('[Memory] status failed:', error?.message);
    res.status(500).json({ error: 'Failed to update fact' });
  }
});

/** DELETE /api/memory/:id */
app.delete('/api/memory/:id', authenticateJwt, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!supabaseStorageClient) return res.status(500).json({ error: 'Database not configured' });
  try {
    const { error } = await supabaseStorageClient
      .from('customer_context')
      .delete().eq('id', req.params.id).eq('user_id', userId);
    if (error) throw error;
    res.json({ ok: true });
  } catch (error) {
    console.error('[Memory] delete failed:', error?.message);
    res.status(500).json({ error: 'Failed to delete fact' });
  }
});

// ---- Screenshot capture history ----

/** GET /api/brain/captures — screenshot captures for the Brain > Captures feed. */
app.get('/api/brain/captures', authenticateJwt, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!supabaseStorageClient) return res.status(500).json({ error: 'Database not configured' });
  try {
    const { data, error } = await supabaseStorageClient
      .from('screenshots')
      .select('id, created_at, summary, extracted_text')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    res.json({ captures: data || [] });
  } catch (err) {
    console.error('[Brain] captures list failed:', err?.message);
    res.status(500).json({ error: 'Failed to load captures' });
  }
});

// ---- Quote-style ingestion (learn how the owner quotes — any vertical) ----

/** POST /api/quote-style — Body: { text: string, source?: string }. Learns from a
 *  captured quote/invoice/proposal and merges into the owner's style. */
app.post('/api/quote-style', authenticateJwt, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!supabaseStorageClient) return res.status(500).json({ error: 'Database not configured' });
  const ocrText = typeof req.body?.text === 'string' ? req.body.text : '';
  if (!ocrText.trim()) return res.status(400).json({ error: 'No document text provided' });
  try {
    // Free-but-capped agentic action (shared daily quota).
    const entitled = await isUserEntitled(userId);
    if (!entitled) {
      const used = await draftsUsedToday(userId);
      if (used >= FREE_DRAFTS_PER_DAY) {
        return res.status(402).json({ limitReached: true, error: 'Free daily limit reached', freeDraftsPerDay: FREE_DRAFTS_PER_DAY });
      }
    }

    let existing = null;
    let sampleCount = 0;
    try {
      const { data } = await supabaseStorageClient
        .from('quote_templates').select('style_json, sample_count').eq('user_id', userId).maybeSingle();
      existing = data?.style_json || null;
      sampleCount = data?.sample_count || 0;
    } catch (_) { /* table may be absent */ }

    const style = await extractQuoteStyle({ ocrText, existingStyle: existing });

    try {
      await supabaseStorageClient.from('quote_templates').upsert({
        user_id: userId,
        style_json: style,
        sample_count: sampleCount + 1,
        source: typeof req.body?.source === 'string' ? req.body.source : 'screenshot',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    } catch (e) {
      console.error('[QuoteStyle] upsert failed (table missing?):', e?.message);
    }

    if (!entitled) { try { await supabaseStorageClient.rpc('bump_draft_usage', { p_user_id: userId }); } catch (_) {} }
    res.json({ style, sampleCount: sampleCount + 1 });
  } catch (error) {
    console.error('[QuoteStyle] ingest failed:', error?.message);
    res.status(500).json({ error: 'Failed to learn quote style' });
  }
});

/** GET /api/quote-style — the owner's current learned style. */
app.get('/api/quote-style', authenticateJwt, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!supabaseStorageClient) return res.status(500).json({ error: 'Database not configured' });
  try {
    const { data } = await supabaseStorageClient
      .from('quote_templates').select('style_json, sample_count').eq('user_id', userId).maybeSingle();
    res.json({ style: data?.style_json || null, sampleCount: data?.sample_count || 0 });
  } catch (_) {
    res.json({ style: null, sampleCount: 0 });
  }
});

/** DELETE /api/quote-style — forget the learned style. */
app.delete('/api/quote-style', authenticateJwt, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!supabaseStorageClient) return res.status(500).json({ error: 'Database not configured' });
  try {
    await supabaseStorageClient.from('quote_templates').delete().eq('user_id', userId);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset quote style' });
  }
});

module.exports = app;
