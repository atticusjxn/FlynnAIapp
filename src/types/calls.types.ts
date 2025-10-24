// Call forwarding and Twilio integration types for Flynn AI

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  webhookUrl: string;
}

export interface TwilioWebhookPayload {
  AccountSid: string;
  CallSid: string;
  From: string;
  To: string;
  CallStatus?: CallStatus;
  Direction?: CallDirection;
  RecordingUrl?: string;
  RecordingDuration?: string;
  RecordingSid?: string;
  TranscriptionText?: string;
  TranscriptionStatus?: TranscriptionStatus;
  CallDuration?: string;
  [key: string]: any;
}

export type CallStatus = 
  | 'queued'
  | 'ringing' 
  | 'in-progress'
  | 'completed'
  | 'busy'
  | 'failed'
  | 'no-answer'
  | 'cancelled';

export type CallDirection = 'inbound' | 'outbound';

export type TranscriptionStatus = 
  | 'in-progress'
  | 'completed' 
  | 'failed';

export type RecordingPreference = 'auto' | 'manual' | 'off';

export type SmartRoutingMode = 'intake' | 'voicemail' | 'smart_auto';

export interface UserTwilioSettings {
  phoneNumber: string | null; // Added for backward compatibility
  twilioPhoneNumber: string | null;
  twilioNumberSid: string | null;
  isForwardingActive: boolean;
  recordingPreference: RecordingPreference;
  callFeaturesEnabled: boolean;
}

export interface CallRecord {
  id: string;
  userId: string;
  callSid: string;
  fromNumber: string;
  toNumber: string;
  status: CallStatus;
  direction?: CallDirection;
  duration?: number; // seconds
  recordingUrl?: string;
  recordingSid?: string;
  transcriptionText?: string;
  transcriptionConfidence?: number;
  jobExtracted?: JobExtraction;
  jobId?: string;
  clientId?: string;
  callerId?: string;
  routeDecision?: 'intake' | 'voicemail';
  routeMode?: SmartRoutingMode;
  routeReason?: string | null;
  createdAt: string;
  updatedAt: string;
  processedAt?: string;
}

export interface JobExtraction {
  confidence: number; // 0-1
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  serviceType?: string;
  description?: string;
  scheduledDate?: string; // ISO date string
  scheduledTime?: string; // HH:MM format
  location?: string;
  estimatedPrice?: number;
  businessType?: string;
  notes?: string;
  followUpDraft?: string;
  estimatedDuration?: string;
  urgency?: UrgencyLevel;
  followUpRequired?: boolean;
  extractedAt: string;
  processingTime?: number; // milliseconds
}

export type UrgencyLevel = 'low' | 'medium' | 'high' | 'emergency';

export interface CallProcessingResult {
  callId: string;
  jobCreated: boolean;
  jobId?: string;
  clientId?: string;
  calendarEventId?: string;
  confirmationSent?: boolean;
  error?: CallProcessingError;
}

export interface CallProcessingError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

// Twilio API Response Types
export interface TwilioPhoneNumber {
  sid: string;
  phone_number: string;
  friendly_name?: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms?: boolean;
    fax?: boolean;
  };
  voice_url?: string;
  voice_method?: string;
  status_callback?: string;
  status_callback_method?: string;
  date_created: string;
  date_updated: string;
}

export interface TwilioAvailableNumber {
  phone_number: string;
  friendly_name: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms?: boolean;
    fax?: boolean;
  };
  locality?: string;
  region?: string;
  postal_code?: string;
}

export interface TwilioCall {
  sid: string;
  status: CallStatus;
  direction: CallDirection;
  from: string;
  to: string;
  duration?: number;
  price?: string;
  price_unit?: string;
  date_created: string;
  date_updated: string;
  start_time?: string;
  end_time?: string;
  parent_call_sid?: string;
}

export interface TwilioRecording {
  sid: string;
  call_sid: string;
  status: 'in-progress' | 'completed' | 'failed';
  duration?: number;
  channels?: number;
  source?: 'DialVerb' | 'Conference' | 'OutboundAPI' | 'Trunking' | 'RecordVerb';
  price?: string;
  price_unit?: string;
  uri: string;
  encryption_details?: any;
  date_created: string;
  date_updated: string;
}

// Error Types
export class TwilioServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'TwilioServiceError';
  }
}

