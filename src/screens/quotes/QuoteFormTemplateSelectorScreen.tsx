/**
 * Quote Form Template Selector Screen
 *
 * Allows users to choose from pre-built templates or start from scratch.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import QuoteFormService from '../../services/QuoteFormService';
import type { QuoteFormTemplate } from '../../types/quoteLinks';
import { INDUSTRY_OPTIONS } from '../../types/quoteLinks';

export default function QuoteFormTemplateSelectorScreen() {
  const navigation = useNavigation();
  const [templates, setTemplates] = useState<QuoteFormTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await QuoteFormService.getTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Error loading templates:', error);
      Alert.alert('Error', 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = async (template: QuoteFormTemplate) => {
    try {
      const orgId = 'temp-org-id'; // TODO: Get from auth context
      const form = await QuoteFormService.createFromTemplate(orgId, template.id);

      Alert.alert(
        'Template Created',
        'Your quote form has been created from the template. You can now customize it.',
        [
          {
            text: 'Customize Now',
            onPress: () => navigation.navigate('QuoteFormEditor', { formId: form.id }),
          },
        ]
      );
    } catch (error) {
      console.error('Error creating from template:', error);
      Alert.alert('Error', 'Failed to create quote form from template');
    }
  };

  const handleStartFromScratch = () => {
    navigation.navigate('QuoteFormEditor', { formId: null });
  };

  const getIndustryIcon = (industry: string): string => {
    const option = INDUSTRY_OPTIONS.find((opt) => opt.value === industry);
    return option?.icon || '📋';
  };

  const renderTemplate = ({ item }: { item: QuoteFormTemplate }) => (
    <TouchableOpacity
      style={styles.templateCard}
      onPress={() => handleSelectTemplate(item)}
    >
      <View style={styles.templateIcon}>
        <Text style={styles.iconText}>{getIndustryIcon(item.industry)}</Text>
      </View>

      <View style={styles.templateInfo}>
        <Text style={styles.templateName}>{item.name}</Text>
        {item.description && (
          <Text style={styles.templateDescription}>{item.description}</Text>
        )}
        <View style={styles.templateMeta}>
          <Text style={styles.metaText}>
            {item.questions.length} questions
          </Text>
          {item.price_guide_template && (
            <Text style={styles.metaText}>
              • Price guide included
            </Text>
          )}
        </View>
      </View>

      <View style={styles.arrow}>
        <Text style={styles.arrowText}>›</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Choose a Template</Text>
        <Text style={styles.headerSubtitle}>
          Start with a pre-built template or create from scratch
        </Text>
      </View>

      <FlatList
        data={templates}
        keyExtractor={(item) => item.id}
        renderItem={renderTemplate}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <TouchableOpacity
            style={styles.scratchCard}
            onPress={handleStartFromScratch}
          >
            <View style={styles.scratchIcon}>
              <Text style={styles.iconText}>✨</Text>
            </View>
            <View style={styles.scratchInfo}>
              <Text style={styles.scratchTitle}>Start from Scratch</Text>
              <Text style={styles.scratchDescription}>
                Create a completely custom quote form
              </Text>
            </View>
            <View style={styles.arrow}>
              <Text style={styles.arrowText}>›</Text>
            </View>
          </TouchableOpacity>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  listContent: {
    padding: 16,
  },
  scratchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#2563EB',
  },
  scratchIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  scratchInfo: {
    flex: 1,
  },
  scratchTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  scratchDescription: {
    fontSize: 14,
    color: '#475569',
  },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  templateIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  iconText: {
    fontSize: 28,
  },
  templateInfo: {
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
    marginBottom: 6,
  },
  templateMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: '#94A3B8',
    marginRight: 4,
  },
  arrow: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowText: {
    fontSize: 24,
    color: '#94A3B8',
    fontWeight: '300',
  },
});
