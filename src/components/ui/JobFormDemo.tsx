import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';
import { FlynnJobForm, JobFormData } from './FlynnJobForm';

const businessTypes = [
  { id: 'home_property', label: '🏠 Home & Property Services', emoji: '🏠' },
  { id: 'personal_beauty', label: '💄 Beauty & Personal Services', emoji: '💄' },
  { id: 'automotive', label: '🚗 Automotive Services', emoji: '🚗' },
  { id: 'business_professional', label: '💼 Professional Services', emoji: '💼' },
  { id: 'moving_delivery', label: '🚚 Moving & Delivery', emoji: '🚚' },
];

const mockData: Partial<JobFormData> = {
  clientName: 'John Smith',
  phone: '+1 (555) 123-4567',
  date: 'March 15, 2024',
  time: '2:00 PM',
  notes: 'Client prefers afternoon appointments',
};

interface RouteParams {
  prefilledData?: {
    date?: string;
    time?: string;
    clientName?: string;
    phone?: string;
    notes?: string;
    serviceType?: string;
    location?: string;
    description?: string;
    estimatedDuration?: string;
    businessType?: string;
    jobId?: string;
  };
  isEditing?: boolean;
}

export const JobFormDemo: React.FC = () => {
  const route = useRoute();
  const routeParams = route.params as RouteParams;
  
  // Set initial business type based on prefilled data or default
  const initialBusinessType = routeParams?.prefilledData?.businessType || 'home_property';
  const [selectedBusinessType, setSelectedBusinessType] = useState(initialBusinessType);
  
  // Initialize form data with prefilled data if available, otherwise use mock data
  const getInitialFormData = (): JobFormData => {
    if (routeParams?.prefilledData) {
      const prefilled = routeParams.prefilledData;
      return {
        clientName: prefilled.clientName || '',
        phone: prefilled.phone || '',
        date: prefilled.date || '',
        time: prefilled.time || '',
        notes: prefilled.notes || '',
      } as JobFormData;
    }
    return mockData as JobFormData;
  };
  
  const [formData, setFormData] = useState<JobFormData>(getInitialFormData());
  const [isValid, setIsValid] = useState(false);

  // Update form data with pre-filled data from route params
  useEffect(() => {
    if (routeParams?.prefilledData) {
      const prefilled = routeParams.prefilledData;
      // If editing, use prefilled data; if creating new, use mock data for missing fields
      setFormData(prevData => ({
        ...prevData,
        clientName: prefilled.clientName || (routeParams.isEditing ? '' : ''),
        phone: prefilled.phone || (routeParams.isEditing ? '' : ''),
        date: prefilled.date || prevData.date || '',
        time: prefilled.time || prevData.time || '',
        notes: prefilled.notes || (routeParams.isEditing ? '' : ''),
        // Add service location if provided
        ...(prefilled.location && {
          propertyAddress: prefilled.location,
        }),
        // Add additional fields for editing
        ...(routeParams.isEditing && {
          // Only include these fields when editing
          homeServiceType: prefilled.serviceType || '',
          issueDescription: prefilled.description || '',
          estimatedDuration: prefilled.estimatedDuration || '',
        }),
      }));
    }
  }, [routeParams]);

  const handleBusinessTypeChange = (businessType: string) => {
    setSelectedBusinessType(businessType);
    // Reset form data when business type changes, but preserve pre-filled data
    if (routeParams?.prefilledData) {
      const prefilled = routeParams.prefilledData;
      setFormData({
        clientName: prefilled.clientName || mockData.clientName || '',
        phone: prefilled.phone || mockData.phone || '',
        date: prefilled.date || '',
        time: prefilled.time || '',
        notes: prefilled.notes || mockData.notes || '',
      } as JobFormData);
    } else {
      setFormData(mockData as JobFormData);
    }
  };

  const handleDataChange = useCallback((data: JobFormData) => {
    // Update state but prevent the circular dependency
    console.log('Form data changed:', data);
  }, []);

  const handleValidationChange = useCallback((valid: boolean) => {
    setIsValid(valid);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {routeParams?.isEditing ? 'Edit Job Details' : 'Dynamic Job Forms Demo'}
        </Text>
        <Text style={styles.subtitle}>
          {routeParams?.isEditing 
            ? 'Update the job information below' 
            : 'Select a business type to see how the form adapts'
          }
        </Text>
      </View>

      {/* Business Type Selector - Hidden when editing */}
      {!routeParams?.isEditing && (
        <View style={styles.selectorContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.selectorContent}
          >
            {businessTypes.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.businessTypeCard,
                  selectedBusinessType === type.id && styles.selectedCard
                ]}
                onPress={() => handleBusinessTypeChange(type.id)}
              >
                <Text style={styles.businessEmoji}>{type.emoji}</Text>
                <Text style={[
                  styles.businessLabel,
                  selectedBusinessType === type.id && styles.selectedLabel
                ]}>
                  {type.label.split(' ').slice(1).join(' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Form Status Indicator */}
      <View style={styles.statusContainer}>
        <View style={[
          styles.statusIndicator,
          isValid ? styles.validIndicator : styles.invalidIndicator
        ]}>
          <Text style={[
            styles.statusText,
            isValid ? styles.validText : styles.invalidText
          ]}>
            {routeParams?.isEditing 
              ? `Update Status: ${isValid ? 'Ready to Save' : 'Missing Required Fields'}`
              : `Form Status: ${isValid ? 'Valid' : 'Missing Required Fields'}`
            }
          </Text>
        </View>
      </View>

      {/* Dynamic Form */}
      <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
        <FlynnJobForm
          key={`${formData.date}-${formData.time}-${selectedBusinessType}`}
          businessType={selectedBusinessType}
          initialData={formData}
          onDataChange={handleDataChange}
          onValidationChange={handleValidationChange}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  
  subtitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  
  selectorContainer: {
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  
  selectorContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  
  businessTypeCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.gray100,
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 100,
  },
  
  selectedCard: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  
  businessEmoji: {
    fontSize: 24,
    marginBottom: spacing.xxs,
  },
  
  businessLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '600',
  },
  
  selectedLabel: {
    color: colors.primary,
  },
  
  statusContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  
  statusIndicator: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  
  validIndicator: {
    backgroundColor: colors.successLight,
  },
  
  invalidIndicator: {
    backgroundColor: colors.warningLight,
  },
  
  statusText: {
    ...typography.caption,
    fontWeight: '600',
  },
  
  validText: {
    color: colors.success,
  },
  
  invalidText: {
    color: colors.warning,
  },
  
  formContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
});