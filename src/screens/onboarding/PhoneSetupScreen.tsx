import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOnboarding } from '../../context/OnboardingContext';

interface PhoneSetupScreenProps {
  onNext: () => void;
  onBack: () => void;
}

export const PhoneSetupScreen: React.FC<PhoneSetupScreenProps> = ({ onNext, onBack }) => {
  const { onboardingData, updateOnboardingData } = useOnboarding();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSettingUp, setIsSettingUp] = useState(false);

  const handleSetupPhone = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }

    setIsSettingUp(true);
    
    // Simulate phone setup process
    setTimeout(() => {
      setIsSettingUp(false);
      updateOnboardingData({ phoneSetupComplete: true });
      Alert.alert(
        'Phone Setup Complete!',
        'Your phone is now configured to forward calls to FlynnAI. You\'ll receive notifications when new jobs are captured.',
        [{ text: 'Continue', onPress: onNext }]
      );
    }, 2000);
  };

  const handleSkip = () => {
    updateOnboardingData({ phoneSetupComplete: false });
    onNext();
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
          <View style={styles.progressBar} />
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleContainer}>
          <View style={styles.iconContainer}>
            <Ionicons name="call" size={32} color="#3B82F6" />
          </View>
          <Text style={styles.title}>Set up Call Forwarding</Text>
          <Text style={styles.subtitle}>
            Forward your business calls to FlynnAI to automatically capture job details and create bookings
          </Text>
        </View>

        <View style={styles.featuresContainer}>
          <View style={styles.feature}>
            <View style={styles.featureIcon}>
              <Ionicons name="mic" size={20} color="#10b981" />
            </View>
            <Text style={styles.featureText}>Record and transcribe calls</Text>
          </View>
          
          <View style={styles.feature}>
            <View style={styles.featureIcon}>
              <Ionicons name="calendar" size={20} color="#10b981" />
            </View>
            <Text style={styles.featureText}>Auto-create calendar events</Text>
          </View>
          
          <View style={styles.feature}>
            <View style={styles.featureIcon}>
              <Ionicons name="people" size={20} color="#10b981" />
            </View>
            <Text style={styles.featureText}>Extract client information</Text>
          </View>
          
          <View style={styles.feature}>
            <View style={styles.featureIcon}>
              <Ionicons name="mail" size={20} color="#10b981" />
            </View>
            <Text style={styles.featureText}>Send automatic confirmations</Text>
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Your Business Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="(555) 123-4567"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            autoCorrect={false}
          />
          <Text style={styles.inputHelper}>
            We'll provide instructions to forward calls from this number to FlynnAI
          </Text>
        </View>

        <View style={styles.infoContainer}>
          <View style={styles.infoIcon}>
            <Ionicons name="information-circle" size={20} color="#3B82F6" />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>How it works</Text>
            <Text style={styles.infoText}>
              1. We'll provide a FlynnAI phone number{'\n'}
              2. Set up call forwarding from your business line{'\n'}
              3. FlynnAI answers, records, and processes calls{'\n'}
              4. You get notified about new bookings instantly
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.primaryButton, isSettingUp && styles.loadingButton]}
          onPress={handleSetupPhone}
          disabled={isSettingUp}
        >
          {isSettingUp ? (
            <>
              <Text style={styles.primaryButtonText}>Setting up...</Text>
              <View style={styles.spinner} />
            </>
          ) : (
            <>
              <Text style={styles.primaryButtonText}>Set Up Phone</Text>
              <Ionicons name="call" size={20} color="white" />
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={handleSkip}>
          <Text style={styles.secondaryButtonText}>Skip for now</Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>
          You can set this up later in Settings
        </Text>
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
  featuresContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureText: {
    fontSize: 14,
    color: '#1f2937',
    flex: 1,
  },
  inputContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1f2937',
    marginBottom: 8,
  },
  inputHelper: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoContainer: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
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
    marginBottom: 12,
  },
  loadingButton: {
    opacity: 0.7,
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
  spinner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    borderTopColor: 'white',
  },
});