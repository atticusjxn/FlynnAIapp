import React from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { billingPlans } from '../../data/billingPlans';
import { colors, spacing, typography, shadows } from '../../theme';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
}

export const PaywallModal: React.FC<PaywallModalProps> = ({
  visible,
  onClose,
  title = 'Upgrade Required',
  message = 'This feature requires a paid plan. Upgrade to unlock full AI receptionist capabilities.',
}) => {
  const navigation = useNavigation();

  const handleUpgrade = () => {
    onClose();
    // @ts-ignore - Navigation typing
    navigation.navigate('Settings', { screen: 'Billing' });
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>

            <View style={styles.plansList}>
              {billingPlans.map((plan) => (
                <View key={plan.id} style={[styles.planCard, plan.recommended && styles.recommendedCard]}>
                  {plan.recommended && (
                    <View style={styles.recommendedBadge}>
                      <Text style={styles.recommendedText}>RECOMMENDED</Text>
                    </View>
                  )}
                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={styles.planPrice}>{plan.priceText}</Text>
                  <Text style={styles.planCalls}>{plan.callAllowanceLabel}</Text>

                  <View style={styles.highlightsList}>
                    {plan.highlights.slice(0, 3).map((highlight, idx) => (
                      <Text key={idx} style={styles.highlight}>
                        • {highlight}
                      </Text>
                    ))}
                  </View>
                </View>
              ))}
            </View>

            <Pressable
              style={({ pressed }) => [styles.upgradeButton, pressed && styles.buttonPressed]}
              onPress={handleUpgrade}
            >
              <Text style={styles.upgradeButtonText}>Upgrade Now</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.laterButton, pressed && styles.buttonPressed]}
              onPress={onClose}
            >
              <Text style={styles.laterButtonText}>Maybe Later</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    maxHeight: '85%',
  },
  title: {
    ...typography.h2,
    color: colors.gray800,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    ...typography.bodyMedium,
    color: colors.gray600,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  plansList: {
    marginBottom: spacing.lg,
  },
  planCard: {
    backgroundColor: colors.gray50,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.gray200,
    position: 'relative',
  },
  recommendedCard: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  recommendedBadge: {
    position: 'absolute',
    top: -10,
    right: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: 12,
  },
  recommendedText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '700',
    fontSize: 10,
  },
  planName: {
    ...typography.h3,
    color: colors.gray800,
    marginBottom: spacing.xxs,
  },
  planPrice: {
    ...typography.h4,
    color: colors.primary,
    marginBottom: spacing.xxs,
  },
  planCalls: {
    ...typography.bodySmall,
    color: colors.gray600,
    marginBottom: spacing.sm,
  },
  highlightsList: {
    marginTop: spacing.xs,
  },
  highlight: {
    ...typography.bodySmall,
    color: colors.gray700,
    marginBottom: spacing.xxs,
  },
  upgradeButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
    ...shadows.md,
  },
  upgradeButtonText: {
    ...typography.button,
    color: colors.white,
  },
  laterButton: {
    backgroundColor: colors.gray100,
    borderRadius: 8,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray300,
  },
  laterButtonText: {
    ...typography.button,
    color: colors.gray700,
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
});
