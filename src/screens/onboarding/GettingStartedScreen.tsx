import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface GettingStartedScreenProps {
  onStartOnboarding: () => void;
}

export const GettingStartedScreen: React.FC<GettingStartedScreenProps> = ({ onStartOnboarding }) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../../../assets/images/onboardinglogo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>Welcome to FlynnAI!</Text>
          <Text style={styles.subtitle}>
            Let's get your business set up so you can start automating your workflow
          </Text>
        </View>

        <View style={styles.featuresContainer}>
          <View style={styles.feature}>
            <View style={styles.featureIcon}>
              <Ionicons name="camera-outline" size={24} color="#3B82F6" />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Smart Job Capture</Text>
              <Text style={styles.featureDescription}>
                Take screenshots to automatically extract job details
              </Text>
            </View>
          </View>

          <View style={styles.feature}>
            <View style={styles.featureIcon}>
              <Ionicons name="call-outline" size={24} color="#3B82F6" />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Call Integration</Text>
              <Text style={styles.featureDescription}>
                Convert phone calls into calendar bookings
              </Text>
            </View>
          </View>

          <View style={styles.feature}>
            <View style={styles.featureIcon}>
              <Ionicons name="calendar-outline" size={24} color="#3B82F6" />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Auto Scheduling</Text>
              <Text style={styles.featureDescription}>
                Automatically create calendar events and send confirmations
              </Text>
            </View>
          </View>

          <View style={styles.feature}>
            <View style={styles.featureIcon}>
              <Ionicons name="people-outline" size={24} color="#3B82F6" />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Client Management</Text>
              <Text style={styles.featureDescription}>
                Keep track of all your clients and job history
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.primaryButton} onPress={onStartOnboarding}>
            <Text style={styles.primaryButtonText}>Set Up Your Business</Text>
            <Ionicons name="arrow-forward" size={20} color="white" />
          </TouchableOpacity>
          
          <Text style={styles.footerText}>
            Takes less than 2 minutes to get started
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    paddingTop: 24,
  },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  logoImage: {
    width: 120,
    height: 120,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  featuresContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: 48,
    paddingBottom: 32,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  buttonContainer: {
    paddingTop: 24,
    paddingBottom: 32,
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 16,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
  footerText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
});