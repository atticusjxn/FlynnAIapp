import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { FlynnIcon } from '../../components/ui/FlynnIcon';
import { FlynnInput } from '../../components/ui/FlynnInput';
import { FlynnButton } from '../../components/ui/FlynnButton';
import { useOnboarding } from '../../context/OnboardingContext';
import { spacing, typography, borderRadius, colors } from '../../theme';
import { WebsiteScraperService } from '../../services/WebsiteScraperService';
import { BusinessProfileService } from '../../services/BusinessProfileService';

interface BusinessProfileSetupScreenProps {
  onNext: () => void;
  onBack: () => void;
}

export const BusinessProfileSetupScreen: React.FC<BusinessProfileSetupScreenProps> = ({
  onNext,
  onBack,
}) => {
  const { onboardingData, updateOnboardingData } = useOnboarding();

  const [websiteUrl, setWebsiteUrl] = useState(onboardingData.websiteUrl || '');
  const [businessName, setBusinessName] = useState(onboardingData.businessName || '');
  const [phone, setPhone] = useState(onboardingData.phone || '');
  const [email, setEmail] = useState(onboardingData.email || '');
  const [scraping, setScraping] = useState(false);
  const [scraped, setScraped] = useState(false);

  const handleScrapeWebsite = async () => {
    if (!websiteUrl.trim()) {
      Alert.alert('Website URL Required', 'Please enter your website URL to auto-fill your business information.');
      return;
    }

    try {
      setScraping(true);
      const result = await WebsiteScraperService.scrapeWebsite(websiteUrl.trim());

      if (!result || !result.data) {
        Alert.alert('Error', 'Unable to extract information from the website. Please fill in the details manually.');
        return;
      }

      // Extract business name
      const configProfile = result.config?.businessProfile;
      if (configProfile?.public_name) {
        setBusinessName(configProfile.public_name);
      }

      // Extract contact info
      if (result.data.contact_info) {
        if (result.data.contact_info.phone) setPhone(result.data.contact_info.phone);
        if (result.data.contact_info.email) setEmail(result.data.contact_info.email);
      }

      setScraped(true);
      Alert.alert(
        'Website Scraped!',
        'Successfully extracted business information. Review and continue to the next step.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('[BusinessProfileSetup] Scraping error:', error);
      Alert.alert('Error', 'Failed to scrape website. Please check the URL and try again, or fill in the details manually.');
    } finally {
      setScraping(false);
    }
  };

  const handleNext = async () => {
    // Validate required fields
    if (!businessName.trim()) {
      Alert.alert('Business Name Required', 'Please enter your business name to continue.');
      return;
    }

    // Save to onboarding data
    updateOnboardingData({
      websiteUrl: websiteUrl.trim(),
      businessName: businessName.trim(),
      phone: phone.trim(),
      email: email.trim(),
    });

    // Create business profile in database
    try {
      await BusinessProfileService.upsertProfile({
        website_url: websiteUrl.trim() || undefined,
        business_name: businessName.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        business_type: onboardingData.businessType || undefined,
      });
    } catch (error) {
      console.error('[BusinessProfileSetup] Failed to save profile:', error);
      // Continue anyway - user can fill this in later
    }

    onNext();
  };

  const handleSkip = () => {
    // Save what we have and move on
    updateOnboardingData({
      websiteUrl: websiteUrl.trim(),
      businessName: businessName.trim(),
      phone: phone.trim(),
      email: email.trim(),
    });
    onNext();
  };

  const canProceed = businessName.trim().length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <FlynnIcon name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, styles.progressActive]} />
            <View style={[styles.progressBar, styles.progressActive]} />
            <View style={styles.progressBar} />
            <View style={styles.progressBar} />
            <View style={styles.progressBar} />
            <View style={styles.progressBar} />
          </View>
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        <View style={styles.titleContainer}>
          <View style={styles.iconContainer}>
            <FlynnIcon name="business" size={32} color={colors.primary} />
          </View>
          <Text style={styles.title}>Set up your business profile</Text>
          <Text style={styles.subtitle}>
            We'll use this information to personalize Flynn's responses and help convert more leads.
          </Text>
        </View>

        {/* Website Scraper */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Quick Setup (Recommended)</Text>
          <Text style={styles.sectionHint}>
            Enter your website URL and we'll automatically extract your business details.
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
            title={scraping ? 'Scraping Website...' : scraped ? 'Re-scrape Website' : 'Auto-Fill from Website'}
            variant="secondary"
            onPress={handleScrapeWebsite}
            disabled={scraping || !websiteUrl.trim()}
            icon={scraping ? undefined : <FlynnIcon name="globe-outline" size={20} color={colors.textPrimary} />}
          />

          {scraping && (
            <View style={styles.scrapingIndicator}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.scrapingText}>Extracting business information...</Text>
            </View>
          )}
        </View>

        {/* Manual Entry */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Business Details</Text>
          <Text style={styles.sectionHint}>
            Review or manually enter your business information below.
          </Text>

          <FlynnInput
            label="Business Name *"
            value={businessName}
            onChangeText={setBusinessName}
            placeholder="Your Business Name"
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
        </View>

        {scraped && (
          <View style={styles.successBanner}>
            <FlynnIcon name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.successText}>
              Information extracted successfully. Review and continue when ready.
            </Text>
          </View>
        )}
        </ScrollView>

        <View style={styles.buttonRow}>
          <FlynnButton
            title="Skip for now"
            onPress={handleSkip}
            variant="secondary"
            disabled={scraping}
            style={styles.skipButton}
          />
          <FlynnButton
            title="Continue"
            onPress={handleNext}
            variant="primary"
            disabled={!canProceed || scraping}
            style={styles.nextButton}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    marginBottom: spacing.md,
  },
  backButton: {
    padding: spacing.xs,
  },
  progressContainer: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  progressBar: {
    width: 56,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e2e8f0',
  },
  progressActive: {
    backgroundColor: colors.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.bodyLarge,
    color: '#475569',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  sectionTitle: {
    ...typography.h3,
    color: '#0f172a',
    marginBottom: spacing.sm,
  },
  sectionHint: {
    ...typography.bodySmall,
    color: '#6b7280',
    marginBottom: spacing.md,
  },
  scrapingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
  },
  scrapingText: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.successLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  successText: {
    ...typography.bodyMedium,
    color: colors.success,
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  skipButton: {
    flex: 1,
  },
  nextButton: {
    flex: 1,
  },
});
