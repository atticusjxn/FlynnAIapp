const crypto = require('crypto');
const { setTimeout: sleep } = require('timers/promises');
const { supabase } = require('./supabaseClient');

const APPLE_ADSERVICES_ENDPOINT = 'https://api-adservices.apple.com/api/v1/';
const APPLE_404_RETRY_ATTEMPTS = 3;
const APPLE_404_RETRY_DELAY_MS = 5000;

function hashAttributionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function asIsoOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function valueToText(value) {
  if (value === undefined || value === null || value === '') return null;
  return String(value);
}

function normalizeApplePayload(payload) {
  return {
    attribution: Boolean(payload?.attribution),
    org_id: valueToText(payload?.orgId),
    campaign_id: valueToText(payload?.campaignId),
    ad_group_id: valueToText(payload?.adGroupId),
    keyword_id: valueToText(payload?.keywordId),
    ad_id: valueToText(payload?.adId),
    claim_type: valueToText(payload?.claimType),
    conversion_type: valueToText(payload?.conversionType),
    country_or_region: valueToText(payload?.countryOrRegion),
    click_date: asIsoOrNull(payload?.clickDate),
    impression_date: asIsoOrNull(payload?.impressionDate),
  };
}

async function fetchAppleAttribution(token) {
  let lastResponse = null;

  for (let attempt = 1; attempt <= APPLE_404_RETRY_ATTEMPTS; attempt += 1) {
    const response = await fetch(APPLE_ADSERVICES_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: token,
    });

    lastResponse = response;
    if (response.status !== 404 || attempt === APPLE_404_RETRY_ATTEMPTS) {
      break;
    }

    await sleep(APPLE_404_RETRY_DELAY_MS);
  }

  if (!lastResponse) {
    throw new Error('No response from Apple AdServices');
  }

  let body = null;
  try {
    body = await lastResponse.json();
  } catch {
    body = null;
  }

  if (!lastResponse.ok) {
    const error = new Error(`Apple AdServices returned ${lastResponse.status}`);
    error.status = lastResponse.status;
    error.payload = body;
    throw error;
  }

  return body || {};
}

async function defaultOrgIdForUser(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('default_org_id')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.warn('[ASA] Could not resolve default org for attribution claim:', error.message);
    return null;
  }

  return data?.default_org_id || null;
}

async function claimAppleSearchAdsAttribution({
  userId,
  token,
  tokenCapturedAt,
  appVersion,
  buildNumber,
}) {
  if (!userId || !token || typeof token !== 'string') {
    return { success: false, statusCode: 400, error: 'invalid_claim_payload' };
  }

  const tokenHash = hashAttributionToken(token);
  const orgId = await defaultOrgIdForUser(userId);

  try {
    const applePayload = await fetchAppleAttribution(token);
    const normalized = normalizeApplePayload(applePayload);
    const status = normalized.attribution ? 'attributed' : 'unattributed';
    const row = {
      user_id: userId,
      token_hash: tokenHash,
      token_captured_at: asIsoOrNull(tokenCapturedAt),
      claimed_at: new Date().toISOString(),
      org_id: orgId,
      ...normalized,
      apple_payload: {
        ...applePayload,
        flynnAppVersion: appVersion || null,
        flynnBuildNumber: buildNumber || null,
      },
      status,
      error_code: null,
      error_message: null,
    };

    const { data, error } = await supabase
      .from('apple_search_ads_attributions')
      .upsert(row, { onConflict: 'token_hash' })
      .select('id, attribution, status')
      .single();

    if (error) {
      console.error('[ASA] Attribution upsert failed:', error.message);
      return { success: false, statusCode: 500, error: 'attribution_store_failed' };
    }

    return {
      success: true,
      attributionId: data.id,
      attribution: data.attribution,
      status: data.status,
    };
  } catch (error) {
    const errorRow = {
      user_id: userId,
      token_hash: tokenHash,
      token_captured_at: asIsoOrNull(tokenCapturedAt),
      claimed_at: new Date().toISOString(),
      org_id: orgId,
      apple_payload: error.payload || {},
      status: 'failed',
      error_code: error.status ? String(error.status) : 'apple_adservices_error',
      error_message: error.message,
    };

    const { error: storeError } = await supabase
      .from('apple_search_ads_attributions')
      .upsert(errorRow, { onConflict: 'token_hash' });

    if (storeError) {
      console.error('[ASA] Failed-attribution upsert failed:', storeError.message);
    }

    return {
      success: false,
      statusCode: error.status && error.status >= 400 && error.status < 500 ? 502 : 500,
      error: 'apple_adservices_failed',
    };
  }
}

async function latestAttributionForUser(userId) {
  if (!userId) return null;

  const { data, error } = await supabase
    .from('apple_search_ads_attributions')
    .select('id')
    .eq('user_id', userId)
    .eq('attribution', true)
    .eq('status', 'attributed')
    .order('claimed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[ASA] Latest attribution lookup failed:', error.message);
    return null;
  }

  return data?.id || null;
}

async function recordSubscriptionConversionEvent({
  userId,
  subscriptionId,
  eventName,
  productId,
  planId,
  appleOriginalTransactionId,
  appleLatestTransactionId,
  occurredAt,
}) {
  if (!userId || !eventName || !appleOriginalTransactionId) {
    return { success: false, reason: 'incomplete_conversion_event' };
  }

  const attributionId = await latestAttributionForUser(userId);
  const row = {
    user_id: userId,
    subscription_id: subscriptionId || null,
    apple_search_ads_attribution_id: attributionId,
    event_name: eventName,
    product_id: productId || null,
    plan_id: planId || null,
    apple_original_transaction_id: String(appleOriginalTransactionId),
    apple_latest_transaction_id: appleLatestTransactionId ? String(appleLatestTransactionId) : null,
    occurred_at: occurredAt || new Date().toISOString(),
  };

  const { error } = await supabase
    .from('subscription_conversion_events')
    .upsert(row, { onConflict: 'event_name,apple_original_transaction_id' });

  if (error) {
    console.warn('[ASA] Subscription conversion event upsert failed:', error.message);
    return { success: false, reason: error.message };
  }

  return { success: true, attributionId };
}

module.exports = {
  claimAppleSearchAdsAttribution,
  recordSubscriptionConversionEvent,
  fetchAppleAttribution,
  hashAttributionToken,
};
