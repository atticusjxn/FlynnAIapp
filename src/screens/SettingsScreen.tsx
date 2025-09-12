import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Switch,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius, shadows } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';

interface IntegrationStatus {
  id: string;
  name: string;
  connected: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
}

interface UserProfile {
  name: string;
  businessName: string;
  businessType: string;
  email: string;
  phone: string;
}

export const SettingsScreen: React.FC = () => {
  const { isDark, colors, toggleTheme } = useTheme();
  const navigation = useNavigation<any>();
  const styles = createStyles(colors);
  const [user] = useState<UserProfile>({
    name: 'John Smith',
    businessName: 'Smith Plumbing Services',
    businessType: 'home_property',
    email: 'john@smithplumbing.com',
    phone: '+1 (555) 123-4567',
  });

  const [notifications, setNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(true);

  const [calendarIntegrations, setCalendarIntegrations] = useState<IntegrationStatus[]>([
    {
      id: 'google',
      name: 'Google Calendar',
      connected: true,
      icon: 'calendar-outline',
      description: 'Sync jobs with Google Calendar',
    },
    {
      id: 'outlook',
      name: 'Outlook',
      connected: false,
      icon: 'mail-outline',
      description: 'Sync jobs with Outlook Calendar',
    },
    {
      id: 'apple',
      name: 'Apple Calendar',
      connected: false,
      icon: 'phone-portrait-outline',
      description: 'Sync jobs with Apple Calendar',
    },
  ]);

  const [accountingIntegrations, setAccountingIntegrations] = useState<IntegrationStatus[]>([
    {
      id: 'myob',
      name: 'MYOB',
      connected: true,
      icon: 'calculator-outline',
      description: 'Send invoices and track expenses',
    },
    {
      id: 'quickbooks',
      name: 'QuickBooks',
      connected: false,
      icon: 'receipt-outline',
      description: 'Accounting and invoicing platform',
    },
    {
      id: 'xero',
      name: 'Xero',
      connected: false,
      icon: 'card-outline',
      description: 'Cloud accounting software',
    },
  ]);

  const [callForwarding, setCallForwarding] = useState(true);

  const handleEditProfile = () => {
    Alert.alert('Edit Profile', 'Profile editing feature coming soon!');
  };

  const handleBusinessSettings = () => {
    Alert.alert('Business Settings', 'Business configuration feature coming soon!');
  };

  const handleIntegrationToggle = (
    type: 'calendar' | 'accounting',
    id: string
  ) => {
    if (type === 'calendar') {
      setCalendarIntegrations(prev =>
        prev.map(integration =>
          integration.id === id
            ? { ...integration, connected: !integration.connected }
            : integration
        )
      );
    } else {
      setAccountingIntegrations(prev =>
        prev.map(integration =>
          integration.id === id
            ? { ...integration, connected: !integration.connected }
            : integration
        )
      );
    }
  };

  const handleDataExport = () => {
    Alert.alert('Data Export', 'Export your data as CSV or PDF files.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Export CSV', onPress: () => Alert.alert('Success', 'CSV export started') },
      { text: 'Export PDF', onPress: () => Alert.alert('Success', 'PDF export started') },
    ]);
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => Alert.alert('Signed Out') },
    ]);
  };

  const handleShortcutSetup = () => {
    navigation.navigate('ShortcutSetup');
  };

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
    showChevron: boolean = true
  ) => (
    <TouchableOpacity
      style={styles.settingRow}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.settingLeft}>
        <View style={styles.settingIcon}>
          <Ionicons name={icon} size={20} color={colors.primary} />
        </View>
        <View style={styles.settingContent}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      <View style={styles.settingRight}>
        {rightElement}
        {showChevron && onPress && (
          <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
        )}
      </View>
    </TouchableOpacity>
  );

  const renderIntegrationRow = (
    integration: IntegrationStatus,
    type: 'calendar' | 'accounting'
  ) => (
    <View key={integration.id} style={styles.integrationRow}>
      <View style={styles.integrationLeft}>
        <View style={[
          styles.integrationIcon,
          { backgroundColor: integration.connected ? colors.successLight : colors.gray100 }
        ]}>
          <Ionicons 
            name={integration.icon} 
            size={20} 
            color={integration.connected ? colors.success : colors.gray400} 
          />
        </View>
        <View style={styles.integrationContent}>
          <Text style={styles.integrationTitle}>{integration.name}</Text>
          <Text style={styles.integrationDescription}>{integration.description}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={[
          styles.connectButton,
          integration.connected ? styles.disconnectButton : styles.connectButtonPrimary
        ]}
        onPress={() => handleIntegrationToggle(type, integration.id)}
      >
        <Text style={[
          styles.connectButtonText,
          integration.connected ? styles.disconnectButtonText : styles.connectButtonTextPrimary
        ]}>
          {integration.connected ? 'Disconnect' : 'Connect'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* User Profile Section */}
        {renderSection('Profile', (
          <View style={styles.profileCard}>
            <View style={styles.profileInfo}>
              <View style={styles.profileImageContainer}>
                <Image
                  source={{ uri: 'https://via.placeholder.com/60x60/2563EB/FFFFFF?text=JS' }}
                  style={styles.profileImage}
                />
              </View>
              <View style={styles.profileDetails}>
                <Text style={styles.profileName}>{user.name}</Text>
                <Text style={styles.businessName}>{user.businessName}</Text>
                <Text style={styles.profileEmail}>{user.email}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
              <Ionicons name="create-outline" size={18} color={colors.primary} />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Business Configuration */}
        {renderSection('Business Configuration', (
          <View>
            {renderSettingRow(
              'business-outline',
              'Business Type',
              'Home & Property Services',
              undefined,
              handleBusinessSettings
            )}
            {renderSettingRow(
              'time-outline',
              'Default Service Duration',
              '2 hours',
              undefined,
              handleBusinessSettings
            )}
            {renderSettingRow(
              'calendar-outline',
              'Business Hours',
              'Mon-Fri 8AM-6PM',
              undefined,
              handleBusinessSettings
            )}
            {renderSettingRow(
              'document-text-outline',
              'Job Templates',
              'Manage default templates',
              undefined,
              handleBusinessSettings
            )}
          </View>
        ))}

        {/* Calendar Integrations */}
        {renderSection('Calendar Sync', (
          <View style={styles.integrationsContainer}>
            {calendarIntegrations.map(integration => 
              renderIntegrationRow(integration, 'calendar')
            )}
          </View>
        ))}

        {/* Accounting Software */}
        {renderSection('Accounting Software', (
          <View style={styles.integrationsContainer}>
            {accountingIntegrations.map(integration => 
              renderIntegrationRow(integration, 'accounting')
            )}
          </View>
        ))}

        {/* Communication Settings */}
        {renderSection('Communication', (
          <View>
            {renderSettingRow(
              'call-outline',
              'Call Forwarding',
              callForwarding ? 'Active' : 'Inactive',
              <Switch
                value={callForwarding}
                onValueChange={setCallForwarding}
                trackColor={{ false: colors.gray300, true: colors.primaryLight }}
                thumbColor={callForwarding ? colors.primary : colors.gray400}
              />,
              undefined,
              false
            )}
            {renderSettingRow(
              'chatbubble-outline',
              'SMS Notifications',
              smsNotifications ? 'Enabled' : 'Disabled',
              <Switch
                value={smsNotifications}
                onValueChange={setSmsNotifications}
                trackColor={{ false: colors.gray300, true: colors.primaryLight }}
                thumbColor={smsNotifications ? colors.primary : colors.gray400}
              />,
              undefined,
              false
            )}
            {renderSettingRow(
              'mail-outline',
              'Email Notifications',
              emailNotifications ? 'Enabled' : 'Disabled',
              <Switch
                value={emailNotifications}
                onValueChange={setEmailNotifications}
                trackColor={{ false: colors.gray300, true: colors.primaryLight }}
                thumbColor={emailNotifications ? colors.primary : colors.gray400}
              />,
              undefined,
              false
            )}
          </View>
        ))}

        {/* App Settings */}
        {renderSection('App Settings', (
          <View>
            {renderSettingRow(
              'flash-outline',
              'iOS Shortcuts',
              'Set up Control Center shortcut',
              undefined,
              handleShortcutSetup
            )}
            {renderSettingRow(
              'moon-outline',
              'Dark Mode',
              undefined,
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: colors.gray300, true: colors.primaryLight }}
                thumbColor={isDark ? colors.primary : colors.gray400}
              />,
              undefined,
              false
            )}
            {renderSettingRow(
              'notifications-outline',
              'Push Notifications',
              notifications ? 'Enabled' : 'Disabled',
              <Switch
                value={notifications}
                onValueChange={setNotifications}
                trackColor={{ false: colors.gray300, true: colors.primaryLight }}
                thumbColor={notifications ? colors.primary : colors.gray400}
              />,
              undefined,
              false
            )}
            {renderSettingRow(
              'language-outline',
              'Language',
              'English',
              undefined,
              () => Alert.alert('Language', 'Language selection coming soon!')
            )}
            {renderSettingRow(
              'download-outline',
              'Export Data',
              'Download your data',
              undefined,
              handleDataExport
            )}
          </View>
        ))}

        {/* Account Management */}
        {renderSection('Account', (
          <View>
            {renderSettingRow(
              'card-outline',
              'Subscription',
              'Pro Plan - Active',
              undefined,
              () => Alert.alert('Subscription', 'Manage subscription coming soon!')
            )}
            {renderSettingRow(
              'receipt-outline',
              'Billing',
              'Payment method & history',
              undefined,
              () => Alert.alert('Billing', 'Billing management coming soon!')
            )}
            {renderSettingRow(
              'shield-outline',
              'Privacy Policy',
              undefined,
              undefined,
              () => Alert.alert('Privacy Policy', 'Privacy policy document')
            )}
            {renderSettingRow(
              'document-text-outline',
              'Terms of Service',
              undefined,
              undefined,
              () => Alert.alert('Terms', 'Terms of service document')
            )}
            {renderSettingRow(
              'log-out-outline',
              'Sign Out',
              undefined,
              undefined,
              handleSignOut
            )}
          </View>
        ))}
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
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },

  content: {
    flex: 1,
    paddingVertical: spacing.md,
  },

  section: {
    marginBottom: spacing.xl,
  },

  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },

  profileCard: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.sm,
  },

  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  profileImageContainer: {
    marginRight: spacing.md,
  },

  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.gray200,
  },

  profileDetails: {
    flex: 1,
  },

  profileName: {
    ...typography.h4,
    color: colors.textPrimary,
    marginBottom: spacing.xxxs,
  },

  businessName: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: spacing.xxxs,
  },

  profileEmail: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },

  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray100,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },

  editButtonText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },

  settingRow: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xs,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.sm,
  },

  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },

  settingContent: {
    flex: 1,
  },

  settingTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },

  settingSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xxxs,
  },

  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  integrationsContainer: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },

  integrationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  integrationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  integrationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },

  integrationContent: {
    flex: 1,
  },

  integrationTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },

  integrationDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  connectButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },

  connectButtonPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  disconnectButton: {
    backgroundColor: colors.white,
    borderColor: colors.gray300,
  },

  connectButtonText: {
    ...typography.caption,
    fontWeight: '600',
  },

  connectButtonTextPrimary: {
    color: colors.white,
  },

  disconnectButtonText: {
    color: colors.gray600,
  },
});