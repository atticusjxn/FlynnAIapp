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
} from 'react-native';
import { Audio } from 'expo-av';
import { Phone, PhoneOff, Mic, MicOff, Calendar, MapPin, User, Clock, CheckCircle } from 'lucide-react-native';
import { FlynnButton } from '../ui/FlynnButton';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';

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

interface TestCallModalProps {
  visible: boolean;
  onClose: () => void;
  greeting?: string;
  questions?: string[];
  voiceId?: string;
}

type CallState = 'idle' | 'connecting' | 'connected' | 'ended' | 'reviewing_job';

export const TestCallModal: React.FC<TestCallModalProps> = ({
  visible,
  onClose,
  greeting,
  questions,
  voiceId,
}) => {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [callState, setCallState] = useState<CallState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [extractedJob, setExtractedJob] = useState<JobExtraction | null>(null);
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);

  const apiBaseUrl = Constants.expoConfig?.extra?.apiBaseUrl || 'https://flynnai-telephony.fly.dev';
  const wsUrl = apiBaseUrl.replace(/^http/, 'ws');

  useEffect(() => {
    if (visible && callState === 'idle') {
      setupAudioPermissions();
    }
  }, [visible]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const setupAudioPermissions = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        setError('Microphone permission is required for test calls');
        Alert.alert('Permission Required', 'Please enable microphone access to use test calls');
      } else {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          interruptionModeIOS: 1, // DoNotMix
          shouldDuckAndroid: true,
          interruptionModeAndroid: 1, // DoNotMix
          playThroughEarpieceAndroid: false,
        });
      }
    } catch (err) {
      console.error('Audio permissions error:', err);
      setError('Failed to setup audio permissions');
    }
  };

  const startTestCall = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to start a test call');
      return;
    }

    setCallState('connecting');
    setError(null);
    setTranscript([]);

    try {
      // Connect to WebSocket
      const testCallSid = `test_${Date.now()}`;
      const ws = new WebSocket(
        `${wsUrl}/realtime/twilio?callSid=${testCallSid}&userId=${user.id}&isTestCall=true`
      );

      ws.onopen = () => {
        console.log('[TestCall] WebSocket connected');
        setCallState('connected');
        setTranscript(prev => [...prev, '📞 Call connected']);

        // Send test call configuration
        ws.send(JSON.stringify({
          event: 'start',
          streamSid: testCallSid,
          customParameters: {
            greeting: greeting || 'Hi! This is Flynn, your AI receptionist. How can I help you today?',
            questions: questions || [],
            voiceId: voiceId || 'flynn_warm',
            isTestCall: true,
          },
        }));

        // Start recording
        startRecording();
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.event === 'media' && data.media?.payload) {
            // Queue audio for playback
            audioQueueRef.current.push(data.media.payload);
            playNextAudio();
          }

          if (data.event === 'transcript') {
            const role = data.role === 'assistant' ? '🤖 Flynn' : '👤 You';
            setTranscript(prev => [...prev, `${role}: ${data.text}`]);
          }

          if (data.event === 'job_extracted') {
            // Job details extracted from conversation
            console.log('[TestCall] Job extracted:', data.job);
            setExtractedJob(data.job);
          }

          if (data.event === 'job_created') {
            // Job was created in the database
            console.log('[TestCall] Job created:', data.jobId);
            setCreatedJobId(data.jobId);
          }

          if (data.event === 'conversation_complete') {
            // AI has finished the conversation
            console.log('[TestCall] Conversation complete');
            if (extractedJob || data.job) {
              setCallState('reviewing_job');
            }
          }
        } catch (err) {
          console.error('[TestCall] Message parse error:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('[TestCall] WebSocket error:', error);
        setError('Connection error occurred');
        setCallState('ended');
      };

      ws.onclose = () => {
        console.log('[TestCall] WebSocket closed');
        setCallState('ended');
        setTranscript(prev => [...prev, '📴 Call ended']);
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('[TestCall] Start call error:', err);
      setError('Failed to start test call');
      setCallState('ended');
    }
  };

  const startRecording = async () => {
    try {
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        android: {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
          sampleRate: 8000,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
          sampleRate: 8000,
          numberOfChannels: 1,
          bitRate: 128000,
          outputFormat: Audio.IOSOutputFormat.LINEARPCM,
        },
      });

      await recording.startAsync();
      recordingRef.current = recording;

      // Stream audio chunks to WebSocket
      recording.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording && status.metering !== undefined) {
          // Send audio data to WebSocket
          // Note: In production, you'd need to implement chunked audio streaming
        }
      });
    } catch (err) {
      console.error('[TestCall] Recording error:', err);
      setError('Failed to start recording');
    }
  };

  const playNextAudio = async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) {
      return;
    }

    isPlayingRef.current = true;
    const audioPayload = audioQueueRef.current.shift();

    try {
      if (!audioPayload) return;

      // Decode base64 and play audio
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/wav;base64,${audioPayload}` },
        { shouldPlay: true }
      );

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
          isPlayingRef.current = false;
          playNextAudio(); // Play next in queue
        }
      });
    } catch (err) {
      console.error('[TestCall] Audio playback error:', err);
      isPlayingRef.current = false;
      playNextAudio();
    }
  };

  const endCall = () => {
    cleanup();

    // Check if we have job data to show
    if (extractedJob && extractedJob.confidence && extractedJob.confidence > 0.5) {
      setCallState('reviewing_job');
    } else {
      setCallState('ended');
      setTimeout(() => {
        onClose();
        resetState();
      }, 2000);
    }
  };

  const resetState = () => {
    setCallState('idle');
    setTranscript([]);
    setError(null);
    setExtractedJob(null);
    setCreatedJobId(null);
  };

  const handleViewJob = () => {
    cleanup();
    onClose();
    // Navigate to Calendar/Events tab
    // @ts-ignore - navigation typing
    navigation.navigate('Calendar');
    resetState();
  };

  const handleCloseJobReview = () => {
    cleanup();
    onClose();
    resetState();
  };

  const cleanup = () => {
    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Stop recording
    if (recordingRef.current) {
      recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;
    }

    // Clear audio queue
    audioQueueRef.current = [];
    isPlayingRef.current = false;
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    // In production: toggle recording pause/resume
  };

  const getCallStateLabel = () => {
    switch (callState) {
      case 'connecting': return 'Connecting...';
      case 'connected': return 'Call in progress';
      case 'ended': return 'Call ended';
      default: return 'Ready to call';
    }
  };

  // Job Review Screen
  if (callState === 'reviewing_job' && extractedJob) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseJobReview}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <CheckCircle size={48} color={colors.success} />
            <Text style={styles.title}>Job Booked!</Text>
            <Text style={styles.subtitle}>
              Flynn successfully captured the following details from your test call
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

            {extractedJob.confidence !== undefined && (
              <View style={styles.confidenceContainer}>
                <Text style={styles.confidenceLabel}>
                  Confidence: {Math.round(extractedJob.confidence * 100)}%
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.jobReviewActions}>
            <FlynnButton
              title="View in Calendar"
              onPress={handleViewJob}
              icon={<Calendar size={20} color={colors.white} />}
              iconPosition="left"
              variant="primary"
              fullWidth
            />
            <FlynnButton
              title="Close"
              onPress={handleCloseJobReview}
              variant="secondary"
              fullWidth
            />
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Test Call</Text>
          <Text style={styles.subtitle}>
            Try out your AI receptionist before going live
          </Text>
        </View>

        <View style={styles.statusContainer}>
          <View style={[
            styles.statusIndicator,
            callState === 'connected' && styles.statusIndicatorActive
          ]} />
          <Text style={styles.statusText}>{getCallStateLabel()}</Text>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.transcriptContainer}>
          <Text style={styles.transcriptLabel}>Call transcript:</Text>
          <View style={styles.transcriptBox}>
            {transcript.length === 0 ? (
              <Text style={styles.transcriptEmpty}>
                {callState === 'idle'
                  ? 'Start the call to see the conversation'
                  : 'Waiting for conversation...'}
              </Text>
            ) : (
              transcript.map((line, index) => (
                <Text key={index} style={styles.transcriptLine}>{line}</Text>
              ))
            )}
          </View>
        </View>

        <View style={styles.controls}>
          {callState === 'idle' && (
            <FlynnButton
              title="START TEST CALL"
              onPress={startTestCall}
              icon={<Phone size={20} color={colors.white} />}
              iconPosition="left"
              variant="primary"
              fullWidth
            />
          )}

          {callState === 'connecting' && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Connecting to your AI receptionist...</Text>
            </View>
          )}

          {callState === 'connected' && (
            <View style={styles.activeCallControls}>
              <TouchableOpacity
                style={[styles.muteButton, isMuted && styles.muteButtonActive]}
                onPress={toggleMute}
              >
                {isMuted ? (
                  <MicOff size={24} color={colors.white} />
                ) : (
                  <Mic size={24} color={colors.white} />
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.endCallButton} onPress={endCall}>
                <PhoneOff size={32} color={colors.white} />
              </TouchableOpacity>
            </View>
          )}

          {callState === 'ended' && (
            <FlynnButton
              title="Close"
              onPress={onClose}
              variant="secondary"
              fullWidth
            />
          )}
        </View>

        {callState === 'idle' && (
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        )}
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
  loadingText: {
    ...typography.bodyMedium,
    color: colors.gray600,
    marginTop: spacing.md,
  },
  activeCallControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xl,
  },
  muteButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.gray600,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },
  muteButtonActive: {
    backgroundColor: colors.error,
  },
  endCallButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
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
  confidenceContainer: {
    padding: spacing.md,
    backgroundColor: colors.successLight,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  confidenceLabel: {
    ...typography.bodyMedium,
    color: colors.success,
    fontWeight: '600',
  },
  jobReviewActions: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
});