export class CallProcessingError extends Error {
  constructor(
    message: string,
    public callId: string,
    public phase: 'webhook' | 'transcription' | 'job_extraction' | 'client_creation',
    public details?: any
  ) {
    super(message);
    this.name = 'CallProcessingError';
  }
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: any;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Webhook validation
export interface WebhookValidation {
  signature: string;
  url: string;
  payload: any;
  isValid: boolean;
}

// TwiML Types
export interface TwiMLResponse {
  toString(): string;
}

export interface TwiMLVoiceResponse extends TwiMLResponse {
  say(text: string, options?: TwiMLSayOptions): void;
  play(url: string, options?: TwiMLPlayOptions): void;
  record(options?: TwiMLRecordOptions): void;
  dial(number: string, options?: TwiMLDialOptions): void;
  hangup(): void;
  redirect(url: string): void;
  pause(options?: TwiMLPauseOptions): void;
}

export interface TwiMLSayOptions {
  voice?: 'man' | 'woman' | 'alice' | 'Polly.Emma' | 'Polly.Brian';
  language?: string;
  loop?: number;
}

export interface TwiMLPlayOptions {
  loop?: number;
  digits?: string;
}

export interface TwiMLRecordOptions {
  action?: string;
  method?: 'GET' | 'POST';
  timeout?: number;
  finishOnKey?: string;
  maxLength?: number;
  playBeep?: boolean;
  trim?: 'trim-silence' | 'do-not-trim';
  recordingStatusCallback?: string;
  recordingStatusCallbackMethod?: 'GET' | 'POST';
  recordingStatusCallbackEvent?: string[];
  transcribe?: boolean;
  transcribeCallback?: string;
}

export interface TwiMLDialOptions {
  action?: string;
  method?: 'GET' | 'POST';
  timeout?: number;
  hangupOnStar?: boolean;
  timeLimit?: number;
  callerId?: string;
  record?: boolean;
  trim?: 'trim-silence' | 'do-not-trim';
  recordingStatusCallback?: string;
}

export interface TwiMLPauseOptions {
  length?: number;
}

// Database table interfaces (for better type safety with Supabase)
export interface CallsTable {
  id: string;
  user_id: string;
  call_sid: string;
  from_number: string;
  to_number: string;
  status: CallStatus;
  duration?: number;
  recording_url?: string;
  transcription_text?: string;
  job_extracted?: any; // JSONB
  job_id?: string;
  created_at: string;
  updated_at: string;
}

export interface UsersTable {
  id: string;
  twilio_phone_number?: string;
  twilio_number_sid?: string;
  recording_preference?: RecordingPreference;
  forwarding_active?: boolean;
  call_features_enabled?: boolean;
  // ... other user fields
}

// Form validation types
export interface PhoneNumberValidation {
  isValid: boolean;
  formatted?: string;
  country?: string;
  type?: 'mobile' | 'landline' | 'voip';
  error?: string;
}

export interface SetupValidation {
  hasPhoneNumber: boolean;
  hasValidTwilioConfig: boolean;
  canProvisionNumber: boolean;
  errors: string[];
}

// Analytics and monitoring types
export interface CallMetrics {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageDuration: number;
  jobsCreated: number;
  transcriptionSuccessRate: number;
  period: 'hour' | 'day' | 'week' | 'month';
  startDate: string;
  endDate: string;
}

export interface CallAnalytics {
  callVolume: number[];
  jobConversionRate: number;
  averageCallDuration: number;
  topServiceTypes: Array<{ type: string; count: number }>;
  clientSatisfactionScore?: number;
  responseTime: number; // milliseconds
}

// Event types for real-time updates
export interface CallEvent {
  type: 'call_started' | 'call_ended' | 'transcription_complete' | 'job_created' | 'error';
  callId: string;
  userId: string;
  timestamp: string;
  data?: any;
}

// Configuration types
export interface CallForwardingConfig {
  enabled: boolean;
  twilioPhoneNumber?: string;
  recordingEnabled: boolean;
  transcriptionEnabled: boolean;
  jobExtractionEnabled: boolean;
  clientNotificationEnabled: boolean;
  webhookSecret: string;
  retryAttempts: number;
  timeoutSeconds: number;
}

export interface AIProcessingConfig {
  model: 'gpt-4' | 'gpt-3.5-turbo';
  temperature: number;
  maxTokens: number;
  confidenceThreshold: number;
  businessContext?: string;
  customPrompts?: Record<string, string>;
}

// Export all types as a module
export type * from './calls.types';
