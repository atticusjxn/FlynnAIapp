import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FlynnIcon } from '../ui/FlynnIcon';
import { useAuth } from '../../context/AuthContext';
import { getTrialStatus, initializeTrialNotifications, TrialStatus } from '../../services/TrialNotificationService';
import { useTheme } from '../../context/ThemeContext';
import { typography, spacing, borderRadius } from '../../theme';
import { useNavigation } from '@react-navigation/native';

export const TrialCountdownBanner: React.FC = () => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrialStatus();
  }, [user?.id]);

  const loadTrialStatus = async () => {
    if (!user?.id) {
      setTrialStatus(null);
      setLoading(false);
      return;
    }

    try {
      const status = await getTrialStatus(user.id);
      setTrialStatus(status);

      // Initialize notifications for trial expiry
      if (status.isInTrial) {
        await initializeTrialNotifications(user.id);
      }
    } catch (error) {
      console.error('[TrialCountdown] Error loading trial status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !trialStatus?.isInTrial) {
    return null;
  }

  const handleUpgrade = () => {
    navigation.navigate('Settings', { screen: 'Billing' });
  };

  const getBannerColor = () => {
    if (trialStatus.daysRemaining <= 1) return colors.error;
    if (trialStatus.daysRemaining <= 5) return colors.warning;
    return colors.primary;
  };

  const getBannerMessage = () => {
    if (trialStatus.hasExpired) {
      return 'Your trial has expired';
    }
    if (trialStatus.daysRemaining === 0) {
      return 'Your trial ends today!';
    }
    if (trialStatus.daysRemaining === 1) {
      return 'Your trial ends tomorrow!';
    }
    return `${trialStatus.daysRemaining} days left in your free trial`;
  };

  const styles = createStyles(colors, getBannerColor());

  return (
    <TouchableOpacity style={styles.banner} onPress={handleUpgrade} activeOpacity={0.8}>
      <View style={styles.iconContainer}>
        <FlynnIcon name="time-outline" size={24} color={colors.white} />
      </View>

      <View style={styles.content}>
        <Text style={styles.message}>{getBannerMessage()}</Text>
        <Text style={styles.subtitle}>
          Subscribe now to keep using AI features
        </Text>
      </View>

      <View style={styles.actionContainer}>
        <Text style={styles.actionText}>Upgrade</Text>
        <FlynnIcon name="arrow-forward" size={18} color={colors.white} />
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (colors: any, bannerColor: string) =>
  StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: bannerColor,
      padding: spacing.md,
      borderRadius: borderRadius.lg,
      marginBottom: spacing.lg,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.sm,
    },
    content: {
      flex: 1,
    },
    message: {
      ...typography.bodyLarge,
      fontWeight: '700',
      color: colors.white,
      marginBottom: spacing.xxs,
    },
    subtitle: {
      ...typography.bodySmall,
      color: 'rgba(255, 255, 255, 0.9)',
    },
    actionContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xxs,
    },
    actionText: {
      ...typography.bodyMedium,
      fontWeight: '600',
      color: colors.white,
    },
  });
