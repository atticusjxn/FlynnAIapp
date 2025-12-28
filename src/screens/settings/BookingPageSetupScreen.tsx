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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BusinessHours } from '../../types/booking';
import BookingPageService from '../../services/BookingPageService';
import BookingTemplateService, { BookingFormTemplate } from '../../services/BookingTemplateService';
import { supabase } from '../../services/supabase';

const DAYS: (keyof BusinessHours)[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

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

  useEffect(() => {
    loadBookingPage();
  }, []);

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
                  {selectedTemplate.custom_fields.length} custom fields included
                </Text>
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
                  <Ionicons name={item.icon as any} size={24} color="#2563EB" />
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
});

export default BookingPageSetupScreen;
