const http2 = require('http2');
const jwt = require('jsonwebtoken');
const { listNotificationTokensForUser } = require('../supabaseMcpClient');

const FCM_ENDPOINT = 'https://fcm.googleapis.com/fcm/send';
const VALID_RESPONSE_STATUSES = new Set([200, 201, 202]);

const chunkArray = (values, chunkSize) => {
  if (!Array.isArray(values) || values.length === 0) {
    return [];
  }

  const size = Math.max(chunkSize, 1);
  const chunks = [];

  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size));
  }

  return chunks;
};

const sendFcmNotifications = async ({ tokens, title, body, data }) => {
  if (!tokens.length) {
    return { attempted: 0, sent: 0 };
  }

  const serverKey = process.env.FCM_SERVER_KEY;
  if (!serverKey) {
    console.warn('[Push] FCM_SERVER_KEY not configured; skipping Android push notifications.');
    return { attempted: tokens.length, sent: 0 };
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `key=${serverKey}`,
  };

  let sent = 0;
  let attempted = 0;

  for (const chunk of chunkArray(tokens, 500)) {
    attempted += chunk.length;

    const payload = {
      registration_ids: chunk,
      notification: {
        title,
        body,
      },
      data,
    };

    try {
      const response = await fetch(FCM_ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn('[Push] FCM send failed.', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        continue;
      }

      const result = await response.json().catch(() => null);
      if (result && typeof result.success === 'number') {
        sent += result.success;
      } else {
        sent += chunk.length;
      }
    } catch (error) {
      console.warn('[Push] FCM request error:', error);
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
