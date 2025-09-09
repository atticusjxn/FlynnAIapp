import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, shadows } from '../../theme';
import { FlynnJobForm, JobFormData } from '../../components/ui/FlynnJobForm';
import { FlynnButton } from '../../components/ui/FlynnButton';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useOnboarding } from '../../context/OnboardingContext';

export const ResultsScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { imageUri, extractedData } = route.params;
  const { onboardingData } = useOnboarding();

  const [jobData, setJobData] = useState<JobFormData>({
    clientName: extractedData.clientName || '',
    phone: extractedData.phone || '',
    date: extractedData.date || '',
    time: extractedData.time || '',
    notes: extractedData.notes || '',
    // Map legacy fields to new structure based on business type
    ...(onboardingData.businessType === 'home_property' && {
      propertyAddress: extractedData.location || '',
      homeServiceType: extractedData.serviceType || '',
      estimatedDuration: extractedData.estimatedDuration || '',
    }),
    ...(onboardingData.businessType === 'personal_beauty' && {
      beautyServiceType: extractedData.serviceType || '',
      appointmentDuration: extractedData.estimatedDuration || '',
    }),
    ...(onboardingData.businessType === 'automotive' && {
      serviceLocation: extractedData.location || '',
    }),
    ...(onboardingData.businessType === 'business_professional' && {
      meetingLocation: extractedData.location || '',
      projectTitle: extractedData.serviceType || '',
      estimatedHours: extractedData.estimatedDuration || '',
    }),
    ...(onboardingData.businessType === 'moving_delivery' && {
      pickupAddress: extractedData.location || '',
    }),
  });

  const [isEditing, setIsEditing] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);

  const handleJobDataChange = (data: JobFormData) => {
    setJobData(data);
    if (!isEditing) setIsEditing(true);
  };

  const handleValidationChange = (isValid: boolean) => {
    setIsFormValid(isValid);
  };

  const handleCreateJob = () => {
    if (!isFormValid) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }

    Alert.alert(
      'Job Created! 🎉',
      `The job has been added to your calendar and a confirmation has been sent to ${jobData.clientName}.`,
      [
        {
          text: 'View Job',
          onPress: () => navigation.navigate('Jobs'),
        },
        {
          text: 'Back to Dashboard',
          onPress: () => navigation.navigate('Dashboard'),
        },
      ]
    );
  };

  const handleEditAgain = () => {
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.gray700} />
        </TouchableOpacity>
        <Text style={styles.title}>Review Details</Text>
        <TouchableOpacity onPress={handleEditAgain}>
          <Ionicons name="refresh" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        extraScrollHeight={20}
        enableOnAndroid={true}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.successBanner}>
          <View style={styles.successIcon}>
            <Ionicons name="sparkles" size={24} color={colors.white} />
          </View>
          <Text style={styles.successText}>
            Great! We extracted the job details
          </Text>
        </View>

        <View style={styles.thumbnailContainer}>
          <Image source={{ uri: imageUri }} style={styles.thumbnail} />
          <TouchableOpacity style={styles.viewFullButton}>
            <Ionicons name="expand-outline" size={16} color={colors.primary} />
            <Text style={styles.viewFullText}>View full</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.sectionTitle}>Job Information</Text>
          <Text style={styles.helperText}>
            Review and edit the extracted details if needed
          </Text>

          <FlynnJobForm
            businessType={onboardingData.businessType || 'other'}
            initialData={jobData}
            onDataChange={handleJobDataChange}
            onValidationChange={handleValidationChange}
          />

          {isEditing && (
            <View style={styles.editingBadge}>
              <Ionicons name="create-outline" size={16} color={colors.warning} />
              <Text style={styles.editingText}>Details have been edited</Text>
            </View>
          )}
        </View>

        <View style={styles.actionContainer}>
          <Text style={styles.confirmTitle}>Looks good?</Text>
          <Text style={styles.confirmSubtitle}>
            We'll create the job and send a confirmation to {jobData.clientName || 'the client'}
          </Text>

          <FlynnButton
            title="Create Job & Send Confirmation"
            onPress={handleCreateJob}
            variant="primary"
            size="large"
            icon={<Ionicons name="checkmark-circle" size={20} color="white" />}
            style={[styles.primaryButton, !isFormValid && styles.disabledButton]}
            disabled={!isFormValid}
          />

          <FlynnButton
            title="Save as Draft"
            onPress={() => Alert.alert('Saved', 'Job saved as draft')}
            variant="secondary"
            size="large"
            icon={<Ionicons name="save-outline" size={20} color={colors.primary} />}
          />
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
  },
  backButton: {
    padding: spacing.xs,
  },
  title: {
    ...typography.h2,
    color: colors.gray800,
  },
  successBanner: {
    backgroundColor: colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  successIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  successText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '600',
  },
  thumbnailContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  thumbnail: {
    width: 100,
    height: 125,
    borderRadius: 8,
    ...shadows.md,
  },
  viewFullButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    backgroundColor: colors.primaryLight,
    borderRadius: 16,
  },
  viewFullText: {
    ...typography.caption,
    color: colors.primary,
    marginLeft: spacing.xxs,
    fontWeight: '600',
  },
  formContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.gray800,
    marginBottom: spacing.xxs,
  },
  helperText: {
    ...typography.bodySmall,
    color: colors.gray500,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    marginHorizontal: -spacing.xs,
  },
  halfInput: {
    flex: 1,
    paddingHorizontal: spacing.xs,
  },
  editingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningLight,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
  editingText: {
    ...typography.caption,
    color: colors.warning,
    marginLeft: spacing.xxs,
    fontWeight: '600',
  },
  actionContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  confirmTitle: {
    ...typography.h3,
    color: colors.gray800,
    textAlign: 'center',
    marginBottom: spacing.xxs,
  },
  confirmSubtitle: {
    ...typography.bodyMedium,
    color: colors.gray600,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  primaryButton: {
    marginBottom: spacing.sm,
  },
  
  disabledButton: {
    opacity: 0.5,
  },
});