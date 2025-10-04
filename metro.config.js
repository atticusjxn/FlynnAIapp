const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ensure Metro watches environment files so changes trigger a rebuild
const envFilesToWatch = [
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
  '.env.test',
  '.env.staging',
].map((filename) => path.resolve(__dirname, filename));

config.server = config.server || {};
config.server.watchAdditionalPaths = Array.from(
  new Set([...(config.server.watchAdditionalPaths ?? []), ...envFilesToWatch])
);

module.exports = config;
