/**
 * Business Profile Screen
 *
 * Allows users to manage their business context that the AI receptionist
 * uses during calls. Supports both manual entry and website scraping.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Switch,
} from 'react-native';
import { FlynnIcon } from '../../components/ui/FlynnIcon';
import { FlynnButton } from '../../components/ui/FlynnButton';
import { FlynnInput } from '../../components/ui/FlynnInput';
import { spacing, typography, borderRadius, shadows } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { BusinessProfileService } from '../../services/BusinessProfileService';
import { WebsiteScraperService } from '../../services/WebsiteScraperService';
import type { BusinessProfile, BusinessService, DayHours } from '../../types/businessProfile';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export const BusinessProfileScreen: React.FC = () => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const navigation = useNavigation<any>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);

  // Form state
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [serviceArea, setServiceArea] = useState('');
  const [pricingNotes, setPricingNotes] = useState('');
  const [cancellationPolicy, setCancellationPolicy] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [aiInstructions, setAiInstructions] = useState('');
  const [autoUpdateFromWebsite, setAutoUpdateFromWebsite] = useState(false);

  // Load existing profile
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await BusinessProfileService.getProfile();
      setProfile(data);

      if (data) {
        setWebsiteUrl(data.website_url || '');
        setBusinessName(data.business_name || '');
        setBusinessType(data.business_type || '');
        setPhone(data.phone || '');
        setEmail(data.email || '');
        setServiceArea(data.service_area || '');
        setPricingNotes(data.pricing_notes || '');
        setCancellationPolicy(data.cancellation_policy || '');
        setPaymentTerms(data.payment_terms || '');
        setAiInstructions(data.ai_instructions || '');
        setAutoUpdateFromWebsite(data.auto_update_from_website || false);
      }
    } catch (error) {
      console.error('[BusinessProfile] Failed to load profile:', error);
      Alert.alert('Error', 'Failed to load business profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleScrapeWebsite = async () => {
    if (!websiteUrl.trim()) {
      Alert.alert('Website Required', 'Please enter your website URL first.');
      return;
    }

    try {
      setScraping(true);
      const result = await WebsiteScraperService.scrapeWebsite(websiteUrl.trim());

      if (!result.success) {
        Alert.alert('Scraping Failed', result.error || 'Failed to scrape website. Please try again.');
        return;
      }

      // Update form with scraped data
      if (result.data.business_hours) {
        // Business hours would need a more complex UI - skipping for now
      }

      if (result.data.contact_info) {
        if (result.data.contact_info.phone) setPhone(result.data.contact_info.phone);
        if (result.data.contact_info.email) setEmail(result.data.contact_info.email);
      }

      if (result.data.pricing_notes) {
        setPricingNotes(result.data.pricing_notes);
      }

      if (result.data.policies?.cancellation) {
        setCancellationPolicy(result.data.policies.cancellation);
      }

      if (result.data.policies?.payment) {
        setPaymentTerms(result.data.policies.payment);
      }

      Alert.alert(
        'Website Scraped',
        'Successfully extracted business information from your website. Review and save to apply changes.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('[BusinessProfile] Scraping error:', error);
      Alert.alert('Error', 'Failed to scrape website. Please check the URL and try again.');
    } finally {
      setScraping(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const updateData: any = {
        website_url: websiteUrl.trim() || undefined,
        business_name: businessName.trim() || undefined,
        business_type: businessType.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        service_area: serviceArea.trim() || undefined,
        pricing_notes: pricingNotes.trim() || undefined,
        cancellation_policy: cancellationPolicy.trim() || undefined,
        payment_terms: paymentTerms.trim() || undefined,
        ai_instructions: aiInstructions.trim() || undefined,
        auto_update_from_website: autoUpdateFromWebsite,
      };

      const updated = await BusinessProfileService.upsertProfile(updateData);
      setProfile(updated);

      Alert.alert('Success', 'Business profile saved successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('[BusinessProfile] Save error:', error);
      Alert.alert('Error', 'Failed to save business profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading business profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <FlynnIcon name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Business Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <View style={styles.infoBannerIcon}>
            <FlynnIcon name="information-circle" size={20} color={colors.primary} />
          </View>
          <Text style={styles.infoText}>
            This information helps Flynn provide accurate, personalized responses during calls.
          </Text>
        </View>

        {/* Website Scraping */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Website Auto-Fill</Text>
          <Text style={styles.sectionDescription}>
            Enter your website URL and we'll automatically extract business information.
          </Text>

          <FlynnInput
            label="Website URL"
            value={websiteUrl}
            onChangeText={setWebsiteUrl}
            placeholder="https://yourbusiness.com"
            keyboardType="url"
            autoCapitalize="none"
          />

          <FlynnButton
            title={scraping ? 'Scraping Website...' : 'Scrape Website'}
            variant="secondary"
            onPress={handleScrapeWebsite}
            disabled={scraping || !websiteUrl.trim()}
            icon={scraping ? undefined : <FlynnIcon name="globe-outline" size={20} color={colors.textPrimary} />}
          />

          <View style={styles.autoUpdateRow}>
            <Text style={styles.autoUpdateLabel}>Auto-update from website weekly</Text>
            <Switch
              value={autoUpdateFromWebsite}
              onValueChange={setAutoUpdateFromWebsite}
            />
          </View>
        </View>

        {/* Basic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>

          <FlynnInput
            label="Business Name"
            value={businessName}
            onChangeText={setBusinessName}
            placeholder="Your Business Name"
            autoCapitalize="words"
          />

          <FlynnInput
            label="Business Type"
            value={businessType}
            onChangeText={setBusinessType}
            placeholder="e.g., Plumbing, HVAC, Beauty Salon"
            autoCapitalize="words"
          />

          <FlynnInput
            label="Phone Number"
            value={phone}
            onChangeText={setPhone}
            placeholder="+1 (555) 123-4567"
            keyboardType="phone-pad"
          />

          <FlynnInput
            label="Email Address"
            value={email}
            onChangeText={setEmail}
            placeholder="contact@yourbusiness.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <FlynnInput
            label="Service Area"
            value={serviceArea}
            onChangeText={setServiceArea}
            placeholder="e.g., Greater Sydney area"
            autoCapitalize="words"
          />
        </View>

        {/* Pricing & Policies */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pricing & Policies</Text>

          <View style={styles.textAreaContainer}>
            <Text style={styles.textAreaLabel}>Pricing Notes</Text>
            <TextInput
              style={styles.textArea}
              value={pricingNotes}
              onChangeText={setPricingNotes}
              placeholder="e.g., Starting at $95/hour, Free quotes"
              multiline
              numberOfLines={3}
              placeholderTextColor={colors.gray400}
            />
          </View>

          <View style={styles.textAreaContainer}>
            <Text style={styles.textAreaLabel}>Cancellation Policy</Text>
            <TextInput
              style={styles.textArea}
              value={cancellationPolicy}
              onChangeText={setCancellationPolicy}
              placeholder="e.g., 24 hours notice required for cancellations"
              multiline
              numberOfLines={3}
              placeholderTextColor={colors.gray400}
            />
          </View>

          <View style={styles.textAreaContainer}>
            <Text style={styles.textAreaLabel}>Payment Terms</Text>
            <TextInput
              style={styles.textArea}
              value={paymentTerms}
              onChangeText={setPaymentTerms}
              placeholder="e.g., Payment due upon completion, we accept cash and card"
              multiline
              numberOfLines={3}
              placeholderTextColor={colors.gray400}
            />
          </View>
        </View>

        {/* AI Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Custom AI Instructions</Text>
          <Text style={styles.sectionDescription}>
            Provide specific instructions for how Flynn should handle calls for your business.
          </Text>

          <View style={styles.textAreaContainer}>
            <TextInput
              style={[styles.textArea, styles.aiInstructionsArea]}
              value={aiInstructions}
              onChangeText={setAiInstructions}
              placeholder="e.g., Always mention we offer free quotes. Ask about property type for HVAC inquiries."
              multiline
              numberOfLines={5}
              placeholderTextColor={colors.gray400}
            />
          </View>
        </View>

        {/* Save Button */}
        <View style={styles.saveButtonContainer}>
          <FlynnButton
            title={saving ? 'Saving...' : 'Save Business Profile'}
            variant="primary"
            onPress={handleSave}
            disabled={saving}
            icon={<FlynnIcon name="checkmark-circle-outline" size={20} color={colors.white} />}
          />
        </View>

        <View style={styles.footerSpacer} />
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
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
    marginLeft: -spacing.xs,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primary + '15',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  infoBannerIcon: {
    marginRight: spacing.sm,
  },
  infoText: {
    flex: 1,
    ...typography.bodySmall,
    color: colors.primary,
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  autoUpdateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  autoUpdateLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    flex: 1,
  },
  textAreaContainer: {
    marginBottom: spacing.md,
  },
  textAreaLabel: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  textArea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    ...typography.bodyMedium,
    color: colors.textPrimary,
    backgroundColor: colors.card,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  aiInstructionsArea: {
    minHeight: 120,
  },
  saveButtonContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  footerSpacer: {
    height: spacing.xxl,
  },
});
