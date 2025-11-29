import React, { useState } from 'react';
import { View, Text, TextInput, Alert, ScrollView, StyleSheet } from 'react-native';
import { FlynnButton } from './ui/FlynnButton';
import { FlynnCard } from './ui/FlynnCard';
import { apiRequest } from '../services/apiClient';
import type {
  ReceptionistConfig,
  ScrapeWebsiteResponse,
  ApplyConfigResponse,
} from '../types/receptionist';

interface Props {
  onConfigGenerated?: (config: ReceptionistConfig) => void;
  onApplied?: () => void;
}

/**
 * WebsiteScraperSetup Component
 *
 * Allows users to input their business website URL and automatically generates:
 * - AI receptionist greeting script
 * - Intake questions
 * - Business profile data
 *
 * Usage:
 * <WebsiteScraperSetup
 *   onConfigGenerated={(config) => console.log(config)}
 *   onApplied={() => navigation.goBack()}
 * />
 */
export const WebsiteScraperSetup: React.FC<Props> = ({
  onConfigGenerated,
  onApplied,
}) => {
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<ReceptionistConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScrapeAndGenerate = async () => {
    if (!websiteUrl.trim()) {
      Alert.alert('Error', 'Please enter your website URL');
      return;
    }

    // Validate URL format
    let url = websiteUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }

    try {
      new URL(url); // Validate URL
    } catch {
      Alert.alert('Error', 'Please enter a valid website URL');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('[WebsiteScraper] Scraping and generating config for:', url);

      const response = await apiRequest<ScrapeWebsiteResponse>('/api/scrape-website', {
        method: 'POST',
        body: { url, applyConfig: false },
      });

      if (!response.success || !response.config) {
        throw new Error(response.error || 'Failed to generate configuration');
      }

      setConfig(response.config);

      if (onConfigGenerated) {
        onConfigGenerated(response.config);
      }

      Alert.alert(
        'Success!',
        'Your AI receptionist configuration has been generated. Review it below and tap "Apply Configuration" to save it.',
      );
    } catch (err: any) {
      console.error('[WebsiteScraper] Error:', err);
      const errorMsg = err.message || 'Failed to scrape website and generate configuration';
      setError(errorMsg);
      Alert.alert('Error', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyConfig = async () => {
    if (!config) {
      return;
    }

    setLoading(true);

    try {
      console.log('[WebsiteScraper] Applying configuration to user settings');

      const response = await apiRequest<ApplyConfigResponse>('/api/receptionist/apply-config', {
        method: 'POST',
        body: {
          greetingScript: config.greetingScript,
          intakeQuestions: config.intakeQuestions,
          businessProfile: config.businessProfile,
        },
      });

      if (!response.success) {
        throw new Error('Failed to apply configuration');
      }

      Alert.alert(
        'Configuration Applied!',
        'Your AI receptionist greeting and questions have been updated.',
      );

      if (onApplied) {
        onApplied();
      }
    } catch (err: any) {
      console.error('[WebsiteScraper] Error applying config:', err);
      Alert.alert('Error', err.message || 'Failed to apply configuration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <FlynnCard style={styles.card}>
        <Text style={styles.title}>Automated Setup</Text>
        <Text style={styles.description}>
          Enter your business website and we'll automatically generate your AI receptionist greeting
          and intake questions based on your business information.
        </Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Business Website</Text>
          <TextInput
            style={styles.input}
            placeholder="example.com or https://example.com"
            value={websiteUrl}
            onChangeText={setWebsiteUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            editable={!loading}
          />
        </View>

        <FlynnButton
          title={loading ? 'Generating...' : 'Generate Configuration'}
          onPress={handleScrapeAndGenerate}
          disabled={loading || !websiteUrl.trim()}
          loading={loading}
        />

        {error && (
          <Text style={styles.errorText}>{error}</Text>
        )}
      </FlynnCard>

      {config && (
        <>
          <FlynnCard style={styles.card}>
            <Text style={styles.sectionTitle}>Generated Greeting</Text>
            <View style={styles.previewBox}>
              <Text style={styles.previewText}>{config.greetingScript}</Text>
            </View>
          </FlynnCard>

          <FlynnCard style={styles.card}>
            <Text style={styles.sectionTitle}>Intake Questions</Text>
            <View style={styles.questionsList}>
              {config.intakeQuestions.map((question, index) => (
                <View key={index} style={styles.questionItem}>
                  <Text style={styles.questionNumber}>{index + 1}.</Text>
                  <Text style={styles.questionText}>{question}</Text>
                </View>
              ))}
            </View>
          </FlynnCard>

          <FlynnCard style={styles.card}>
            <Text style={styles.sectionTitle}>Business Profile</Text>
            <View style={styles.profileSection}>
              <Text style={styles.profileLabel}>Business Name:</Text>
              <Text style={styles.profileValue}>{config.businessProfile.public_name}</Text>

              <Text style={styles.profileLabel}>Headline:</Text>
              <Text style={styles.profileValue}>{config.businessProfile.headline}</Text>

              <Text style={styles.profileLabel}>Description:</Text>
              <Text style={styles.profileValue}>{config.businessProfile.description}</Text>

              {config.businessProfile.services.length > 0 && (
                <>
                  <Text style={styles.profileLabel}>Services:</Text>
                  {config.businessProfile.services.map((service, idx) => (
                    <Text key={idx} style={styles.serviceItem}>• {service}</Text>
                  ))}
                </>
              )}

              <Text style={styles.profileLabel}>Brand Voice:</Text>
              <Text style={styles.profileValue}>
                {config.businessProfile.brand_voice.tone}, {config.businessProfile.brand_voice.personality}
              </Text>
            </View>
          </FlynnCard>

          <FlynnButton
            title="Apply Configuration"
            onPress={handleApplyConfig}
            disabled={loading}
            loading={loading}
            style={styles.applyButton}
          />
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 16,
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
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
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
  },
  previewBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  previewText: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 22,
  },
  questionsList: {
    gap: 12,
  },
  questionItem: {
    flexDirection: 'row',
    gap: 8,
  },
  questionNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2563EB',
    minWidth: 24,
  },
  questionText: {
    fontSize: 15,
    color: '#334155',
    flex: 1,
    lineHeight: 22,
  },
  profileSection: {
    gap: 8,
  },
  profileLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 8,
  },
  profileValue: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 22,
  },
  serviceItem: {
    fontSize: 15,
    color: '#334155',
    marginLeft: 8,
    lineHeight: 22,
  },
  applyButton: {
    marginTop: 8,
  },
});

export default WebsiteScraperSetup;
