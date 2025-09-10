import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Get environment variables from expo-constants for production builds
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

console.log('[Supabase] Initializing with URL:', supabaseUrl ? 'PROVIDED' : 'MISSING');
console.log('[Supabase] Anon key:', supabaseAnonKey ? 'PROVIDED' : 'MISSING');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[CRITICAL] Missing Supabase environment variables!');
  console.error('supabaseUrl:', supabaseUrl);
  console.error('supabaseAnonKey:', supabaseAnonKey ? 'present' : 'missing');
  throw new Error('Missing Supabase environment variables. Please check your app.json configuration.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});