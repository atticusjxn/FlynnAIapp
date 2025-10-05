import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { FlynnIcon } from '../../components/ui/FlynnIcon';
import { FlynnButton } from '../../components/ui/FlynnButton';
import { FlynnInput } from '../../components/ui/FlynnInput';
import {
  CallerLabel,
  CallerRoutingOverride,
  CallerTimelineEntry,
  CallerRecord,
  fetchCallerById,
  fetchCallerTimeline,
  updateCallerPreferences,
} from '../../services/callersService';
import { spacing, typography, borderRadius, shadows } from '../../theme';

interface CallerDetailScreenProps {
  navigation: any;
  route: {
    params: {
      callerId?: string | null;
      phoneNumber?: string | null;
    };
  };
}

const LABEL_OPTIONS: Array<{ value: CallerLabel; label: string; description: string }> = [
  { value: 'lead', label: 'Lead', description: 'Treat as a potential new customer.' },
  { value: 'client', label: 'Client', description: 'Existing customer with active work.' },
  { value: 'personal', label: 'Personal', description: 'Friends and family who skip intake.' },
  { value: 'spam', label: 'Spam', description: 'Known spam callers go straight to voicemail.' },
];

const ROUTING_OVERRIDES: Array<{ value: CallerRoutingOverride; label: string; description: string }> = [
  { value: 'auto', label: 'Follow smart rules', description: 'Use the account routing mode.' },
  { value: 'intake', label: 'Always AI intake', description: 'Always gather lead details with the AI receptionist.' },
  { value: 'voicemail', label: 'Always voicemail', description: 'Skip intake and collect a voicemail recording.' },
];

