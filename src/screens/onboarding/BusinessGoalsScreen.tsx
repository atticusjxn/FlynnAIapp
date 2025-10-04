import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { FlynnIcon } from '../../components/ui/FlynnIcon';
import { businessGoals, useOnboarding } from '../../context/OnboardingContext';

interface BusinessGoalsScreenProps {
  onNext: () => void;
  onBack: () => void;
}

export const BusinessGoalsScreen: React.FC<BusinessGoalsScreenProps> = ({ onNext, onBack }) => {
  const { onboardingData, updateOnboardingData } = useOnboarding();
  const [selectedGoals, setSelectedGoals] = useState<string[]>(onboardingData.goals || []);

  const toggleGoal = (goalId: string) => {
    setSelectedGoals(prev => {
      if (prev.includes(goalId)) {
        return prev.filter(id => id !== goalId);
      } else {
        return [...prev, goalId];
      }
    });
  };

  const handleNext = () => {
    updateOnboardingData({ goals: selectedGoals });
    onNext();
  };

  const canProceed = selectedGoals.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <FlynnIcon name="arrow-back" size={24} color="#3B82F6" />
        </TouchableOpacity>
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={styles.progressBar} />
          <View style={styles.progressBar} />
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>What are your main goals?</Text>
          <Text style={styles.subtitle}>
            Select all that apply. We'll customize your experience based on your priorities.
          </Text>
        </View>

        <View style={styles.optionsContainer}>
          {businessGoals.map((goal) => {
            const isSelected = selectedGoals.includes(goal.id);
            return (
              <TouchableOpacity
                key={goal.id}
                style={[
                  styles.option,
                  isSelected && styles.selectedOption,
                ]}
                onPress={() => toggleGoal(goal.id)}
              >
                <View style={styles.optionContent}>
                  <View style={styles.optionHeader}>
                    <Text
                      style={[
                        styles.optionTitle,
                        isSelected && styles.selectedOptionTitle,
                      ]}
                    >
                      {goal.label}
                    </Text>
                    <View style={[styles.checkbox, isSelected && styles.selectedCheckbox]}>
                      {isSelected && (
                        <FlynnIcon name="checkmark" size={16} color="white" />
                      )}
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.optionDescription,
                      isSelected && styles.selectedOptionDescription,
                    ]}
                  >
                    {goal.description}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.selectedCountContainer}>
          <Text style={styles.selectedCountText}>
            {selectedGoals.length} goal{selectedGoals.length !== 1 ? 's' : ''} selected
          </Text>
        </View>
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
        
        {!canProceed && (
          <Text style={styles.helperText}>
            Please select at least one goal to continue
          </Text>
        )}
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
    gap: 16,
  },
  option: {
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
    flex: 1,
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  selectedOptionTitle: {
    color: '#3B82F6',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedCheckbox: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  optionDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  selectedOptionDescription: {
    color: '#1e40af',
  },
  selectedCountContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    alignItems: 'center',
  },
  selectedCountText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
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
  helperText: {
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 12,
  },
});