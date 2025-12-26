import { supabase } from './supabase';
import {
  TwilioServiceError,
  CallProcessingError,
  CallRecord as CallRecordType,
  UserTwilioSettings,
  JobExtraction,
  RecordingPreference,
} from '../types/calls.types';
import { CarrierDetectionResult } from './CarrierDetectionService';
import { carrierIdToIsoCountry, inferIsoCountryFromNumber } from '../utils/phone';
import { OrganizationService } from './organizationService';
import { isPaidPlanId } from '../types/billing';

// Environment configuration - SECURE: Only public URLs, no secrets
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://flynnai-telephony.fly.dev';

// LLM configuration - model info only, keys stored on backend
const EXPO_LLM_PROVIDER = (process.env.EXPO_PUBLIC_LLM_PROVIDER || 'grok').toLowerCase();
const LLM_CHAT_MODEL = process.env.EXPO_PUBLIC_LLM_CHAT_MODEL || 'grok-4-fast';
const LLM_BASE_URL = process.env.EXPO_PUBLIC_LLM_BASE_URL || 'https://api.x.ai/v1';

// Re-export types for backward compatibility
export type TwilioUserStatus = UserTwilioSettings;
export type CallRecord = CallRecordType;

export interface PhoneNumberProvisionResult {
  phoneNumber: string;
  phoneNumberSid: string;
  cost: number;
}

// Re-export for backward compatibility
export type JobExtractionResult = JobExtraction;

export interface PhoneNumberProvisionOptions {
  countryCode?: string;
  phoneNumberHint?: string | null;
  carrierIdHint?: string | null;
}

class TwilioServiceClass {
  private readonly defaultCountryCode = 'US';
  
