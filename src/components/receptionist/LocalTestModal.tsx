import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Animated,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { Phone, PhoneOff, Mic, MicOff, CheckCircle, Calendar, MapPin, User, Clock } from 'lucide-react-native';
import { FlynnButton } from '../ui/FlynnButton';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../services/apiClient';

interface JobExtraction {
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  serviceType?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  location?: string;
  notes?: string;
  urgency?: 'low' | 'medium' | 'high';
  confidence?: number;
}

interface LocalTestModalProps {
  visible: boolean;
  onClose: () => void;
  greeting?: string;
  questions?: string[];
  voiceId?: string;
}

type TestState = 'idle' | 'requesting_permission' | 'active' | 'processing' | 'ended' | 'reviewing_job';

export const LocalTestModal: React.FC<LocalTestModalProps> = ({
  visible,
  onClose,
  greeting,
  questions,
  voiceId,
}) => {
  const { user } = useAuth();
  const navigation = useNavigation();

  const [testState, setTestState] = useState<TestState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [extractedJob, setExtractedJob] = useState<JobExtraction | null>(null);
  const [isAISpeaking, setIsAISpeaking] = useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const conversationRef = useRef<Array<{ role: string; content: string }>>([]);
  const micAnimation = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) {
      resetState();
    }
  }, [visible]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  // Animate mic icon when recording
  useEffect(() => {
    if (testState === 'active' && !isAISpeaking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(micAnimation, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(micAnimation, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      micAnimation.setValue(1);
    }
  }, [testState, isAISpeaking]);

  const requestPermissions = async (): Promise<boolean> => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Microphone Permission Required',
          'Please enable microphone access to test your AI receptionist.'
        );
        return false;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
        shouldDuckAndroid: true,
        interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
        playThroughEarpieceAndroid: false,
      });

      return true;
    } catch (err) {
      console.error('[LocalTest] Permission error:', err);
      setError('Failed to setup microphone');
      return false;
    }
  };

  const startTest = async () => {
    setError(null);
    setTranscript([]);
    conversationRef.current = [];

    setTestState('requesting_permission');
    const hasPermission = await requestPermissions();

    if (!hasPermission) {
      setTestState('idle');
      return;
    }

    // Build system prompt
    const systemPrompt = buildSystemPrompt();
    conversationRef.current.push({
      role: 'system',
      content: systemPrompt,
    });

    setTestState('active');

    // Play greeting
    const greetingText = greeting || 'Hi! This is Flynn, your AI receptionist. How can I help you today?';
    addTranscript('assistant', greetingText);
    await speak(greetingText);

    // Start listening
    await startListening();
  };

  const buildSystemPrompt = (): string => {
    const questionBlock = questions && questions.length > 0
      ? `Intake questions (ask these naturally, one at a time):\n${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
      : 'Collect the caller\'s name, contact details, service request, timing, and location.';

    return [
      'You are Flynn, a friendly AI receptionist for a small business.',
      'Your goal is to gather booking details in a natural, conversational way.',
      '',
      'Key behaviors:',
      '- Be warm, professional, and efficient',
      '- Ask ONE question at a time',
      '- Acknowledge answers briefly (1 sentence) before moving to next question',
      '- Keep responses concise (1-2 sentences max)',
      '- Use casual, friendly language',
      '- After gathering all information, confirm details and thank the caller',
      '',
      questionBlock,
    ].join('\n');
  };

  const startListening = async () => {
    if (isMuted) return;

    try {
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
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

      await recording.startAsync();
      recordingRef.current = recording;

      // Stop recording after 10 seconds (user should tap mic to send)
      setTimeout(() => {
        if (recordingRef.current === recording) {
          stopListening();
        }
      }, 10000);
    } catch (err) {
      console.error('[LocalTest] Recording start error:', err);
      setError('Failed to start recording');
    }
  };

  const stopListening = async () => {
    if (!recordingRef.current) return;

    try {
      setTestState('processing');
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (uri && testState !== 'ended') {
        await processAudio(uri);
      }
    } catch (err) {
      console.error('[LocalTest] Recording stop error:', err);
      setError('Failed to process recording');
      setTestState('active');
    }
  };

  const processAudio = async (audioUri: string) => {
    try {
      // Transcribe audio using Whisper
      const transcript = await transcribeAudio(audioUri);

      if (!transcript || transcript.trim().length < 2) {
        // No meaningful speech detected
        setTestState('active');
        await startListening();
        return;
      }

      addTranscript('user', transcript);
      conversationRef.current.push({
        role: 'user',
        content: transcript,
      });

      // Generate AI response
      const response = await generateResponse();
      addTranscript('assistant', response);

      // Check if we should extract job
      if (shouldExtractJob()) {
        await extractJob();
      }

      // Speak response
      await speak(response);

      // Continue conversation
      if (testState === 'active') {
        await startListening();
      }
    } catch (err) {
      console.error('[LocalTest] Process audio error:', err);
      setError('Failed to process speech');
      setTestState('active');
    }
  };

  const transcribeAudio = async (audioUri: string): Promise<string> => {
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: audioUri,
        type: 'audio/m4a',
        name: 'audio.m4a',
      } as any);
      formData.append('model', 'whisper-1');

      const response = await apiClient.post('/ai/transcribe', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data.text || '';
    } catch (err) {
      console.error('[LocalTest] Transcription error:', err);
      throw new Error('Failed to transcribe audio');
    }
  };

  const generateResponse = async (): Promise<string> => {
    try {
      const response = await apiClient.post('/ai/chat', {
        messages: conversationRef.current,
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 150,
      });

      const aiMessage = response.data.choices?.[0]?.message?.content || '';
      conversationRef.current.push({
        role: 'assistant',
        content: aiMessage,
      });

      return aiMessage;
    } catch (err) {
      console.error('[LocalTest] Generate response error:', err);
      throw new Error('Failed to generate AI response');
    }
  };

  const shouldExtractJob = (): boolean => {
    const userMessages = conversationRef.current.filter(m => m.role === 'user');
    return userMessages.length >= 3; // Extract after 3+ user responses
  };

  const extractJob = async () => {
    try {
      const conversationText = conversationRef.current
        .filter(m => m.role !== 'system')
        .map(m => `${m.role === 'user' ? 'Caller' : 'Flynn'}: ${m.content}`)
        .join('\n');

      const response = await apiClient.post('/ai/extract-job', {
        transcript: conversationText,
      });

      if (response.data.job) {
        setExtractedJob(response.data.job);
      }
    } catch (err) {
      console.error('[LocalTest] Job extraction error:', err);
      // Non-critical error, continue
    }
  };

  const speak = async (text: string): Promise<void> => {
    return new Promise((resolve) => {
      setIsAISpeaking(true);

      Speech.speak(text, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.9,
        onDone: () => {
          setIsAISpeaking(false);
          resolve();
        },
        onError: (err) => {
          console.error('[LocalTest] Speech error:', err);
          setIsAISpeaking(false);
          resolve();
        },
      });
    });
  };

  const addTranscript = (role: 'user' | 'assistant', text: string) => {
    const prefix = role === 'assistant' ? '🤖 Flynn' : '👤 You';
    setTranscript(prev => [...prev, `${prefix}: ${text}`]);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (!isMuted && recordingRef.current) {
      stopListening();
    }
  };

  const endTest = async () => {
    await cleanup();

    // Show job review if extracted
    if (extractedJob && extractedJob.confidence && extractedJob.confidence > 0.5) {
      setTestState('reviewing_job');
    } else {
      setTestState('ended');
      setTimeout(() => {
        onClose();
        resetState();
      }, 2000);
    }
  };

  const cleanup = async () => {
    setTestState('ended');

    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch (err) {
        console.error('[LocalTest] Cleanup recording error:', err);
      }
      recordingRef.current = null;
    }

    await Speech.stop();
  };

  const resetState = () => {
    setTestState('idle');
    setTranscript([]);
    setError(null);
    setExtractedJob(null);
    setIsMuted(false);
    setIsAISpeaking(false);
    conversationRef.current = [];
  };

  const handleViewJob = () => {
    cleanup();
    onClose();
    // @ts-ignore
    navigation.navigate('Calendar');
    resetState();
  };

  const handleClose = () => {
    cleanup();
    onClose();
    resetState();
  };

  // Job Review Screen
  if (testState === 'reviewing_job' && extractedJob) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleClose}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <CheckCircle size={48} color={colors.success} />
            <Text style={styles.title}>Test Complete!</Text>
            <Text style={styles.subtitle}>
              Flynn successfully captured these details
            </Text>
          </View>

          <ScrollView style={styles.jobDetailsContainer}>
            {extractedJob.clientName && (
              <View style={styles.jobDetailRow}>
                <User size={20} color={colors.primary} />
                <View style={styles.jobDetailText}>
                  <Text style={styles.jobDetailLabel}>Client</Text>
                  <Text style={styles.jobDetailValue}>{extractedJob.clientName}</Text>
                </View>
              </View>
            )}

            {extractedJob.clientPhone && (
              <View style={styles.jobDetailRow}>
                <Phone size={20} color={colors.primary} />
                <View style={styles.jobDetailText}>
                  <Text style={styles.jobDetailLabel}>Phone</Text>
                  <Text style={styles.jobDetailValue}>{extractedJob.clientPhone}</Text>
                </View>
              </View>
            )}

            {extractedJob.serviceType && (
              <View style={styles.jobDetailRow}>
                <CheckCircle size={20} color={colors.primary} />
                <View style={styles.jobDetailText}>
                  <Text style={styles.jobDetailLabel}>Service</Text>
                  <Text style={styles.jobDetailValue}>{extractedJob.serviceType}</Text>
                </View>
              </View>
            )}

            {(extractedJob.scheduledDate || extractedJob.scheduledTime) && (
              <View style={styles.jobDetailRow}>
                <Calendar size={20} color={colors.primary} />
                <View style={styles.jobDetailText}>
                  <Text style={styles.jobDetailLabel}>When</Text>
                  <Text style={styles.jobDetailValue}>
                    {extractedJob.scheduledDate && extractedJob.scheduledTime
                      ? `${extractedJob.scheduledDate} at ${extractedJob.scheduledTime}`
                      : extractedJob.scheduledDate || extractedJob.scheduledTime}
                  </Text>
                </View>
              </View>
            )}

            {extractedJob.location && (
              <View style={styles.jobDetailRow}>
                <MapPin size={20} color={colors.primary} />
                <View style={styles.jobDetailText}>
                  <Text style={styles.jobDetailLabel}>Location</Text>
                  <Text style={styles.jobDetailValue}>{extractedJob.location}</Text>
                </View>
              </View>
            )}

            {extractedJob.notes && (
              <View style={styles.jobDetailRow}>
                <Clock size={20} color={colors.primary} />
                <View style={styles.jobDetailText}>
                  <Text style={styles.jobDetailLabel}>Notes</Text>
                  <Text style={styles.jobDetailValue}>{extractedJob.notes}</Text>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <FlynnButton
              title="Done"
              onPress={handleClose}
              variant="primary"
              fullWidth
            />
          </View>
        </View>
      </Modal>
    );
  }

  // Main Test Screen
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Try Flynn</Text>
          <Text style={styles.subtitle}>
            Test your receptionist with your device mic and speaker
          </Text>
        </View>

        <View style={styles.statusContainer}>
          <View style={[
            styles.statusIndicator,
            testState === 'active' && styles.statusIndicatorActive
          ]} />
          <Text style={styles.statusText}>
            {testState === 'idle' && 'Ready to test'}
            {testState === 'requesting_permission' && 'Requesting permission...'}
            {testState === 'active' && (isAISpeaking ? 'Flynn is speaking...' : 'Listening...')}
            {testState === 'processing' && 'Processing...'}
            {testState === 'ended' && 'Test ended'}
          </Text>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.transcriptContainer}>
          <Text style={styles.transcriptLabel}>Conversation:</Text>
          <ScrollView style={styles.transcriptBox}>
            {transcript.length === 0 ? (
              <Text style={styles.transcriptEmpty}>
                Start the test to begin your conversation with Flynn
              </Text>
            ) : (
              transcript.map((line, index) => (
                <Text key={index} style={styles.transcriptLine}>{line}</Text>
              ))
            )}
          </ScrollView>
        </View>

        <View style={styles.controls}>
          {testState === 'idle' && (
            <>
              <FlynnButton
                title="START TEST"
                onPress={startTest}
                icon={<Phone size={20} color={colors.white} />}
                iconPosition="left"
                variant="primary"
                fullWidth
              />
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}

          {(testState === 'requesting_permission' || testState === 'processing') && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}

          {testState === 'active' && (
            <View style={styles.activeControls}>
              <TouchableOpacity
                style={styles.micButton}
                onPress={stopListening}
                disabled={isAISpeaking}
              >
                <Animated.View style={{ transform: [{ scale: micAnimation }] }}>
                  <Mic size={32} color={colors.white} />
                </Animated.View>
                <Text style={styles.micButtonLabel}>
                  {isAISpeaking ? 'Flynn speaking...' : 'Tap to send'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.endButton} onPress={endTest}>
                <PhoneOff size={24} color={colors.white} />
              </TouchableOpacity>
            </View>
          )}

          {testState === 'ended' && (
            <FlynnButton
              title="Close"
              onPress={handleClose}
              variant="secondary"
              fullWidth
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    paddingTop: spacing.xxxl,
    paddingHorizontal: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.displayMedium,
    color: colors.black,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodyMedium,
    color: colors.gray600,
    textAlign: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.gray400,
    marginRight: spacing.xs,
  },
  statusIndicatorActive: {
    backgroundColor: colors.success,
  },
  statusText: {
    ...typography.bodyMedium,
    color: colors.gray700,
  },
  errorContainer: {
    backgroundColor: colors.errorLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    ...typography.bodyMedium,
    color: colors.error,
    textAlign: 'center',
  },
  transcriptContainer: {
    flex: 1,
    marginBottom: spacing.xl,
  },
  transcriptLabel: {
    ...typography.label,
    color: colors.gray700,
    marginBottom: spacing.sm,
  },
  transcriptBox: {
    flex: 1,
    backgroundColor: colors.gray50,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.gray200,
    padding: spacing.md,
  },
  transcriptEmpty: {
    ...typography.bodyMedium,
    color: colors.gray500,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  transcriptLine: {
    ...typography.bodyMedium,
    color: colors.gray800,
    marginBottom: spacing.sm,
  },
  controls: {
    marginBottom: spacing.lg,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  activeControls: {
    alignItems: 'center',
    gap: spacing.xl,
  },
  micButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
  micButtonLabel: {
    ...typography.caption,
    color: colors.white,
    marginTop: spacing.xs,
    fontWeight: '600',
  },
  endButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  cancelText: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '600',
  },
  jobDetailsContainer: {
    flex: 1,
    marginBottom: spacing.lg,
  },
  jobDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    backgroundColor: colors.gray50,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.gray200,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  jobDetailText: {
    flex: 1,
  },
  jobDetailLabel: {
    ...typography.caption,
    color: colors.gray600,
    marginBottom: spacing.xxs,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  jobDetailValue: {
    ...typography.bodyMedium,
    color: colors.gray800,
    fontWeight: '500',
  },
  actions: {
    paddingBottom: spacing.lg,
  },
});
