/**
 * Quote Forms List Screen
 *
 * Shows all quote forms for the organization with quick actions.
 * Entry point for creating/editing/managing quote forms.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Share,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import QuoteFormService from '../../services/QuoteFormService';
import type { BusinessQuoteForm } from '../../types/quoteLinks';

export default function QuoteFormsListScreen() {
  const navigation = useNavigation();
  const [forms, setForms] = useState<BusinessQuoteForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadForms();
  }, []);

  const loadForms = async () => {
    try {
      // Get org_id from auth context
      const orgId = 'temp-org-id'; // TODO: Get from auth context
      const data = await QuoteFormService.getQuoteForms(orgId);
      setForms(data);
    } catch (error) {
      console.error('Error loading quote forms:', error);
      Alert.alert('Error', 'Failed to load quote forms');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadForms();
  };

  const handleCreateNew = () => {
    navigation.navigate('QuoteFormTemplateSelector');
  };

  const handleEditForm = (form: BusinessQuoteForm) => {
    navigation.navigate('QuoteFormEditor', { formId: form.id });
  };

  const handleTogglePublish = async (form: BusinessQuoteForm) => {
    try {
      if (form.is_published) {
        await QuoteFormService.unpublishQuoteForm(form.id);
        Alert.alert('Success', 'Quote form unpublished');
      } else {
        await QuoteFormService.publishQuoteForm(form.id);
        Alert.alert('Success', 'Quote form published and live!');
      }
      loadForms();
    } catch (error) {
      console.error('Error toggling publish:', error);
      Alert.alert('Error', 'Failed to update quote form');
    }
  };

  const handleShareLink = async (form: BusinessQuoteForm) => {
    const url = QuoteFormService.getQuoteFormUrl(form.slug);
    const message = QuoteFormService.getQuoteFormSMSMessage(form.title, form.slug);

    try {
      await Share.share({
        message,
        title: 'Share Quote Form',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleDuplicate = async (form: BusinessQuoteForm) => {
    try {
      await QuoteFormService.duplicateQuoteForm(form.id);
      Alert.alert('Success', 'Quote form duplicated');
      loadForms();
    } catch (error) {
      console.error('Error duplicating:', error);
      Alert.alert('Error', 'Failed to duplicate quote form');
    }
  };

  const handleDelete = (form: BusinessQuoteForm) => {
    Alert.alert(
      'Delete Quote Form',
      `Are you sure you want to delete "${form.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await QuoteFormService.deleteQuoteForm(form.id);
              Alert.alert('Success', 'Quote form deleted');
              loadForms();
            } catch (error) {
              console.error('Error deleting:', error);
              Alert.alert('Error', 'Failed to delete quote form');
            }
          },
        },
      ]
    );
  };

  const renderForm = ({ item }: { item: BusinessQuoteForm }) => (
    <View style={styles.formCard}>
      <View style={styles.formHeader}>
        <View style={styles.formInfo}>
          <Text style={styles.formTitle}>{item.title}</Text>
          {item.description && (
            <Text style={styles.formDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}
          <View style={styles.formMeta}>
            <Text style={styles.metaText}>
              {item.questions.length} questions
            </Text>
            {item.is_published && (
              <View style={styles.publishedBadge}>
                <Text style={styles.publishedText}>● Live</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.formActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleEditForm(item)}
        >
          <Text style={styles.actionButtonText}>✏️ Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButton,
            item.is_published ? styles.unpublishButton : styles.publishButton,
          ]}
          onPress={() => handleTogglePublish(item)}
        >
          <Text
            style={[
              styles.actionButtonText,
              item.is_published ? styles.unpublishText : styles.publishText,
            ]}
          >
            {item.is_published ? '🔴 Unpublish' : '✅ Publish'}
          </Text>
        </TouchableOpacity>

        {item.is_published && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleShareLink(item)}
          >
            <Text style={styles.actionButtonText}>📤 Share</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => {
            Alert.alert('More Actions', null, [
              {
                text: 'Duplicate',
                onPress: () => handleDuplicate(item),
              },
              {
                text: 'View Analytics',
                onPress: () =>
                  navigation.navigate('QuoteFormAnalytics', { formId: item.id }),
              },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => handleDelete(item),
              },
              { text: 'Cancel', style: 'cancel' },
            ]);
          }}
        >
          <Text style={styles.moreButtonText}>⋯</Text>
        </TouchableOpacity>
      </View>
    </View>
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
        <Text style={styles.headerTitle}>Quote Forms</Text>
        <Text style={styles.headerSubtitle}>
          Create forms to collect quote requests from customers
        </Text>
      </View>

      {forms.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📝</Text>
          <Text style={styles.emptyTitle}>No Quote Forms Yet</Text>
          <Text style={styles.emptyDescription}>
            Create your first quote form to start collecting customer requests
          </Text>
          <TouchableOpacity style={styles.createButton} onPress={handleCreateNew}>
            <Text style={styles.createButtonText}>+ Create Quote Form</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={forms}
            keyExtractor={(item) => item.id}
            renderItem={renderForm}
            contentContainerStyle={styles.listContent}
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />

          <TouchableOpacity
            style={styles.floatingButton}
            onPress={handleCreateNew}
          >
            <Text style={styles.floatingButtonText}>+ New Form</Text>
          </TouchableOpacity>
        </>
      )}
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
  formCard: {
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
  formHeader: {
    marginBottom: 12,
  },
  formInfo: {
    flex: 1,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  formDescription: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
  },
  formMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: '#94A3B8',
    marginRight: 12,
  },
  publishedBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  publishedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  formActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  publishButton: {
    backgroundColor: '#DBEAFE',
    borderColor: '#2563EB',
  },
  publishText: {
    color: '#2563EB',
  },
  unpublishButton: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
  },
  unpublishText: {
    color: '#EF4444',
  },
  moreButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  moreButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#475569',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  floatingButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
