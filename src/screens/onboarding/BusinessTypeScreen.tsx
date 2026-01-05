import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { FlynnIcon } from '../../components/ui/FlynnIcon';
import { businessTypes, useOnboarding } from '../../context/OnboardingContext';
import { colors, typography, spacing, borderRadius } from '../../theme';

const categoryDescriptions: { [key: string]: string } = {
  home_property: 'Plumbing, Electrical, Carpentry, Landscaping, Cleaning, HVAC, Roofing',
  personal_beauty: 'Hair Styling, Makeup, Massage, Personal Training, Wellness',
  automotive: 'Mechanics, Auto Detailing, Towing, Mobile Repair',
  business_professional: 'Consulting, Marketing, Accounting, Legal, IT Services',
  other: 'Any other service type',
};

interface BusinessTypeScreenProps {
  onNext: () => void;
  onBack: () => void;
}

export const BusinessTypeScreen: React.FC<BusinessTypeScreenProps> = ({ onNext, onBack }) => {
  const { onboardingData, updateOnboardingData } = useOnboarding();
  const [selectedType, setSelectedType] = useState(onboardingData.businessType);
  const [customType, setCustomType] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(selectedType === 'other');

  const handleTypeSelect = (typeId: string) => {
    setSelectedType(typeId);
    if (typeId === 'other') {
      setShowCustomInput(true);
    } else {
      setShowCustomInput(false);
      setCustomType('');
    }
  };

  const handleNext = () => {
    const businessType = selectedType === 'other' ? customType.trim() : selectedType;
    if (businessType) {
      updateOnboardingData({ businessType });
      onNext();
    }
  };

  const canProceed = selectedType && (selectedType !== 'other' || customType.trim().length > 0);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <FlynnIcon name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, styles.progressActive]} />
            <View style={styles.progressBar} />
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
            <Text style={styles.title}>What type of services do you provide?</Text>
            <Text style={styles.subtitle}>
              Choose the category that best fits your business
            </Text>
          </View>

          <View style={styles.optionsContainer}>
            {businessTypes.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.option,
                  selectedType === type.id && styles.selectedOption,
                ]}
                onPress={() => handleTypeSelect(type.id)}
              >
                <View style={styles.optionContent}>
                  <View style={styles.textContainer}>
                    <Text
                      style={[
                        styles.optionText,
                        selectedType === type.id && styles.selectedOptionText,
                      ]}
                    >
                      {type.label}
                    </Text>
                    {categoryDescriptions[type.id] && (
                      <Text style={styles.optionDescription}>
                        {categoryDescriptions[type.id]}
                      </Text>
                    )}
                  </View>
                </View>
                {selectedType === type.id && (
                  <FlynnIcon name="checkmark-circle" size={24} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {showCustomInput && (
            <View style={styles.customInputContainer}>
              <Text style={styles.customInputLabel}>Please specify your service type:</Text>
              <TextInput
                style={styles.customInput}
                placeholder="e.g., Photography, Event Planning, Pet Services"
                value={customType}
                onChangeText={setCustomType}
                autoCapitalize="words"
                autoFocus
              />
            </View>
          )}
          
          {/* Add extra padding at bottom when keyboard is shown */}
          {showCustomInput && <View style={{ height: 100 }} />}
        </ScrollView>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.nextButton, !canProceed && styles.disabledButton]}
            onPress={handleNext}
            disabled={!canProceed}
          >
            <Text style={[styles.nextButtonText, !canProceed && styles.disabledButtonText]}>
              Continue
            </Text>
            <FlynnIcon 
              name="arrow-forward" 
              size={20} 
              color={canProceed ? "white" : "#9ca3af"} 
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  backButton: {
    marginRight: spacing.md,
  },
  progressContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: colors.gray200,
    borderRadius: borderRadius.xs,
  },
  progressActive: {
    backgroundColor: colors.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  titleContainer: {
    marginBottom: spacing.xxl,
  },
  title: {
    ...typography.h1,
    color: colors.gray900,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodyMedium,
    color: colors.gray600,
    lineHeight: 22,
  },
  optionsContainer: {
    gap: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedOption: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  emoji: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  optionText: {
    ...typography.bodyLarge,
    color: colors.gray900,
    fontWeight: '600',
    marginBottom: spacing.xxs,
  },
  selectedOptionText: {
    color: colors.primary,
  },
  optionDescription: {
    ...typography.bodySmall,
    color: colors.gray600,
    lineHeight: 18,
  },
  customInputContainer: {
    marginTop: spacing.lg,
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  customInputLabel: {
    ...typography.bodyLarge,
    fontWeight: '500',
    color: colors.gray900,
    marginBottom: spacing.sm,
  },
  customInput: {
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    fontSize: 16,
    color: colors.gray900,
  },
  buttonContainer: {
    padding: spacing.lg,
  },
  nextButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  disabledButton: {
    backgroundColor: colors.gray200,
  },
  nextButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    marginRight: spacing.xs,
  },
  disabledButtonText: {
    color: colors.gray400,
  },
});