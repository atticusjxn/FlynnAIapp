import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';

interface ReminderSettings {
  enabled: boolean;
  default_enabled: boolean;
  confirmation_enabled: boolean;
  one_day_before_enabled: boolean;
  one_day_before_time: string;
  morning_of_enabled: boolean;
  morning_of_time: string;
  two_hours_before_enabled: boolean;
  respect_quiet_hours: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  confirmation_template: string;
  one_day_before_template: string;
  morning_of_template: string;
  two_hours_before_template: string;
  on_the_way_template: string;
  post_job_template: string;
}

export const ReminderSettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/reminders/settings');
      setSettings(response.data);
    } catch (error) {
      console.error('Failed to load reminder settings:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load reminder settings',
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      await apiClient.put('/api/reminders/settings', settings);
      Toast.show({
        type: 'success',
        text1: 'Saved',
        text2: 'Reminder settings updated successfully',
      });
    } catch (error) {
      console.error('Failed to save reminder settings:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to save reminder settings',
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof ReminderSettings>(
    key: K,
    value: ReminderSettings[K]
  ) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : null));
  };

  if (loading || !settings) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Automated Reminders</Text>
          <Text style={styles.subtitle}>
            Reduce no-shows with automatic SMS reminders
          </Text>
        </View>

        {/* Master Toggle */}
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Enable Reminders</Text>
              <Text style={styles.settingDescription}>
                Master toggle for all automated reminders
              </Text>
            </View>
            <Switch
              value={settings.enabled}
              onValueChange={(value) => updateSetting('enabled', value)}
              trackColor={{ false: '#CBD5E1', true: '#2563EB' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {settings.enabled && (
          <>
            {/* Default Behavior */}
            <View style={styles.card}>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Auto-Enable for New Jobs</Text>
                  <Text style={styles.settingDescription}>
                    Automatically turn on reminders for new jobs
                  </Text>
                </View>
                <Switch
                  value={settings.default_enabled}
                  onValueChange={(value) => updateSetting('default_enabled', value)}
                  trackColor={{ false: '#CBD5E1', true: '#2563EB' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            {/* Reminder Types */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Reminder Schedule</Text>

              {/* Confirmation */}
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Confirmation (Immediate)</Text>
                  <Text style={styles.settingDescription}>
                    Send confirmation right after booking
                  </Text>
                </View>
                <Switch
                  value={settings.confirmation_enabled}
                  onValueChange={(value) => updateSetting('confirmation_enabled', value)}
                  trackColor={{ false: '#CBD5E1', true: '#2563EB' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* One Day Before */}
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>1 Day Before</Text>
                  <Text style={styles.settingDescription}>
                    Send reminder the day before appointment
                  </Text>
                </View>
                <Switch
                  value={settings.one_day_before_enabled}
                  onValueChange={(value) => updateSetting('one_day_before_enabled', value)}
                  trackColor={{ false: '#CBD5E1', true: '#2563EB' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {settings.one_day_before_enabled && (
                <View style={styles.timeInput}>
                  <Text style={styles.timeLabel}>Send at:</Text>
                  <TextInput
                    style={styles.timeField}
                    value={settings.one_day_before_time}
                    onChangeText={(value) => updateSetting('one_day_before_time', value)}
                    placeholder="18:00"
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
              )}

              {/* Morning Of */}
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Morning Of</Text>
                  <Text style={styles.settingDescription}>
                    Send reminder on the morning of appointment
                  </Text>
                </View>
                <Switch
                  value={settings.morning_of_enabled}
                  onValueChange={(value) => updateSetting('morning_of_enabled', value)}
                  trackColor={{ false: '#CBD5E1', true: '#2563EB' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {settings.morning_of_enabled && (
                <View style={styles.timeInput}>
                  <Text style={styles.timeLabel}>Send at:</Text>
                  <TextInput
                    style={styles.timeField}
                    value={settings.morning_of_time}
                    onChangeText={(value) => updateSetting('morning_of_time', value)}
                    placeholder="08:00"
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
              )}

              {/* Two Hours Before */}
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>2 Hours Before</Text>
                  <Text style={styles.settingDescription}>
                    Last-minute reminder 2 hours before
                  </Text>
                </View>
                <Switch
                  value={settings.two_hours_before_enabled}
                  onValueChange={(value) => updateSetting('two_hours_before_enabled', value)}
                  trackColor={{ false: '#CBD5E1', true: '#2563EB' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            {/* Quiet Hours */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Quiet Hours</Text>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Respect Quiet Hours</Text>
                  <Text style={styles.settingDescription}>
                    Don't send reminders during late night/early morning
                  </Text>
                </View>
                <Switch
                  value={settings.respect_quiet_hours}
                  onValueChange={(value) => updateSetting('respect_quiet_hours', value)}
                  trackColor={{ false: '#CBD5E1', true: '#2563EB' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {settings.respect_quiet_hours && (
                <View style={styles.quietHoursInputs}>
                  <View style={styles.quietHourRow}>
                    <Text style={styles.timeLabel}>Start:</Text>
                    <TextInput
                      style={styles.timeField}
                      value={settings.quiet_hours_start}
                      onChangeText={(value) => updateSetting('quiet_hours_start', value)}
                      placeholder="21:00"
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                  <View style={styles.quietHourRow}>
                    <Text style={styles.timeLabel}>End:</Text>
                    <TextInput
                      style={styles.timeField}
                      value={settings.quiet_hours_end}
                      onChangeText={(value) => updateSetting('quiet_hours_end', value)}
                      placeholder="08:00"
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                </View>
              )}
            </View>

            {/* Message Templates */}
            <TouchableOpacity
              style={styles.card}
              onPress={() => setShowTemplates(!showTemplates)}
            >
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Message Templates</Text>
                <Text style={styles.chevron}>{showTemplates ? '▼' : '▶'}</Text>
              </View>
            </TouchableOpacity>

            {showTemplates && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Available Variables:</Text>
                <Text style={styles.variablesText}>
                  {'{{clientName}}, {{serviceType}}, {{date}}, {{time}}, {{location}}, {{businessName}}'}
                </Text>

                {settings.confirmation_enabled && (
                  <View style={styles.templateSection}>
                    <Text style={styles.templateLabel}>Confirmation:</Text>
                    <TextInput
                      style={styles.templateInput}
                      value={settings.confirmation_template}
                      onChangeText={(value) => updateSetting('confirmation_template', value)}
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                )}

                {settings.one_day_before_enabled && (
                  <View style={styles.templateSection}>
                    <Text style={styles.templateLabel}>1 Day Before:</Text>
                    <TextInput
                      style={styles.templateInput}
                      value={settings.one_day_before_template}
                      onChangeText={(value) => updateSetting('one_day_before_template', value)}
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                )}

                {settings.morning_of_enabled && (
                  <View style={styles.templateSection}>
                    <Text style={styles.templateLabel}>Morning Of:</Text>
                    <TextInput
                      style={styles.templateInput}
                      value={settings.morning_of_template}
                      onChangeText={(value) => updateSetting('morning_of_template', value)}
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                )}

                {settings.two_hours_before_enabled && (
                  <View style={styles.templateSection}>
                    <Text style={styles.templateLabel}>2 Hours Before:</Text>
                    <TextInput
                      style={styles.templateInput}
                      value={settings.two_hours_before_template}
                      onChangeText={(value) => updateSetting('two_hours_before_template', value)}
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                )}

                <View style={styles.templateSection}>
                  <Text style={styles.templateLabel}>On The Way:</Text>
                  <TextInput
                    style={styles.templateInput}
                    value={settings.on_the_way_template}
                    onChangeText={(value) => updateSetting('on_the_way_template', value)}
                    multiline
                    numberOfLines={3}
                  />
                  <Text style={styles.templateNote}>
                    Note: Use {'{{eta}}'} for estimated arrival time in minutes
                  </Text>
                </View>
              </View>
            )}
          </>
        )}

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={saveSettings}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save Settings</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 12,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1E293B',
    fontWeight: '600',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 12,
    lineHeight: 16,
    color: '#64748B',
  },
  timeInput: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingVertical: 8,
  },
  timeLabel: {
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
    marginRight: 12,
  },
  timeField: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1E293B',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    width: 80,
  },
  quietHoursInputs: {
    paddingLeft: 16,
    paddingTop: 12,
  },
  quietHourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  chevron: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    color: '#94A3B8',
  },
  variablesText: {
    fontSize: 12,
    lineHeight: 16,
    color: '#64748B',
    fontFamily: 'monospace',
    backgroundColor: '#F1F5F9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  templateSection: {
    marginBottom: 16,
  },
  templateLabel: {
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
    fontWeight: '600',
    marginBottom: 8,
  },
  templateInput: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1E293B',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  templateNote: {
    fontSize: 11,
    lineHeight: 14,
    color: '#94A3B8',
    marginTop: 4,
    fontStyle: 'italic',
  },
  saveButton: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 64,
  },
  saveButtonDisabled: {
    backgroundColor: '#CBD5E1',
  },
  saveButtonText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default ReminderSettingsScreen;
