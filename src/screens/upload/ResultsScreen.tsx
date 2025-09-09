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
import { FlynnInput } from '../../components/ui/FlynnInput';
import { FlynnButton } from '../../components/ui/FlynnButton';
import { useNavigation, useRoute } from '@react-navigation/native';

export const ResultsScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { imageUri, extractedData } = route.params;

  const [formData, setFormData] = useState({
    clientName: extractedData.clientName || '',
    serviceType: extractedData.serviceType || '',
    date: extractedData.date || '',
    time: extractedData.time || '',
    location: extractedData.location || '',
    phone: extractedData.phone || '',
    estimatedDuration: extractedData.estimatedDuration || '',
    notes: extractedData.notes || '',
  });

  const [isEditing, setIsEditing] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (!isEditing) setIsEditing(true);
  };

  const handleCreateJob = () => {
    Alert.alert(
      'Job Created! 🎉',
      'The job has been added to your calendar and a confirmation has been sent to the client.',
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

          <FlynnInput
            label="Client Name"
            value={formData.clientName}
            onChangeText={(text) => handleInputChange('clientName', text)}
            placeholder="Enter client name"
            leftIcon="person-outline"
          />

          <FlynnInput
            label="Service Type"
            value={formData.serviceType}
            onChangeText={(text) => handleInputChange('serviceType', text)}
            placeholder="e.g., Plumbing, Electrical, Cleaning"
            leftIcon="briefcase-outline"
          />

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <FlynnInput
                label="Date"
                value={formData.date}
                onChangeText={(text) => handleInputChange('date', text)}
                placeholder="Select date"
                leftIcon="calendar-outline"
              />
            </View>
            <View style={styles.halfInput}>
              <FlynnInput
                label="Time"
                value={formData.time}
                onChangeText={(text) => handleInputChange('time', text)}
                placeholder="Select time"
                leftIcon="time-outline"
              />
            </View>
          </View>

          <FlynnInput
            label="Location"
            value={formData.location}
            onChangeText={(text) => handleInputChange('location', text)}
            placeholder="Enter job location"
            leftIcon="location-outline"
          />

          <FlynnInput
            label="Phone Number"
            value={formData.phone}
            onChangeText={(text) => handleInputChange('phone', text)}
            placeholder="+1 (555) 123-4567"
            leftIcon="call-outline"
            keyboardType="phone-pad"
          />

          <FlynnInput
            label="Estimated Duration"
            value={formData.estimatedDuration}
            onChangeText={(text) => handleInputChange('estimatedDuration', text)}
            placeholder="e.g., 2 hours"
            leftIcon="timer-outline"
          />

          <FlynnInput
            label="Notes"
            value={formData.notes}
            onChangeText={(text) => handleInputChange('notes', text)}
            placeholder="Additional notes about the job"
            leftIcon="document-text-outline"
            multiline
            numberOfLines={4}
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
            We'll create the job and send a confirmation to {formData.clientName || 'the client'}
          </Text>

          <FlynnButton
            title="Create Job & Send Confirmation"
            onPress={handleCreateJob}
            variant="primary"
            size="large"
            icon="checkmark-circle"
            style={styles.primaryButton}
          />

          <FlynnButton
            title="Save as Draft"
            onPress={() => Alert.alert('Saved', 'Job saved as draft')}
            variant="secondary"
            size="large"
            icon="save-outline"
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
});