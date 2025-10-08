import { supabase } from './supabase';
import {
  TwilioServiceError, 
  CallProcessingError,
  CallRecord as CallRecordType,
  UserTwilioSettings,
  JobExtraction,
  RecordingPreference 
} from '../types/calls.types';
import { CarrierDetectionResult } from './CarrierDetectionService';
import { carrierIdToIsoCountry, inferIsoCountryFromNumber } from '../utils/phone';

// Environment configuration
const env = process.env as Record<string, string | undefined>;

const TWILIO_ACCOUNT_SID = env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN;
const TWILIO_WEBHOOK_URL = env.EXPO_PUBLIC_TWILIO_WEBHOOK_URL;
const OPENAI_API_KEY = env.EXPO_PUBLIC_OPENAI_API_KEY;

type AvailablePhoneNumber = {
  phone_number: string;
  friendly_name?: string;
  iso_country?: string;
  address_requirements?: string | null;
  capabilities?: {
    voice?: boolean;
    sms?: boolean;
    fax?: boolean;
  };
};

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
  private baseUrl = 'https://api.twilio.com/2010-04-01';
  private readonly defaultCountryCode = 'US';
  
  /**
   * Get current user's Twilio setup status
   */
  async getUserTwilioStatus(): Promise<UserTwilioSettings> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new TwilioServiceError(
          'User not authenticated', 
          'AUTH_REQUIRED', 
          401
        );
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('twilio_phone_number, twilio_number_sid, recording_preference, forwarding_active, call_features_enabled')
        .eq('id', user.id)
        .single();

      if (userError) {
        throw new TwilioServiceError(
          'Failed to fetch user data', 
          'USER_DATA_ERROR', 
          500,
          userError
        );
      }

      return {
        phoneNumber: userData?.twilio_phone_number || null,
        twilioPhoneNumber: userData?.twilio_phone_number || null,
        twilioNumberSid: userData?.twilio_number_sid || null,
        isForwardingActive: userData?.forwarding_active || false,
        recordingPreference: userData?.recording_preference || 'manual',
        callFeaturesEnabled: userData?.call_features_enabled !== false
      };
    } catch (error) {
      if (error instanceof TwilioServiceError) {
        throw error;
      }
      console.error('Error getting Twilio status:', error);
      throw new TwilioServiceError(
        'Failed to get Twilio status',
        'UNKNOWN_ERROR',
        500,
        error
      );
    }
  }

  /**
   * Provision a new Twilio phone number for the user
   */
  async provisionPhoneNumber(options: PhoneNumberProvisionOptions = {}): Promise<PhoneNumberProvisionResult> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
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
      const purchaseResult = await this.purchasePhoneNumber(
        selectedNumber.phone_number,
        user.id,
        selectedNumber.iso_country || countryCode,
        selectedNumber.address_requirements
      );

      // Update user record with Twilio information
      const { error: updateError } = await supabase
        .from('users')
        .update({
          twilio_phone_number: purchaseResult.phoneNumber,
          twilio_number_sid: purchaseResult.phoneNumberSid,
          call_features_enabled: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Failed to update user with Twilio info:', updateError);
        // Continue anyway - the number is provisioned
      }

      return purchaseResult;
    } catch (error) {
      console.error('Error provisioning phone number:', error);
      throw error;
    }
  }

  /**
   * Search for available phone numbers in a country
   */
  private async searchAvailableNumbers(countryCode: string = this.defaultCountryCode): Promise<AvailablePhoneNumber[]> {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      // For development, return mock data
      const devNumbers: Record<string, { phone_number: string; iso_country: string; address_requirements: string }> = {
        AU: { phone_number: '+61491570156', iso_country: 'AU', address_requirements: 'any' },
        GB: { phone_number: '+447700900123', iso_country: 'GB', address_requirements: 'any' },
        IE: { phone_number: '+35315500000', iso_country: 'IE', address_requirements: 'any' },
        NZ: { phone_number: '+64210123456', iso_country: 'NZ', address_requirements: 'any' },
        US: { phone_number: '+15551234567', iso_country: 'US', address_requirements: 'none' },
      };

      const fallback = devNumbers[this.defaultCountryCode];
      const selected = devNumbers[countryCode] || fallback;
      return [{
        phone_number: selected.phone_number,
        friendly_name: 'Flynn AI Development Number',
        iso_country: selected.iso_country,
        address_requirements: selected.address_requirements,
        capabilities: { voice: true, sms: true, fax: false }
      }];
    }

    try {
      const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
      
      const response = await fetch(
        `${this.baseUrl}/Accounts/${TWILIO_ACCOUNT_SID}/AvailablePhoneNumbers/${countryCode}/Local.json?Limit=5&VoiceEnabled=true`,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Twilio API error: ${response.status}`);
      }

      const data = await response.json();
      return (data.available_phone_numbers as AvailablePhoneNumber[]) || [];
    } catch (error) {
      console.error('Error searching available numbers:', error);
      throw new Error('Failed to search for available phone numbers');
    }
  }

  /**
   * Purchase a specific phone number
   */
  private async purchasePhoneNumber(
    phoneNumber: string,
    userId: string,
    isoCountry?: string | null,
    addressRequirements?: string | null
  ): Promise<PhoneNumberProvisionResult> {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      // For development, return mock data
      return {
        phoneNumber: phoneNumber,
        phoneNumberSid: 'PN' + Math.random().toString(36).substring(2, 15),
        cost: 1.15
      };
    }

    try {
      const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
      const normalizedCountry = this.normalizeCountryCode(isoCountry) || this.defaultCountryCode;
      const requirement = (addressRequirements || '').toLowerCase();
      const addressSid = this.resolveAddressSid(normalizedCountry, requirement);

      if (requirement && requirement !== 'none' && requirement !== 'any' && !addressSid) {
        const friendlyCountry = this.getCountryFriendlyName(normalizedCountry);
        throw new Error(
          `A verified address is required to provision numbers in ${friendlyCountry}. ` +
            `Set EXPO_PUBLIC_TWILIO_ADDRESS_SID_${normalizedCountry} or EXPO_PUBLIC_TWILIO_DEFAULT_ADDRESS_SID in your environment.`
        );
      }

      const params = new URLSearchParams({
        PhoneNumber: phoneNumber,
        VoiceUrl: `${TWILIO_WEBHOOK_URL}/webhook/voice/${userId}`,
        VoiceMethod: 'POST',
        StatusCallback: `${TWILIO_WEBHOOK_URL}/webhook/status/${userId}`,
        StatusCallbackMethod: 'POST'
      });

      if (addressSid) {
        params.set('AddressSid', addressSid);
      }

      const response = await fetch(
        `${this.baseUrl}/Accounts/${TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: params.toString()
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        const friendlyCountry = this.getCountryFriendlyName(normalizedCountry);
        if (
          errorData?.message &&
          typeof errorData.message === 'string' &&
          errorData.message.toLowerCase().includes('requires an address')
        ) {
          throw new Error(
            `Twilio requires a verified address to buy numbers in ${friendlyCountry}. ` +
              `Set EXPO_PUBLIC_TWILIO_ADDRESS_SID_${normalizedCountry} (or EXPO_PUBLIC_TWILIO_DEFAULT_ADDRESS_SID) to a compliant Twilio Address SID.`
          );
        }

        throw new Error(errorData.message || 'Failed to purchase phone number');
      }

      const data = await response.json();
      
      return {
        phoneNumber: data.phone_number,
        phoneNumberSid: data.sid,
        cost: 1.15 // Standard monthly cost
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Log the attempt in analytics or audit trail
      console.log(`Forwarding setup attempted for ${twilioNumber} by user ${user.id}`);
      
      // You could store this in an analytics table if needed
    } catch (error) {
      console.error('Error tracking forwarding attempt:', error);
    }
  }

  /**
   * Update user's call forwarding status
   */
  async updateForwardingStatus(isActive: boolean): Promise<void> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('users')
        .update({
          forwarding_active: isActive,
          updated_at: new Date().toISOString()
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
   * Extract job information from call transcription using OpenAI
   */
  async extractJobFromTranscript(transcription: string, businessType?: string): Promise<JobExtraction> {
    if (!OPENAI_API_KEY) {
      console.warn('OpenAI API key not configured, returning mock data');
      return {
        confidence: 0.8,
        clientName: 'John Smith',
        clientPhone: '+15551234567',
        serviceType: 'Plumbing repair',
        description: 'Kitchen sink is leaking under the cabinet',
        scheduledDate: '2024-01-15',
        scheduledTime: '10:00 AM',
        location: '123 Main St',
        urgency: 'medium',
        extractedAt: new Date().toISOString(),
        processingTime: 1500
      };
    }

    try {
      const prompt = this.buildExtractionPrompt(transcription, businessType);
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that extracts job details from phone call transcriptions for service providers.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const result = JSON.parse(data.choices[0].message.content);
      
      return result;
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
   * Release a phone number (for cleanup/testing)
   */
  async releasePhoneNumber(phoneNumberSid: string): Promise<void> {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      console.log('Development mode - would release number:', phoneNumberSid);
      return;
    }

    try {
      const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
      
      const response = await fetch(
        `${this.baseUrl}/Accounts/${TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers/${phoneNumberSid}.json`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Basic ${auth}`,
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to release phone number: ${response.status}`);
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

  private resolveAddressSid(countryCode?: string | null, requirement?: string | null): string | undefined {
    const normalizedCountry = this.normalizeCountryCode(countryCode);
    const normalizedRequirement = requirement?.toLowerCase() || 'none';

    if (!normalizedCountry) {
      return undefined;
    }

    if (normalizedRequirement === 'none' || normalizedRequirement === 'any') {
      return undefined;
    }

    const countrySpecificKey = `EXPO_PUBLIC_TWILIO_ADDRESS_SID_${normalizedCountry}`;
    const addressSid = env[countrySpecificKey] || env.EXPO_PUBLIC_TWILIO_DEFAULT_ADDRESS_SID;
    return addressSid || undefined;
  }

  private getCountryFriendlyName(countryCode?: string | null): string {
    switch (this.normalizeCountryCode(countryCode)) {
      case 'AU':
        return 'Australia';
      case 'GB':
        return 'the United Kingdom';
      case 'IE':
        return 'Ireland';
      case 'NZ':
        return 'New Zealand';
      case 'US':
        return 'the United States';
      case 'CA':
        return 'Canada';
      default:
        return countryCode ? countryCode.toUpperCase() : 'the selected region';
    }
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
