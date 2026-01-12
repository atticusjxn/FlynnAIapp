/**
 * Native Voice Agent Service
 *
 * Manages WebSocket connection to the backend for native AI receptionist testing
 * Handles audio recording, streaming, and playback for in-app conversation testing
 */

import { Audio } from 'expo-av';
import { EventEmitter } from 'events';
import { Buffer } from 'buffer';
import { apiClient } from './apiClient';

// Configuration
const WEBSOCKET_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || 'https://flynnai-telephony.fly.dev').replace('http', 'ws');
const RECORDING_OPTIONS = {
  android: {
    extension: '.wav',
    outputFormat: Audio.AndroidOutputFormat.DEFAULT,
    audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
    metering: true, // Enable metering for animation
  },
  ios: {
    extension: '.wav',
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
    metering: true, // Enable metering for animation
  },
  web: {
    mimeType: 'audio/wav',
    bitsPerSecond: 256000,
  },
};

export type ConversationState =
  | 'disconnected'
  | 'connecting'
  | 'ready'
  | 'agent_speaking'
  | 'user_speaking'
  | 'processing'
  | 'ended'
  | 'error';

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ExtractedEntities {
  caller_name?: string;
  phone_number?: string;
  service_type?: string;
  preferred_date?: string;
  preferred_time?: string;
  location?: string;
  urgency?: 'urgent' | 'normal' | 'flexible';
  notes?: string;
}

export interface ConversationResult {
  transcript: string;
  entities: ExtractedEntities;
  conversationHistory: ConversationMessage[];
  durationSeconds?: number; // Total conversation duration in seconds
}

class NativeVoiceAgentService extends EventEmitter {
  private ws: WebSocket | null = null;
  private recording: Audio.Recording | null = null;
  private sound: Audio.Sound | null = null;
  private state: ConversationState = 'disconnected';
  private conversationHistory: ConversationMessage[] = [];
  private extractedEntities: ExtractedEntities = {};
  private recordingInterval: NodeJS.Timeout | null = null;
  private audioChunks: string[] = [];
  private audioBytesSent: number = 0; // Track how many bytes we've already sent
  private shouldSendAudio: boolean = true; // Control whether to send audio chunks
  private conversationStartTime: number = 0; // Track conversation start for duration calculation
  private isFirstGreeting: boolean = true; // Don't record during AI's initial greeting

  // Audio Playback Queue
  private audioPlaybackQueue: string[] = [];
  private isPlayingAudio: boolean = false;

