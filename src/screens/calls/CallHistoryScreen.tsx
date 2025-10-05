import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { FlynnIcon } from '../../components/ui/FlynnIcon';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { FlynnCard } from '../../components/ui/FlynnCard';
import { FlynnButton } from '../../components/ui/FlynnButton';
import { useTheme } from '../../context/ThemeContext';
import { 
  colors, 
  spacing, 
  typography, 
  borderRadius, 
  shadows 
} from '../../theme';
import { TwilioService, CallRecord } from '../../services/TwilioService';

interface CallHistoryScreenProps {
  navigation: any;
}

const CallHistoryScreen: React.FC<CallHistoryScreenProps> = ({ navigation }) => {
  const { colors: themeColors } = useTheme();
  const styles = createStyles(themeColors);
  
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load call history when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadCallHistory();
    }, [])
  );

  const loadCallHistory = async (refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else {
        setIsLoading(true);
      }
      
      setError(null);
      const callHistory = await TwilioService.getCallHistory();
      setCalls(callHistory);
    } catch (error: any) {
      console.error('Error loading call history:', error);
      setError(error.message || 'Failed to load call history');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadCallHistory(true);
  };

  const handleCallPress = (call: CallRecord) => {
    Alert.alert(
      'Call Details',
      `Call from ${call.fromNumber}\nDuration: ${formatDuration(call.duration)}\nStatus: ${call.status}\nRoute: ${call.routeDecision || 'unknown'}\n\n${call.transcriptionText ? 'Transcription available' : 'No transcription'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        ...(call.recordingUrl ? [{ text: 'Play Recording', onPress: () => playRecording(call.recordingUrl!) }] : []),
        ...(call.jobId ? [{ text: 'View Job', onPress: () => navigation.navigate('JobDetails', { jobId: call.jobId }) }] : []),
        ...(call.callerId ? [{ text: 'Caller timeline', onPress: () => navigation.navigate('CallerDetail', { callerId: call.callerId, phoneNumber: call.fromNumber }) }] : []),
        { text: 'Call Back', onPress: () => callBack(call.fromNumber) }
      ]
    );
  };

  const playRecording = async (recordingUrl: string) => {
    try {
      await Linking.openURL(recordingUrl);
    } catch (error) {
      Alert.alert('Error', 'Unable to open recording');
    }
  };

  const callBack = async (phoneNumber: string) => {
    try {
      await Linking.openURL(`tel:${phoneNumber}`);
    } catch (error) {
      Alert.alert('Error', 'Unable to make call');
    }
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return 'Unknown';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes === 0) {
      return `${remainingSeconds}s`;
    }
    
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatCallTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 2) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays <= 7) {
      return `${diffDays - 1} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return themeColors.success || colors.success;
      case 'failed':
      case 'no-answer':
        return themeColors.error || colors.error;
      case 'busy':
        return themeColors.warning || colors.warning;
      case 'in-progress':
        return themeColors.primary || colors.primary;
      default:
        return themeColors.gray500 || colors.gray500;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return 'checkmark-circle';
      case 'failed':
        return 'close-circle';
      case 'no-answer':
        return 'call-outline';
      case 'busy':
        return 'time-outline';
      case 'in-progress':
        return 'radio-button-on';
      default:
        return 'help-circle';
    }
  };

  const renderCallItem = ({ item }: { item: CallRecord }) => (
    <TouchableOpacity onPress={() => handleCallPress(item)}>
      <FlynnCard style={styles.callCard}>
        <View style={styles.callHeader}>
          <View style={styles.callerInfo}>
            <View style={styles.callerIcon}>
              <FlynnIcon name="call" size={20} color={themeColors.primary || colors.primary} />
            </View>
            <View style={styles.callerDetails}>
              <Text style={styles.callerNumber}>{item.fromNumber}</Text>
              <Text style={styles.callTime}>{formatCallTime(item.createdAt)}</Text>
            </View>
          </View>
          
          <View style={styles.callStatus}>
            <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(item.status) + '20' }]}>
              <FlynnIcon 
                name={getStatusIcon(item.status) as any} 
                size={16} 
                color={getStatusColor(item.status)} 
              />
            </View>
          </View>
        </View>

        <View style={styles.callMetadata}>
          <View style={styles.metadataItem}>
            <FlynnIcon name="time-outline" size={14} color={themeColors.textTertiary || colors.gray500} />
            <Text style={styles.metadataText}>{formatDuration(item.duration)}</Text>
          </View>
          
          {item.transcriptionText && (
            <View style={styles.metadataItem}>
              <FlynnIcon name="document-text-outline" size={14} color={themeColors.textTertiary || colors.gray500} />
              <Text style={styles.metadataText}>Transcribed</Text>
            </View>
          )}
          
          {item.jobId && (
            <View style={styles.metadataItem}>
              <FlynnIcon name="briefcase-outline" size={14} color={themeColors.success || colors.success} />
              <Text style={[styles.metadataText, { color: themeColors.success || colors.success }]}>Job Created</Text>
            </View>
          )}

          {item.routeDecision && (
            <View style={styles.metadataItem}>
              <FlynnIcon
                name={item.routeDecision === 'intake' ? 'sparkles' : 'mic-outline'}
                size={14}
                color={themeColors.textTertiary || colors.gray500}
              />
              <Text style={styles.metadataText}>
                {item.routeDecision === 'intake' ? 'AI intake' : 'Voicemail'}
              </Text>
            </View>
          )}
        </View>

        {item.transcriptionText && (
          <View style={styles.transcriptionPreview}>
            <Text style={styles.transcriptionText} numberOfLines={2}>
              {item.transcriptionText}
            </Text>
          </View>
        )}

        {item.jobExtracted && (
          <View style={styles.jobPreview}>
            <Text style={styles.jobPreviewTitle}>Extracted Job Details</Text>
            <Text style={styles.jobPreviewText} numberOfLines={1}>
              {item.jobExtracted.serviceType || item.jobExtracted.description || 'Service request'}
            </Text>
            {item.jobExtracted.clientName && (
              <Text style={styles.jobPreviewClient}>Client: {item.jobExtracted.clientName}</Text>
            )}
          </View>
        )}
      </FlynnCard>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <FlynnIcon name="call-outline" size={48} color={themeColors.gray400 || colors.gray400} />
      </View>
      <Text style={styles.emptyTitle}>No Call History</Text>
      <Text style={styles.emptyDescription}>
        Once you set up call forwarding, your business calls will appear here with automatic job extraction.
      </Text>
      <FlynnButton
        title="Setup Call Forwarding"
        onPress={() => navigation.navigate('CallSetup')}
        variant="primary"
        style={styles.setupButton}
      />
    </View>
  );

  const renderErrorState = () => (
    <View style={styles.errorState}>
      <View style={styles.errorIcon}>
        <FlynnIcon name="alert-circle" size={48} color={themeColors.error || colors.error} />
      </View>
      <Text style={styles.errorTitle}>Unable to Load Calls</Text>
      <Text style={styles.errorDescription}>{error}</Text>
      <FlynnButton
        title="Try Again"
        onPress={() => loadCallHistory()}
        variant="secondary"
        style={styles.retryButton}
      />
    </View>
  );

  if (error && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        {renderErrorState()}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <FlynnIcon name="arrow-back" size={24} color={themeColors.textPrimary || colors.gray800} />
        </TouchableOpacity>
        <Text style={styles.title}>Call History</Text>
        <TouchableOpacity 
          style={styles.settingsButton}
          onPress={() => navigation.navigate('CallSettings')}
        >
          <FlynnIcon name="settings-outline" size={24} color={themeColors.textPrimary || colors.gray800} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={calls}
        keyExtractor={(item) => item.id}
        renderItem={renderCallItem}
        contentContainerStyle={[
          styles.listContainer,
          calls.length === 0 && styles.emptyListContainer
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={!isLoading ? renderEmptyState : undefined}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  listContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  separator: {
    height: spacing.sm,
  },
  callCard: {
    paddingVertical: spacing.md,
  },
  callHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  callerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  callerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  callerDetails: {
    flex: 1,
  },
  callerNumber: {
    ...typography.h4,
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  callTime: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  callStatus: {
    alignItems: 'center',
  },
  statusIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  metadataText: {
    ...typography.caption,
    color: colors.textTertiary,
    marginLeft: spacing.xxs,
  },
  transcriptionPreview: {
    backgroundColor: colors.backgroundTertiary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  transcriptionText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  jobPreview: {
    backgroundColor: colors.successLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
  },
  jobPreviewTitle: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: spacing.xxs,
  },
  jobPreviewText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '500',
    marginBottom: spacing.xxs,
  },
  jobPreviewClient: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  emptyDescription: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  setupButton: {
    minWidth: 200,
  },
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.errorLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  errorTitle: {
    ...typography.h3,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  errorDescription: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  retryButton: {
    minWidth: 150,
  },
});

export default CallHistoryScreen;