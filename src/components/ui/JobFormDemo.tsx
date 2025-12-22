import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { FlynnJobForm, JobFormData } from './FlynnJobForm';
import { OrganizationService } from '../../services/organizationService';


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

  const [selectedBusinessType, setSelectedBusinessType] = useState<string>('home_property');
  const [isLoadingBusinessType, setIsLoadingBusinessType] = useState(true);

  // Initialize form data with prefilled data if available
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
    return {
      clientName: '',
      phone: '',
      date: '',
      time: '',
      notes: '',
    } as JobFormData;
  };

  const [formData, setFormData] = useState<JobFormData>(getInitialFormData());
  const [isValid, setIsValid] = useState(false);

  // Fetch user's business type on mount
  useEffect(() => {
    const fetchBusinessType = async () => {
      try {
        const { data } = await OrganizationService.fetchOnboardingData();
        if (data.businessType) {
          setSelectedBusinessType(data.businessType);
        }
      } catch (error) {
        console.error('Error fetching business type:', error);
        // Default to home_property if fetch fails
        setSelectedBusinessType('home_property');
      } finally {
        setIsLoadingBusinessType(false);
      }
    };

    fetchBusinessType();
  }, []);

  // Update form data with pre-filled data from route params
  useEffect(() => {
    if (routeParams?.prefilledData) {
      const prefilled = routeParams.prefilledData;
      setFormData(prevData => ({
        ...prevData,
        clientName: prefilled.clientName || '',
        phone: prefilled.phone || '',
        date: prefilled.date || prevData.date || '',
        time: prefilled.time || prevData.time || '',
        notes: prefilled.notes || '',
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

  const handleDataChange = useCallback((data: JobFormData) => {
    // Update state but prevent the circular dependency
    console.log('Form data changed:', data);
  }, []);

  const handleValidationChange = useCallback((valid: boolean) => {
    setIsValid(valid);
  }, []);

  // Don't render until we've loaded the business type
  if (isLoadingBusinessType) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {routeParams?.isEditing ? 'Edit Job Details' : 'Create Job'}
        </Text>
      </View>

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
            {isValid ? 'Ready to Save' : 'Missing Required Fields'}
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

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
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