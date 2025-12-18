import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

/**
 * Local Receptionist Test Service
 *
 * Provides in-app testing of AI receptionist WITHOUT making actual calls.
 * Uses device microphone, Expo Speech for TTS, and OpenAI for conversation.
 * This allows users to try the receptionist before paying for an account.
 */

export interface LocalTestConfig {
  greeting: string;
  questions: string[];
  voiceId: string;
  onTranscript: (role: 'user' | 'assistant', text: string) => void;
  onJobExtracted: (job: any) => void;
  onError: (error: string) => void;
}

export interface AudioChunk {
  uri: string;
  duration: number;
}

class LocalReceptionistTestService {
  private recording: Audio.Recording | null = null;
  private conversationHistory: Array<{ role: string; content: string }> = [];
  private config: LocalTestConfig | null = null;
  private isActive: boolean = false;
  private silenceTimer: NodeJS.Timeout | null = null;
  private lastAudioLevel: number = 0;

  /**
   * Initialize local test session
   */
  async initialize(config: LocalTestConfig): Promise<void> {
    this.config = config;
    this.conversationHistory = [];
    this.isActive = true;

    // Setup audio mode for recording
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
      shouldDuckAndroid: true,
      interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
      playThroughEarpieceAndroid: false,
    });

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(config);
    this.conversationHistory.push({
      role: 'system',
      content: systemPrompt,
    });

    // Play greeting
    await this.speak(config.greeting);
    config.onTranscript('assistant', config.greeting);
  }

  /**
   * Build system prompt for AI receptionist
   */
  private buildSystemPrompt(config: LocalTestConfig): string {
    const questionBlock = config.questions.length > 0
      ? `Intake questions (ask these naturally):\n${config.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
      : 'Collect the caller\'s name, contact details, service request, timing, and location.';

    return [
      'You are Flynn, a friendly AI receptionist helping a small business capture lead information.',
      'Your goal is to gather booking details from the caller in a natural, conversational way.',
      '',
      'Key behaviors:',
      '- Be warm, professional, and efficient',
      '- Ask ONE question at a time',
      '- Acknowledge answers briefly before moving to the next question',
      '- After gathering all information, confirm the details back to the caller',
      '- Keep responses concise (1-2 sentences max)',
      '- Use casual, friendly language',
      '',
      questionBlock,
      '',
      'After collecting all details, summarize what you captured and thank them.',
    ].join('\n');
  }

  /**
   * Start recording user speech
   */
  async startRecording(): Promise<void> {
    if (!this.isActive) return;

    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Microphone permission not granted');
      }

      this.recording = new Audio.Recording();
      await this.recording.prepareToRecordAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        android: {
          extension: '.m4a',
          outputFormat: Audio.ANDROID_OUTPUT_FORMAT.MPEG_4,
          audioEncoder: Audio.ANDROID_AUDIO_ENCODER.AAC,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
      });

      await this.recording.startAsync();

      // Monitor audio levels for silence detection
      this.recording.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording && status.metering !== undefined) {
          this.lastAudioLevel = status.metering;
          this.detectSilence(status.metering);
        }
      });
    } catch (error) {
      console.error('[LocalTest] Recording error:', error);
      this.config?.onError('Failed to start recording: ' + (error as Error).message);
      throw error;
    }
  }

  /**
   * Detect silence to automatically stop recording
   */
  private detectSilence(metering: number): void {
    const SILENCE_THRESHOLD = -40; // dB
    const SILENCE_DURATION = 1500; // ms

    if (metering < SILENCE_THRESHOLD) {
      if (!this.silenceTimer) {
        this.silenceTimer = setTimeout(() => {
          this.stopRecording();
        }, SILENCE_DURATION);
      }
    } else {
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
    }
  }

  /**
   * Stop recording and process user speech
   */
  async stopRecording(): Promise<void> {
    if (!this.recording) return;

    try {
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      this.recording = null;

      if (uri) {
        // Transcribe audio using Whisper (requires API key)
        await this.transcribeAndRespond(uri);
      }
    } catch (error) {
      console.error('[LocalTest] Stop recording error:', error);
      this.config?.onError('Failed to process recording');
    }
  }

  /**
   * Transcribe audio and generate AI response
   */
  private async transcribeAndRespond(audioUri: string): Promise<void> {
    if (!this.isActive || !this.config) return;

    try {
      // Transcribe using Whisper API
      const transcript = await this.transcribeAudio(audioUri);

      if (!transcript || transcript.trim().length === 0) {
        // No speech detected, wait for user to speak
        return;
      }

      this.config.onTranscript('user', transcript);
      this.conversationHistory.push({
        role: 'user',
        content: transcript,
      });

      // Generate AI response
      const response = await this.generateResponse();
      this.config.onTranscript('assistant', response);

      // Speak response
      await this.speak(response);

      // Check if we should extract job details
      if (this.shouldExtractJob()) {
        await this.extractJobDetails();
      }

      // Continue listening
      await this.startRecording();
    } catch (error) {
      console.error('[LocalTest] Transcribe and respond error:', error);
      this.config?.onError('Failed to process speech');
    }
  }

  /**
   * Transcribe audio using Whisper API
   */
  private async transcribeAudio(audioUri: string): Promise<string> {
    // This requires OpenAI API key
    // For now, return placeholder (you'll need to implement API call)

    // TODO: Implement actual Whisper transcription
    // const formData = new FormData();
    // formData.append('file', { uri: audioUri, type: 'audio/m4a', name: 'audio.m4a' });
    // formData.append('model', 'whisper-1');

    return ''; // Placeholder
  }

  /**
   * Generate AI response using OpenAI
   */
  private async generateResponse(): Promise<string> {
    // This requires OpenAI API key
    // For now, return placeholder

    // TODO: Implement actual OpenAI API call
    // const response = await fetch('https://api.openai.com/v1/chat/completions', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${OPENAI_API_KEY}`,
    //   },
    //   body: JSON.stringify({
    //     model: 'gpt-4',
    //     messages: this.conversationHistory,
    //     temperature: 0.7,
    //     max_tokens: 150,
    //   }),
    // });

    return 'Thank you for that information. What else can I help you with?';
  }

  /**
   * Check if we should extract job details
   */
  private shouldExtractJob(): boolean {
    // Extract job after collecting enough information
    return this.conversationHistory.filter(m => m.role === 'user').length >= 4;
  }

  /**
   * Extract job details from conversation
   */
  private async extractJobDetails(): Promise<void> {
    if (!this.config) return;

    // TODO: Implement job extraction using OpenAI
    const jobDetails = {
      clientName: 'Test User',
      clientPhone: '555-0100',
      serviceType: 'General Service',
      scheduledDate: new Date().toISOString().split('T')[0],
      notes: 'Extracted from local test call',
      confidence: 0.85,
    };

    this.config.onJobExtracted(jobDetails);
  }

  /**
   * Speak text using device TTS
   */
  private async speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      // Get voice based on platform and config
      const voice = this.getVoiceForPlatform();

      Speech.speak(text, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.9, // Slightly slower for clarity
        voice: voice,
        onDone: () => resolve(),
        onError: (error) => {
          console.error('[LocalTest] Speech error:', error);
          resolve(); // Continue anyway
        },
      });
    });
  }

  /**
   * Get appropriate voice for platform
   */
  private getVoiceForPlatform(): string | undefined {
    if (Platform.OS === 'ios') {
      // iOS voices: Samantha (female), Daniel (male)
      if (this.config?.voiceId === 'flynn_hype' || this.config?.voiceId === 'flynn_warm') {
        return 'com.apple.ttsbundle.Samantha-compact'; // Warm female voice
      }
      return 'com.apple.ttsbundle.Samantha-compact';
    } else if (Platform.OS === 'android') {
      // Android uses default system voice
      return undefined;
    }
    return undefined;
  }

  /**
   * Stop the test session
   */
  async stop(): Promise<void> {
    this.isActive = false;

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    if (this.recording) {
      await this.recording.stopAndUnloadAsync();
      this.recording = null;
    }

    // Stop any ongoing speech
    await Speech.stop();

    this.conversationHistory = [];
    this.config = null;
  }

  /**
   * Check if service is currently active
   */
  isRunning(): boolean {
    return this.isActive;
  }
}

export const localReceptionistTestService = new LocalReceptionistTestService();
export default localReceptionistTestService;
