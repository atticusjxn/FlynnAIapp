// Booking Page Setup Screen
// Configure booking page, business hours, and booking preferences

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ActivityIndicator,
  Alert,
  Share,
  Modal,
  FlatList,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { BusinessHours } from '../../types/booking';
import BookingPageService from '../../services/BookingPageService';
import BookingTemplateService, { BookingFormTemplate } from '../../services/BookingTemplateService';
import { CalendarService } from '../../services/integrations/CalendarService';
import { OrganizationService } from '../../services/organizationService';
import type { IntegrationConnection } from '../../types/integrations';
import { supabase } from '../../services/supabase';

// Enable dismissing web browser on iOS
WebBrowser.maybeCompleteAuthSession();

const DAYS: (keyof BusinessHours)[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

// Map generic icon names to Ionicons names
const getIoniconName = (iconName: string): string => {
  const iconMap: Record<string, string> = {
    'wrench': 'construct-outline',
    'zap': 'flash-outline',
    'thermometer': 'thermometer-outline',
    'hammer': 'hammer-outline',
    'key': 'key-outline',
    'scissors': 'cut-outline',
    'heart': 'heart-outline',
    'sparkles': 'sparkles-outline',
    'dumbbell': 'barbell-outline',
    'briefcase': 'briefcase-outline',
    'car': 'car-outline',
    'home': 'home-outline',
    'brush': 'brush-outline',
    'camera': 'camera-outline',
    'medical': 'medical-outline',
    'paw': 'paw-outline',
  };

  return iconMap[iconName] || 'help-circle-outline';
};

const BookingPageSetupScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bookingPageId, setBookingPageId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string>('');

  // Form fields
  const [businessName, setBusinessName] = useState('');
  const [slug, setSlug] = useState('');
  const [slotDuration, setSlotDuration] = useState('60');
  const [bufferTime, setBufferTime] = useState('15');
  const [isActive, setIsActive] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [businessHours, setBusinessHours] = useState<BusinessHours>({
    monday: { enabled: true, start: '09:00', end: '17:00' },
    tuesday: { enabled: true, start: '09:00', end: '17:00' },
    wednesday: { enabled: true, start: '09:00', end: '17:00' },
    thursday: { enabled: true, start: '09:00', end: '17:00' },
    friday: { enabled: true, start: '09:00', end: '17:00' },
    saturday: { enabled: false, start: '09:00', end: '17:00' },
    sunday: { enabled: false, start: '09:00', end: '17:00' },
  });

  // Template selector
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [templates, setTemplates] = useState<BookingFormTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<BookingFormTemplate | null>(null);

  // Calendar integration
  const [calendarConnection, setCalendarConnection] = useState<IntegrationConnection | null>(null);
  const [loadingCalendar, setLoadingCalendar] = useState(false);

  useEffect(() => {
    loadBookingPage();
    loadCalendarConnection();
  }, []);

  const loadCalendarConnection = async () => {
    try {
      const connection = await CalendarService.getConnection();
      setCalendarConnection(connection);
    } catch (error) {
      console.error('Failed to load calendar connection:', error);
    }
  };

  const loadBookingPage = async () => {
    try {
      setLoading(true);

      // Get user's org_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('default_org_id')
        .eq('id', user.id)
        .single();

      if (!userData?.default_org_id) return;

      setOrgId(userData.default_org_id);

      // Check if booking page exists
      const bookingPage = await BookingPageService.getBookingPage(userData.default_org_id);

      if (bookingPage) {
        setBookingPageId(bookingPage.id);
        setBusinessName(bookingPage.business_name);
        setSlug(bookingPage.slug);
        setSlotDuration(bookingPage.slot_duration_minutes.toString());
        setBufferTime(bookingPage.buffer_time_minutes.toString());
        setIsActive(bookingPage.is_active);
        setBusinessHours(bookingPage.business_hours);

        // Load selected template if exists
        if (bookingPage.selected_template_id) {
          setSelectedTemplateId(bookingPage.selected_template_id);
          try {
            const template = await BookingTemplateService.getTemplateById(bookingPage.selected_template_id);
            if (template) {
              setSelectedTemplate(template);
            }
          } catch (error) {
            console.error('Failed to load template:', error);
          }
        }

        // Load custom fields if exists
        if (bookingPage.custom_fields) {
          setCustomFields(bookingPage.custom_fields);
        }
      }
    } catch (error) {
      console.error('Failed to load booking page:', error);
      Alert.alert('Error', 'Failed to load booking page settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validate form
    if (!businessName.trim()) {
      Alert.alert('Error', 'Please enter your business name');
      return;
    }

    if (!slug.trim()) {
      Alert.alert('Error', 'Please enter a booking page URL');
      return;
    }

    // Validate business hours
    const validation = BookingPageService.validateBusinessHours(businessHours);
    if (!validation.valid) {
      Alert.alert('Error', validation.errors.join('\n'));
      return;
    }

    setSaving(true);
    try {
      if (bookingPageId) {
        // Update existing
        await BookingPageService.updateBookingPage(bookingPageId, {
          business_name: businessName,
          slug,
          slot_duration_minutes: parseInt(slotDuration),
          buffer_time_minutes: parseInt(bufferTime),
          is_active: isActive,
          business_hours: businessHours,
          selected_template_id: selectedTemplateId,
          custom_fields: customFields,
        });
        Alert.alert('Success', 'Booking page updated successfully');
      } else {
        // Create new
        const bookingPage = await BookingPageService.createBookingPage({
          org_id: orgId,
          business_name: businessName,
          slug,
          slot_duration_minutes: parseInt(slotDuration),
          buffer_time_minutes: parseInt(bufferTime),
          is_active: isActive,
          business_hours: businessHours,
          selected_template_id: selectedTemplateId,
          custom_fields: customFields,
        });
        setBookingPageId(bookingPage.id);
        Alert.alert('Success', 'Booking page created successfully');
      }
    } catch (error: any) {
      console.error('Failed to save booking page:', error);
      Alert.alert('Error', error.message || 'Failed to save booking page');
    } finally {
      setSaving(false);
    }
  };

  const handleShareLink = async () => {
    if (!slug) {
      Alert.alert('Error', 'Please save your booking page first');
      return;
    }

    const bookingUrl = BookingPageService.getBookingUrl(slug);

    try {
      await Share.share({
        message: `Book an appointment: ${bookingUrl}`,
        url: bookingUrl,
      });
    } catch (error) {
      console.error('Failed to share:', error);
    }
  };

  const updateDayHours = (day: keyof BusinessHours, field: 'enabled' | 'start' | 'end', value: boolean | string) => {
    setBusinessHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff4500" />
      </View>
    );
  }

  const bookingUrl = slug ? BookingPageService.getBookingUrl(slug) : '';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Booking Page Setup</Text>
        <TouchableOpacity
          onPress={handleSave}
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Business Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Business Information</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Business Name</Text>
              <TextInput
                style={styles.input}
                value={businessName}
                onChangeText={setBusinessName}
                placeholder="e.g., Acme Plumbing"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Booking Page URL</Text>
              <View style={styles.slugContainer}>
                <Text style={styles.slugPrefix}>flynnai.app/</Text>
                <TextInput
                  style={styles.slugInput}
                  value={slug}
                  onChangeText={(text) => setSlug(text.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="your-business"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                />
              </View>
              {bookingUrl && (
                <View style={styles.urlPreview}>
                  <Text style={styles.urlText}>{bookingUrl}</Text>
                  <TouchableOpacity onPress={handleShareLink}>
                    <Ionicons name="share-outline" size={20} color="#ff4500" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* Template Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Booking Form Template</Text>

            <TouchableOpacity
              style={styles.templateButton}
              onPress={async () => {
                try {
                  const fetchedTemplates = await BookingTemplateService.getAllTemplates();
                  setTemplates(fetchedTemplates);
                  setShowTemplateSelector(true);
                } catch (error) {
                  console.error('Failed to load templates:', error);
                  Alert.alert('Error', 'Failed to load templates');
                }
              }}
            >
              <Text style={styles.templateButtonText}>
                {selectedTemplate ? selectedTemplate.name : 'Choose Template'}
              </Text>
              <Ionicons name="chevron-forward" size={20} color="#64748B" />
            </TouchableOpacity>

            {selectedTemplate && (
              <View style={styles.selectedTemplateInfo}>
                <Text style={styles.helperText}>
                  {selectedTemplate.description}
                </Text>
                <Text style={styles.helperText}>
                  {customFields.length} custom fields
                </Text>
              </View>
            )}

            {/* Custom Fields Editor */}
            {customFields.length > 0 && (
              <View style={styles.customFieldsSection}>
                <View style={styles.customFieldsHeader}>
                  <Text style={styles.customFieldsTitle}>Form Fields</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setCustomFields([...customFields, {
                        label: '',
                        type: 'text',
                        required: false,
                        placeholder: '',
                      }]);
                    }}
                    style={styles.addFieldButton}
                  >
                    <Ionicons name="add-circle-outline" size={20} color="#2563EB" />
                    <Text style={styles.addFieldText}>Add Field</Text>
                  </TouchableOpacity>
                </View>

                {customFields.map((field, index) => (
                  <View key={index} style={styles.customFieldItem}>
                    <View style={styles.customFieldRow}>
                      <TextInput
                        style={styles.customFieldInput}
                        placeholder="Field label (e.g., Service Type)"
                        value={field.label}
                        onChangeText={(text) => {
                          const updated = [...customFields];
                          updated[index].label = text;
                          setCustomFields(updated);
                        }}
                        placeholderTextColor="#94A3B8"
                      />
                      <TouchableOpacity
                        onPress={() => {
                          const updated = customFields.filter((_, i) => i !== index);
                          setCustomFields(updated);
                        }}
                        style={styles.deleteFieldButton}
                      >
                        <Ionicons name="trash-outline" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.customFieldOptions}>
                      <TouchableOpacity
                        onPress={() => {
                          const updated = [...customFields];
                          updated[index].required = !updated[index].required;
                          setCustomFields(updated);
                        }}
                        style={styles.fieldOptionButton}
                      >
                        <Ionicons
                          name={field.required ? 'checkbox' : 'square-outline'}
                          size={20}
                          color={field.required ? '#2563EB' : '#64748B'}
                        />
                        <Text style={styles.fieldOptionText}>Required</Text>
                      </TouchableOpacity>
                      <View style={styles.fieldTypeSelector}>
                        <Text style={styles.fieldTypeLabel}>Type:</Text>
                        <TouchableOpacity
                          onPress={() => {
                            const types = ['text', 'textarea', 'select', 'date', 'time', 'radio'];
                            const typeLabels = ['Text', 'Text Area', 'Select', 'Date', 'Time', 'Radio'];
                            const currentType = field.type || 'text';

                            if (Platform.OS === 'ios') {
                              ActionSheetIOS.showActionSheetWithOptions(
                                {
                                  options: [...typeLabels, 'Cancel'],
                                  cancelButtonIndex: typeLabels.length,
                                  title: 'Select Field Type',
                                },
                                (buttonIndex) => {
                                  if (buttonIndex < types.length) {
                                    const updated = [...customFields];
                                    updated[index].type = types[buttonIndex];
                                    setCustomFields(updated);
                                  }
                                }
                              );
                            } else {
                              // For Android, cycle through types
                              const currentIndex = types.indexOf(currentType);
                              const nextIndex = (currentIndex + 1) % types.length;
                              const updated = [...customFields];
                              updated[index].type = types[nextIndex];
                              setCustomFields(updated);
                            }
                          }}
                          style={styles.fieldTypeButton}
                        >
                          <Text style={styles.fieldTypeValue}>
                            {field.type === 'textarea' ? 'Text Area' :
                             field.type === 'text' ? 'Text' :
                             field.type === 'select' ? 'Select' :
                             field.type === 'date' ? 'Date' :
                             field.type === 'time' ? 'Time' :
                             field.type === 'radio' ? 'Radio' : 'Text'}
                          </Text>
                          <Ionicons name="chevron-down" size={16} color="#64748B" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Calendar Integration */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Calendar Integration</Text>

            {calendarConnection?.status === 'connected' ? (
              <View style={styles.calendarConnected}>
                <View style={styles.calendarHeader}>
                  <Ionicons name="checkmark-circle" size={24} color="#10b981" />
                  <View style={styles.calendarInfo}>
                    <Text style={styles.calendarTitle}>Google Calendar Connected</Text>
                    <Text style={styles.calendarSubtitle}>
                      {calendarConnection.account_name}
                    </Text>
                  </View>
                </View>
                <Text style={styles.helperText}>
                  Bookings will sync to your calendar and availability will be checked automatically
                </Text>
                <TouchableOpacity
                  style={styles.disconnectCalendarButton}
                  onPress={async () => {
                    Alert.alert(
                      'Disconnect Calendar',
                      'Are you sure? New bookings won\'t sync to your calendar.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Disconnect',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              setLoadingCalendar(true);
                              await CalendarService.disconnect();
                              setCalendarConnection(null);
                              Alert.alert('Success', 'Calendar disconnected');
                            } catch (error) {
                              Alert.alert('Error', 'Failed to disconnect calendar');
                            } finally {
                              setLoadingCalendar(false);
                            }
                          },
                        },
                      ]
                    );
                  }}
                  disabled={loadingCalendar}
                >
                  <Ionicons name="unlink-outline" size={18} color="#ef4444" />
                  <Text style={styles.disconnectCalendarText}>Disconnect</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.calendarDisconnected}>
                <View style={styles.calendarPlaceholder}>
                  <Ionicons name="calendar-outline" size={32} color="#64748b" />
                  <Text style={styles.calendarPlaceholderTitle}>
                    Connect Google Calendar
                  </Text>
                  <Text style={styles.calendarPlaceholderText}>
                    Prevent double-booking by syncing your availability and automatically adding confirmed bookings to your calendar
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.connectCalendarButton}
                  onPress={async () => {
                    try {
                      setLoadingCalendar(true);

                      // Get org ID
                      const { orgId } = await OrganizationService.fetchOnboardingData();
                      if (!orgId) {
                        Alert.alert('Error', 'Organization not found. Please try again.');
                        return;
                      }

                      // Get OAuth URL
                      const authUrl = CalendarService.getAuthorizationUrl(orgId);

                      // Open OAuth in browser
                      const result = await WebBrowser.openAuthSessionAsync(
                        authUrl,
                        'https://flynnai-telephony.fly.dev/api/integrations/google-calendar/callback'
                      );

                      if (result.type === 'success') {
                        // Wait for server to save connection
                        await new Promise(resolve => setTimeout(resolve, 1000));

                        // Reload calendar connection
                        await loadCalendarConnection();

                        Alert.alert('Success', 'Google Calendar connected successfully!');
                      } else if (result.type === 'cancel') {
                        console.log('[GoogleCalendar] User cancelled authorization');
                      }
                    } catch (error) {
                      console.error('[GoogleCalendar] Connection error:', error);
                      Alert.alert('Error', 'Failed to connect Google Calendar. Please try again.');
                    } finally {
                      setLoadingCalendar(false);
                    }
                  }}
                  disabled={loadingCalendar}
                >
                  {loadingCalendar ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="logo-google" size={18} color="#fff" />
                      <Text style={styles.connectCalendarText}>Connect Google Calendar</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Booking Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Booking Settings</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Appointment Duration (minutes)</Text>
              <TextInput
                style={styles.input}
                value={slotDuration}
                onChangeText={setSlotDuration}
                keyboardType="number-pad"
                placeholder="60"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Buffer Time Between Appointments (minutes)</Text>
              <TextInput
                style={styles.input}
                value={bufferTime}
                onChangeText={setBufferTime}
                keyboardType="number-pad"
                placeholder="15"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.switchField}>
              <View>
                <Text style={styles.label}>Accept Bookings</Text>
                <Text style={styles.helperText}>
                  {isActive ? 'Your booking page is live' : 'Your booking page is paused'}
                </Text>
              </View>
              <Switch
                value={isActive}
                onValueChange={setIsActive}
                trackColor={{ false: '#CBD5E1', true: '#ff4500' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* Business Hours */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Business Hours</Text>

            {DAYS.map(day => {
              const dayHours = businessHours[day];
              return (
                <View key={day} style={styles.dayRow}>
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayName}>{day.charAt(0).toUpperCase() + day.slice(1)}</Text>
                    <Switch
                      value={dayHours.enabled}
                      onValueChange={(value) => updateDayHours(day, 'enabled', value)}
                      trackColor={{ false: '#CBD5E1', true: '#ff4500' }}
                      thumbColor="#FFFFFF"
                    />
                  </View>

                  {dayHours.enabled && (
                    <View style={styles.timeInputs}>
                      <View style={styles.timeField}>
                        <Text style={styles.timeLabel}>Start</Text>
                        <TextInput
                          style={styles.timeInput}
                          value={dayHours.start}
                          onChangeText={(value) => updateDayHours(day, 'start', value)}
                          placeholder="09:00"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>

                      <Text style={styles.timeSeparator}>to</Text>

                      <View style={styles.timeField}>
                        <Text style={styles.timeLabel}>End</Text>
                        <TextInput
                          style={styles.timeInput}
                          value={dayHours.end}
                          onChangeText={(value) => updateDayHours(day, 'end', value)}
                          placeholder="17:00"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* Bottom padding */}
          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      {/* Template Selector Modal */}
      <Modal
        visible={showTemplateSelector}
        animationType="slide"
        onRequestClose={() => setShowTemplateSelector(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choose Template</Text>
            <TouchableOpacity onPress={() => setShowTemplateSelector(false)}>
              <Ionicons name="close" size={28} color="#1E293B" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={templates}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.templateItem}
                onPress={() => {
                  setSelectedTemplate(item);
                  setSelectedTemplateId(item.id);
                  setCustomFields(item.custom_fields);
                  setSlotDuration(item.recommended_duration_minutes.toString());
                  setBufferTime(item.recommended_buffer_minutes.toString());
                  setShowTemplateSelector(false);
                }}
              >
                <View style={styles.templateIcon}>
                  <Ionicons name={getIoniconName(item.icon) as any} size={24} color="#2563EB" />
                </View>
                <View style={styles.templateDetails}>
                  <Text style={styles.templateName}>{item.name}</Text>
                  <Text style={styles.templateDescription}>{item.description}</Text>
                  <Text style={styles.templateMeta}>
                    {item.custom_fields.length} fields • {item.recommended_duration_minutes} min
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
  },
  saveButton: {
    backgroundColor: '#ff4500',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1E293B',
    backgroundColor: '#FFFFFF',
  },
  slugContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  slugPrefix: {
    paddingLeft: 16,
    fontSize: 16,
    color: '#64748B',
  },
  slugInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 16,
    color: '#1E293B',
  },
  urlPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    padding: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
  },
  urlText: {
    fontSize: 14,
    color: '#64748B',
    flex: 1,
  },
  helperText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  switchField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  dayRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    textTransform: 'capitalize',
  },
  timeInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
  },
  timeField: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },
  timeInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#1E293B',
    backgroundColor: '#F8FAFC',
  },
  timeSeparator: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 20,
  },
  templateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  templateButtonText: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '500',
  },
  selectedTemplateInfo: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
  },
  templateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  templateIcon: {
    width: 48,
    height: 48,
    backgroundColor: '#DBEAFE',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  templateDetails: {
    flex: 1,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  templateDescription: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 4,
  },
  templateMeta: {
    fontSize: 12,
    color: '#94A3B8',
  },
  calendarConnected: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  calendarDisconnected: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  calendarInfo: {
    marginLeft: 12,
    flex: 1,
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#166534',
    marginBottom: 2,
  },
  calendarSubtitle: {
    fontSize: 14,
    color: '#15803d',
  },
  disconnectCalendarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ef4444',
    gap: 6,
  },
  disconnectCalendarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
  calendarPlaceholder: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 16,
  },
  calendarPlaceholderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 12,
    marginBottom: 8,
  },
  calendarPlaceholderText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  connectCalendarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    gap: 8,
  },
  connectCalendarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  customFieldsSection: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  customFieldsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  customFieldsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  addFieldButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addFieldText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
  customFieldItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  customFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  customFieldInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#1E293B',
    backgroundColor: '#FFFFFF',
  },
  deleteFieldButton: {
    padding: 8,
  },
  customFieldOptions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fieldOptionText: {
    fontSize: 14,
    color: '#64748B',
  },
  fieldTypeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fieldTypeLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  fieldTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
  },
  fieldTypeValue: {
    fontSize: 14,
    color: '#1E293B',
  },
});

export default BookingPageSetupScreen;