const CallerDetailScreen: React.FC<CallerDetailScreenProps> = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const callerId = route.params?.callerId ?? null;
  const fallbackPhone = route.params?.phoneNumber ?? 'Unknown number';

  const [caller, setCaller] = useState<CallerRecord | null>(null);
  const [timeline, setTimeline] = useState<CallerTimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [displayName, setDisplayName] = useState('');

  const loadData = useCallback(async () => {
    if (!callerId) {
      return;
    }

    setLoading(true);
    try {
      const [callerRecord, timelineEntries] = await Promise.all([
        fetchCallerById(callerId),
        fetchCallerTimeline(callerId, 25),
      ]);
      setCaller(callerRecord);
      setDisplayName(callerRecord?.displayName ?? '');
      setTimeline(timelineEntries);
    } catch (error) {
      console.error('[CallerDetail] Failed to load caller data', error);
      Alert.alert('Error', 'Unable to load caller details right now.');
    } finally {
      setLoading(false);
    }
  }, [callerId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    if (!callerId) return;
    try {
      setRefreshing(true);
      await loadData();
    } finally {
      setRefreshing(false);
    }
  };

  const handleLabelUpdate = async (label: CallerLabel) => {
    if (!callerId || updating) return;
    try {
      setUpdating(true);
      const updated = await updateCallerPreferences(callerId, { label });
      setCaller(updated);
      Alert.alert('Caller updated', 'Routing label saved.');
    } catch (error) {
      console.error('[CallerDetail] Failed to update label', error);
      Alert.alert('Update failed', 'Could not update the caller label.');
    } finally {
      setUpdating(false);
    }
  };

  const handleOverrideUpdate = async (value: CallerRoutingOverride) => {
    if (!callerId || updating) return;
    try {
      setUpdating(true);
      const updated = await updateCallerPreferences(callerId, { routingOverride: value === 'auto' ? null : value });
      setCaller(updated);
      Alert.alert('Routing updated', 'Caller routing preference saved.');
    } catch (error) {
      console.error('[CallerDetail] Failed to update override', error);
      Alert.alert('Update failed', 'Could not update the routing preference.');
    } finally {
      setUpdating(false);
    }
  };

  const handleDisplayNameSave = async () => {
    if (!callerId || updating) return;
    try {
      setUpdating(true);
      const updated = await updateCallerPreferences(callerId, { displayName });
      setCaller(updated);
      Alert.alert('Saved', 'Caller name updated.');
    } catch (error) {
      console.error('[CallerDetail] Failed to update name', error);
      Alert.alert('Update failed', 'Could not update the caller name.');
    } finally {
      setUpdating(false);
    }
  };

  const activeLabel = caller?.label ?? 'lead';
  const routingOverride = caller?.routingOverride ?? 'auto';
  const phoneDisplay = caller?.displayName ? `${caller.displayName} · ${caller.phoneNumber}` : (caller?.phoneNumber || fallbackPhone);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBack} onPress={() => navigation.goBack()}>
          <FlynnIcon name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Caller details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={styles.summaryCard}>
          <Text style={styles.callerTitle}>{phoneDisplay}</Text>
          <Text style={styles.callerMeta}>
            Last seen {caller?.lastSeenAt ? new Date(caller.lastSeenAt).toLocaleString() : 'never'}
          </Text>
          <FlynnInput
            label="Display name"
            placeholder="Add a contact name"
            value={displayName}
            onChangeText={setDisplayName}
            containerStyle={styles.displayNameInput}
          />
          <FlynnButton
            title={updating ? 'Saving…' : 'Save name'}
            onPress={handleDisplayNameSave}
            disabled={updating}
            loading={updating}
            variant="secondary"
            fullWidth
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Caller label</Text>
          <Text style={styles.sectionSubtitle}>Tell Flynn how to treat future calls from this number.</Text>
          <View style={styles.optionGrid}>
            {LABEL_OPTIONS.map((option) => {
              const selected = activeLabel === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.optionCard, selected && styles.optionCardSelected]}
                  onPress={() => handleLabelUpdate(option.value)}
                  disabled={updating}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: updating, selected }}
                  accessibilityLabel={`${option.label} caller label`}
                  accessibilityHint="Double tap to set this label for future calls from this number."
                >
                  <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{option.label}</Text>
                  <Text style={[styles.optionDescription, selected && styles.optionDescriptionSelected]}>
                    {option.description}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Routing preference</Text>
          <Text style={styles.sectionSubtitle}>Override the global routing mode for this caller.</Text>
          <View style={styles.optionGrid}>
            {ROUTING_OVERRIDES.map((option) => {
              const selected = routingOverride === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.optionCard, selected && styles.optionCardSelected]}
                  onPress={() => handleOverrideUpdate(option.value)}
                  disabled={updating}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: updating, selected }}
                  accessibilityLabel={`${option.label} routing override`}
                  accessibilityHint="Double tap to choose how Flynn routes this caller by default."
                >
                  <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{option.label}</Text>
                  <Text style={[styles.optionDescription, selected && styles.optionDescriptionSelected]}>
                    {option.description}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent activity</Text>
          <Text style={styles.sectionSubtitle}>Latest calls from this number with their routing outcomes.</Text>

          {loading ? (
            <Text style={styles.loadingText}>Loading activity…</Text>
          ) : timeline.length === 0 ? (
            <Text style={styles.emptyState}>No calls logged for this caller yet.</Text>
          ) : (
            timeline.map((entry) => (
              <View key={entry.callSid} style={styles.timelineRow}>
                <View style={styles.timelineIcon}>
                  <FlynnIcon
                    name={entry.routeDecision === 'intake' ? 'sparkles' : 'mic-outline'}
                    size={20}
                    color={entry.routeDecision === 'intake' ? colors.primary : colors.gray500}
                  />
                </View>
                <View style={styles.timelineBody}>
                  <Text style={styles.timelineTitle}>
                    {entry.routeDecision === 'intake' ? 'AI intake' : 'Voicemail captured'}
                  </Text>
                  <Text style={styles.timelineMeta}>
                    {new Date(entry.createdAt).toLocaleString()} · {entry.status || 'completed'}
                  </Text>
                  {entry.routeReason ? (
                    <Text style={styles.timelineReason}>{entry.routeReason.replace(/_/g, ' ')}</Text>
                  ) : null}
                  {entry.transcriptionText ? (
                    <Text style={styles.timelineTranscript} numberOfLines={3}>
                      “{entry.transcriptionText}”
                    </Text>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBack: {
    padding: spacing.xs,
  },
  headerSpacer: {
    width: 24,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  callerTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  callerMeta: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  displayNameInput: {
    marginBottom: spacing.md,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.bodyLarge,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  sectionSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  optionGrid: {
    gap: spacing.sm,
  },
  optionCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.card,
  },
  optionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '12',
  },
  optionLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  optionLabelSelected: {
    color: colors.primary,
  },
  optionDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xxxs,
    lineHeight: 18,
  },
  optionDescriptionSelected: {
    color: colors.textPrimary,
  },
  loadingText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    paddingVertical: spacing.md,
  },
  emptyState: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    paddingVertical: spacing.md,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  timelineIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  timelineBody: {
    flex: 1,
  },
  timelineTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  timelineMeta: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: spacing.xxxs,
  },
  timelineReason: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xxxs,
  },
  timelineTranscript: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  bottomSpacer: {
    height: spacing.xl * 2,
  },
});

export default CallerDetailScreen;
