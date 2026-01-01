import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'TermsOfService'>;

const TermsOfServiceScreen: React.FC<Props> = ({ navigation }) => {
  const handleOpenWebVersion = () => {
    Linking.openURL('https://www.flynnai.app/terms');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.webLinkCard}>
          <Text style={styles.webLinkText}>
            View the full Terms of Service on our website
          </Text>
          <TouchableOpacity onPress={handleOpenWebVersion} style={styles.webLinkButton}>
            <Text style={styles.webLinkButtonText}>Open in Browser</Text>
            <Ionicons name="open-outline" size={16} color="#2563EB" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Last Updated: January 2, 2025</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>1. Acceptance of Terms</Text>
          <Text style={styles.paragraph}>
            By accessing or using Flynn AI ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>2. Description of Service</Text>
          <Text style={styles.paragraph}>
            Flynn AI is an inbound lead management platform that captures missed calls and converts them into revenue through automated SMS booking and quote links, with optional AI voice assistance.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>3. User Accounts</Text>
          <Text style={styles.paragraph}>
            You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify us immediately of any unauthorized use of your account.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>4. Call Recording and Privacy</Text>
          <Text style={styles.paragraph}>
            Flynn AI may record and transcribe incoming calls to your business. You are responsible for complying with all applicable laws regarding call recording and consent in your jurisdiction. Flynn AI provides tools to help you meet these requirements, including recording disclosure messages.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>5. Billing and Payment</Text>
          <Text style={styles.paragraph}>
            Subscription fees are billed in advance on a monthly or annual basis. You authorize us to charge your payment method for all fees. Fees are non-refundable except as required by law.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>6. Data Usage and AI Processing</Text>
          <Text style={styles.paragraph}>
            The Service uses AI to process voicemails, transcribe calls, and extract job details. By using the Service, you grant Flynn AI permission to process this data to provide the Service to you. We do not use your data to train AI models for third parties.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>7. Acceptable Use</Text>
          <Text style={styles.paragraph}>
            You agree not to use the Service for any unlawful purpose, to spam users, or to violate any telecommunications regulations. Flynn AI reserves the right to suspend or terminate accounts that violate these terms.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>8. Third-Party Services</Text>
          <Text style={styles.paragraph}>
            The Service integrates with third-party platforms including Twilio, OpenAI, Deepgram, and accounting software. Your use of these integrations is subject to their respective terms of service.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>9. Limitation of Liability</Text>
          <Text style={styles.paragraph}>
            Flynn AI is provided "as is" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the Service, including missed calls or lost business opportunities.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>10. Changes to Terms</Text>
          <Text style={styles.paragraph}>
            We reserve the right to modify these Terms of Service at any time. We will notify you of material changes via email or in-app notification. Your continued use of the Service after changes constitutes acceptance of the new terms.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>11. Termination</Text>
          <Text style={styles.paragraph}>
            You may terminate your account at any time through the app settings. We may terminate or suspend your account for violations of these terms. Upon termination, your data will be retained according to our data retention policy.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>12. Governing Law</Text>
          <Text style={styles.paragraph}>
            These Terms are governed by the laws of the jurisdiction where Flynn AI operates. Any disputes will be resolved through binding arbitration.
          </Text>
        </View>

        <View style={styles.contactSection}>
          <Text style={styles.contactHeading}>Contact Us</Text>
          <Text style={styles.contactText}>
            If you have questions about these Terms of Service, please contact us at:
          </Text>
          <TouchableOpacity onPress={() => Linking.openURL('mailto:support@flynnai.app')}>
            <Text style={styles.contactLink}>support@flynnai.app</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
  },
  webLinkCard: {
    backgroundColor: '#DBEAFE',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2563EB',
  },
  webLinkText: {
    fontSize: 14,
    color: '#1E293B',
    marginBottom: 12,
  },
  webLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  webLinkButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    color: '#475569',
  },
  contactSection: {
    marginTop: 32,
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  contactHeading: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  contactText: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 8,
  },
  contactLink: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '500',
  },
});

export default TermsOfServiceScreen;
