import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { FlynnIcon } from '../../components/ui/FlynnIcon';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { TwilioService, TwilioUserStatus } from '../../services/TwilioService';

interface CallSettingsScreenProps {
  navigation: any;
}

const CallSettingsScreen: React.FC<CallSettingsScreenProps> = ({ navigation }) => {
  const { colors: themeColors } = useTheme();
  const styles = createStyles(themeColors);
  
  const [userStatus, setUserStatus] = useState<TwilioUserStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadUserStatus();
  }, []);

  const loadUserStatus = async () => {
    try {
      setIsLoading(true);
      const status = await TwilioService.getUserTwilioStatus();
      setUserStatus(status);
    } catch (error) {
      console.error('Error loading user status:', error);
      Alert.alert('Error', 'Failed to load call settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecordingPreferenceChange = async (preference: 'auto' | 'manual' | 'off') => {
    if (!userStatus) return;
    
    try {
      setIsSaving(true);
      await TwilioService.updateRecordingPreference(preference);
      setUserStatus({ ...userStatus, recordingPreference: preference });
      
      // Show appropriate message based on selection
      const messages = {
        auto: 'All calls will now be recorded automatically.',
        manual: 'You can press 0 during calls to start recording.',
        off: 'Call recording is disabled. Job extraction will be limited.'
      };
      
      Alert.alert('Settings Updated', messages[preference]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update recording preference');
    } finally {
      setIsSaving(false);
    }
  };

  const handleForwardingToggle = async (enabled: boolean) => {
    if (!userStatus) return;
    
    if (enabled && !userStatus.twilioPhoneNumber) {
      Alert.alert(
        'Setup Required',
        'You need to provision a phone number first before enabling call forwarding.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Setup Now', onPress: () => navigation.navigate('CallSetup') }
        ]
      );
      return;
    }

    if (!enabled) {
      Alert.alert(
        'Disable Call Forwarding',
        'This will disable call forwarding. You\'ll need to dial *720 on your phone to completely turn off forwarding.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Disable', 
            style: 'destructive',
            onPress: async () => {
              try {
                setIsSaving(true);
                await TwilioService.updateForwardingStatus(false);
                setUserStatus({ ...userStatus, isForwardingActive: false });
                
                Alert.alert(
                  'Forwarding Disabled',
                  'To completely disable forwarding on your phone, dial *720 and press call.',
                  [{ text: 'Got it' }]
                );
              } catch (error: any) {
                Alert.alert('Error', error.message || 'Failed to disable forwarding');
              } finally {
                setIsSaving(false);
              }
            }
          }
        ]
      );
    } else {
      // Enable forwarding - navigate to setup
      navigation.navigate('CallSetup');
    }
  };

  const handleTestCall = () => {
    if (!userStatus?.twilioPhoneNumber) {
      Alert.alert('Error', 'No phone number configured');
      return;
    }

    Alert.alert(
      'Test Call',
      `Call your Flynn AI number to test the setup:\n\n${userStatus.twilioPhoneNumber}\n\nSpeak about a job request and Flynn AI will automatically create a job card for you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Call Now', onPress: () => Linking.openURL(`tel:${userStatus.twilioPhoneNumber}`) }
      ]
    );
  };

  const handleViewHistory = () => {
    navigation.navigate('CallHistory');
  };

  const renderRecordingPreference = () => {
    const options = [
      {
        value: 'auto' as const,
        title: 'Automatic Recording',
        description: 'All calls are recorded automatically for job extraction',
        icon: 'radio-button-on-outline',
        iconColor: colors.primary
      },
      {
        value: 'manual' as const,
        title: 'Manual Recording',
        description: 'Press 0 during calls to start recording',
        icon: 'hand-left-outline',
        iconColor: colors.warning
      },
      {
        value: 'off' as const,
        title: 'No Recording',
        description: 'Calls are not recorded. Limited job extraction.',
        icon: 'radio-button-off-outline',
        iconColor: colors.error
      }
    ];

    return (
      <FlynnCard>
        <View style={styles.sectionHeader}>
          <FlynnIcon name="mic-outline" size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>Recording Preferences</Text>
        </View>
        <Text style={styles.sectionDescription}>
          Choose how Flynn AI should handle call recordings for job extraction.
        </Text>

        {options.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.optionButton,
              userStatus?.recordingPreference === option.value && styles.selectedOption
            ]}
            onPress={() => handleRecordingPreferenceChange(option.value)}
            disabled={isSaving}
          >
            <View style={styles.optionContent}>
              <View style={styles.optionLeft}>
                <FlynnIcon name={option.icon as any} size={24} color={option.iconColor} />
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>{option.title}</Text>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                </View>
              </View>
              {userStatus?.recordingPreference === option.value && (
                <FlynnIcon name="checkmark-circle" size={20} color={colors.success} />
              )}
            </View>
          </TouchableOpacity>
        ))}
      </FlynnCard>
    );
  };

  const renderForwardingSettings = () => (
    <FlynnCard>
      <View style={styles.sectionHeader}>
        <FlynnIcon name="call-outline" size={20} color={colors.primary} />
        <Text style={styles.sectionTitle}>Call Forwarding</Text>
      </View>
      
      {userStatus?.twilioPhoneNumber ? (
        <View>
          <Text style={styles.sectionDescription}>
            Your Flynn AI number: {userStatus.twilioPhoneNumber}
          </Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Enable Forwarding</Text>
              <Text style={styles.settingDescription}>
                {userStatus.isForwardingActive 
                  ? 'Calls are being forwarded to Flynn AI'
                  : 'Call forwarding is currently disabled'
                }
              </Text>
            </View>
            <Switch
              value={userStatus.isForwardingActive}
              onValueChange={handleForwardingToggle}
              disabled={isSaving}
              trackColor={{ false: colors.gray300, true: colors.primaryLight }}
              thumbColor={userStatus.isForwardingActive ? colors.primary : colors.gray400}
            />
          </View>
        </View>
      ) : (
        <View style={styles.noNumberState}>
          <Text style={styles.noNumberText}>
            No phone number configured. Set up call forwarding to get started.
          </Text>
          <FlynnButton
            title="Setup Call Forwarding"
            onPress={() => navigation.navigate('CallSetup')}
            variant="primary"
            size="small"
            style={styles.setupButton}
          />
        </View>
      )}
    </FlynnCard>
  );

  const renderQuickActions = () => (
    <FlynnCard>
      <View style={styles.sectionHeader}>
        <FlynnIcon name="flash-outline" size={20} color={colors.primary} />
        <Text style={styles.sectionTitle}>Quick Actions</Text>
      </View>
      
      <View style={styles.actionButtons}>
        <FlynnButton
          title="Test Call"
          onPress={handleTestCall}
          variant="secondary"
          size="small"
          style={styles.actionButton}
          icon={<FlynnIcon name="call-outline" size={16} color={colors.primary} />}
          disabled={!userStatus?.twilioPhoneNumber}
        />
        
        <FlynnButton
          title="Call History"
          onPress={handleViewHistory}
          variant="secondary"
          size="small"
          style={styles.actionButton}
          icon={<FlynnIcon name="time-outline" size={16} color={colors.primary} />}
        />
      </View>
    </FlynnCard>
  );

  const renderUsageInfo = () => (
    <FlynnCard>
      <View style={styles.sectionHeader}>
        <FlynnIcon name="information-circle-outline" size={20} color={colors.primary} />
        <Text style={styles.sectionTitle}>How It Works</Text>
      </View>
      
      <View style={styles.infoList}>
        <View style={styles.infoItem}>
          <FlynnIcon name="phone-portrait-outline" size={16} color={colors.textTertiary} />
          <Text style={styles.infoText}>
            Forward your business calls to your Flynn AI number
          </Text>
        </View>
        
        <View style={styles.infoItem}>
          <FlynnIcon name="mic-outline" size={16} color={colors.textTertiary} />
          <Text style={styles.infoText}>
            Calls are automatically recorded and transcribed
          </Text>
        </View>
        
        <View style={styles.infoItem}>
          <FlynnIcon name="sparkles-outline" size={16} color={colors.textTertiary} />
          <Text style={styles.infoText}>
            AI extracts job details and creates calendar events
          </Text>
        </View>
        
        <View style={styles.infoItem}>
          <FlynnIcon name="checkmark-circle-outline" size={16} color={colors.textTertiary} />
          <Text style={styles.infoText}>
            Client confirmations are sent automatically
          </Text>
        </View>
      </View>
    </FlynnCard>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
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
          <FlynnIcon name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Call Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderForwardingSettings()}
        {renderRecordingPreference()}
        {renderQuickActions()}
        {renderUsageInfo()}
      </ScrollView>
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
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingBottom: spacing.xxl,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
  },
  sectionDescription: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  settingDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  optionButton: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  selectedOption: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionText: {
    marginLeft: spacing.md,
    flex: 1,
  },
  optionTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  optionDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  noNumberState: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  noNumberText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  setupButton: {
    minWidth: 160,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  infoList: {
    marginTop: spacing.sm,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  infoText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginLeft: spacing.md,
    flex: 1,
  },
});

export default CallSettingsScreen;