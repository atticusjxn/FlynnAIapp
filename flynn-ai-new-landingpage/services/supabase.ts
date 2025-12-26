import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Type definitions for trial signups
export interface TrialSignup {
  id: string;
  email: string;
  business_type: string;
  created_at: string;
  has_completed_signup: boolean;
  metadata?: Record<string, any>;
}

// Helper function to create a trial signup
export async function createTrialSignup(email: string, businessType: string) {
  const { data, error } = await supabase
    .from('trial_signups')
    .insert({
      email: email.toLowerCase().trim(),
      business_type: businessType,
    })
    .select()
    .single();

  if (error) {
    // Handle duplicate email error gracefully
    if (error.code === '23505') {
      return { data: null, error: { message: 'This email has already signed up for a trial.' } };
    }
    return { data: null, error };
  }

  return { data, error: null };
}
