import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
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

export const JobFormDemo: React.FC = () => {
  const [selectedBusinessType, setSelectedBusinessType] = useState('home_property');
  const [formData, setFormData] = useState<JobFormData>(mockData as JobFormData);
  const [isValid, setIsValid] = useState(false);

  const handleBusinessTypeChange = (businessType: string) => {
    setSelectedBusinessType(businessType);
    // Reset form data when business type changes
    setFormData(mockData as JobFormData);
  };

  const handleDataChange = (data: JobFormData) => {
    setFormData(data);
  };

  const handleValidationChange = (valid: boolean) => {
    setIsValid(valid);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Dynamic Job Forms Demo</Text>
        <Text style={styles.subtitle}>
          Select a business type to see how the form adapts
        </Text>
      </View>

      {/* Business Type Selector */}
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
            Form Status: {isValid ? 'Valid' : 'Missing Required Fields'}
          </Text>
        </View>
      </View>

      {/* Dynamic Form */}
      <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
        <FlynnJobForm
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