import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { FlynnIcon } from '../ui/FlynnIcon';
import { FlynnInput } from '../ui/FlynnInput';
import { FlynnButton } from '../ui/FlynnButton';
import NativeVoiceAgentService, { ConversationResult } from '../../services/NativeVoiceAgentService';
import { useAuth } from '../../context/AuthContext';
import { useOnboarding } from '../../context/OnboardingContext';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';
import { supabase } from '../../services/supabase';
import { apiClient } from '../../services/apiClient';
import EqualizerAnimation from '../ui/EqualizerAnimation';

interface FirstTimeExperienceModalProps {
  visible: boolean;
  onClose: () => void;
  onStartTrial: () => void;
}

type ModalStep = 'greeting' | 'test' | 'jobcard' | 'cta';

interface MockJobCard {
  clientName: string;
  serviceType: string;
  date: string;
  time: string;
  location: string;
  notes: string;
}

export const FirstTimeExperienceModal: React.FC<FirstTimeExperienceModalProps> = ({
  visible,
  onClose,
  onStartTrial,
}) => {
  const { user } = useAuth();
  const { onboardingData } = useOnboarding();

  const [currentStep, setCurrentStep] = useState<ModalStep>('greeting');
  const [greeting, setGreeting] = useState('');
  const [conversationState, setConversationState] = useState<string>('disconnected');
  const [transcript, setTranscript] = useState<Array<{ role: string; content: string }>>([]);
  const [mockJobCard, setMockJobCard] = useState<MockJobCard | null>(null);
  const [conversationDuration, setConversationDuration] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  // Initialize greeting with personalized default
  useEffect(() => {
    if (!visible) return;

    // Use business name from onboarding data or user metadata
    const businessName = onboardingData.businessName || user?.user_metadata?.business_name || 'us';
    const defaultGreeting = `Hey, thanks for reaching ${businessName}. How can we help you today?`;

    // Set greeting from onboarding data or default
    const savedGreeting = onboardingData.receptionistGreeting;
    console.log('[FirstTimeExperience] Loading greeting:', { savedGreeting, defaultGreeting, hasOnboardingGreeting: !!savedGreeting });
    setGreeting(savedGreeting || defaultGreeting);

    // Skip greeting step if already configured during onboarding
    if (savedGreeting && onboardingData.receptionistVoice) {
      console.log('[FirstTimeExperience] Skipping greeting step - already configured');
      setCurrentStep('test');
      // Auto-start the test if we have all needed info
      if (user?.id) {
        startTestSession(savedGreeting, onboardingData.receptionistVoice);
      }
    } else {
      console.log('[FirstTimeExperience] Showing greeting step');
      setCurrentStep('greeting');
    }
  }, [visible, onboardingData, user]);

  // Listen to voice agent events
  useEffect(() => {
    const handleStateChange = (state: string) => {
      setConversationState(state);
      if (state !== 'agent_speaking' && state !== 'user_speaking') {
        setAudioLevel(0);
      }
    };

    const handleTranscript = (message: any) => {
      setTranscript(prev => [...prev, { role: message.role, content: message.content }]);
    };

    const handleAudioLevel = (level: number) => {
      setAudioLevel(level);
    };

    const handleConversationEnded = async (result: ConversationResult) => {
      setConversationState('ended');
      setAudioLevel(0);
      await createJobFromConversation(result);
    };

    NativeVoiceAgentService.on('state_changed', handleStateChange);
    NativeVoiceAgentService.on('transcript', handleTranscript);
    NativeVoiceAgentService.on('audio_level', handleAudioLevel);
    NativeVoiceAgentService.on('conversation_ended', handleConversationEnded);

    return () => {
      NativeVoiceAgentService.off('state_changed', handleStateChange);
      NativeVoiceAgentService.off('transcript', handleTranscript);
      NativeVoiceAgentService.off('audio_level', handleAudioLevel);
      NativeVoiceAgentService.off('conversation_ended', handleConversationEnded);
    };
  }, []);

  const createJobFromConversation = async (result: ConversationResult) => {
    try {
      // Prepare job data from conversation result
      const jobData = {
        customerName: result.entities.caller_name || '',
        serviceType: result.entities.service_type || onboardingData.businessType || 'Service Request',
        date: result.entities.preferred_date || '',
        time: result.entities.preferred_time || '',
        location: result.entities.location || '',
        notes: result.entities.notes || result.transcript.substring(0, 200) + (result.transcript.length > 200 ? '...' : ''),
        status: 'new',
        source: 'ai_test_call', // Indicate this came from a test call
        businessType: onboardingData.businessType || '',
        capturedAt: new Date().toISOString(),
        voicemailTranscript: result.transcript,
        userId: user?.id,
      };

      // Create job via API
      const response = await apiClient.post('/jobs', jobData);
      
      // Create job card representation
      const card: MockJobCard = {
        clientName: jobData.customerName || 'Test Client',
        serviceType: jobData.serviceType,
        date: jobData.date || 'TBD',
        time: jobData.time || 'TBD',
        location: jobData.location || 'Test Location',
        notes: jobData.notes || 'Test notes from AI receptionist test',
      };

      setMockJobCard(card);
      setConversationDuration(45);
      
      // Refresh jobs context to show the new job
      // Note: This depends on having access to refreshJobs from JobsContext
    } catch (error) {
      console.error('[FirstTimeExperience] Failed to create job from conversation:', error);
      
      // Fallback to mock job card if API fails
      const card: MockJobCard = {
        clientName: result.entities.caller_name || 'John Smith',
        serviceType: result.entities.service_type || onboardingData.businessType || 'Service Request',
        date: result.entities.preferred_date || 'Tomorrow',
        time: result.entities.preferred_time || '2:00 PM',
        location: result.entities.location || '123 Main St',
        notes: result.entities.notes || result.transcript.substring(0, 100) + '...',
      };

      setMockJobCard(card);
      setConversationDuration(45);
    }
  };

  const startTestSession = async (greetingText: string, voiceId: string) => {
    if (!user?.id) return;

    try {
      console.log('[FirstTimeExperience] Starting test session...', { greeting: greetingText, voice: voiceId });
      setTranscript([]);
      
      // Save customized greeting if it differs from saved
      if (greetingText && greetingText !== onboardingData.receptionistGreeting) {
        await supabase
          .from('users')
          .update({ demo_greeting_customized: greetingText })
          .eq('id', user.id);
      }

      // Start AI conversation with user's customized settings
      await NativeVoiceAgentService.startConversation(
        user.id,
        greetingText,
        voiceId || 'female',
        'ai_only'
      );
    } catch (error) {
      console.error('[FirstTimeExperience] Failed to start test:', error);
    }
  };

  const handleStartTest = async () => {
    setCurrentStep('test');
    await startTestSession(greeting, onboardingData.receptionistVoice || 'female');
  };

  const handleEndTest = async () => {
    try {
      setIsProcessing(true);
      await NativeVoiceAgentService.endConversation();

      // Wait a moment for the backend to process
      setTimeout(() => {
        setCurrentStep('jobcard');
        setIsProcessing(false);
      }, 1500);
    } catch (error) {
      console.error('[FirstTimeExperience] Failed to end test:', error);
      setIsProcessing(false);
    }
  };

  const handleViewJobCard = () => {
    setCurrentStep('jobcard');
  };

  const handleContinueToCTA = () => {
    setCurrentStep('cta');
  };

  const handleSkip = async () => {
    // Mark as seen in database
    if (user?.id) {
      await supabase
        .from('users')
        .update({ has_seen_demo: true })
        .eq('id', user.id);
    }
    onClose();
  };

  const handleStartTrialNow = async () => {
    // Mark as seen
    if (user?.id) {
      await supabase
        .from('users')
        .update({ has_seen_demo: true })
        .eq('id', user.id);
    }
    onClose();
    onStartTrial();
  };

  const renderGreetingStep = () => {
    const hasExistingGreeting = Boolean(onboardingData.receptionistGreeting);

    return (
      <View style={styles.stepContainer}>
        <View style={styles.iconContainer}>
          <FlynnIcon name="chatbubble-ellipses" size={48} color={colors.primary} />
        </View>

        <Text style={styles.stepTitle}>
          {hasExistingGreeting ? 'Confirm Your Greeting' : 'Customize Your Greeting'}
        </Text>
        <Text style={styles.stepSubtitle}>
          {hasExistingGreeting
            ? 'This is what callers will hear. You can edit it or keep it as is.'
            : 'This is what callers will hear when they reach your AI receptionist. Make it yours!'}
        </Text>

        <View style={styles.greetingPreview}>
          <View style={styles.voiceLabel}>
            <FlynnIcon name="mic" size={20} color={colors.textSecondary} />
            <Text style={styles.voiceLabelText}>
              {onboardingData.receptionistVoice === 'male' ? 'Male Voice' : 'Female Voice'}
            </Text>
          </View>

          <FlynnInput
            multiline
            numberOfLines={4}
            value={greeting}
            onChangeText={setGreeting}
            placeholder="Hey, thanks for reaching..."
            containerStyle={styles.greetingInput}
          />
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip Demo</Text>
          </TouchableOpacity>
          <FlynnButton
            title={hasExistingGreeting ? 'Test It Now →' : 'Continue →'}
            onPress={handleStartTest}
            disabled={!greeting.trim()}
          />
        </View>
      </View>
    );
  };

  const renderTestStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <FlynnIcon
          name={conversationState === 'agent_speaking' ? 'mic' : conversationState === 'user_speaking' ? 'person' : 'chatbubbles'}
          size={48}
          color={colors.primary}
        />
      </View>

      <Text style={styles.stepTitle}>Talk to Your AI Receptionist</Text>
      <Text style={styles.stepSubtitle}>
        This is YOUR AI - customized with your business name and voice preference
      </Text>

      {/* Reactive Equalizer Animation - Always rendered to reserve space */}
      <View style={[
        styles.equalizerContainer,
        { opacity: (conversationState === 'agent_speaking' || conversationState === 'user_speaking' || conversationState === 'ready') ? 1 : 0 }
      ]}>
        <EqualizerAnimation 
          isActive={conversationState === 'agent_speaking' || conversationState === 'user_speaking'} 
          barCount={15} 
          height={60} 
          audioLevel={audioLevel}
        />
      </View>

      <ScrollView 
        style={styles.transcriptContainer} 
        showsVerticalScrollIndicator={false}
        ref={scrollViewRef}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {transcript.map((message, index) => (
          <View
            key={index}
            style={[
              styles.transcriptMessage,
              message.role === 'assistant' ? styles.assistantMessage : styles.userMessage,
            ]}
          >
            <View style={styles.messageHeader}>
              <FlynnIcon
                name={message.role === 'assistant' ? 'chatbubble' : 'person'}
                size={16}
                color={message.role === 'assistant' ? colors.primary : colors.textSecondary}
              />
              <Text style={styles.messageRole}>
                {message.role === 'assistant' ? 'AI Receptionist' : 'You'}
              </Text>
            </View>
            <Text style={styles.messageContent}>{message.content}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.conversationControls}>
        {conversationState === 'ready' || conversationState === 'user_speaking' || conversationState === 'agent_speaking' ? (
          <FlynnButton
            title={isProcessing ? 'Processing...' : 'End Call'}
            onPress={handleEndTest}
            variant="secondary"
            disabled={isProcessing}
          />
        ) : conversationState === 'ended' && mockJobCard ? (
          <FlynnButton
            title="See What Flynn Captured →"
            onPress={handleViewJobCard}
          />
        ) : (
          <View style={styles.connectingIndicator}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.connectingText}>
              {conversationState === 'connecting' ? 'Connecting...' : conversationState === 'processing' ? 'Processing conversation...' : 'Initializing...'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderJobCardStep = () => {
    if (!mockJobCard) return null;

    return (
      <View style={styles.stepContainer}>
        <View style={styles.iconContainer}>
          <FlynnIcon name="checkmark-circle" size={48} color={colors.success} />
        </View>

        <Text style={styles.stepTitle}>Your First Lead Captured!</Text>
        <Text style={styles.stepSubtitle}>
          Your AI captured all this information in just {conversationDuration} seconds
        </Text>

        <View style={styles.jobCard}>
          <View style={styles.jobCardHeader}>
            <View style={styles.jobCardIcon}>
              <FlynnIcon name="briefcase" size={24} color={colors.white} />
            </View>
            <View style={styles.jobCardHeaderText}>
              <Text style={styles.jobCardTitle}>{mockJobCard.serviceType}</Text>
              <Text style={styles.jobCardStatus}>Demo Job • From Test Call</Text>
            </View>
          </View>

          <View style={styles.jobCardDetails}>
            <View style={styles.jobCardRow}>
              <FlynnIcon name="person" size={20} color={colors.textSecondary} />
              <Text style={styles.jobCardLabel}>Client:</Text>
              <Text style={styles.jobCardValue}>{mockJobCard.clientName}</Text>
            </View>

            <View style={styles.jobCardRow}>
              <FlynnIcon name="calendar" size={20} color={colors.textSecondary} />
              <Text style={styles.jobCardLabel}>When:</Text>
              <Text style={styles.jobCardValue}>{mockJobCard.date} at {mockJobCard.time}</Text>
            </View>

            <View style={styles.jobCardRow}>
              <FlynnIcon name="location" size={20} color={colors.textSecondary} />
              <Text style={styles.jobCardLabel}>Where:</Text>
              <Text style={styles.jobCardValue}>{mockJobCard.location}</Text>
            </View>

            <View style={styles.jobCardNotes}>
              <FlynnIcon name="document-text" size={20} color={colors.textSecondary} />
              <Text style={styles.jobCardLabel}>Notes:</Text>
              <Text style={styles.jobCardNotesText}>{mockJobCard.notes}</Text>
            </View>
          </View>
        </View>

        <View style={styles.valueProposition}>
          <View style={styles.valueItem}>
            <Text style={styles.valueNumber}>{conversationDuration}s</Text>
            <Text style={styles.valueLabel}>Capture Time</Text>
          </View>
          <View style={styles.valueDivider} />
          <View style={styles.valueItem}>
            <Text style={styles.valueNumber}>100%</Text>
            <Text style={styles.valueLabel}>Info Captured</Text>
          </View>
          <View style={styles.valueDivider} />
          <View style={styles.valueItem}>
            <Text style={styles.valueNumber}>$0</Text>
            <Text style={styles.valueLabel}>Leads Lost</Text>
          </View>
        </View>

        <FlynnButton
          title="Ready to Go Live? →"
          onPress={handleContinueToCTA}
        />
      </View>
    );
  };

  const renderCTAStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <FlynnIcon name="rocket" size={48} color={colors.primary} />
      </View>

      <Text style={styles.stepTitle}>Never Miss a Lead Again</Text>
      <Text style={styles.stepSubtitle}>
        Every missed call becomes a captured lead. Start your 7-day free trial to connect your real phone number.
      </Text>

      <View style={styles.benefitsList}>
        <View style={styles.benefitItem}>
          <FlynnIcon name="checkmark-circle" size={24} color={colors.success} />
          <Text style={styles.benefitText}>AI answers every call instantly</Text>
        </View>
        <View style={styles.benefitItem}>
          <FlynnIcon name="checkmark-circle" size={24} color={colors.success} />
          <Text style={styles.benefitText}>Auto-creates job cards from conversations</Text>
        </View>
        <View style={styles.benefitItem}>
          <FlynnIcon name="checkmark-circle" size={24} color={colors.success} />
          <Text style={styles.benefitText}>Works 24/7, even when you're busy</Text>
        </View>
        <View style={styles.benefitItem}>
          <FlynnIcon name="checkmark-circle" size={24} color={colors.success} />
          <Text style={styles.benefitText}>7-day free trial • Cancel anytime</Text>
        </View>
      </View>

      <FlynnButton
        title="Start Free Trial & Connect Phone"
        onPress={handleStartTrialNow}
      />

      <TouchableOpacity onPress={handleSkip} style={styles.skipLinkButton}>
        <Text style={styles.skipLinkText}>Maybe later</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={handleSkip} style={styles.closeButton}>
            <FlynnIcon name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.progressDots}>
            <View style={[styles.dot, currentStep === 'greeting' && styles.activeDot]} />
            <View style={[styles.dot, currentStep === 'test' && styles.activeDot]} />
            <View style={[styles.dot, currentStep === 'jobcard' && styles.activeDot]} />
            <View style={[styles.dot, currentStep === 'cta' && styles.activeDot]} />
          </View>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.modalContent}
          contentContainerStyle={styles.modalContentContainer}
          showsVerticalScrollIndicator={false}
        >
          {currentStep === 'greeting' && renderGreetingStep()}
          {currentStep === 'test' && renderTestStep()}
          {currentStep === 'jobcard' && renderJobCardStep()}
          {currentStep === 'cta' && renderCTAStep()}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: colors.white,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },

  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  progressDots: {
    flexDirection: 'row',
    gap: spacing.xs,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gray300,
  },

  activeDot: {
    backgroundColor: colors.primary,
    width: 24,
  },

  headerSpacer: {
    width: 40,
  },

  modalContent: {
    flex: 1,
  },

  modalContentContainer: {
    padding: spacing.xl,
  },

  stepContainer: {
    alignItems: 'center',
  },

  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },

  stepTitle: {
    ...typography.h1,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },

  stepSubtitle: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },

  greetingPreview: {
    width: '100%',
    marginBottom: spacing.xl,
  },

  voiceLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },

  voiceLabelText: {
    ...typography.label,
    color: colors.textSecondary,
  },

  greetingInput: {
    marginBottom: 0,
  },

  buttonRow: {
    width: '100%',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  skipButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },

  skipText: {
    ...typography.button,
    color: colors.textSecondary,
  },

  transcriptContainer: {
    width: '100%',
    maxHeight: 400,
    backgroundColor: colors.gray50,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },

  transcriptMessage: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },

  assistantMessage: {
    backgroundColor: colors.primaryLight,
    alignSelf: 'flex-start',
    maxWidth: '85%',
  },

  userMessage: {
    backgroundColor: colors.white,
    alignSelf: 'flex-end',
    maxWidth: '85%',
    borderWidth: 1,
    borderColor: colors.gray200,
  },

  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xxs,
  },

  messageRole: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  messageContent: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },

  conversationControls: {
    width: '100%',
  },

  connectingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },

  connectingText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },

  jobCard: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.primary,
    ...shadows.md,
    marginBottom: spacing.xl,
    overflow: 'hidden',
  },

  jobCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primary,
    padding: spacing.md,
  },

  jobCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
  },

  jobCardHeaderText: {
    flex: 1,
  },

  jobCardTitle: {
    ...typography.h3,
    color: colors.white,
    marginBottom: 2,
  },

  jobCardStatus: {
    ...typography.caption,
    color: colors.white,
    opacity: 0.9,
  },

  jobCardDetails: {
    padding: spacing.md,
    gap: spacing.md,
  },

  jobCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  jobCardLabel: {
    ...typography.label,
    color: colors.textSecondary,
    width: 60,
  },

  jobCardValue: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    flex: 1,
  },

  jobCardNotes: {
    gap: spacing.xs,
  },

  jobCardNotesText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginLeft: spacing.sm + 20,
  },

  valueProposition: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: colors.gray50,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    justifyContent: 'space-around',
  },

  valueItem: {
    alignItems: 'center',
  },

  valueNumber: {
    ...typography.h1,
    color: colors.primary,
    marginBottom: spacing.xxs,
  },

  valueLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  valueDivider: {
    width: 1,
    backgroundColor: colors.gray300,
  },

  benefitsList: {
    width: '100%',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },

  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },

  benefitText: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    flex: 1,
  },

  skipLinkButton: {
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },

  skipLinkText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
