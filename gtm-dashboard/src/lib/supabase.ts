import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // Surface clearly in the dev console; the auth gate will also halt the app.
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(url ?? '', anon ?? '', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const FOUNDER_EMAIL = 'atticusjxn@gmail.com';
