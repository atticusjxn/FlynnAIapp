module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  collectCoverage: false,
  verbose: true,
  // The backend is plain CommonJS and Node runs it as-is. Without this, jest
  // picks up the root babel.config.js — which is babel-preset-expo, for the RN
  // app — and that preset rewrites `process.env.EXPO_PUBLIC_*` reads into an
  // ESM expo virtual module. That made `process.env` undefined inside server.js
  // and failed every suite that loads it. Backend tests must not be transformed
  // by the React Native preset.
  transform: {},
  // Loading server.js starts the 60s cron ticker (and its Supabase/Twilio
  // clients), so the event loop never drains and the run hangs forever. Nothing
  // here is a leak worth chasing — the process is meant to be long-lived.
  forceExit: true,
};
