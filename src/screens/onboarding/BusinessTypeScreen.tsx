import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { businessTypes, useOnboarding } from '../../context/OnboardingContext';

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
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#3B82F6" />
        </TouchableOpacity>
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={styles.progressBar} />
          <View style={styles.progressBar} />
          <View style={styles.progressBar} />
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>What type of business do you run?</Text>
          <Text style={styles.subtitle}>
            This helps us customize FlynnAI for your specific needs
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
                <Text style={styles.emoji}>{type.emoji}</Text>
                <Text
                  style={[
                    styles.optionText,
                    selectedType === type.id && styles.selectedOptionText,
                  ]}
                >
                  {type.label}
                </Text>
              </View>
              {selectedType === type.id && (
                <Ionicons name="checkmark-circle" size={24} color="#3B82F6" />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {showCustomInput && (
          <View style={styles.customInputContainer}>
            <Text style={styles.customInputLabel}>Please specify your business type:</Text>
            <TextInput
              style={styles.customInput}
              placeholder="e.g., Pool Maintenance, Window Cleaning, etc."
              value={customType}
              onChangeText={setCustomType}
              autoCapitalize="words"
              autoFocus
            />
          </View>
        )}
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
          <Ionicons 
            name="arrow-forward" 
            size={20} 
            color={canProceed ? "white" : "#9ca3af"} 
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
  emoji: {
    fontSize: 24,
    marginRight: 16,
  },
  optionText: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  selectedOptionText: {
    color: '#3B82F6',
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