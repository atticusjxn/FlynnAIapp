import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FlynnIcon } from '../ui/FlynnIcon';
import { useTheme } from '../../context/ThemeContext';
import { spacing, typography, borderRadius, shadows } from '../../theme';
import { DashboardVoicemail } from '../../services/voicemailService';
import { formatActivityTime } from '../../services/dashboardService';

interface VoicemailPreviewCardProps {
  voicemail: DashboardVoicemail;
  onPlayRecording?: (url: string) => void;
  onOpenJob?: (jobId: string) => void;
}

export const VoicemailPreviewCard: React.FC<VoicemailPreviewCardProps> = ({
  voicemail,
  onPlayRecording,
  onOpenJob,
}) => {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const formattedTime = React.useMemo(() => {
    return voicemail.recordedAt ? formatActivityTime(voicemail.recordedAt) : 'Just now';
  }, [voicemail.recordedAt]);

  const handlePlay = () => {
    if (voicemail.recordingUrl) {
      onPlayRecording?.(voicemail.recordingUrl);
    }
  };

  const handleOpenJob = () => {
    if (voicemail.jobId) {
      onOpenJob?.(voicemail.jobId);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
          <FlynnIcon name="mic-outline" size={18} color={colors.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.caller}>{voicemail.fromNumber || 'Unknown caller'}</Text>
          <Text style={styles.timestamp}>{formattedTime}</Text>
        </View>
        {voicemail.jobId ? (
          <View style={[styles.badge, { backgroundColor: colors.success + '15' }]}>
            <Text style={[styles.badgeText, { color: colors.success }]}>Converted</Text>
          </View>
        ) : voicemail.status ? (
          <View style={[styles.badge, { backgroundColor: colors.gray100 }]}>
            <Text style={[styles.badgeText, { color: colors.gray600 }]}>{voicemail.status}</Text>
          </View>
        ) : null}
      </View>

      {voicemail.transcription ? (
        <Text style={styles.transcript} numberOfLines={4}>
          “{voicemail.transcription.trim()}”
        </Text>
      ) : (
        <Text style={styles.placeholder}>
          Transcript not available yet. We’ll notify you when it’s ready.
        </Text>
      )}

      <View style={styles.actions}>
        {voicemail.recordingUrl && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary + '12' }]}
            activeOpacity={0.7}
            onPress={handlePlay}
          >
            <FlynnIcon name="play-outline" size={16} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>Listen to voicemail</Text>
          </TouchableOpacity>
        )}

        {voicemail.jobId && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary + '08' }]}
            activeOpacity={0.7}
            onPress={handleOpenJob}
          >
            <FlynnIcon name="briefcase-outline" size={16} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>Open event</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  caller: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: spacing.xxxs,
  },
  timestamp: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  badge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxxs,
    borderRadius: borderRadius.full,
  },
  badgeText: {
    ...typography.caption,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  transcript: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  placeholder: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  actionText: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
});
