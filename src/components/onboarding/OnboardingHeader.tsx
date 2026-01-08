import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FlynnIcon } from '../ui/FlynnIcon';
import { colors, spacing } from '../../theme';

interface OnboardingHeaderProps {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  showBack?: boolean;
}

export const OnboardingHeader: React.FC<OnboardingHeaderProps> = ({
  currentStep,
  totalSteps,
  onBack,
  showBack = true,
}) => {
  return (
    <View style={styles.header}>
      {/* Back Button */}
      {showBack ? (
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <FlynnIcon name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
      ) : (
        <View style={styles.backButton} />
      )}

      {/* Progress Indicators */}
      <View style={styles.progressContainer}>
        {Array.from({ length: totalSteps }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.progressBar,
              index < currentStep && styles.progressBarActive,
            ]}
          />
        ))}
      </View>

      {/* Spacer for alignment */}
      <View style={styles.spacer} />
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
  },

  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },

  progressContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },

  progressBar: {
    height: 4,
    flex: 1,
    backgroundColor: colors.gray200,
    borderRadius: 2,
  },

  progressBarActive: {
    backgroundColor: colors.primary,
  },

  spacer: {
    width: 40,
  },
});
