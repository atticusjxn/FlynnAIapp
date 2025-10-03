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
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius, shadows } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { FlynnInput } from '../components/ui/FlynnInput';
import { FlynnButton } from '../components/ui/FlynnButton';
import { businessTypes } from '../context/OnboardingContext';
import { useAuth } from '../context/AuthContext';
import {
  CalendarIntegrationView,
  fetchUserSettings,
  resolveBusinessTypeLabel,
  toggleCalendarIntegration,
  updateNotificationSettings,
  updateUserProfile,
} from '../services/settingsService';

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
  const [calendarIntegrations, setCalendarIntegrations] = useState<CalendarIntegrationView[]>([]);
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

  const loadSettings = async () => {
    if (!user?.id) {
      setProfile(null);
      setCalendarIntegrations([]);
      setProfileLoading(false);
      return;
    }

    try {
      setProfileLoading(true);
      setProfileError(null);
      const data = await fetchUserSettings(user.id);
      setProfile(data.profile);
      setCalendarIntegrations(data.calendarIntegrations);

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

  const handleCalendarToggle = async (integration: CalendarIntegrationView) => {
    const nextState = !integration.connected;
    setCalendarIntegrations(prev =>
      prev.map(item => (item.id === integration.id ? { ...item, connected: nextState } : item))
    );
    try {
      await toggleCalendarIntegration(integration.id, nextState);
    } catch (error) {
      console.error('[Settings] Failed to toggle calendar integration', error);
      setCalendarIntegrations(prev =>
        prev.map(item => (item.id === integration.id ? { ...item, connected: integration.connected } : item))
      );
      Alert.alert('Update failed', 'Unable to update calendar integration right now.');
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
    icon: keyof typeof Ionicons.glyphMap,
    title: string,
    subtitle?: string,
    rightElement?: React.ReactNode,
    onPress?: () => void,
  ) => (
    <TouchableOpacity
      style={styles.settingRow}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.settingLeft}>
        <View style={styles.settingIcon}>
          <Ionicons name={icon} size={20} color={colors.primary} />
        </View>
        <View style={styles.settingContent}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle ? <Text style={styles.settingSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <View style={styles.settingRight}>
        {rightElement}
        {onPress && <Ionicons name="chevron-forward" size={20} color={colors.gray400} />}
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
            <Ionicons name="alert-circle" size={16} color={colors.error} />
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
              <Ionicons name="create-outline" size={18} color={colors.primary} />
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
            <View style={styles.settingRowStatic}>
              <View style={styles.settingLeft}>
                <View style={styles.settingIcon}>
                  <Ionicons name="business-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>Business type</Text>
                  <Text style={styles.settingSubtitle}>{businessTypeLabel}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={handleBusinessSettings}>
                <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
              </TouchableOpacity>
            </View>

            {profile?.twilioPhoneNumber ? ( // Check if a Twilio phone number is present
              <View style={styles.toggleRow}>
                <View style={styles.settingLeft}>
                  <View style={styles.settingIcon}>
                    <Ionicons name="call-outline" size={20} color={colors.primary} />
                  </View>
                  <View style={styles.settingContent}>
                    <Text style={styles.settingTitle}>Call forwarding</Text>
                    <Text style={styles.settingSubtitle}>
                      {profile?.forwardingActive ? 'Forwarding enabled' : 'Forwarding off'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={profile?.forwardingActive ?? false}
                  onValueChange={handleForwardingToggle}
                />
              </View>
            ) : (
              <TouchableOpacity style={styles.settingRow} onPress={handleSetupCallForwarding}>
                <View style={styles.settingLeft}>
                  <View style={styles.settingIcon}>
                    <Ionicons name="call-outline" size={20} color={colors.primary} />
                  </View>
                  <View style={styles.settingContent}>
                    <Text style={styles.settingTitle}>Set up call forwarding</Text>
                    <Text style={styles.settingSubtitle}>Provision a new number for your business</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
              </TouchableOpacity>
            )}
          </View>
        ))}

        {/* Notification preferences */}
        {renderSection('Notifications', (
          <View style={styles.settingsGroup}>
            <View style={styles.toggleRow}>
              <View style={styles.settingLeft}>
                <View style={styles.settingIcon}>
                  <Ionicons name="notifications-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>Push notifications</Text>
                  <Text style={styles.settingSubtitle}>
                    {pushStatus ? (
                      !pushStatus.isDevice
                        ? 'Only available on physical devices'
                        : !pushStatus.permissionGranted
                        ? 'Permission not granted - tap to enable'
                        : pushStatus.tokenRegistered
                        ? 'Active and registered'
                        : 'Permission granted - registration pending'
                    ) : (
                      'Device alerts about new jobs and activity'
                    )}
                  </Text>
                </View>
              </View>
              <Switch
                value={notificationPrefs.push}
                onValueChange={value => handleNotificationToggle('push', value)}
                disabled={!pushStatus?.isDevice || !pushStatus?.permissionGranted}
              />
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.settingLeft}>
                <View style={styles.settingIcon}>
                  <Ionicons name="mail-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>Email updates</Text>
                  <Text style={styles.settingSubtitle}>Receive booking confirmations via email</Text>
                </View>
              </View>
              <Switch
                value={notificationPrefs.email}
                onValueChange={value => handleNotificationToggle('email', value)}
              />
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.settingLeft}>
                <View style={styles.settingIcon}>
                  <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>SMS alerts</Text>
                  <Text style={styles.settingSubtitle}>Text message reminders for key activity</Text>
                </View>
              </View>
              <Switch
                value={notificationPrefs.sms}
                onValueChange={value => handleNotificationToggle('sms', value)}
              />
            </View>

            {savingNotifications && (
              <Text style={styles.savingText}>Saving notification preferences…</Text>
            )}
          </View>
        ))}

        {/* Calendar integrations */}
        {renderSection('Calendar integrations', (
          <View style={styles.settingsGroup}>
            {calendarIntegrations.length === 0 ? (
              <Text style={styles.emptyIntegrationText}>
                No calendar connections yet. Connect Google, Outlook, or Apple Calendar to sync your jobs.
              </Text>
            ) : (
              calendarIntegrations.map(integration => (
                <View key={integration.id} style={styles.integrationRow}>
                  <View style={styles.integrationLeft}>
                    <View style={[
                      styles.integrationIcon,
                      { backgroundColor: integration.connected ? colors.successLight : colors.gray100 }
                    ]}>
                      <Ionicons
                        name={integration.icon as keyof typeof Ionicons.glyphMap}
                        size={18}
                        color={integration.connected ? colors.success : colors.gray400}
                      />
                    </View>
                    <View style={styles.integrationContent}>
                      <Text style={styles.integrationTitle}>{integration.label}</Text>
                      <Text style={styles.integrationDescription}>{integration.description}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.connectButton,
                      integration.connected ? styles.disconnectButton : styles.connectButtonPrimary,
                    ]}
                    onPress={() => handleCalendarToggle(integration)}
                  >
                    <Text
                      style={[
                        styles.connectButtonText,
                        integration.connected ? styles.disconnectButtonText : styles.connectButtonTextPrimary,
                      ]}
                    >
                      {integration.connected ? 'Disconnect' : 'Connect'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        ))}

        {/* Appearance */}
        {renderSection('Appearance', (
          <View style={styles.toggleRow}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIcon}>
                <Ionicons name="moon-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Dark mode</Text>
                <Text style={styles.settingSubtitle}>{isDark ? 'Enabled' : 'Disabled'}</Text>
              </View>
            </View>
            <Switch value={isDark} onValueChange={toggleTheme} />
          </View>
        ))}

        {/* Support */}
        {renderSection('Support', (
          <View style={styles.settingsGroup}>
            {renderSettingRow('information-circle-outline', 'Help center', 'Guides and FAQs', undefined, () => Alert.alert('Help', 'Visit flynn.ai/help for more information.'))}
            {renderSettingRow('chatbubbles-outline', 'Contact support', 'support@flynnai.com', undefined, () => Alert.alert('Support', 'Email support@flynnai.com with any issues.'))}
            {renderSettingRow('document-text-outline', 'Data export', 'Download your data as CSV or PDF', undefined, handleDataExport)}
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
            })}
            {renderSettingRow('log-out-outline', 'Sign out', undefined, undefined, handleSignOut)}
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
              <Ionicons name="close" size={24} color={colors.gray600} />
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
    paddingVertical: spacing.sm,
    ...shadows.sm,
  },
  settingRowStatic: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  integrationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  integrationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  },
  integrationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  integrationContent: {
    flex: 1,
  },
  integrationTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  integrationDescription: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  connectButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  connectButtonPrimary: {
    backgroundColor: colors.primary,
  },
  disconnectButton: {
    backgroundColor: colors.transparent,
  },
  connectButtonText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.primary,
  },
  connectButtonTextPrimary: {
    color: colors.white,
  },
  disconnectButtonText: {
    color: colors.primary,
  },
  emptyIntegrationText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
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
