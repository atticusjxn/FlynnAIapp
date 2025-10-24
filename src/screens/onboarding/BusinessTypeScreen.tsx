import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  TextInput,
} from 'react-native';
import { FlynnKeyboardAvoidingView, FlynnKeyboardAwareScrollView } from '../../components/ui';
import { FlynnIcon } from '../../components/ui/FlynnIcon';
import { businessTypes, useOnboarding } from '../../context/OnboardingContext';

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
      <FlynnKeyboardAvoidingView
        style={styles.keyboardAvoidingContainer}
        contentContainerStyle={styles.keyboardContent}
        dismissOnTapOutside
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <FlynnIcon name="arrow-back" size={24} color="#3B82F6" />
          </TouchableOpacity>
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, styles.progressActive]} />
            <View style={styles.progressBar} />
            <View style={styles.progressBar} />
            <View style={styles.progressBar} />
          </View>
        </View>

        <FlynnKeyboardAwareScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.titleContainer}>
            <Text style={styles.title}>What type of services do you provide?</Text>
            <Text style={styles.subtitle}>
              Choose the category that best fits your business
            </Text>
          </View>

          <View style={styles.optionsContainer}>
            {businessTypes.map((type) => {
              const isSelected = selectedType === type.id;
              const iconColor = isSelected ? '#1d4ed8' : '#1f2937';

              return (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.option,
                  isSelected && styles.selectedOption,
                ]}
                onPress={() => handleTypeSelect(type.id)}
              >
                <View style={styles.optionContent}>
                  <View
                    style={[
                      styles.iconBadge,
                      isSelected && styles.selectedIconBadge,
                    ]}
                  >
                    <FlynnIcon
                      name={type.icon}
                      size={22}
                      color={iconColor}
                      strokeWidth={2}
                    />
                  </View>
                  <View style={styles.textContainer}>
                    <Text
                      style={[
                        styles.optionText,
                        isSelected && styles.selectedOptionText,
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
                {isSelected && (
                  <FlynnIcon name="checkmark-circle" size={24} color="#3B82F6" />
                )}
              </TouchableOpacity>
            );
            })}
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
        </FlynnKeyboardAwareScrollView>

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
      </FlynnKeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
  keyboardContent: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  backButton: {
    marginRight: 16,
  },
  progressContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
  },
  progressActive: {
    backgroundColor: '#3B82F6',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  titleContainer: {
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    lineHeight: 22,
  },
  optionsContainer: {
    gap: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedOption: {
    borderColor: '#3B82F6',
    backgroundColor: '#eff6ff',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  selectedIconBadge: {
    backgroundColor: '#e0f2fe',
  },
  textContainer: {
    flex: 1,
  },
  optionText: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '600',
    marginBottom: 4,
  },
  selectedOptionText: {
    color: '#3B82F6',
  },
  optionDescription: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  customInputContainer: {
    marginTop: 24,
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
  },
  customInputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 12,
  },
  customInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  buttonContainer: {
    padding: 24,
  },
  nextButton: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  disabledButton: {
    backgroundColor: '#f3f4f6',
  },
  nextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  disabledButtonText: {
    color: '#9ca3af',
  },
});
