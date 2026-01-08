import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { PhoneProvisioningScreen } from './onboarding/PhoneProvisioningScreen';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../config/supabase';

/**
 * CompleteSetupScreen
 *
 * Post-payment phone provisioning flow.
 * This wraps the PhoneProvisioningScreen but is accessed after the user
 * has started their trial. When complete, it marks has_provisioned_phone=true
 * and navigates back to the dashboard.
 */
export const CompleteSetupScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [isCompleting, setIsCompleting] = useState(false);

  const handleBack = () => {
    navigation.goBack();
  };

  const handleComplete = async () => {
    if (isCompleting) return;

    try {
      setIsCompleting(true);

      // Mark phone as provisioned
      if (user?.id) {
        const { error } = await supabase
          .from('users')
          .update({ has_provisioned_phone: true })
          .eq('id', user.id);

        if (error) {
          console.error('[CompleteSetup] Failed to update provisioning status:', error);
          throw error;
        }
      }

      // Navigate back to dashboard
      Alert.alert(
        'Setup Complete!',
        'Your Flynn AI receptionist is now ready to capture leads from missed calls.',
        [
          {
            text: 'Go to Dashboard',
            onPress: () => {
              // Navigate to Dashboard tab
              navigation.navigate('Dashboard' as never);
            },
          },
        ]
      );
    } catch (error) {
      console.error('[CompleteSetup] Error completing setup:', error);
      Alert.alert(
        'Error',
        'Failed to complete setup. Please try again or contact support.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <View style={styles.container}>
      <PhoneProvisioningScreen
        onNext={handleComplete}
        onBack={handleBack}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
