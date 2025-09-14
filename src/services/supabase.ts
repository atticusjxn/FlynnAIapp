import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Get Supabase credentials from app config or environment
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] Missing configuration. Check app.config.js or .env file');
  throw new Error('Supabase configuration missing');
}

console.log('[Supabase] Initializing client with URL:', supabaseUrl);

// Add additional polyfills if needed
if (typeof global.URL === 'undefined') {
  console.warn('[Supabase] URL polyfill not working, using fallback');
  global.URL = require('react-native-url-polyfill').URL;
  global.URLSearchParams = require('react-native-url-polyfill').URLSearchParams;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});