  /**
   * Start a new test conversation
   */
  async startConversation(
    userId: string,
    greeting: string,
    voiceId: string = 'flynn_warm',
    mode: string = 'ai_only'
  ): Promise<void> {
    try {
      console.log('[NativeVoiceAgent] Starting conversation...');
      
      // Reset conversation state
      this.conversationHistory = [];
      this.extractedEntities = {};
      this.audioPlaybackQueue = [];
      this.isPlayingAudio = false;
      this.audioBytesSent = 0;
      this.shouldSendAudio = true;
      this.conversationStartTime = 0;
      this.isFirstGreeting = true;

      this.setState('connecting');

      // Request audio permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Audio permission not granted');
      }

      // Configure audio mode for recording and playback
      // Use loudspeaker with echo cancellation for proper voice chat experience
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false, // Use loudspeaker, not earpiece
        // iOS automatically enables echo cancellation when recording + playback
      });

      // Build WebSocket URL with parameters
      const wsUrl = `${WEBSOCKET_URL}/realtime/native-test?userId=${encodeURIComponent(userId)}&greeting=${encodeURIComponent(greeting)}&voiceId=${encodeURIComponent(voiceId)}&mode=${encodeURIComponent(mode)}`;

      console.log('[NativeVoiceAgent] Connecting to:', wsUrl);

      // Create WebSocket connection
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[NativeVoiceAgent] WebSocket connected');
      };

      this.ws.onmessage = (event) => {
        this.handleWebSocketMessage(event.data);
      };

      this.ws.onerror = (error) => {
        console.error('[NativeVoiceAgent] WebSocket error:', error);
        this.setState('error');
        this.emit('error', error);
      };

      this.ws.onclose = () => {
        console.log('[NativeVoiceAgent] WebSocket closed');
        this.cleanup();
      };

    } catch (error) {
      console.error('[NativeVoiceAgent] Failed to start conversation:', error);
      this.setState('error');
      throw error;
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleWebSocketMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      console.log('[NativeVoiceAgent] Received message:', message.type);

      switch (message.type) {
        case 'ready':
          this.setState('ready');
          this.emit('ready');
          // Automatically start the agent
          this.sendWebSocketMessage({ type: 'start' });
          break;

        case 'agent_ready':
          this.setState('ready');
          this.emit('agent_ready');
          // Track conversation start time for duration calculation
          this.conversationStartTime = Date.now();
          // Don't start recording yet - wait for AI to finish its initial greeting
          // Recording will start on first 'agent_stopped_speaking' event
          console.log('[NativeVoiceAgent] Agent ready - waiting for initial greeting to complete');
          break;

        case 'audio':
          // Add to playback queue instead of playing immediately
          this.queueAudio(message.audio);
          // Failsafe: Ensure recording is paused when we receive audio, 
          // in case 'agent_started_speaking' event was missed or delayed.
          this.pauseRecording();
          break;
          
        case 'agent_audio_done':
          // Failsafe: Ensure recording resumes when agent audio finishes,
          // in case 'agent_stopped_speaking' event was missed.
          this.resumeRecording();
          this.emit('agent_stopped_speaking');
          break;

        case 'agent_started_speaking':
          this.setState('agent_speaking');
          this.emit('agent_started_speaking');
          // Pause recording while agent speaks
          this.pauseRecording();
          break;

        case 'agent_stopped_speaking':
          this.setState('ready');
          this.emit('agent_stopped_speaking');
          // If this is the first greeting, start recording for the first time
          if (this.isFirstGreeting) {
            console.log('[NativeVoiceAgent] Initial greeting complete - starting user recording');
            this.isFirstGreeting = false;
            this.startRecording();
          } else {
            // For subsequent interactions, resume recording
            this.resumeRecording();
          }
          break;

        case 'user_started_speaking':
          this.setState('user_speaking');
          this.emit('user_started_speaking');
          break;

        case 'transcript':
          const transcriptMessage: ConversationMessage = {
            role: message.role,
            content: message.text,
            timestamp: new Date(),
          };
          this.conversationHistory.push(transcriptMessage);
          this.emit('transcript', transcriptMessage);
          break;

        case 'entities_extracted':
          this.extractedEntities = {
            ...this.extractedEntities,
            ...message.entities,
          };
          this.emit('entities_updated', this.extractedEntities);
          break;

        case 'conversation_ended':
          this.setState('ended');
          // Calculate conversation duration
          const durationMs = this.conversationStartTime ? Date.now() - this.conversationStartTime : 0;
          const durationSeconds = Math.round(durationMs / 1000);

          const result: ConversationResult = {
            transcript: message.transcript,
            entities: message.entities || this.extractedEntities,
            conversationHistory: message.conversationHistory || this.conversationHistory,
            durationSeconds,
          };
          console.log(`[NativeVoiceAgent] Conversation ended - duration: ${durationSeconds}s`);
          this.emit('conversation_ended', result);
          this.cleanup();
          break;

        case 'error':
          console.error('[NativeVoiceAgent] Server error:', message.error);
          this.setState('error');
          this.emit('error', new Error(message.error));
          break;

        default:
          console.warn('[NativeVoiceAgent] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[NativeVoiceAgent] Error handling WebSocket message:', error);
    }
  }

  /**
   * Start recording user audio
   */
  private async startRecording(): Promise<void> {
    try {
      console.log('[NativeVoiceAgent] Starting audio recording...');

      // Reset audio bytes sent counter
      this.audioBytesSent = 0;

      // Make sure any existing recording is properly disposed of
      if (this.recording) {
        try {
          await this.recording.stopAndUnloadAsync();
        } catch (unloadError) {
          console.warn('[NativeVoiceAgent] Error unloading existing recording:', unloadError);
        }
        this.recording = null;
      }

      const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS);
      this.recording = recording;

      // Start streaming audio chunks at regular intervals
      this.recordingInterval = setInterval(() => {
        this.sendAudioChunk();
      }, 100); // Send chunks every 100ms

      console.log('[NativeVoiceAgent] Recording started');
    } catch (error) {
      console.error('[NativeVoiceAgent] Failed to start recording:', error);
    }
  }

  /**
   * Pause recording (when agent is speaking)
   * Stops recording to prevent microphone from capturing agent's voice
   */
  private async pauseRecording(): Promise<void> {
    console.log('[NativeVoiceAgent] Pausing audio capture (agent speaking)...');
    this.shouldSendAudio = false;

    // Stop the recording interval
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }

    // Stop and unload the recording to turn off the microphone
    if (this.recording) {
      try {
        await this.recording.stopAndUnloadAsync();
        this.recording = null;
      } catch (error) {
        console.warn('[NativeVoiceAgent] Error stopping recording during pause:', error);
      }
    }
  }

  /**
   * Resume recording (when agent stops speaking)
   * Starts a fresh recording session for user speech
   */
  private async resumeRecording(): Promise<void> {
    console.log('[NativeVoiceAgent] Resuming audio capture (agent done)...');

    // Small delay to ensure previous recording is fully cleaned up
    await new Promise(resolve => setTimeout(resolve, 100));

    // Only start if we don't already have a recording
    if (!this.recording) {
      this.shouldSendAudio = true;
      await this.startRecording();
    }
  }

  /**
   * Send audio chunk to backend (only sends NEW data since last send)
   */
  private async sendAudioChunk(): Promise<void> {
    if (!this.recording || !this.shouldSendAudio) return;

    try {
      // Get recording status to access latest audio data and metering
      const status = await this.recording.getStatusAsync();

      if (status.isRecording) {
        // Emit audio level for animation (normalized 0-1)
        // status.metering is usually -160 (silence) to 0 (loud)
        if (typeof status.metering === 'number') {
          // Normalize: -50dB to -10dB range -> 0 to 1 for better visual response
          const minDb = -50;
          const maxDb = -10;
          const level = Math.max(0, Math.min(1, (status.metering - minDb) / (maxDb - minDb)));
          this.emit('audio_level', level);
        }

        // Only send audio chunks when we should (not when agent is speaking)
        if (this.shouldSendAudio) {
          // Read the recording URI
          const uri = this.recording.getURI();
          if (uri) {
            // Fetch the entire file and read as ArrayBuffer
            const response = await fetch(uri);
            const arrayBuffer = await response.arrayBuffer();

            // Only send the NEW bytes (skip bytes we've already sent)
            if (arrayBuffer.byteLength > this.audioBytesSent) {
              let newBytes = arrayBuffer.slice(this.audioBytesSent);

              // SPECIAL HANDLING FOR WAV/PCM (iOS):
              // The first chunk includes the WAV header (44 bytes).
              // We must strip it because the server expects RAW PCM samples.
              if (this.audioBytesSent === 0 && newBytes.byteLength > 44) {
                 // Only strip if it looks like a WAV (starts with RIFF)
                 const view = new DataView(newBytes);
                 if (view.getUint32(0, false) === 0x52494646) { // 'RIFF' in big-endian
                   console.log('[NativeVoiceAgent] Stripping WAV header from first chunk');
                   newBytes = newBytes.slice(44);
                 }
              }

              // Convert only the new chunk to base64
              const uint8Array = new Uint8Array(newBytes);
              const base64Audio = this.arrayBufferToBase64(uint8Array);

              if (base64Audio && base64Audio.length > 0) {
                this.sendWebSocketMessage({
                  type: 'audio',
                  audio: base64Audio,
                });

                // Update bytes sent counter
                this.audioBytesSent = arrayBuffer.byteLength;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('[NativeVoiceAgent] Error sending audio chunk:', error);
    }
  }

  /**
   * Queue audio chunk for playback
   */
  private queueAudio(base64Audio: string): void {
    this.audioPlaybackQueue.push(base64Audio);
    this.processAudioQueue();
  }

  /**
   * Process the next item in the audio queue
   */
  private async processAudioQueue(): Promise<void> {
    if (this.isPlayingAudio || this.audioPlaybackQueue.length === 0) {
      return;
    }

    this.isPlayingAudio = true;
    const nextChunk = this.audioPlaybackQueue.shift();

    if (nextChunk) {
      try {
        await this.playAudio(nextChunk);
      } catch (error) {
        console.error('[NativeVoiceAgent] Error playing audio chunk:', error);
        this.isPlayingAudio = false;
        this.processAudioQueue(); // Try next chunk
      }
    } else {
      this.isPlayingAudio = false;
    }
  }

  /**
   * Play audio received from agent
   */
  private async playAudio(base64Audio: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        // Unload previous sound if exists (though usually we wait for it to finish)
        if (this.sound) {
          try {
            await this.sound.unloadAsync();
          } catch (e) { /* ignore unload error */ }
        }

        // DECODE: Server sends RAW PCM (Linear16, 16kHz, Mono)
        // We must add a WAV header so Expo AV can play it.
        const pcmData = this.base64ToUint8Array(base64Audio);
        const wavHeader = this.createWavHeader(pcmData.length, 16000, 1, 16);
        
        // Combine header + PCM data
        const wavData = new Uint8Array(wavHeader.length + pcmData.length);
        wavData.set(wavHeader);
        wavData.set(pcmData, wavHeader.length);
        
        // Encode back to base64 for Audio.Sound
        const wavBase64 = this.arrayBufferToBase64(wavData);
        const audioUri = `data:audio/wav;base64,${wavBase64}`;

        // Load and play sound
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUri },
          { shouldPlay: true },
          (status) => {
            if (status.isLoaded && status.didJustFinish) {
              // Sound finished playing
              this.emit('audio_finished');
              this.isPlayingAudio = false;
              // Clean up current sound
              sound.unloadAsync().catch(() => {});
              this.sound = null;
              // Trigger next chunk
              resolve();
              this.processAudioQueue();
            }
          }
        );

        this.sound = sound;
        
        // Emit fake audio levels for animation while AI speaks
        this.simulateAgentSpeakingLevels(pcmData.length);
        
      } catch (error) {
        console.error('[NativeVoiceAgent] Error playing audio:', error);
        this.isPlayingAudio = false;
        reject(error);
      }
    });
  }
  
  private speakingInterval: NodeJS.Timeout | null = null;
  
  private simulateAgentSpeakingLevels(dataLength: number) {
      // clear existing
      if (this.speakingInterval) clearInterval(this.speakingInterval);
      
      // Approx duration in seconds = samples / sampleRate / channels / (bits/8)
      // 16kHz, 16bit = 2 bytes per sample.
      const durationMs = (dataLength / 2 / 16000) * 1000;
      const startTime = Date.now();
      
      this.speakingInterval = setInterval(() => {
          const elapsed = Date.now() - startTime;
          if (elapsed >= durationMs) {
              if (this.speakingInterval) clearInterval(this.speakingInterval);
              this.emit('audio_level', 0);
              return;
          }
          // Random fluctuating level 0.3 - 0.8
          this.emit('audio_level', 0.3 + Math.random() * 0.5);
      }, 50);
  }

  /**
   * Send message to WebSocket server
   */
  private sendWebSocketMessage(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * End the conversation
   */
  async endConversation(): Promise<void> {
    console.log('[NativeVoiceAgent] Ending conversation...');
    this.sendWebSocketMessage({ type: 'stop' });
    this.setState('processing');
    if (this.speakingInterval) clearInterval(this.speakingInterval);
  }

  /**
   * Get current conversation state
   */
  getState(): ConversationState {
    return this.state;
  }

  /**
   * Get conversation history
   */
  getConversationHistory(): ConversationMessage[] {
    return this.conversationHistory;
  }

  /**
   * Get extracted entities
   */
  getExtractedEntities(): ExtractedEntities {
    return this.extractedEntities;
  }

  /**
   * Set conversation state and emit event
   */
  private setState(state: ConversationState): void {
    this.state = state;
    this.emit('state_changed', state);
  }

  /**
   * Clean up resources
   */
  private async cleanup(): Promise<void> {
    console.log('[NativeVoiceAgent] Cleaning up...');
    
    // Reset queue
    this.audioPlaybackQueue = [];
    this.isPlayingAudio = false;
    
    if (this.speakingInterval) {
        clearInterval(this.speakingInterval);
        this.speakingInterval = null;
    }

    // Stop recording
    if (this.recording) {
      try {
        await this.recording.stopAndUnloadAsync();
      } catch (error) {
        console.error('[NativeVoiceAgent] Error stopping recording:', error);
      }
      this.recording = null;
    }

    // Clear recording interval
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }

    // Unload sound
    if (this.sound) {
      try {
        await this.sound.unloadAsync();
      } catch (error) {
        console.error('[NativeVoiceAgent] Error unloading sound:', error);
      }
      this.sound = null;
    }

    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.state !== 'ended') {
      this.setState('disconnected');
    }
  }

  /**
   * Helper: Create WAV Header
   */
  private createWavHeader(dataLength: number, sampleRate: number, numChannels: number, bitsPerSample: number): Uint8Array {
      const header = new Uint8Array(44);
      const view = new DataView(header.buffer);
      
      // RIFF chunk descriptor
      this.writeString(view, 0, 'RIFF');
      view.setUint32(4, 36 + dataLength, true); // ChunkSize
      this.writeString(view, 8, 'WAVE');
      
      // fmt sub-chunk
      this.writeString(view, 12, 'fmt ');
      view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
      view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
      view.setUint16(22, numChannels, true); // NumChannels
      view.setUint32(24, sampleRate, true); // SampleRate
      view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true); // ByteRate
      view.setUint16(32, numChannels * (bitsPerSample / 8), true); // BlockAlign
      view.setUint16(34, bitsPerSample, true); // BitsPerSample
      
      // data sub-chunk
      this.writeString(view, 36, 'data');
      view.setUint32(40, dataLength, true); // Subchunk2Size
      
      return header;
  }
  
  private writeString(view: DataView, offset: number, string: string) {
      for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i));
      }
  }
  
  private base64ToUint8Array(base64: string): Uint8Array {
      return new Uint8Array(Buffer.from(base64, 'base64'));
  }

  /**
   * Helper: Convert Uint8Array to base64
   */
  private arrayBufferToBase64(uint8Array: Uint8Array): string {
    return Buffer.from(uint8Array).toString('base64');
  }

  /**
   * Helper: Convert base64 to Blob
   */
  private base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }
}

export default new NativeVoiceAgentService();
