import { supabase } from './supabase';
import { apiRequest } from './apiClient';
import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system';

const VOICE_BUCKET = 'voice-profiles';

const generateRandomId = () => {
  const globalCrypto = globalThis?.crypto as Partial<Crypto> | undefined;
  if (globalCrypto?.randomUUID) {
    return globalCrypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export interface ReceptionistPreferences {
  voiceId: string | null;
  greeting: string | null;
  questions: string[];
  voiceProfileId?: string | null;
  configured?: boolean;
}

export interface VoiceProfile {
  id: string;
  user_id: string;
  label: string;
  provider: string;
  status: string;
  sample_path?: string | null;
  voice_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

const normalizeQuestions = (questions?: string[]): string[] => {
  if (!Array.isArray(questions)) {
    return [];
  }

  return questions
    .map((question) => question?.trim())
    .filter((question): question is string => Boolean(question));
};

export const ReceptionistService = {
  async savePreferences(preferences: ReceptionistPreferences): Promise<void> {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;

    if (!user) {
      throw new Error('You must be signed in to update receptionist settings.');
    }

    const updates = {
      receptionist_voice: preferences.voiceId,
      receptionist_greeting: preferences.greeting,
      receptionist_questions: normalizeQuestions(preferences.questions),
      receptionist_voice_profile_id: preferences.voiceProfileId ?? null,
      receptionist_configured: preferences.configured ?? true,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id);

    if (error) {
      console.error('[ReceptionistService] Failed to save preferences', error);
      throw new Error(error.message || 'Unable to save receptionist settings.');
    }
  },

  async listVoiceProfiles(): Promise<VoiceProfile[]> {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;

    if (!user) {
      throw new Error('You must be signed in to view voice profiles.');
    }

    const { data, error } = await supabase
      .from('voice_profiles')
      .select('id, user_id, label, provider, status, sample_path, voice_id, created_at, updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[ReceptionistService] Failed to load voice profiles', error);
      throw new Error('Unable to load voice profiles.');
    }

    return data ?? [];
  },

  async createVoiceProfile(label: string, fileUri: string, contentType: string = 'audio/m4a'): Promise<VoiceProfile> {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;

    if (!user) {
      throw new Error('You must be signed in to create a voice profile.');
    }

    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: 'base64',
    });

    const buffer = Buffer.from(base64, 'base64');
    const extension = contentType.includes('wav') ? 'wav' : contentType.includes('mp3') ? 'mp3' : 'm4a';
    const storagePath = `${user.id}/${generateRandomId()}.${extension}`;

    const { error: uploadError } = await supabase
      .storage
      .from(VOICE_BUCKET)
      .upload(storagePath, buffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error('[ReceptionistService] Failed to upload voice sample', uploadError);
      throw new Error('Unable to upload voice recording.');
    }

    const { data, error: insertError } = await supabase
      .from('voice_profiles')
      .insert({
        user_id: user.id,
        label,
        sample_path: storagePath,
        status: 'uploaded',
        provider: 'custom',
      })
      .select('id, user_id, label, provider, status, sample_path, voice_id, created_at, updated_at')
      .single();

    if (insertError || !data) {
      console.error('[ReceptionistService] Failed to create voice profile record', insertError);
      throw new Error('Unable to create voice profile.');
    }

    try {
      await apiRequest(`/voice/profiles/${data.id}/clone`, { method: 'POST' });
    } catch (cloneError) {
      console.error('[ReceptionistService] Voice clone request failed', cloneError);
      // Allow the user to continue; status will remain "uploaded" and they can retry later.
    }

    try {
      if (fileUri.startsWith('file://')) {
        await FileSystem.deleteAsync(fileUri, { idempotent: true });
      }
    } catch (cleanupError) {
      console.warn('[ReceptionistService] Failed to delete temporary recording', cleanupError);
    }

    return data;
  },

  async refreshVoiceProfile(profileId: string): Promise<VoiceProfile | null> {
    const { data, error } = await supabase
      .from('voice_profiles')
      .select('id, user_id, label, provider, status, sample_path, voice_id, created_at, updated_at')
      .eq('id', profileId)
      .single();

    if (error) {
      console.error('[ReceptionistService] Failed to refresh voice profile', error);
      return null;
    }

    return data ?? null;
  },
};

export default ReceptionistService;
