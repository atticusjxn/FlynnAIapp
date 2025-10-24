import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { FlynnIcon, FlynnIconName } from '../components/ui/FlynnIcon';
import { spacing, typography, borderRadius, shadows } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { FlynnInput } from '../components/ui/FlynnInput';
import { FlynnButton } from '../components/ui/FlynnButton';
import { businessTypes } from '../context/OnboardingContext';
import { useAuth } from '../context/AuthContext';
import {
  fetchUserSettings,
  resolveBusinessTypeLabel,
  updateNotificationSettings,
  updateUserProfile,
} from '../services/settingsService';
import { FlynnKeyboardAwareScrollView } from '../components/ui';
import CalendarService, { CalendarIntegration } from '../services/CalendarService';
import Constants from 'expo-constants';

interface NotificationPrefs {
  push: boolean;
  email: boolean;
  sms: boolean;
}

const getInitials = (name?: string, email?: string) => {
  const source = name || email || '';
  if (!source) return 'FL';
  const parts = source.split(/[\s@]/).filter(Boolean);
  const initials = parts.slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('');
  return initials || 'FL';
};

export const SettingsScreen: React.FC = () => {
  const { isDark, colors, toggleTheme } = useTheme();
  const navigation = useNavigation<any>();
  const styles = createStyles(colors);
  const { user, signOut } = useAuth();

  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profile, setProfile] = useState<{
    id: string;
    businessName: string;
    businessType: string;
    email: string;
    phone: string; // This is the user's personal mobile number
    forwardingActive: boolean;
    callFeaturesEnabled: boolean;
    twilioPhoneNumber: string | null; // Added Twilio phone number
    twilioNumberSid: string | null; // Added Twilio number SID
  } | null>(null);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>({ push: false, email: true, sms: true });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editBusinessName, setEditBusinessName] = useState('');
  const [editBusinessType, setEditBusinessType] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [pushStatus, setPushStatus] = useState<{
    permissionGranted: boolean;
    tokenRegistered: boolean;
    isDevice: boolean;
  } | null>(null);
  const [calendarIntegrations, setCalendarIntegrations] = useState<CalendarIntegration[]>([]);
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [connectingCalendar, setConnectingCalendar] = useState(false);

  const loadSettings = async () => {
    if (!user?.id) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    try {
      setProfileLoading(true);
      setProfileError(null);
      const data = await fetchUserSettings(user.id);
      setProfile(data.profile);
      const notifications = data.notificationSettings?.notifications ?? {};
      setNotificationPrefs({
        push: notifications.push ?? data.pushEnabled,
        email: notifications.email ?? true,
        sms: notifications.sms ?? true,
      });
    } catch (error) {
      console.error('[Settings] Failed to load settings', error);
      setProfileError('Unable to load your settings right now. Pull to refresh or try again later.');
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
    void loadPushStatus();
    void loadCalendarIntegrations();
  }, [user?.id]);

  const loadPushStatus = async () => {
    try {
      const { getPushNotificationStatus } = await import('../services/pushRegistration');
      const status = await getPushNotificationStatus();
      setPushStatus(status);
    } catch (error) {
      console.error('[Settings] Failed to load push status', error);
      setPushStatus(null);
    }
  };

  const handleEditProfile = () => {
    if (!profile) return;
    setEditBusinessName(profile.businessName);
    setEditBusinessType(profile.businessType);
    setEditPhone(profile.phone);
    setEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!user?.id || !profile) return;
    try {
      setSavingProfile(true);
      await updateUserProfile(user.id, {
        businessName: editBusinessName.trim(),
        businessType: editBusinessType,
        phone: editPhone.trim(),
      });
      setProfile({
        ...profile,
        businessName: editBusinessName.trim(),
        businessType: editBusinessType,
        phone: editPhone.trim(),
      });
      setEditModalVisible(false);
    } catch (error) {
      console.error('[Settings] Failed to update profile', error);
      Alert.alert('Update failed', 'We could not save your profile changes. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleForwardingToggle = async (value: boolean) => {
    if (!user?.id || !profile) return;
    setProfile(prev => (prev ? { ...prev, forwardingActive: value } : prev));
    try {
      await updateUserProfile(user.id, { forwardingActive: value });
    } catch (error) {
      console.error('[Settings] Failed to update call forwarding', error);
      setProfile(prev => (prev ? { ...prev, forwardingActive: !value } : prev));
      Alert.alert('Update failed', 'Unable to update call forwarding right now.');
    }
  };

  const handleNotificationToggle = async (key: keyof NotificationPrefs, value: boolean) => {
    if (!user?.id) return;
    const next = { ...notificationPrefs, [key]: value };
    setNotificationPrefs(next);
    try {
      setSavingNotifications(true);
      await updateNotificationSettings(user.id, next);
    } catch (error) {
      console.error('[Settings] Failed to update notification preferences', error);
      setNotificationPrefs(notificationPrefs);
      Alert.alert('Update failed', 'Unable to update notification settings right now.');
    } finally {
      setSavingNotifications(false);
    }
  };

  const businessTypeLabel = useMemo(() =>
    profile ? resolveBusinessTypeLabel(profile.businessType) : 'Not specified'
  , [profile]);

  const handleBusinessSettings = () => {
    handleEditProfile();
  };

  const handleDataExport = () => {
    Alert.alert('Data export', 'Export your data as CSV or PDF files.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Export CSV', onPress: () => Alert.alert('Export started', 'CSV export is in progress.') },
      { text: 'Export PDF', onPress: () => Alert.alert('Export started', 'PDF export is in progress.') },
    ]);
  };

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            // Navigation will be handled automatically by auth state change
          } catch (error) {
            console.error('[Settings] Sign out failed', error);
            Alert.alert('Sign out failed', 'Unable to sign out right now. Please try again.');
          }
        },
      },
    ]);
  };

  const loadCalendarIntegrations = async () => {
    try {
      setLoadingCalendars(true);
      const integrations = await CalendarService.listIntegrations();
      setCalendarIntegrations(integrations);
    } catch (error) {
      console.error('[Settings] Failed to load calendar integrations', error);
    } finally {
      setLoadingCalendars(false);
    }
  };

  const handleConnectGoogleCalendar = async () => {
    // Check if running in Expo Go
    const isExpoGo = Constants.appOwnership === 'expo';

    if (isExpoGo) {
      Alert.alert(
        'Native Build Required',
        'Google Calendar integration requires a native development build.\n\nTo use this feature, please run:\n\nnpx expo run:ios\n\nThis will create a development build with native modules enabled.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setConnectingCalendar(true);
      const integration = await CalendarService.connectGoogleCalendar();
      if (integration) {
        setCalendarIntegrations([...calendarIntegrations, integration]);
        Alert.alert('Success', 'Google Calendar connected successfully!');
      } else {
        Alert.alert('Connection failed', 'Unable to connect Google Calendar. Please try again.');
      }
    } catch (error: any) {
      console.error('[Settings] Failed to connect Google Calendar', error);
      Alert.alert('Error', error?.message || 'An error occurred while connecting Google Calendar.');
    } finally {
      setConnectingCalendar(false);
    }
  };

  const handleConnectAppleCalendar = async () => {
    try {
      setConnectingCalendar(true);
      const integration = await CalendarService.connectDeviceCalendar();
      if (integration) {
        setCalendarIntegrations([...calendarIntegrations, integration]);
        Alert.alert('Success', 'Apple Calendar connected successfully!');
      } else {
        Alert.alert('Connection failed', 'Unable to connect Apple Calendar. Please check permissions.');
      }
    } catch (error) {
      console.error('[Settings] Failed to connect Apple Calendar', error);
      Alert.alert('Error', 'An error occurred while connecting Apple Calendar.');
    } finally {
      setConnectingCalendar(false);
    }
  };

  const handleDisconnectCalendar = (integration: CalendarIntegration) => {
    Alert.alert(
      'Disconnect calendar',
      `Are you sure you want to disconnect ${integration.provider} calendar? Synced events will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            const success = await CalendarService.disconnectCalendar(integration.id);
            if (success) {
              setCalendarIntegrations(calendarIntegrations.filter(i => i.id !== integration.id));
              Alert.alert('Disconnected', 'Calendar has been disconnected.');
            } else {
              Alert.alert('Error', 'Failed to disconnect calendar.');
            }
          },
        },
      ]
    );
  };

  const handleSyncCalendar = async (integration: CalendarIntegration) => {
    try {
      const result = await CalendarService.syncCalendar(integration.id);
      if (result.success) {
        Alert.alert('Sync complete', `Synced ${result.eventsSynced || 0} events successfully.`);
        await loadCalendarIntegrations(); // Refresh to show last_synced_at
      } else {
        Alert.alert('Sync failed', result.error || 'Unable to sync calendar right now.');
      }
    } catch (error) {
      console.error('[Settings] Calendar sync failed', error);
      Alert.alert('Error', 'An error occurred while syncing calendar.');
    }
  };

  const handleSetupCallForwarding = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'User not authenticated.');
      return;
    }
    // Navigate to the TwilioProvisioningScreen instead of directly provisioning here
    navigation.navigate('OnboardingNavigator', { screen: 'TwilioProvisioning' });
  };

  const initials = getInitials(profile?.businessName, profile?.email);

  const renderSection = (title: string, children: React.ReactNode) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );

  const renderSettingRow = (
    icon: FlynnIconName,
    title: string,
    subtitle?: string,
    rightElement?: React.ReactNode,
    onPress?: () => void,
    isLast: boolean = false,
  ) => (
    <TouchableOpacity
      style={[styles.settingRow, isLast && styles.rowLast]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.settingLeft}>
        <View style={styles.settingIcon}>
          <FlynnIcon name={icon} size={20} color={colors.primary} />
        </View>
        <View style={styles.settingContent}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle ? <Text style={styles.settingSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <View style={styles.settingRight}>
        {rightElement}
        {onPress ? <FlynnIcon name="chevron-forward" size={20} color={colors.gray400} /> : null}
      </View>
    </TouchableOpacity>
  );

  if (profileLoading) {
    return (
      <SafeAreaView style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loaderText}>Loading your settings…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {profileError && (
          <View style={styles.errorBanner}>
            <FlynnIcon name="alert-circle" size={16} color={colors.error} />
            <Text style={styles.errorText}>{profileError}</Text>
          </View>
        )}

        {/* Profile */}
        {renderSection('Profile', profile ? (
          <View style={styles.profileCard}>
            <View style={styles.profileInfo}>
              <View style={[styles.profileImageContainer, { backgroundColor: colors.primary + '20' }]}>
                <Text style={styles.profileInitials}>{initials}</Text>
              </View>
              <View style={styles.profileDetails}>
                <Text style={styles.profileName}>{profile.businessName || 'Add business name'}</Text>
                <Text style={styles.profileEmail}>{profile.email}</Text>
                <Text style={styles.profilePhone}>{profile.phone || 'Add phone number'}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
              <FlynnIcon name="create-outline" size={18} color={colors.primary} />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.profileCard}>
            <Text style={styles.emptyProfileText}>We couldn't load your profile information.</Text>
            <FlynnButton title="Retry" variant="primary" onPress={loadSettings} />
          </View>
        ))}

        {/* Business configuration */}
        {renderSection('Business configuration', (
          <View style={styles.settingsGroup}>
            {renderSettingRow(
              'business-outline',
              'Business type',
              businessTypeLabel,
              undefined,
              profile ? handleBusinessSettings : undefined,
              !profile?.twilioPhoneNumber,
            )}

            {profile?.twilioPhoneNumber
              ? renderSettingRow(
                  'call-outline',
                  'Call forwarding',
                  profile.forwardingActive ? 'Forwarding enabled' : 'Forwarding off',
                  <Switch
                    value={profile.forwardingActive}
                    onValueChange={handleForwardingToggle}
                  />,
                  undefined,
                  true,
                )
              : renderSettingRow(
                  'call-outline',
                  'Set up call forwarding',
                  'Provision a new number for your business',
                  undefined,
                  handleSetupCallForwarding,
                  true,
                )}
          </View>
        ))}

        {/* Notification preferences */}
        {renderSection('Notifications', (
          <View style={styles.settingsGroup}>
            {renderSettingRow(
              'notifications-outline',
              'Push notifications',
              pushStatus
                ? !pushStatus.isDevice
                  ? 'Only available on physical devices'
                  : !pushStatus.permissionGranted
                    ? 'Permission not granted - tap to enable'
                    : pushStatus.tokenRegistered
                      ? 'Active and registered'
                      : 'Permission granted - registration pending'
                : 'Device alerts about new jobs and activity',
              <Switch
                value={notificationPrefs.push}
                onValueChange={value => handleNotificationToggle('push', value)}
                disabled={!pushStatus?.isDevice || !pushStatus?.permissionGranted}
              />,
              undefined,
              false,
            )}

            {renderSettingRow(
              'mail-outline',
              'Email updates',
              'Receive booking confirmations via email',
              <Switch
                value={notificationPrefs.email}
                onValueChange={value => handleNotificationToggle('email', value)}
              />,
              undefined,
              false,
            )}

            {renderSettingRow(
              'chatbubble-outline',
              'SMS alerts',
              'Text message reminders for key activity',
              <Switch
                value={notificationPrefs.sms}
                onValueChange={value => handleNotificationToggle('sms', value)}
              />,
              undefined,
              true,
            )}

            {savingNotifications && (
              <Text style={styles.savingText}>Saving notification preferences…</Text>
            )}
          </View>
        ))}

        {/* Calendar Integration */}
        {renderSection('Calendar Integration', (
          <View style={styles.settingsGroup}>
            {calendarIntegrations.length > 0 ? (
              <>
                {calendarIntegrations.map((integration, index) => (
                  <View key={integration.id}>
                    {renderSettingRow(
                      'calendar-outline',
                      `${integration.provider.charAt(0).toUpperCase() + integration.provider.slice(1)} Calendar`,
                      integration.last_synced_at
                        ? `Last synced: ${new Date(integration.last_synced_at).toLocaleDateString()}`
                        : integration.sync_error
                        ? `Error: ${integration.sync_error}`
                        : 'Not synced yet',
                      <View style={styles.calendarActions}>
                        <TouchableOpacity
                          onPress={() => handleSyncCalendar(integration)}
                          style={styles.syncButton}
                        >
                          <FlynnIcon name="refresh-outline" size={18} color={colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDisconnectCalendar(integration)}
                          style={styles.disconnectButton}
                        >
                          <FlynnIcon name="close-circle-outline" size={18} color={colors.error} />
                        </TouchableOpacity>
                      </View>,
                      undefined,
                      index === calendarIntegrations.length - 1,
                    )}
                  </View>
                ))}
              </>
            ) : (
              <>
                {renderSettingRow(
                  'logo-google',
                  'Connect Google Calendar',
                  'Sync your Google Calendar for availability tracking',
                  connectingCalendar ? <ActivityIndicator size="small" color={colors.primary} /> : undefined,
                  connectingCalendar ? undefined : handleConnectGoogleCalendar,
                  false,
                )}
                {Platform.OS === 'ios' && renderSettingRow(
                  'logo-apple',
                  'Connect Apple Calendar',
                  'Sync your device calendar for availability tracking',
                  connectingCalendar ? <ActivityIndicator size="small" color={colors.primary} /> : undefined,
                  connectingCalendar ? undefined : handleConnectAppleCalendar,
                  true,
                )}
              </>
            )}
          </View>
        ))}

        {/* Appearance */}
        {renderSection('Appearance', (
          <View style={styles.settingsGroup}>
            {renderSettingRow(
              'moon-outline',
              'Dark mode',
              isDark ? 'Enabled' : 'Disabled',
              <Switch value={isDark} onValueChange={toggleTheme} />,
              undefined,
              true,
            )}
          </View>
        ))}

        {/* Support */}
        {renderSection('Support', (
          <View style={styles.settingsGroup}>
            {renderSettingRow('information-circle-outline', 'Help center', 'Guides and FAQs', undefined, () => Alert.alert('Help', 'Visit flynn.ai/help for more information.'), false)}
            {renderSettingRow('chatbubbles-outline', 'Contact support', 'support@flynnai.com', undefined, () => Alert.alert('Support', 'Email support@flynnai.com with any issues.'), false)}
            {renderSettingRow('document-text-outline', 'Data export', 'Download your data as CSV or PDF', undefined, handleDataExport, true)}
          </View>
        ))}

        {/* Account */}
        {renderSection('Account', (
          <View style={styles.settingsGroup}>
            {renderSettingRow('key-outline', 'Change password', undefined, undefined, async () => {
              if (!profile?.email) {
                Alert.alert('No email', 'We could not find your email address.');
                return;
              }
              Alert.alert(
                'Reset password',
                `We'll send a password reset link to ${profile.email}. Continue?`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Send link',
                    onPress: async () => {
                      try {
                        const { supabase } = await import('../services/supabase');
                        const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
                          redirectTo: 'flynnai://reset-password',
                        });
                        if (error) throw error;
                        Alert.alert('Email sent', 'Check your inbox for a password reset link.');
                      } catch (error) {
                        console.error('[Settings] Password reset failed', error);
                        Alert.alert('Reset failed', 'Unable to send password reset email. Please try again.');
                      }
                    },
                  },
                ]
              );
            }, false)}
            {renderSettingRow('log-out-outline', 'Sign out', undefined, undefined, handleSignOut, true)}
          </View>
        ))}

        <View style={styles.footerSpacer} />
      </ScrollView>

      <Modal
        visible={editModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.editModalContainer}>
          <View style={styles.editModalHeader}>
            <Text style={styles.editModalTitle}>Edit profile</Text>
            <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.closeButton}>
              <FlynnIcon name="close" size={24} color={colors.gray600} />
            </TouchableOpacity>
          </View>

          <FlynnKeyboardAwareScrollView
            style={styles.editModalScrollView}
            contentContainerStyle={styles.editModalContent}
            keyboardShouldPersistTaps="handled"
            enableOnAndroid={true}
            showsVerticalScrollIndicator={false}
          >
            <FlynnInput
              label="Business name"
              value={editBusinessName}
              onChangeText={setEditBusinessName}
              placeholder="Your business name"
              autoCapitalize="words"
            />

            <FlynnInput
              label="Phone number"
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="e.g. +61 0497 779 071"
              keyboardType="phone-pad"
            />

            <Text style={styles.businessTypeLabel}>Business type</Text>
            <View style={styles.businessTypeGrid}>
              {businessTypes.map(type => {
                const active = editBusinessType === type.id;
                return (
                  <TouchableOpacity
                    key={type.id}
                    style={[styles.businessTypeChip, active && { backgroundColor: colors.primary }]}
                    onPress={() => setEditBusinessType(type.id)}
                  >
                    <Text style={[styles.businessTypeChipText, active && { color: colors.white }]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.editModalFooter}>
              <FlynnButton
                title="Cancel"
                variant="secondary"
                onPress={() => setEditModalVisible(false)}
                style={styles.editModalButton}
              />
              <FlynnButton
                title={savingProfile ? 'Saving…' : 'Save profile'}
                variant="primary"
                onPress={handleSaveProfile}
                disabled={savingProfile}
                style={styles.editModalButton}
              />
            </View>
          </FlynnKeyboardAwareScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  closeButton: {
    padding: spacing.xs,
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  profileCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shadows.md,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileImageContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  profileInitials: {
    ...typography.h3,
    color: colors.primary,
    fontWeight: '600',
  },
  profileDetails: {
    flex: 1,
  },
  profileName: {
    ...typography.h4,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  businessName: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  profileEmail: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: spacing.xxxs,
  },
  profilePhone: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: spacing.xxxs,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary + '15',
  },
  editButtonText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  settingsGroup: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
  },
  settingSubtitle: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: spacing.xxxs,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  savingText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  emptyActivityCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  emptyActivityTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  emptyActivityDescription: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: spacing.xxxs,
    textAlign: 'center',
  },
  footerSpacer: {
    height: spacing.xxl,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loaderText: {
    marginTop: spacing.md,
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.error + '15',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.error,
    flex: 1,
  },
  emptyProfileText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  editModalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  editModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  editModalTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  editModalScrollView: {
    flex: 1,
  },
  editModalContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  businessTypeLabel: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  businessTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  businessTypeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  businessTypeChipText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  editModalFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  editModalButton: {
    flex: 1,
  },
  calendarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  syncButton: {
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary + '15',
  },
  disconnectButton: {
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.error + '15',
  },
});
