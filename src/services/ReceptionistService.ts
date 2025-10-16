import { supabase } from './supabase';
import { apiRequest } from './apiClient';
import { Buffer } from 'buffer';
import { File } from 'expo-file-system';

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

export interface BusinessSearchResult {
  name: string;
  address?: string;
  rating?: number;
  reviewCount?: number;
  businessType?: string;
  url?: string;
}

export interface BusinessContext {
  businessName: string;
  businessType?: string;
  description?: string;
  services?: string[];
  specialties?: string[];
  hoursOfOperation?: string;
  serviceArea?: string;
  yearsInBusiness?: string;
  certifications?: string[];
  lastUpdated?: string;
  sourceUrl?: string;
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

    const recordingFile = new File(fileUri);
    const base64 = await recordingFile.base64();

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
      if (recordingFile.uri.startsWith('file://') && recordingFile.exists) {
        recordingFile.delete();
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

  async previewGreeting(text: string, voiceOption: string, voiceProfileId?: string | null) {
    if (!text?.trim()) {
      throw new Error('Enter a greeting script before playing a preview.');
    }

    const payload: Record<string, unknown> = {
      text,
      voiceOption,
    };

    if (voiceProfileId) {
      payload.voiceProfileId = voiceProfileId;
    }

    return apiRequest<{ audio: string; contentType: string }>('/voice/preview', {
      method: 'POST',
      body: payload,
    });
  },

  async searchBusinesses(
    businessName: string,
    location?: string,
    latitude?: number,
    longitude?: number
  ): Promise<BusinessSearchResult[]> {
    const response = await apiRequest<{ success: boolean; businesses: BusinessSearchResult[] }>(
      '/receptionist/business-context/search',
      {
        method: 'POST',
        body: {
          businessName,
          location: location || '',
          latitude,
          longitude,
        },
      }
    );

    return response.businesses || [];
  },

  async extractBusinessContext(businessProfileUrl: string): Promise<BusinessContext> {
    const response = await apiRequest<{ success: boolean; businessContext: BusinessContext }>(
      '/receptionist/business-context/extract',
      {
        method: 'POST',
        body: {
          businessProfileUrl,
        },
      }
    );

    return response.businessContext;
  },

  async getBusinessContext(): Promise<{ business_profile_url?: string; business_context?: BusinessContext } | null> {
    const response = await apiRequest<{
      business_profile_url?: string;
      business_context?: BusinessContext;
      business_context_updated_at?: string;
    }>('/receptionist/business-context', {
      method: 'GET',
    });

    return response;
  },
};

export default ReceptionistService;
