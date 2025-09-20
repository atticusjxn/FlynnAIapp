import { supabase } from './supabase';
import { 
  TwilioServiceError, 
  CallProcessingError,
  CallRecord as CallRecordType,
  UserTwilioSettings,
  JobExtraction,
  RecordingPreference 
} from '../types/calls.types';

// Environment configuration
const TWILIO_ACCOUNT_SID = process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN;
const TWILIO_WEBHOOK_URL = process.env.EXPO_PUBLIC_TWILIO_WEBHOOK_URL;
const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

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

class TwilioServiceClass {
  private baseUrl = 'https://api.twilio.com/2010-04-01';
  
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
  async provisionPhoneNumber(): Promise<PhoneNumberProvisionResult> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      // Get user's location for number selection (default to US)
      const { data: userData } = await supabase
        .from('users')
        .select('phone, address')
        .eq('id', user.id)
        .single();

      // Search for available phone numbers
      const availableNumbers = await this.searchAvailableNumbers('US');
      
      if (!availableNumbers || availableNumbers.length === 0) {
        throw new Error('No phone numbers available in your area');
      }

      // Purchase the first available number
      const selectedNumber = availableNumbers[0];
      const purchaseResult = await this.purchasePhoneNumber(selectedNumber.phone_number, user.id);

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
  private async searchAvailableNumbers(countryCode: string = 'US') {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      // For development, return mock data
      return [{
        phone_number: '+15551234567',
        friendly_name: 'Flynn AI Development Number',
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
      return data.available_phone_numbers || [];
    } catch (error) {
      console.error('Error searching available numbers:', error);
      throw new Error('Failed to search for available phone numbers');
    }
  }

  /**
   * Purchase a specific phone number
   */
  private async purchasePhoneNumber(phoneNumber: string, userId: string): Promise<PhoneNumberProvisionResult> {
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
      
      const params = new URLSearchParams({
        PhoneNumber: phoneNumber,
        VoiceUrl: `${TWILIO_WEBHOOK_URL}/webhook/voice/${userId}`,
        VoiceMethod: 'POST',
        StatusCallback: `${TWILIO_WEBHOOK_URL}/webhook/status/${userId}`,
        StatusCallbackMethod: 'POST'
      });

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
          call_sid,
          from_number,
          to_number,
          status,
          duration,
          recording_url,
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
        callSid: call.call_sid,
        fromNumber: call.from_number,
        toNumber: call.to_number,
        status: call.status,
        duration: call.duration,
        recordingUrl: call.recording_url,
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
        callSid: data.call_sid,
        fromNumber: data.from_number,
        toNumber: data.to_number,
        status: data.status,
        duration: data.duration,
        recordingUrl: data.recording_url,
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
        callSid: data.call_sid,
        fromNumber: data.from_number,
        toNumber: data.to_number,
        status: data.status,
        duration: data.duration,
        recordingUrl: data.recording_url,
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
}

export const TwilioService = new TwilioServiceClass();
