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
import { colors, typography, spacing, borderRadius } from '../../theme';

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
          <FlynnIcon name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={styles.progressBar} />
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
                  <Text
                    style={[
                      styles.optionTitle,
                      isSelected && styles.selectedOptionTitle,
                    ]}
                  >
                    {goal.label}
                  </Text>
                  <Text
                    style={[
                      styles.optionDescription,
                      isSelected && styles.selectedOptionDescription,
                    ]}
                  >
                    {goal.description}
                  </Text>
                </View>
                {isSelected && (
                  <FlynnIcon name="checkmark-circle" size={24} color={colors.primary} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {selectedGoals.length > 0 && (
          <View style={styles.selectedCountContainer}>
            <Text style={styles.selectedCountText}>
              {selectedGoals.length} goal{selectedGoals.length !== 1 ? 's' : ''} selected
            </Text>
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
          <FlynnIcon
            name="arrow-forward"
            size={20}
            color={canProceed ? colors.white : colors.gray400}
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
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
    flex: 1,
    marginRight: spacing.sm,
  },
  optionTitle: {
    ...typography.bodyLarge,
    color: colors.gray900,
    fontWeight: '600',
    marginBottom: spacing.xxs,
  },
  selectedOptionTitle: {
    color: colors.primary,
  },
  optionDescription: {
    ...typography.bodySmall,
    color: colors.gray600,
    lineHeight: 18,
  },
  selectedOptionDescription: {
    color: colors.primaryDark,
  },
  selectedCountContainer: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  selectedCountText: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '600',
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