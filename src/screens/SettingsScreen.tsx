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
  SmartRoutingSettings,
  SmartRoutingMode,
  AfterHoursMode,
  SmartRoutingScheduleConfig,
  updateSmartRoutingSettings,
} from '../services/settingsService';

interface NotificationPrefs {
  push: boolean;
  email: boolean;
  sms: boolean;
}

type ScheduleValidationResult = {
  schedule: SmartRoutingScheduleConfig | null;
  error: 'invalid_time' | null;
};

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
  const [savingRouting, setSavingRouting] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editBusinessName, setEditBusinessName] = useState('');
  const [editBusinessType, setEditBusinessType] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [pushStatus, setPushStatus] = useState<{
    permissionGranted: boolean;
    tokenRegistered: boolean;
    isDevice: boolean;
  } | null>(null);
  const [smartRouting, setSmartRouting] = useState<SmartRoutingSettings | null>(null);
  const [routingMode, setRoutingMode] = useState<SmartRoutingMode>('smart_auto');
  const [afterHoursMode, setAfterHoursMode] = useState<AfterHoursMode>('voicemail');
  const [routingEnabled, setRoutingEnabled] = useState(true);
  const [businessTimezone, setBusinessTimezone] = useState('America/Los_Angeles');
  const [businessHoursStart, setBusinessHoursStart] = useState('09:00');
  const [businessHoursEnd, setBusinessHoursEnd] = useState('17:00');

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
      setSmartRouting(data.smartRouting);
      if (data.smartRouting) {
        setRoutingMode(data.smartRouting.mode);
        setAfterHoursMode(data.smartRouting.afterHoursMode);
        setRoutingEnabled(data.smartRouting.featureEnabled !== false);
        if (data.smartRouting.schedule) {
          setBusinessTimezone(data.smartRouting.schedule.timezone);
          const firstWindow = data.smartRouting.schedule.windows[0];
          if (firstWindow) {
            setBusinessHoursStart(firstWindow.start || '09:00');
            setBusinessHoursEnd(firstWindow.end || '17:00');
          }
        }
      }
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

  const TIME_INPUT_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

  const buildSchedulePayload = (): ScheduleValidationResult => {
    if (!routingEnabled) {
      return { schedule: null, error: null };
    }

    const timezone = businessTimezone.trim();
    const start = businessHoursStart.trim();
    const end = businessHoursEnd.trim();

    if (!timezone || !start || !end) {
      return { schedule: null, error: null };
    }

    if (!TIME_INPUT_REGEX.test(start) || !TIME_INPUT_REGEX.test(end)) {
      return { schedule: null, error: 'invalid_time' };
    }

    return {
      schedule: {
        timezone,
        windows: [
          {
            days: ['mon', 'tue', 'wed', 'thu', 'fri'],
            start,
            end,
          },
        ],
      },
      error: null,
    };
  };

  const handleSaveRoutingSettings = async () => {
    if (!user?.id) {
      return;
    }

    const { schedule, error } = buildSchedulePayload();

    if (error === 'invalid_time') {
      Alert.alert(
        'Invalid hours',
        'Enter business hours using 24-hour HH:MM format (for example 09:00 to 17:30).',
      );
      return;
    }

    try {
      setSavingRouting(true);
      await updateSmartRoutingSettings(user.id, {
        mode: routingMode,
        afterHoursMode,
        featureEnabled: routingEnabled,
        schedule,
      });

      setSmartRouting({
        mode: routingMode,
        afterHoursMode,
        featureEnabled: routingEnabled,
        schedule,
        updatedAt: new Date().toISOString(),
      });

      Alert.alert('Routing updated', 'Call routing preferences saved.');
    } catch (error) {
      console.error('[Settings] Failed to update smart routing', error);
      Alert.alert('Update failed', 'Unable to update call routing right now.');
    } finally {
      setSavingRouting(false);
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

  const modeOptions: Array<{ value: SmartRoutingMode; label: string; description: string }> = [
    {
      value: 'smart_auto',
      label: 'Smart auto',
      description: 'New callers go to AI intake while known callers skip to voicemail.',
    },
    {
      value: 'intake',
      label: 'AI intake',
      description: 'Every call is answered by the AI receptionist for lead capture.',
    },
    {
      value: 'voicemail',
      label: 'Voicemail',
      description: 'All callers hear your voicemail greeting and leave a message.',
    },
  ];

  const afterHoursOptions: Array<{ value: AfterHoursMode; label: string }> = [
    { value: 'voicemail', label: 'Voicemail' },
    { value: 'intake', label: 'AI intake' },
  ];

  const renderModeOption = (option: { value: SmartRoutingMode; label: string; description: string }) => {
    const isActive = routingMode === option.value;
    return (
      <TouchableOpacity
        key={option.value}
        style={[styles.modeOption, isActive && styles.modeOptionActive]}
        onPress={() => setRoutingMode(option.value)}
        activeOpacity={0.8}
      >
        <View style={styles.modeOptionHeader}>
          <Text style={styles.modeOptionLabel}>{option.label}</Text>
          <FlynnIcon
            name={isActive ? 'radio-button-on' : 'radio-button-off'}
            size={18}
            color={isActive ? colors.primary : colors.gray400}
          />
        </View>
        <Text style={styles.modeOptionDescription}>{option.description}</Text>
      </TouchableOpacity>
    );
  };

  const renderAfterHoursOption = (option: { value: AfterHoursMode; label: string }) => {
    const isActive = afterHoursMode === option.value;
    return (
      <TouchableOpacity
        key={option.value}
        style={[styles.afterHoursChip, isActive && styles.afterHoursChipActive]}
        onPress={() => setAfterHoursMode(option.value)}
        activeOpacity={0.8}
      >
        <Text style={[styles.afterHoursChipText, isActive && styles.afterHoursChipTextActive]}>
          {option.label}
        </Text>
      </TouchableOpacity>
    );
  };

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

        {/* Call routing */}
        {renderSection('Call routing', (
          <View style={styles.routingCard}>
            <Text style={styles.routingDescription}>
              Decide who hears the AI receptionist versus voicemail and keep after-hours under control.
            </Text>

            <View style={styles.modeList}>
              {modeOptions.map(renderModeOption)}
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={styles.toggleLabel}>Business hours schedule</Text>
                <Text style={styles.toggleDescription}>
                  Outside these hours callers follow the after-hours route.
                </Text>
              </View>
              <Switch value={routingEnabled} onValueChange={setRoutingEnabled} />
            </View>

            {routingEnabled && (
              <View>
                <FlynnInput
                  label="Timezone"
                  placeholder="e.g. America/Los_Angeles"
                  value={businessTimezone}
                  onChangeText={setBusinessTimezone}
                  autoCapitalize="none"
                  containerStyle={styles.routingInput}
                />
                <View style={styles.inlineInputs}>
                  <FlynnInput
                    label="Start time"
                    placeholder="09:00"
                    value={businessHoursStart}
                    onChangeText={setBusinessHoursStart}
                    autoCapitalize="none"
                    keyboardType="numbers-and-punctuation"
                    containerStyle={styles.routingInlineInput}
                  />
                  <FlynnInput
                    label="End time"
                    placeholder="17:00"
                    value={businessHoursEnd}
                    onChangeText={setBusinessHoursEnd}
                    autoCapitalize="none"
                    keyboardType="numbers-and-punctuation"
                    containerStyle={styles.routingInlineInput}
                  />
                </View>

                <Text style={styles.afterHoursLabel}>After-hours route</Text>
                <View style={styles.afterHoursRow}>
                  {afterHoursOptions.map(renderAfterHoursOption)}
                </View>
              </View>
            )}

            <FlynnButton
              title={savingRouting ? 'Saving…' : 'Save routing'}
              onPress={handleSaveRoutingSettings}
              loading={savingRouting}
              disabled={savingRouting}
              fullWidth
              style={styles.routingSaveButton}
            />
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

          <ScrollView style={styles.editModalContent} showsVerticalScrollIndicator={false}>
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
          </ScrollView>

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
  routingCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  routingDescription: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  modeList: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  modeOption: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    backgroundColor: colors.background,
  },
  modeOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  modeOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  modeOptionLabel: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  modeOptionDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  toggleCopy: {
    flex: 1,
    paddingRight: spacing.md,
  },
  toggleLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  toggleDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xxxs,
  },
  routingInput: {
    marginBottom: spacing.md,
  },
  inlineInputs: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  routingInlineInput: {
    flex: 1,
    marginBottom: spacing.md,
  },
  afterHoursLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  afterHoursRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  afterHoursChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  afterHoursChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  afterHoursChipText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  afterHoursChipTextActive: {
    color: colors.white,
  },
  routingSaveButton: {
    marginTop: spacing.sm,
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
  editModalContent: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
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
});
