const path = require('path');
const jwt = require('jsonwebtoken');

const BASE_ENV = {
  SERVER_PUBLIC_URL: 'https://example.test',
  SUPABASE_URL: 'https://supabase.test',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  SUPABASE_JWT_SECRET: 'dev-jwt-secret',
  TWILIO_ACCOUNT_SID: 'AC_TEST',
  TWILIO_AUTH_TOKEN: 'auth-token',
  TWILIO_SMS_FROM_NUMBER: '+15555550123',
  TWILIO_VALIDATE_SIGNATURE: 'false',
  VOICEMAIL_STORAGE_BUCKET: 'voicemails',
  VOICEMAIL_SIGNED_URL_TTL_SECONDS: '3600',
  VOICEMAIL_RETENTION_DAYS: '30',
  OPENAI_API_KEY: 'sk-test',
};

const clearModule = (modulePath) => {
  try {
    const resolved = require.resolve(modulePath);
    delete require.cache[resolved];
  } catch (error) {
    // ignore
  }
};

const loadServer = (envOverrides = {}, options = {}) => {
  const { setupMocks } = options;
  jest.resetModules();

  Object.keys(BASE_ENV).forEach((key) => {
    process.env[key] = BASE_ENV[key];
  });

  Object.entries(envOverrides).forEach(([key, value]) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });

  clearModule('./testAppMocks');
  clearModule('../supabaseMcpClient');
  clearModule('twilio');
  clearModule('@supabase/supabase-js');
  clearModule('openai');
  clearModule('../telephony/jobCreation');

  if (typeof setupMocks === 'function') {
    setupMocks();
  }

  const mocks = require('./testAppMocks');
  mocks.resetAllMocks();

  const app = require('../server');

  return {
    app,
    mocks,
  };
};

const createAuthToken = (userId, overrides = {}) => {
  const secret = process.env.SUPABASE_JWT_SECRET || BASE_ENV.SUPABASE_JWT_SECRET;
  const payload = {
    sub: userId,
    aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };

  return jwt.sign(payload, secret, { algorithm: 'HS256' });
};

module.exports = {
  loadServer,
  BASE_ENV,
  createAuthToken,
};