  /**
   * Get current user's Twilio setup status
   */
  async getUserTwilioStatus(): Promise<UserTwilioSettings> {
    try {
      const { snapshot, orgId } = await OrganizationService.fetchOnboardingData();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new TwilioServiceError('User not authenticated', 'AUTH_REQUIRED', 401);
      }

      const primaryNumber = snapshot.primaryNumber;
      const userProfile = snapshot.userProfile;

      return {
        phoneNumber: userProfile?.phone_number || primaryNumber?.connected_number || null,
        twilioPhoneNumber: primaryNumber?.e164_number || userProfile?.twilio_phone_number || null,
        twilioNumberSid: primaryNumber?.id || userProfile?.twilio_number_sid || null,
        isForwardingActive: Boolean(primaryNumber?.verification_state === 'verified' || userProfile?.forwarding_active),
        recordingPreference: 'manual',
        callFeaturesEnabled: true,
        orgId,
        primaryNumberId: primaryNumber?.id || null,
        verificationState: primaryNumber?.verification_state || null,
        forwardingType: primaryNumber?.forwarding_type || null,
      };
    } catch (error) {
      if (error instanceof TwilioServiceError) {
        throw error;
      }
      console.error('Error getting Twilio status:', error);
      throw new TwilioServiceError('Failed to get Twilio status', 'UNKNOWN_ERROR', 500, error);
    }
  }

  /**
   * Provision a new Twilio phone number for the user
   */
  async provisionPhoneNumber(options: PhoneNumberProvisionOptions = {}): Promise<PhoneNumberProvisionResult> {
    try {
      const { snapshot } = await OrganizationService.fetchOnboardingData();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      if (!isPaidPlanId(snapshot.organizationPlan)) {
        throw new TwilioServiceError(
          'Subscribe to a concierge plan to provision a Flynn number.',
          'PLAN_REQUIRED',
          402
        );
      }

      // Get user's location for number selection (default to US)
      const { data: userData } = await supabase
        .from('users')
        .select('phone, phone_number, address, country_code')
        .eq('id', user.id)
        .single();

      const countryCode = this.resolveCountryCode({
        user,
        userData,
        options,
      });

      // Search for available phone numbers
      const availableNumbers = await this.searchAvailableNumbers(countryCode);
      
      let numbersToConsider = availableNumbers;

      if (!numbersToConsider || numbersToConsider.length === 0) {
        if (countryCode !== this.defaultCountryCode) {
          const fallbackNumbers = await this.searchAvailableNumbers(this.defaultCountryCode);
          if (fallbackNumbers && fallbackNumbers.length > 0) {
            numbersToConsider = fallbackNumbers;
          }
        }

        if (!numbersToConsider || numbersToConsider.length === 0) {
          throw new Error('No phone numbers available in your area');
        }
      }

      // Purchase the first available number
      const selectedNumber = numbersToConsider[0];
      const purchaseResult = await this.purchasePhoneNumber(selectedNumber.phone_number, user.id);

      const onboardingSnapshot = await OrganizationService.fetchOnboardingData();

      if (onboardingSnapshot.orgId) {
        const existingPrimary = onboardingSnapshot.snapshot.primaryNumber;
        const phonePayload = {
          org_id: onboardingSnapshot.orgId,
          e164_number: purchaseResult.phoneNumber,
          status: 'reserved',
          verification_state: 'unverified',
          forwarding_type: 'flynn_number',
          is_primary: true,
          twilio_sid: purchaseResult.phoneNumberSid,
          metadata: {
            ...(existingPrimary?.metadata as Record<string, unknown> | undefined),
            provisioned_at: new Date().toISOString(),
          },
        };

        if (existingPrimary) {
          await supabase
            .from('phone_numbers')
            .update(phonePayload)
            .eq('id', existingPrimary.id);
        } else {
          await supabase.from('phone_numbers').insert(phonePayload);
        }
      }

      // Update user record with Twilio information
      await supabase
        .from('users')
        .update({
          twilio_phone_number: purchaseResult.phoneNumber,
          twilio_number_sid: purchaseResult.phoneNumberSid,
          call_features_enabled: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      return purchaseResult;
    } catch (error) {
      console.error('Error provisioning phone number:', error);
      throw error;
    }
  }

  /**
   * Search for available phone numbers in a country using backend proxy
   */
  private async searchAvailableNumbers(countryCode: string = this.defaultCountryCode) {
    try {
      // Get auth token from Supabase
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(
        `${API_BASE_URL}/api/twilio/search-numbers`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            countryCode,
            limit: 5,
            voiceEnabled: true,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Backend API error: ${response.status}`);
      }

      const data = await response.json();
      return data.availableNumbers || [];
    } catch (error) {
      console.error('Error searching available numbers:', error);
      throw new Error('Failed to search for available phone numbers');
    }
  }

  /**
   * Purchase a specific phone number using backend proxy
   */
  private async purchasePhoneNumber(phoneNumber: string, userId: string): Promise<PhoneNumberProvisionResult> {
    try {
      // Get auth token from Supabase
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(
        `${API_BASE_URL}/api/twilio/purchase-number`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phoneNumber,
            userId,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to purchase phone number');
      }

      const data = await response.json();

      return {
        phoneNumber: data.phoneNumber,
        phoneNumberSid: data.phoneNumberSid,
        cost: data.cost || 1.15,
      };
    } catch (error) {
      console.error('Error purchasing phone number:', error);
      throw error;
    }
  }

  /**
   * Track a forwarding setup attempt
   */
  async trackForwardingAttempt(twilioNumber: string): Promise<void> {
    try {
      const { snapshot, orgId } = await OrganizationService.fetchOnboardingData();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !orgId) return;

      await supabase
        .from('call_events')
        .insert({
          org_id: orgId,
          number_id: snapshot.primaryNumber?.id ?? null,
          event_type: 'forwarding_attempt',
          direction: 'outbound',
          payload: {
            twilioNumber,
            attempted_at: new Date().toISOString(),
          },
        });
    } catch (error) {
      console.error('Error tracking forwarding attempt:', error);
    }
  }

  /**
   * Update user's call forwarding status
   */
  async updateForwardingStatus(isActive: boolean): Promise<void> {
    try {
      const { snapshot, orgId } = await OrganizationService.fetchOnboardingData();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      if (orgId && snapshot.primaryNumber) {
        const { error: phoneError } = await supabase
          .from('phone_numbers')
          .update({
            verification_state: isActive ? 'verified' : 'unverified',
            status: isActive ? 'active' : (snapshot.primaryNumber.status ?? 'pending'),
            connected_number: snapshot.userProfile?.phone_number || snapshot.primaryNumber.connected_number || null,
          })
          .eq('id', snapshot.primaryNumber.id);

        if (phoneError) {
          console.warn('[TwilioService] Failed to update phone_numbers forwarding status', phoneError);
        }
      }

      const { error } = await supabase
        .from('users')
        .update({
          forwarding_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        throw new Error('Failed to update forwarding status');
      }
    } catch (error) {
      console.error('Error updating forwarding status:', error);
      throw error;
    }
  }

  /**
   * Update user's recording preferences
   */
  async updateRecordingPreference(preference: RecordingPreference): Promise<void> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('users')
        .update({
          recording_preference: preference,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) {
        throw new Error('Failed to update recording preference');
      }
    } catch (error) {
      console.error('Error updating recording preference:', error);
      throw error;
    }
  }

  async persistCarrierDetection(
    phoneNumber: string,
    detection: CarrierDetectionResult
  ): Promise<void> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return;
      }

      const existingMetadata = user.user_metadata || {};

      const detectionRecord = {
        phoneNumber,
        carrierId: detection.carrierId,
        confidence: detection.confidence,
        source: detection.source,
        rawCarrierName: detection.rawCarrierName || null,
        e164Number: detection.e164Number || null,
        recordedAt: new Date().toISOString(),
      };

      await supabase.auth.updateUser({
        data: {
          ...existingMetadata,
          forwarding_carrier_hint: detectionRecord,
        },
      });
    } catch (error) {
      console.warn('persistCarrierDetection failed', error);
    }
  }

  /**
   * Get user's call history
   */
  async getCallHistory(limit: number = 20, offset: number = 0): Promise<CallRecordType[]> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      const { data: calls, error } = await supabase
        .from('calls')
        .select(`
          id,
          user_id,
          call_sid,
          from_number,
          to_number,
          status,
          duration,
          recording_url,
          recording_sid,
          transcription_text,
          job_extracted,
          job_id,
          created_at,
          updated_at
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error('Failed to fetch call history');
      }

      return calls?.map(call => ({
        id: call.id,
        userId: call.user_id,
        callSid: call.call_sid,
        fromNumber: call.from_number,
        toNumber: call.to_number,
        status: call.status,
        duration: call.duration,
        recordingUrl: call.recording_url,
        recordingSid: call.recording_sid,
        transcriptionText: call.transcription_text,
        jobExtracted: call.job_extracted,
        jobId: call.job_id,
        createdAt: call.created_at,
        updatedAt: call.updated_at
      })) || [];
    } catch (error) {
      console.error('Error getting call history:', error);
      throw error;
    }
  }

  /**
   * Store a call record in the database
   */
  async storeCallRecord(callData: Partial<CallRecordType>): Promise<CallRecordType> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('calls')
        .insert({
          user_id: user.id,
          call_sid: callData.callSid,
          from_number: callData.fromNumber,
          to_number: callData.toNumber,
          status: callData.status || 'in-progress',
          duration: callData.duration,
          recording_url: callData.recordingUrl,
          transcription_text: callData.transcriptionText,
          job_extracted: callData.jobExtracted,
          job_id: callData.jobId
        })
        .select()
        .single();

      if (error) {
        throw new Error('Failed to store call record');
      }

      return {
        id: data.id,
        userId: data.user_id,
        callSid: data.call_sid,
        fromNumber: data.from_number,
        toNumber: data.to_number,
        status: data.status,
        duration: data.duration,
        recordingUrl: data.recording_url,
        recordingSid: data.recording_sid,
        transcriptionText: data.transcription_text,
        jobExtracted: data.job_extracted,
        jobId: data.job_id,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (error) {
      console.error('Error storing call record:', error);
      throw error;
    }
  }

  /**
   * Update an existing call record
   */
  async updateCallRecord(callId: string, updates: Partial<CallRecordType>): Promise<CallRecordType> {
    try {
      const updateData: any = {};
      
      if (updates.status) updateData.status = updates.status;
      if (updates.duration !== undefined) updateData.duration = updates.duration;
      if (updates.recordingUrl) updateData.recording_url = updates.recordingUrl;
      if (updates.recordingSid) updateData.recording_sid = updates.recordingSid;
      if (updates.transcriptionText) updateData.transcription_text = updates.transcriptionText;
      if (updates.jobExtracted) updateData.job_extracted = updates.jobExtracted;
      if (updates.jobId) updateData.job_id = updates.jobId;
      
      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('calls')
        .update(updateData)
        .eq('id', callId)
        .select()
        .single();

      if (error) {
        throw new Error('Failed to update call record');
      }

      return {
        id: data.id,
        userId: data.user_id,
        callSid: data.call_sid,
        fromNumber: data.from_number,
        toNumber: data.to_number,
        status: data.status,
        duration: data.duration,
        recordingUrl: data.recording_url,
        recordingSid: data.recording_sid,
        transcriptionText: data.transcription_text,
        jobExtracted: data.job_extracted,
        jobId: data.job_id,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (error) {
      console.error('Error updating call record:', error);
      throw error;
    }
  }

  /**
   * Extract job information from call transcription using backend proxy
   */
  async extractJobFromTranscript(transcription: string, businessType?: string): Promise<JobExtraction> {
    try {
      // Get auth token from Supabase
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('User not authenticated');
      }

      const prompt = this.buildExtractionPrompt(transcription, businessType);

      const response = await fetch(
        `${API_BASE_URL}/api/ai/extract-job`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transcription,
            businessType,
            prompt,
            model: LLM_CHAT_MODEL,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Backend API error: ${response.status}`);
      }

      const data = await response.json();
      return data.extraction;
    } catch (error) {
      console.error('Error extracting job from transcript:', error);
      throw error;
    }
  }

  /**
   * Build prompt for job extraction based on business type
   */
  private buildExtractionPrompt(transcription: string, businessType?: string): string {
    const basePrompt = `
Analyze this phone call transcription and extract job details. Return a JSON object with the following structure:

{
  "confidence": 0-1,
  "clientName": "string or null",
  "clientPhone": "string or null",
  "serviceType": "string or null",
  "description": "string or null",
  "scheduledDate": "YYYY-MM-DD or null",
  "scheduledTime": "HH:MM AM/PM or null",
  "location": "string or null",
  "estimatedPrice": number or null,
  "urgency": "low|medium|high or null",
  "followUpRequired": boolean
}

Business type: ${businessType || 'General service provider'}

Transcription:
${transcription}

Focus on extracting:
- Client's name and contact information
- What service they need
- When they want it done
- Where the work needs to be performed
- How urgent the request is
- Any mentioned pricing expectations

If information is unclear or missing, set those fields to null. Set confidence based on how clear and complete the extracted information is.
    `;

    return basePrompt.trim();
  }

  /**
   * Release a phone number (for cleanup/testing) using backend proxy
   */
  async releasePhoneNumber(phoneNumberSid: string): Promise<void> {
    try {
      // Get auth token from Supabase
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(
        `${API_BASE_URL}/api/twilio/release-number`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phoneNumberSid,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to release phone number: ${response.status}`);
      }
    } catch (error) {
      console.error('Error releasing phone number:', error);
      throw error;
    }
  }

  private normalizeCountryCode(code?: string | null): string | null {
    if (!code) return null;
    const trimmed = code.trim();
    if (!trimmed) return null;
    return trimmed.toUpperCase();
  }

  private resolveCountryCode({
    user,
    userData,
    options,
  }: {
    user: { user_metadata?: Record<string, any>; phone?: string | null };
    userData: { phone?: string | null; phone_number?: string | null; address?: any; country_code?: string | null } | null;
    options: PhoneNumberProvisionOptions;
  }): string {
    const metadata = (user?.user_metadata || {}) as Record<string, any>;
    const forwardingHint = metadata.forwarding_carrier_hint as
      | { carrierId?: string | null; e164Number?: string | null }
      | undefined;

    const addressCountry = userData?.address && typeof userData.address === 'object'
      ? this.normalizeCountryCode(userData.address.country || userData.address.countryCode)
      : this.normalizeCountryCode(userData?.country_code);

    const addressStringCountry =
      typeof userData?.address === 'string'
        ? ((): string | null => {
            const lower = userData.address.toLowerCase();
            if (lower.includes('australia')) return 'AU';
            if (lower.includes('new zealand')) return 'NZ';
            if (lower.includes('united kingdom') || lower.includes('u.k.') || lower.includes('uk')) return 'GB';
            if (lower.includes('ireland')) return 'IE';
            if (lower.includes('canada')) return 'CA';
            if (lower.includes('united states') || lower.includes('usa') || lower.includes('u.s.')) return 'US';
            return null;
          })()
        : null;

    const hints: Array<string | null | undefined> = [
      this.normalizeCountryCode(options.countryCode),
      carrierIdToIsoCountry(options.carrierIdHint),
      inferIsoCountryFromNumber(options.phoneNumberHint),
      carrierIdToIsoCountry(forwardingHint?.carrierId),
      inferIsoCountryFromNumber(forwardingHint?.e164Number),
      inferIsoCountryFromNumber(user?.phone),
      inferIsoCountryFromNumber(userData?.phone_number),
      inferIsoCountryFromNumber(userData?.phone),
      addressCountry,
      addressStringCountry,
    ];

    const resolved = hints.find((code) => Boolean(code));
    return this.normalizeCountryCode(resolved) || this.defaultCountryCode;
  }
}

export const TwilioService = new TwilioServiceClass();
