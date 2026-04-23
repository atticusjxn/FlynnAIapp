import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { Audio } from 'expo-av';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';
import { FlynnButton } from '../../components/ui/FlynnButton';
import { useAuth } from '../../context/AuthContext';

const API_BASE_URL =
  Constants.expoConfig?.extra?.apiBaseUrl || 'https://flynnai-telephony.fly.dev';

const TOTAL_STEPS = 7;
const CURRENT_STEP = 4;
const DEMO_DURATION_SECS = 90;
const NUM_BARS = 24;

const PRESET_QUESTIONS = [
  "What services do you offer?",
  "What's your call-out fee?",
  "Can I book for this Saturday?",
  "Are you licensed?",
];

interface Props {
  onNext: () => void;
  onBack: () => void;
}

export const LiveVoiceDemoScreen: React.FC<Props> = ({ onNext, onBack }) => {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'ended'>('idle');
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [isPTTHeld, setIsPTTHeld] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const demoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Waveform animation
  const barAnims = useRef<Animated.Value[]>(
    Array.from({ length: NUM_BARS }, () => new Animated.Value(0.2))
  ).current;
  const waveAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  const startWaveAnimation = useCallback(() => {
    const animations = barAnims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 40),
          Animated.timing(anim, {
            toValue: 0.5 + Math.random() * 0.5,
            duration: 300 + Math.random() * 200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.1 + Math.random() * 0.3,
            duration: 300 + Math.random() * 200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      )
    );
    waveAnimRef.current = Animated.parallel(animations);
    waveAnimRef.current.start();
  }, [barAnims]);

  const stopWaveAnimation = useCallback(() => {
    waveAnimRef.current?.stop();
    barAnims.forEach(a => a.setValue(0.2));
  }, [barAnims]);

  const handleEndCall = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    recordingRef.current = null;
    soundRef.current?.unloadAsync().catch(() => {});
    soundRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    if (demoTimerRef.current) clearTimeout(demoTimerRef.current);
    stopWaveAnimation();
    setStatus('ended');
  }, [stopWaveAnimation]);

  const startSession = useCallback(async () => {
    setStatus('connecting');
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      const accessToken = session?.access_token;
      const res = await fetch(`${API_BASE_URL}/api/demo/start-voice-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });
      if (!res.ok) throw new Error('Failed to start demo session');
      const { wsUrl } = await res.json();

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        startWaveAnimation();
        timerRef.current = setInterval(() => setElapsedSecs(s => s + 1), 1000);
        demoTimerRef.current = setTimeout(() => handleEndCall(), DEMO_DURATION_SECS * 1000);
      };

      ws.onmessage = async (event) => {
        if (typeof event.data === 'string') {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'transcript' && msg.text) {
              setTranscript(prev => [...prev.slice(-2), msg.text]);
            }
          } catch {}
        } else if (event.data instanceof ArrayBuffer) {
          // Play received audio
          try {
            const { sound } = await Audio.Sound.createAsync(
              { uri: `data:audio/wav;base64,${arrayBufferToBase64(event.data)}` },
              { shouldPlay: true }
            );
            soundRef.current = sound;
          } catch {}
        }
      };

      ws.onerror = () => handleEndCall();
      ws.onclose = () => {
        if (status !== 'ended') setStatus('ended');
        stopWaveAnimation();
      };
    } catch {
      setStatus('idle');
    }
  }, [supabase, startWaveAnimation, stopWaveAnimation, handleEndCall, status]);

  const startPTT = async () => {
    if (!wsRef.current || status !== 'connected') return;
    setIsPTTHeld(true);
    try {
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
    } catch {}
  };

  const stopPTT = async () => {
    setIsPTTHeld(false);
    if (!recordingRef.current || !wsRef.current) return;
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (uri && wsRef.current.readyState === WebSocket.OPEN) {
        const response = await fetch(uri);
        const buffer = await response.arrayBuffer();
        wsRef.current.send(buffer);
      }
    } catch {}
  };

  const injectPreset = (text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'inject_text', text }));
    }
  };

  useEffect(() => {
    return () => {
      handleEndCall();
    };
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress */}
        <View style={styles.progressRow}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View
              key={i}
              style={[styles.progressCapsule, i < CURRENT_STEP && styles.progressCapsuleFilled]}
            />
          ))}
        </View>

        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.heading}>Meet your AI receptionist</Text>
        <Text style={styles.subtitle}>
          This is exactly what your callers experience.
        </Text>

        {/* Status indicator */}
        {status === 'connected' && (
          <View style={styles.statusRow}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE · {formatTime(elapsedSecs)}</Text>
          </View>
        )}

        {/* Waveform */}
        <View style={styles.waveformContainer}>
          {barAnims.map((anim, i) => (
            <Animated.View
              key={i}
              style={[
                styles.bar,
                { transform: [{ scaleY: anim }] },
                status !== 'connected' && styles.barInactive,
              ]}
            />
          ))}
        </View>

        {/* Transcript */}
        {transcript.length > 0 && (
          <View style={styles.transcriptBox}>
            {transcript.map((line, i) => (
              <Text key={i} style={styles.transcriptLine}>
                {line}
              </Text>
            ))}
          </View>
        )}

        {/* Preset chips */}
        {status === 'connected' && (
          <View style={styles.chipsRow}>
            {PRESET_QUESTIONS.map((q) => (
              <TouchableOpacity
                key={q}
                style={styles.chip}
                onPress={() => injectPreset(q)}
                activeOpacity={0.7}
              >
                <Text style={styles.chipText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Main CTA */}
        <View style={styles.ctaGroup}>
          {status === 'idle' && (
            <FlynnButton
              title="Start demo call"
              onPress={startSession}
              variant="primary"
              size="large"
              fullWidth
            />
          )}

          {status === 'connecting' && (
            <FlynnButton
              title="Connecting…"
              onPress={() => {}}
              variant="primary"
              size="large"
              fullWidth
              disabled
            />
          )}

          {status === 'connected' && (
            <>
              <TouchableOpacity
                onPressIn={startPTT}
                onPressOut={stopPTT}
                style={[styles.pttBtn, isPTTHeld && styles.pttBtnActive]}
                activeOpacity={0.8}
              >
                <Text style={styles.pttText}>
                  {isPTTHeld ? '🎙 Speaking…' : 'Hold to speak'}
                </Text>
              </TouchableOpacity>

              <FlynnButton
                title="End call — continue"
                onPress={() => { handleEndCall(); onNext(); }}
                variant="secondary"
                size="large"
                fullWidth
              />
            </>
          )}

          {status === 'ended' && (
            <>
              <Text style={styles.doneNote}>
                Demo done — continue to unlock your agent
              </Text>
              <FlynnButton
                title="Continue"
                onPress={onNext}
                variant="primary"
                size="large"
                fullWidth
              />
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Utility: ArrayBuffer → base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  progressRow: { flexDirection: 'row', gap: spacing.xxs, marginBottom: spacing.lg },
  progressCapsule: {
    flex: 1,
    height: 4,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray200,
  },
  progressCapsuleFilled: { backgroundColor: colors.primary },
  backBtn: { minHeight: 44, justifyContent: 'center', marginBottom: spacing.md },
  backText: { ...typography.bodyMedium, color: colors.textSecondary },
  heading: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.error,
  },
  liveText: { ...typography.caption, color: colors.error, fontWeight: '600' },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 80,
    gap: 3,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
    paddingHorizontal: spacing.md,
  },
  bar: {
    width: 4,
    height: 48,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  barInactive: { backgroundColor: colors.gray300 },
  transcriptBox: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  transcriptLine: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  chip: {
    backgroundColor: colors.gray100,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipText: { ...typography.bodySmall, color: colors.textPrimary },
  ctaGroup: { gap: spacing.sm },
  pttBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  pttBtnActive: { backgroundColor: colors.error },
  pttText: { ...typography.button, color: colors.white },
  doneNote: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
});
