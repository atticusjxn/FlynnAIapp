import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { FlynnCard } from '../../components/ui/FlynnCard';
import { FlynnButton } from '../../components/ui/FlynnButton';
import { FlynnIcon } from '../../components/ui/FlynnIcon';
import { spacing, typography, borderRadius, colors, shadows } from '../../theme';
import { supabase } from '../../services/supabase';
import type { BusinessProfile } from '../../types/businessProfile';

interface IVRTemplate {
  id: string;
  name: string;
  industry_type: string;
  tone: string;
  script_template: string;
  description: string;
}

interface IVRScriptEditorProps {
  businessProfile: BusinessProfile;
  onSave: (script: string, templateId?: string) => Promise<void>;
  onCancel: () => void;
}

export const IVRScriptEditor: React.FC<IVRScriptEditorProps> = ({
  businessProfile,
  onSave,
  onCancel,
}) => {
  const [templates, setTemplates] = useState<IVRTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [customScript, setCustomScript] = useState(businessProfile.ivr_custom_script || '');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('ivr_templates')
        .select('*')
        .eq('is_active', true)
        .order('industry_type', { ascending: true });

      if (error) throw error;
      setTemplates(data || []);

      // If there's a saved template, select it
      if (businessProfile.ivr_greeting_template) {
        setSelectedTemplateId(businessProfile.ivr_greeting_template);
        const template = data?.find(t => t.id === businessProfile.ivr_greeting_template);
        if (template && !customScript) {
          setCustomScript(template.script_template);
        }
      }
    } catch (error) {
      console.error('[IVRScriptEditor] Failed to load templates:', error);
      Alert.alert('Error', 'Failed to load IVR templates');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTemplateSelect = (template: IVRTemplate) => {
    setSelectedTemplateId(template.id);
    setCustomScript(template.script_template);
  };

  const handleSave = async () => {
    if (!customScript.trim()) {
      Alert.alert('Error', 'Please enter an IVR script');
      return;
    }

    try {
      setIsSaving(true);
      await onSave(customScript.trim(), selectedTemplateId || undefined);
    } catch (error) {
      console.error('[IVRScriptEditor] Failed to save:', error);
      Alert.alert('Error', 'Failed to save IVR script');
    } finally {
      setIsSaving(false);
    }
  };

  const insertPlaceholder = (placeholder: string) => {
    setCustomScript(prev => prev + placeholder);
  };

  const previewScript = () => {
    const businessName = businessProfile.business_name || 'Your Business';
    const hasBooking = businessProfile.booking_link_enabled;
    const hasQuote = businessProfile.quote_link_enabled;

    const bookingOption = hasBooking ? ' Press 1 and we\'ll text you a booking link.' : '';
    const quoteOption = hasQuote ? ` Press ${hasBooking ? '2' : '1'} and we'll text you a quick quote form.` : '';
    const voicemailOption = ` Press ${hasBooking && hasQuote ? '3' : hasBooking || hasQuote ? '2' : '1'} to leave a message.`;

    return customScript
      .replace(/{business_name}/g, businessName)
      .replace(/{booking_option}/g, bookingOption)
      .replace(/{quote_option}/g, quoteOption)
      .replace(/{voicemail_option}/g, voicemailOption);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.backButton}>
          <FlynnIcon name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>IVR Script Editor</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <FlynnCard>
          <Text style={styles.sectionTitle}>Template Library</Text>
          <Text style={styles.sectionHint}>
            Choose a pre-built template to get started, then customize it below.
          </Text>

          {isLoading ? (
            <Text style={styles.loadingText}>Loading templates...</Text>
          ) : (
            <View style={styles.templateList}>
              {templates.map(template => {
                const isSelected = selectedTemplateId === template.id;
                return (
                  <TouchableOpacity
                    key={template.id}
                    style={[styles.templateCard, isSelected && styles.templateCardSelected]}
                    onPress={() => handleTemplateSelect(template)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.templateHeader}>
                      <Text style={[styles.templateName, isSelected && styles.templateNameSelected]}>
                        {template.name}
                      </Text>
                      {isSelected && (
                        <FlynnIcon name="checkmark-circle" size={20} color={colors.primary} />
                      )}
                    </View>
                    <View style={styles.templateTags}>
                      <View style={styles.tag}>
                        <Text style={styles.tagText}>{template.industry_type}</Text>
                      </View>
                      <View style={styles.tag}>
                        <Text style={styles.tagText}>{template.tone}</Text>
                      </View>
                    </View>
                    <Text style={styles.templateDescription}>{template.description}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </FlynnCard>

        <FlynnCard>
          <Text style={styles.sectionTitle}>Custom Script</Text>
          <Text style={styles.sectionHint}>
            Edit your IVR greeting. Use placeholders to automatically insert details.
          </Text>

          <View style={styles.placeholderButtons}>
            <TouchableOpacity
              style={styles.placeholderButton}
              onPress={() => insertPlaceholder('{business_name}')}
            >
              <Text style={styles.placeholderButtonText}>+ Business Name</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.placeholderButton}
              onPress={() => insertPlaceholder('{booking_option}')}
            >
              <Text style={styles.placeholderButtonText}>+ Booking Option</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.placeholderButton}
              onPress={() => insertPlaceholder('{quote_option}')}
            >
              <Text style={styles.placeholderButtonText}>+ Quote Option</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.placeholderButton}
              onPress={() => insertPlaceholder('{voicemail_option}')}
            >
              <Text style={styles.placeholderButtonText}>+ Voicemail Option</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.scriptInput}
            value={customScript}
            onChangeText={setCustomScript}
            placeholder="Enter your IVR script here..."
            placeholderTextColor={colors.gray400}
            multiline
            numberOfLines={8}
            textAlignVertical="top"
          />

          <View style={styles.helpBox}>
            <FlynnIcon name="information-circle" size={16} color={colors.primary} />
            <Text style={styles.helpText}>
              Placeholders will be replaced automatically. {'{business_name}'} becomes your business name, and menu options are inserted based on your enabled links.
            </Text>
          </View>
        </FlynnCard>

        <FlynnCard>
          <Text style={styles.sectionTitle}>Preview</Text>
          <Text style={styles.sectionHint}>
            This is what callers will hear when they call your Flynn number.
          </Text>

          <View style={styles.previewBox}>
            <FlynnIcon name="volume-high" size={20} color={colors.primary} style={styles.previewIcon} />
            <Text style={styles.previewText}>{previewScript()}</Text>
          </View>
        </FlynnCard>

        <View style={styles.actions}>
          <FlynnButton
            title="Cancel"
            onPress={onCancel}
            variant="secondary"
            style={styles.actionButton}
          />
          <FlynnButton
            title={isSaving ? 'Saving...' : 'Save Script'}
            onPress={handleSave}
            disabled={isSaving || !customScript.trim()}
            style={styles.actionButton}
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  sectionHint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  loadingText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  templateList: {
    gap: spacing.sm,
  },
  templateCard: {
    borderWidth: 2,
    borderColor: colors.gray300,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    backgroundColor: colors.white,
  },
  templateCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  templateName: {
    ...typography.bodyLarge,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  templateNameSelected: {
    color: colors.primary,
  },
  templateTags: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  tag: {
    backgroundColor: colors.gray100,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxxs,
    borderRadius: borderRadius.sm,
  },
  tagText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.textSecondary,
  },
  templateDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  placeholderButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  placeholderButton: {
    backgroundColor: colors.gray100,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gray300,
  },
  placeholderButtonText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.primary,
  },
  scriptInput: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.gray300,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: 150,
    marginBottom: spacing.md,
  },
  helpBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.primaryLight,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  helpText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    flex: 1,
  },
  previewBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.gray50,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.gray200,
  },
  previewIcon: {
    marginTop: 2,
  },
  previewText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    flex: 1,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
});
