import React from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlynnButton } from '../ui/FlynnButton';
import { FlynnIcon } from '../ui/FlynnIcon';
import { borderRadius, spacing, typography } from '../../theme';

const formatDuration = (millis: number): string => {
  const seconds = Math.floor(millis / 1000);
  const mins = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
};

export interface RecordVoiceModalProps {
  visible: boolean;
  isRecording: boolean;
  durationMillis: number;
  uploading: boolean;
  onStartRecording: () => Promise<void>;
  onStopRecording: () => Promise<void>;
  onDismiss: () => void;
}

export const RecordVoiceModal: React.FC<RecordVoiceModalProps> = ({
  visible,
  isRecording,
  durationMillis,
  uploading,
  onStartRecording,
  onStopRecording,
  onDismiss,
}) => {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Record your voice</Text>
          <Text style={styles.subtitle}>
            Find a quiet space and read one of your typical phone greetings for at least 45 seconds. Flynn needs a clean sample to mimic your tone.
          </Text>

          <View style={styles.timerContainer}>
            <View style={[styles.timerBadge, isRecording ? styles.timerBadgeActive : null]}>
              <FlynnIcon
                name={isRecording ? 'pause-circle' : 'mic'}
                size={20}
                color={isRecording ? '#f87171' : '#2563eb'}
              />
              <Text style={styles.timerText}>{formatDuration(durationMillis)}</Text>
            </View>
            {uploading && (
              <View style={styles.uploadRow}>
                <ActivityIndicator size="small" color="#2563eb" />
                <Text style={styles.uploadText}>Uploading sample…</Text>
              </View>
            )}
          </View>

          <View style={styles.actions}>
            <FlynnButton
              title={isRecording ? 'Stop recording' : uploading ? 'Uploading…' : 'Start recording'}
              variant={isRecording ? 'danger' : 'primary'}
              onPress={isRecording ? onStopRecording : onStartRecording}
              disabled={uploading}
            />
            <FlynnButton title="Cancel" variant="secondary" onPress={onDismiss} disabled={isRecording || uploading} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    padding: spacing.lg,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  title: {
    ...typography.h3,
    color: '#0f172a',
  },
  subtitle: {
    ...typography.bodyMedium,
    color: '#475569',
    lineHeight: 22,
  },
  timerContainer: {
    gap: spacing.md,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    borderRadius: borderRadius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: '#e0f2fe',
  },
  timerBadgeActive: {
    backgroundColor: '#fee2e2',
  },
  timerText: {
    ...typography.bodyMedium,
    color: '#0f172a',
    fontVariant: ['tabular-nums'],
  },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  uploadText: {
    ...typography.bodySmall,
    color: '#2563eb',
  },
  actions: {
    flexDirection: 'column',
    gap: spacing.sm,
  },
});

export default RecordVoiceModal;
