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
  Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import { Phone, PhoneOff, Mic } from 'lucide-react-native';
import { FlynnButton } from '../ui/FlynnButton';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { isApiConfigured } from '../../services/apiClient';

interface DeepgramTestModalProps {
  visible: boolean;
  onClose: () => void;
  greeting?: string;
  questions?: string[];
  voiceId?: string;
}

type TestState = 'idle' | 'requesting_permission' | 'connecting' | 'active' | 'ended';

export const DeepgramTestModal: React.FC<DeepgramTestModalProps> = ({
  visible,
  onClose,
  greeting,
  questions,
  voiceId,
}) => {
  const { user } = useAuth();

  const [testState, setTestState] = useState<TestState>('idle');
  const [transcript, setTranscript] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isAISpeaking, setIsAISpeaking] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const micAnimation = useRef(new Animated.Value(1)).current;
  const audioChunksRef = useRef<Uint8Array[]>([]);

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

  // Animate mic icon when listening
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
        interruptionModeIOS: 1, // InterruptionModeIOS.DoNotMix
        shouldDuckAndroid: true,
        interruptionModeAndroid: 1, // InterruptionModeAndroid.DoNotMix
        playThroughEarpieceAndroid: false,
      });

      return true;
    } catch (err) {
      console.error('[DeepgramTest] Permission error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to setup microphone';
      setError(errorMessage);
      return false;
    }
  };

  const startTest = async () => {
    setError(null);
    setTranscript([]);

    setTestState('requesting_permission');
    const hasPermission = await requestPermissions();

    if (!hasPermission) {
      setTestState('idle');
      return;
    }

    setTestState('connecting');
    await connectToDeepgram();
  };

  const connectToDeepgram = async () => {
    try {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const baseUrl = isApiConfigured()
        ? process.env.EXPO_PUBLIC_API_BASE_URL || 'https://flynnai-telephony.fly.dev'
        : 'https://flynnai-telephony.fly.dev';

      // Use wss:// for HTTPS endpoints, ws:// for HTTP
      const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
      const wsUrl = `${wsProtocol}://${baseUrl.replace(/^https?:\/\//, '')}/realtime/test?userId=${user.id}`;

      console.log('[DeepgramTest] Connecting to:', wsUrl);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[DeepgramTest] WebSocket connected');
        setTestState('active');
        startRecording();
      };

      ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          await handleServerMessage(message);
        } catch (err) {
          console.error('[DeepgramTest] Message parse error:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('[DeepgramTest] WebSocket error:', event);
        setError('Connection error. Please try again.');
        setTestState('idle');
      };

      ws.onclose = () => {
        console.log('[DeepgramTest] WebSocket closed');
        if (testState !== 'ended') {
          endTest();
        }
      };

    } catch (err) {
      console.error('[DeepgramTest] Connection error:', err);
      setError('Failed to connect to voice agent');
      setTestState('idle');
    }
  };

  const handleServerMessage = async (message: any) => {
    console.log('[DeepgramTest] Server message:', message.type);

    switch (message.type) {
      case 'conversationText':
        addTranscript(message.role, message.content);
        break;

      case 'agentStartedSpeaking':
        setIsAISpeaking(true);
        // Stop recording while AI speaks
        if (recordingRef.current) {
          await stopRecording();
        }
        break;

      case 'agentAudioDone':
        setIsAISpeaking(false);
        // Resume recording after AI finishes
        if (testState === 'active') {
          await startRecording();
        }
        break;

      case 'audio':
        // Play audio from Deepgram
        if (message.data) {
          await playAudio(message.data);
        }
        break;

      case 'error':
        console.error('[DeepgramTest] Server error:', message.error);
        setError(message.error);
        break;

      default:
        // Ignore other message types
        break;
    }
  };

  const startRecording = async () => {
    if (isAISpeaking || recordingRef.current) return;

    try {
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 8000, // Match Deepgram's expected rate
          numberOfChannels: 1,
          bitRate: 12800,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.MIN, // Lower quality for phone call simulation
          sampleRate: 8000,
          numberOfChannels: 1,
          bitRate: 12800,
        },
      });

      recording.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording) {
          // Stream audio data to WebSocket in real-time if needed
          // For now, we'll send chunks periodically
        }
      });

      await recording.startAsync();
      recordingRef.current = recording;

      console.log('[DeepgramTest] Recording started');

      // Send audio chunks every 100ms
      const sendAudioInterval = setInterval(async () => {
        if (recordingRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
          await sendAudioChunk();
        } else {
          clearInterval(sendAudioInterval);
        }
      }, 100);

    } catch (err) {
      console.error('[DeepgramTest] Recording start error:', err);
      setError('Failed to start recording');
    }
  };

  const sendAudioChunk = async () => {
    if (!recordingRef.current || !wsRef.current) return;

    try {
      const uri = recordingRef.current.getURI();
      if (uri) {
        // In production, you'd stream the audio buffer directly
        // For now, we'll just indicate recording is happening
        wsRef.current.send(JSON.stringify({
          type: 'audio',
          data: 'recording', // Placeholder
        }));
      }
    } catch (err) {
      console.error('[DeepgramTest] Send audio error:', err);
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;

    try {
      await recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;
      console.log('[DeepgramTest] Recording stopped');
    } catch (err) {
      console.error('[DeepgramTest] Recording stop error:', err);
    }
  };

  const playAudio = async (base64Audio: string) => {
    try {
      // Stop existing sound
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      // Create sound from base64 audio
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/mpeg;base64,${base64Audio}` },
        { shouldPlay: true }
      );

      soundRef.current = sound;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });

    } catch (err) {
      console.error('[DeepgramTest] Play audio error:', err);
    }
  };

  const addTranscript = (role: 'user' | 'assistant', text: string) => {
    const prefix = role === 'assistant' ? '🤖 Flynn' : '👤 You';
    setTranscript(prev => [...prev, `${prefix}: ${text}`]);
  };

  const endTest = async () => {
    await cleanup();
    setTestState('ended');

    setTimeout(() => {
      onClose();
      resetState();
    }, 2000);
  };

  const cleanup = async () => {
    setTestState('ended');

    // Close WebSocket
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (err) {
        console.error('[DeepgramTest] WebSocket close error:', err);
      }
      wsRef.current = null;
    }

    // Stop recording
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch (err) {
        console.error('[DeepgramTest] Recording cleanup error:', err);
      }
      recordingRef.current = null;
    }

    // Stop sound
    if (soundRef.current) {
      try {
        await soundRef.current.unloadAsync();
      } catch (err) {
        console.error('[DeepgramTest] Sound cleanup error:', err);
      }
      soundRef.current = null;
    }
  };

  const resetState = () => {
    setTestState('idle');
    setTranscript([]);
    setError(null);
    setIsAISpeaking(false);
  };

  const handleClose = () => {
    cleanup();
    onClose();
    resetState();
  };

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
            {testState === 'connecting' && 'Connecting to voice agent...'}
            {testState === 'active' && (isAISpeaking ? 'Flynn is speaking...' : 'Listening...')}
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

          {(testState === 'requesting_permission' || testState === 'connecting') && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>
                {testState === 'requesting_permission' ? 'Setting up microphone...' : 'Connecting...'}
              </Text>
            </View>
          )}

          {testState === 'active' && (
            <View style={styles.activeControls}>
              <Animated.View style={{ transform: [{ scale: micAnimation }] }}>
                <View style={[
                  styles.micButton,
                  isAISpeaking && styles.micButtonMuted
                ]}>
                  <Mic size={32} color={colors.white} />
                </View>
              </Animated.View>
              <Text style={styles.micButtonLabel}>
                {isAISpeaking ? 'Flynn speaking...' : 'Listening...'}
              </Text>

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
  loadingText: {
    ...typography.bodyMedium,
    color: colors.gray600,
    marginTop: spacing.md,
  },
  activeControls: {
    alignItems: 'center',
    gap: spacing.lg,
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
  micButtonMuted: {
    backgroundColor: colors.gray400,
  },
  micButtonLabel: {
    ...typography.caption,
    color: colors.gray700,
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
});
