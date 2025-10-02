const http2 = require('http2');
const jwt = require('jsonwebtoken');
const { listNotificationTokensForUser } = require('../supabaseMcpClient');

const VALID_RESPONSE_STATUSES = new Set([200, 201, 202]);

// Cache for FCM access token (valid for 1 hour)
let fcmAccessTokenCache = null;
let fcmTokenExpiry = null;

/**
 * Generate OAuth 2.0 access token for FCM HTTP v1 API using service account
 * Requires GOOGLE_SERVICE_ACCOUNT_KEY environment variable with service account JSON
 */
const getFcmAccessToken = async () => {
  // Return cached token if still valid
  if (fcmAccessTokenCache && fcmTokenExpiry && Date.now() < fcmTokenExpiry) {
    return fcmAccessTokenCache;
  }

  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not configured for FCM v1 API');
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountKey);
  } catch (error) {
    throw new Error('Invalid GOOGLE_SERVICE_ACCOUNT_KEY JSON format');
  }

  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600; // 1 hour

  const jwtPayload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: expiry,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  };

  const token = jwt.sign(jwtPayload, serviceAccount.private_key, { algorithm: 'RS256' });

  // Exchange JWT for access token
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${token}`,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get FCM access token: ${errorText}`);
  }

  const result = await response.json();
  fcmAccessTokenCache = result.access_token;
  fcmTokenExpiry = Date.now() + 50 * 60 * 1000; // Cache for 50 minutes

  return fcmAccessTokenCache;
};

/**
 * Send push notification via FCM HTTP v1 API
 * https://firebase.google.com/docs/cloud-messaging/migrate-v1
 */
const sendFcmNotifications = async ({ tokens, title, body, data }) => {
  if (!tokens.length) {
    return { attempted: 0, sent: 0 };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    console.warn('[Push] FIREBASE_PROJECT_ID not configured; skipping Android push notifications.');
    return { attempted: tokens.length, sent: 0 };
  }

  let accessToken;
  try {
    accessToken = await getFcmAccessToken();
  } catch (error) {
    console.error('[Push] Failed to get FCM access token:', error.message);
    return { attempted: tokens.length, sent: 0 };
  }

  const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  let sent = 0;
  let attempted = 0;

  // FCM v1 API requires sending to one token at a time (no batch endpoint)
  for (const token of tokens) {
    attempted += 1;

    const payload = {
      message: {
        token,
        notification: {
          title,
          body,
        },
        data: data || {},
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channel_id: 'default',
          },
        },
      },
    };

    try {
      const response = await fetch(fcmEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        sent += 1;
      } else {
        const errorText = await response.text();
        console.warn('[Push] FCM send failed for token.', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
          token: token.substring(0, 20) + '...',
        });
      }
    } catch (error) {
      console.warn('[Push] FCM request error:', error.message);
    }
  }

  return { attempted, sent };
};

const buildApnsAuthToken = () => {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const privateKey = process.env.APNS_PRIVATE_KEY;

  if (!keyId || !teamId || !privateKey) {
    return null;
  }

  const normalizedKey = privateKey.replace(/\\n/g, '\n');

  try {
    return jwt.sign(
      {
        iss: teamId,
        iat: Math.floor(Date.now() / 1000),
      },
      normalizedKey,
      {
        algorithm: 'ES256',
        header: {
          kid: keyId,
        },
        expiresIn: '50m',
      }
    );
  } catch (error) {
    console.warn('[Push] Failed to build APNs authentication token:', error);
    return null;
  }
};

const sendApnsNotifications = async ({ tokens, title, body, data }) => {
  if (!tokens.length) {
    return { attempted: 0, sent: 0 };
  }

  const authToken = buildApnsAuthToken();

  if (!authToken) {
    console.warn('[Push] APNs credentials missing; skipping iOS push notifications.');
    return { attempted: tokens.length, sent: 0 };
  }

  const bundleId = process.env.APNS_BUNDLE_ID || process.env.IOS_BUNDLE_IDENTIFIER || 'com.flynnai.app';
  const apnsHost = process.env.APNS_HOST || (process.env.NODE_ENV === 'production'
    ? 'https://api.push.apple.com'
    : 'https://api.sandbox.push.apple.com');

  const client = http2.connect(apnsHost);
  client.on('error', (error) => {
    console.warn('[Push] APNs client error:', error);
  });
  const payload = JSON.stringify({
    aps: {
      alert: {
        title,
        body,
      },
      sound: 'default',
    },
    data,
  });

  let attempted = 0;
  let sent = 0;

  try {
    await Promise.all(tokens.map(async (token) => {
      attempted += 1;

      return new Promise((resolve) => {
        const request = client.request({
          ':method': 'POST',
          ':path': `/3/device/${token}`,
          authorization: `bearer ${authToken}`,
          'apns-topic': bundleId,
        });

        request.setEncoding('utf8');
        request.write(payload);

        request.on('response', (headers) => {
          const status = headers[':status'];
          if (VALID_RESPONSE_STATUSES.has(Number(status))) {
            sent += 1;
          } else {
            console.warn('[Push] APNs send failed.', { token, status });
          }
        });

        request.on('error', (error) => {
          console.warn('[Push] APNs request error.', { token, error });
          resolve();
        });

        request.on('close', resolve);
        request.end();
      });
    }));
  } finally {
    client.close();
  }

  return { attempted, sent };
};

const sendPushNotificationsToUser = async ({ userId, title, body, data = {} }) => {
  if (!userId) {
    throw new Error('userId is required to send notifications.');
  }

  const tokens = await listNotificationTokensForUser({ userId }).catch((error) => {
    console.error('[Push] Failed to fetch notification tokens for user.', { userId, error });
    return [];
  });

  if (!tokens.length) {
    console.log('[Push] No registered notification tokens for user; skipping send.', { userId });
    return { attempted: 0, sent: 0 };
  }

  const androidTokens = tokens.filter((token) => token.platform === 'android').map((token) => token.token);
  const iosTokens = tokens.filter((token) => token.platform === 'ios').map((token) => token.token);

  const results = await Promise.all([
    sendFcmNotifications({ tokens: androidTokens, title, body, data }),
    sendApnsNotifications({ tokens: iosTokens, title, body, data }),
  ]);

  return results.reduce((acc, result) => ({
    attempted: acc.attempted + result.attempted,
    sent: acc.sent + result.sent,
  }), { attempted: 0, sent: 0 });
};

const sendJobCreatedNotification = async ({ userId, job }) => {
  if (!userId || !job) {
    return { attempted: 0, sent: 0 };
  }

  const title = 'New job created';
  const body = job.customer_name
    ? `A new job for ${job.customer_name} is ready to review.`
    : 'A new job is ready to review.';

  const data = {
    jobId: job.id,
    callSid: job.call_sid,
    status: job.status,
  };

  return sendPushNotificationsToUser({ userId, title, body, data });
};

module.exports = {
  sendPushNotificationsToUser,
  sendJobCreatedNotification,
};
