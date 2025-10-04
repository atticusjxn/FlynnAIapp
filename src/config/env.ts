import Constants from 'expo-constants';

type ExpoExtra = {
  apiBaseUrl?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  openAIApiKey?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as ExpoExtra;

export const API_BASE_URL = extra.apiBaseUrl;
export const SUPABASE_URL = extra.supabaseUrl;
export const SUPABASE_ANON_KEY = extra.supabaseAnonKey;
export const OPENAI_API_KEY = extra.openAIApiKey;

export const getExpoExtra = () => extra;
