import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useOnboarding } from '../context/OnboardingContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/supabase';
import { spacing, typography } from '../theme';
import Constants from 'expo-constants';

const API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl || 'https://flynnai-telephony.fly.dev';

export const StripeRedirectScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user, session } = useAuth();
  const { refreshOnboarding } = useOnboarding();
  const { colors } = useTheme();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const styles = createStyles(colors);

  useEffect(() => {
    console.log('[StripeRedirect] Screen mounted');
    console.log('[StripeRedirect] User:', !!user, 'Session:', !!session);

    // Verify payment and subscription status
    verifyPaymentStatus();
  }, []);

  const verifyPaymentStatus = async () => {
    try {
      if (!user?.id) {
        console.error('[StripeRedirect] No user found, redirecting to login');
        // User got logged out - this shouldn't happen with our session preservation
        Alert.alert(
          'Session expired',
          'Please log in again to continue',
          [{ text: 'OK', onPress: () => navigation.navigate('Login' as never) }]
        );
        return;
      }

      console.log('[StripeRedirect] Verifying payment status for user:', user.id);
      setStatus('verifying');

      // Wait a moment for webhook to process
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get the session for API authentication
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession?.access_token) {
        throw new Error('No authentication session found');
      }

      // Fetch subscription status from backend
      const response = await fetch(`${API_BASE_URL}/api/stripe/subscription/${user.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${currentSession.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // If no subscription found, payment might have been cancelled
        if (response.status === 404) {
          console.log('[StripeRedirect] No subscription found - payment likely cancelled');
          setStatus('error');
          Alert.alert(
            'Payment not completed',
            'Your payment was not completed. You can try again from Settings > Subscription.',
            [{ text: 'OK', onPress: () => navigateToCallSetup() }]
          );
          return;
        }

        throw new Error(errorData.message || 'Failed to verify subscription');
      }

      const subscriptionData = await response.json();
      console.log('[StripeRedirect] Subscription verified:', subscriptionData.status);

      // Check if subscription is active or in trial
      if (subscriptionData.status === 'active' || subscriptionData.status === 'trialing') {
        setStatus('success');

        // Refresh onboarding context to get updated plan
        await refreshOnboarding();

        // Show success message
        const trialMessage = subscriptionData.trialEnd
          ? `Your 14-day free trial has started! You won\'t be charged until ${new Date(subscriptionData.trialEnd * 1000).toLocaleDateString()}.`
          : 'Your subscription is now active!';

        Alert.alert(
          'Payment successful!',
          trialMessage,
          [
            {
              text: 'Continue Setup',
              onPress: () => navigateToCallSetup(),
            },
          ]
        );
      } else {
        // Subscription exists but not active - payment might have failed
        console.warn('[StripeRedirect] Subscription status:', subscriptionData.status);
        setStatus('error');
        Alert.alert(
          'Payment issue',
          'There was an issue with your payment. Please try again or contact support.',
          [{ text: 'OK', onPress: () => navigateToCallSetup() }]
        );
      }

    } catch (error: any) {
      console.error('[StripeRedirect] Error verifying payment:', error);
      setStatus('error');

      // Don't block the user - let them continue to setup
      Alert.alert(
        'Verification in progress',
        'We\'re still processing your payment. You can continue setup and we\'ll notify you once it\'s confirmed.',
        [{ text: 'Continue', onPress: () => navigateToCallSetup() }]
      );
    }
  };

  const navigateToCallSetup = () => {
    console.log('[StripeRedirect] Navigating to call forwarding setup');
    // Navigate to CompleteSetup screen where users can set up call forwarding
    navigation.navigate('CompleteSetup' as never);
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {status === 'verifying' && (
          <>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.title}>Verifying payment...</Text>
            <Text style={styles.subtitle}>Please wait while we confirm your subscription</Text>
          </>
        )}

        {status === 'success' && (
          <>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.title}>Payment successful!</Text>
            <Text style={styles.subtitle}>Redirecting to setup...</Text>
          </>
        )}

        {status === 'error' && (
          <>
            <Text style={styles.errorIcon}>⚠</Text>
            <Text style={styles.title}>Processing...</Text>
            <Text style={styles.subtitle}>Continuing to setup</Text>
          </>
        )}
      </View>
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  content: {
    alignItems: 'center',
    maxWidth: 400,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  successIcon: {
    fontSize: 64,
    color: colors.success,
  },
  errorIcon: {
    fontSize: 64,
    color: colors.warning,
  },
});
