/**
 * Native Voice Agent Service
 *
 * Manages WebSocket connection to the backend for native AI receptionist testing
 * Handles audio recording, streaming, and playback for in-app conversation testing
 */

import { Audio } from 'expo-av';
import { EventEmitter } from 'events';
import apiClient from './apiClient';

// Configuration
const WEBSOCKET_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000').replace('http', 'ws');
const RECORDING_OPTIONS = {
  android: {
    extension: '.wav',
    outputFormat: Audio.AndroidOutputFormat.DEFAULT,
    audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
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
      this.setState('connecting');

      // Request audio permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Audio permission not granted');
      }

      // Configure audio mode for recording and playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
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
          // Start recording user audio
          this.startRecording();
          break;

        case 'audio':
          // Play AI response audio
          this.playAudio(message.audio);
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
          // Resume recording for user response
          this.resumeRecording();
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
          const result: ConversationResult = {
            transcript: message.transcript,
            entities: message.entities || this.extractedEntities,
            conversationHistory: message.conversationHistory || this.conversationHistory,
          };
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
   */
  private async pauseRecording(): Promise<void> {
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }
  }

  /**
   * Resume recording (when agent stops speaking)
   */
  private async resumeRecording(): Promise<void> {
    if (!this.recordingInterval && this.recording) {
      this.recordingInterval = setInterval(() => {
        this.sendAudioChunk();
      }, 100);
    }
  }

  /**
   * Send audio chunk to backend
   */
  private async sendAudioChunk(): Promise<void> {
    if (!this.recording) return;

    try {
      // Get recording status to access latest audio data
      const status = await this.recording.getStatusAsync();

      if (status.isRecording) {
        // Read the recording URI and convert to base64
        const uri = this.recording.getURI();
        if (uri) {
          // Note: In a production app, we'd read the file incrementally
          // For now, we'll send the full recording periodically
          const response = await fetch(uri);
          const blob = await response.blob();
          const reader = new FileReader();

          reader.onloadend = () => {
            const base64Audio = (reader.result as string).split(',')[1];
            if (base64Audio && base64Audio.length > 0) {
              this.sendWebSocketMessage({
                type: 'audio',
                audio: base64Audio,
              });
            }
          };

          reader.readAsDataURL(blob);
        }
      }
    } catch (error) {
      console.error('[NativeVoiceAgent] Error sending audio chunk:', error);
    }
  }

  /**
   * Play audio received from agent
   */
  private async playAudio(base64Audio: string): Promise<void> {
    try {
      // Unload previous sound if exists
      if (this.sound) {
        await this.sound.unloadAsync();
      }

      // Convert base64 to blob URI (required for Audio.Sound)
      const audioBlob = this.base64ToBlob(base64Audio, 'audio/wav');
      const audioUrl = URL.createObjectURL(audioBlob);

      // Load and play sound
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded && status.didJustFinish) {
            this.emit('audio_finished');
          }
        }
      );

      this.sound = sound;
    } catch (error) {
      console.error('[NativeVoiceAgent] Error playing audio:', error);
    }
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
