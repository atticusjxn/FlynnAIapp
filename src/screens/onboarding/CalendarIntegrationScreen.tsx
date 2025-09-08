import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOnboarding } from '../../context/OnboardingContext';

interface CalendarIntegrationScreenProps {
  onComplete: () => void;
  onBack: () => void;
}

export const CalendarIntegrationScreen: React.FC<CalendarIntegrationScreenProps> = ({ 
  onComplete, 
  onBack 
}) => {
  const { onboardingData, updateOnboardingData } = useOnboarding();
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedCalendar, setConnectedCalendar] = useState<string | null>(null);

  const handleConnectGoogle = async () => {
    setIsConnecting(true);
    
    // Simulate Google Calendar integration
    setTimeout(() => {
      setIsConnecting(false);
      setConnectedCalendar('google');
      updateOnboardingData({ calendarIntegrationComplete: true });
      Alert.alert(
        'Google Calendar Connected!',
        'FlynnAI can now automatically create events in your Google Calendar.',
        [{ text: 'Great!', onPress: () => {} }]
      );
    }, 2000);
  };

  const handleConnectApple = async () => {
    setIsConnecting(true);
    
    // Simulate Apple Calendar integration
    setTimeout(() => {
      setIsConnecting(false);
      setConnectedCalendar('apple');
      updateOnboardingData({ calendarIntegrationComplete: true });
      Alert.alert(
        'Apple Calendar Connected!',
        'FlynnAI can now automatically create events in your Apple Calendar.',
        [{ text: 'Great!', onPress: () => {} }]
      );
    }, 2000);
  };

  const handleSkip = () => {
    updateOnboardingData({ calendarIntegrationComplete: false });
    onComplete();
  };

  const handleFinish = () => {
    onComplete();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#3B82F6" />
        </TouchableOpacity>
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={[styles.progressBar, styles.progressActive]} />
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleContainer}>
          <View style={styles.iconContainer}>
            <Ionicons name="calendar" size={32} color="#3B82F6" />
          </View>
          <Text style={styles.title}>Connect Your Calendar</Text>
          <Text style={styles.subtitle}>
            Sync with your existing calendar to automatically create events for new bookings
          </Text>
        </View>

        <View style={styles.benefitsContainer}>
          <Text style={styles.benefitsTitle}>Benefits of Calendar Integration:</Text>
          
          <View style={styles.benefit}>
            <View style={styles.benefitIcon}>
              <Ionicons name="sync" size={18} color="#10b981" />
            </View>
            <Text style={styles.benefitText}>
              Automatic event creation from phone calls and screenshots
            </Text>
          </View>
          
          <View style={styles.benefit}>
            <View style={styles.benefitIcon}>
              <Ionicons name="notifications" size={18} color="#10b981" />
            </View>
            <Text style={styles.benefitText}>
              Get reminders for upcoming appointments
            </Text>
          </View>
          
          <View style={styles.benefit}>
            <View style={styles.benefitIcon}>
              <Ionicons name="people" size={18} color="#10b981" />
            </View>
            <Text style={styles.benefitText}>
              Share availability with clients automatically
            </Text>
          </View>
          
          <View style={styles.benefit}>
            <View style={styles.benefitIcon}>
              <Ionicons name="time" size={18} color="#10b981" />
            </View>
            <Text style={styles.benefitText}>
              Prevent double-bookings and scheduling conflicts
            </Text>
          </View>
        </View>

        {connectedCalendar ? (
          <View style={styles.successContainer}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={48} color="#10b981" />
            </View>
            <Text style={styles.successTitle}>Calendar Connected!</Text>
            <Text style={styles.successText}>
              Your {connectedCalendar === 'google' ? 'Google' : 'Apple'} Calendar is now synced with FlynnAI
            </Text>
          </View>
        ) : (
          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={[styles.calendarOption, isConnecting && styles.disabledOption]}
              onPress={handleConnectGoogle}
              disabled={isConnecting}
            >
              <View style={styles.calendarIconContainer}>
                <Text style={styles.googleIcon}>G</Text>
              </View>
              <View style={styles.calendarContent}>
                <Text style={styles.calendarTitle}>Google Calendar</Text>
                <Text style={styles.calendarDescription}>
                  Sync with your Google Calendar account
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color="#6b7280" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.calendarOption, isConnecting && styles.disabledOption]}
              onPress={handleConnectApple}
              disabled={isConnecting}
            >
              <View style={styles.calendarIconContainer}>
                <Ionicons name="logo-apple" size={24} color="#1f2937" />
              </View>
              <View style={styles.calendarContent}>
                <Text style={styles.calendarTitle}>Apple Calendar</Text>
                <Text style={styles.calendarDescription}>
                  Sync with your iCloud Calendar
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>
        )}

        {isConnecting && (
          <View style={styles.loadingContainer}>
            <View style={styles.spinner} />
            <Text style={styles.loadingText}>Connecting to your calendar...</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.buttonContainer}>
        {connectedCalendar ? (
          <TouchableOpacity style={styles.primaryButton} onPress={handleFinish}>
            <Text style={styles.primaryButtonText}>Complete Setup</Text>
            <Ionicons name="checkmark" size={20} color="white" />
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleSkip}>
              <Text style={styles.secondaryButtonText}>Skip for now</Text>
            </TouchableOpacity>
            <Text style={styles.footerText}>
              You can connect your calendar later in Settings
            </Text>
          </>
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
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    lineHeight: 22,
    textAlign: 'center',
  },
  benefitsContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  benefitText: {
    fontSize: 14,
    color: '#1f2937',
    flex: 1,
    lineHeight: 20,
  },
  optionsContainer: {
    gap: 12,
  },
  calendarOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  disabledOption: {
    opacity: 0.5,
  },
  calendarIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4285f4',
  },
  calendarContent: {
    flex: 1,
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  calendarDescription: {
    fontSize: 14,
    color: '#6b7280',
  },
  successContainer: {
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 32,
    marginBottom: 24,
  },
  successIcon: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  successText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 24,
  },
  spinner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#e5e7eb',
    borderTopColor: '#3B82F6',
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
  },
  buttonContainer: {
    padding: 24,
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  secondaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 8,
  },
  secondaryButtonText: {
    color: '#6b7280',
    fontSize: 16,
    textAlign: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
});