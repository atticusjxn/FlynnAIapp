/**
 * AI Receptionist Test Screen
 *
 * Onboarding step 6.5 - Allows users to test their configured AI receptionist
 * before signing up for a trial. Uses real Deepgram Voice Agent API for authentic experience.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOnboarding } from '../../context/OnboardingContext';
import { useAuth } from '../../context/AuthContext';
import NativeVoiceAgentService, {
  ConversationState,
  ConversationMessage,
  ConversationResult,
  ExtractedEntities,
} from '../../services/NativeVoiceAgentService';
import EqualizerAnimation from '../../components/ui/EqualizerAnimation';
import JobCard from '../../components/jobs/JobCard';

const AIReceptionistTestScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { onboardingData, updateOnboardingData } = useOnboarding();
  const { user } = useAuth();

  // State
  const [conversationState, setConversationState] = useState<ConversationState>('disconnected');
  const [transcript, setTranscript] = useState<ConversationMessage[]>([]);
  const [entities, setEntities] = useState<ExtractedEntities>({});
  const [showJobCard, setShowJobCard] = useState(false);
  const [conversationResult, setConversationResult] = useState<ConversationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Extract config from onboarding data
  const greeting = onboardingData.receptionistGreeting || 'Hi! How can I help you today?';
  const voiceId = onboardingData.receptionistVoice || 'flynn_warm';
  const mode = onboardingData.receptionistMode || 'ai_only';

  useEffect(() => {
    // Set up event listeners
    const handleStateChange = (state: ConversationState) => {
      console.log('[AIReceptionistTest] State changed:', state);
      setConversationState(state);
    };

    const handleTranscript = (message: ConversationMessage) => {
      console.log('[AIReceptionistTest] Transcript:', message);
      setTranscript(prev => [...prev, message]);
    };

    const handleEntitiesUpdated = (updatedEntities: ExtractedEntities) => {
      console.log('[AIReceptionistTest] Entities updated:', updatedEntities);
      setEntities(updatedEntities);
    };

    const handleConversationEnded = (result: ConversationResult) => {
      console.log('[AIReceptionistTest] Conversation ended:', result);
      setConversationResult(result);
      setShowJobCard(true);

      // Save result to onboarding data
      updateOnboardingData({
        aiTestCompleted: true,
        testJobExtracted: result.entities,
      });
    };

    const handleError = (err: Error) => {
      console.error('[AIReceptionistTest] Error:', err);
      setError(err.message);
      Alert.alert('Error', err.message);
    };

    NativeVoiceAgentService.on('state_changed', handleStateChange);
    NativeVoiceAgentService.on('transcript', handleTranscript);
    NativeVoiceAgentService.on('entities_updated', handleEntitiesUpdated);
    NativeVoiceAgentService.on('conversation_ended', handleConversationEnded);
    NativeVoiceAgentService.on('error', handleError);

    return () => {
      NativeVoiceAgentService.off('state_changed', handleStateChange);
      NativeVoiceAgentService.off('transcript', handleTranscript);
      NativeVoiceAgentService.off('entities_updated', handleEntitiesUpdated);
      NativeVoiceAgentService.off('conversation_ended', handleConversationEnded);
      NativeVoiceAgentService.off('error', handleError);
    };
  }, [updateOnboardingData]);

  /**
   * Start the test conversation
   */
  const handleStartTest = async () => {
    if (!user?.default_org_id) {
      Alert.alert('Error', 'User ID not found');
      return;
    }

    try {
      setError(null);
      setTranscript([]);
      setEntities({});
      setShowJobCard(false);
      setConversationResult(null);

      await NativeVoiceAgentService.startConversation(
        user.default_org_id,
        greeting,
        voiceId,
        mode
      );
    } catch (err: any) {
      console.error('[AIReceptionistTest] Failed to start:', err);
      Alert.alert('Error', 'Failed to start conversation: ' + err.message);
    }
  };

  /**
   * End the test conversation
   */
  const handleEndTest = async () => {
    try {
      await NativeVoiceAgentService.endConversation();
    } catch (err: any) {
      console.error('[AIReceptionistTest] Failed to end:', err);
    }
  };

  /**
   * Continue to trial signup or complete onboarding
   */
  const handleContinue = () => {
    // For now, this completes onboarding. Later you can add a trial signup screen
    // by creating step 8 in OnboardingNavigator
    if (typeof navigation?.navigate === 'function') {
      navigation.navigate(); // Calls handleNext which moves to next step or completes onboarding
    }
  };

  /**
   * Try again with different settings
   */
  const handleTryAgain = () => {
    setShowJobCard(false);
    setConversationResult(null);
    setTranscript([]);
    setEntities({});
    setConversationState('disconnected');
  };

  /**
   * Get state display info
   */
  const getStateInfo = () => {
    switch (conversationState) {
      case 'disconnected':
        return {
          text: 'Ready to test your AI receptionist',
          icon: 'mic-outline' as const,
          color: '#64748B',
        };
      case 'connecting':
        return {
          text: 'Connecting to Flynn...',
          icon: 'sync-outline' as const,
          color: '#2563EB',
        };
      case 'ready':
        return {
          text: 'Listening... speak now',
          icon: 'mic' as const,
          color: '#10B981',
        };
      case 'agent_speaking':
        return {
          text: 'Flynn is speaking...',
          icon: 'volume-high' as const,
          color: '#2563EB',
        };
      case 'user_speaking':
        return {
          text: 'Listening...',
          icon: 'mic' as const,
          color: '#10B981',
        };
      case 'processing':
        return {
          text: 'Processing conversation...',
          icon: 'sync-outline' as const,
          color: '#F59E0B',
        };
      case 'ended':
        return {
          text: 'Conversation ended',
          icon: 'checkmark-circle' as const,
          color: '#10B981',
        };
      case 'error':
        return {
          text: 'Error occurred',
          icon: 'alert-circle' as const,
          color: '#EF4444',
        };
    }
  };

  const stateInfo = getStateInfo();
  const isConversationActive = ['ready', 'agent_speaking', 'user_speaking'].includes(conversationState);
  const canStart = conversationState === 'disconnected';
  const canEnd = isConversationActive || conversationState === 'processing';

  // Render job card preview
  if (showJobCard && conversationResult) {
    const mockJob = {
      id: 'test-job',
      clientName: conversationResult.entities.caller_name || 'Test Caller',
      clientPhone: conversationResult.entities.phone_number || '(555) 123-4567',
      serviceType: conversationResult.entities.service_type || 'Service Request',
      description: conversationResult.entities.notes || 'Test job from AI receptionist',
      date: conversationResult.entities.preferred_date || 'TBD',
      time: conversationResult.entities.preferred_time || 'TBD',
      location: conversationResult.entities.location || 'Not specified',
      status: 'pending' as const,
      businessType: onboardingData.businessType || 'service',
      source: 'ai_receptionist' as const,
    };

    return (
      <View style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <Ionicons name="checkmark-circle" size={48} color="#10B981" />
            <Text style={styles.title}>Test Complete!</Text>
            <Text style={styles.subtitle}>
              Here's what Flynn extracted from your conversation
            </Text>
          </View>

          {/* Job Card Preview */}
          <View style={styles.jobCardContainer}>
            <View style={styles.previewBadge}>
              <Text style={styles.previewBadgeText}>PREVIEW ONLY</Text>
            </View>
            <JobCard job={mockJob} previewMode={true} />
          </View>

          {/* Transcript */}
          <View style={styles.transcriptContainer}>
            <Text style={styles.transcriptTitle}>Conversation Transcript</Text>
            {transcript.map((msg, index) => (
              <View
                key={index}
                style={[
                  styles.transcriptMessage,
                  msg.role === 'assistant' ? styles.assistantMessage : styles.userMessage,
                ]}
              >
                <Text style={styles.transcriptRole}>
                  {msg.role === 'assistant' ? 'Flynn' : 'You'}
                </Text>
                <Text style={styles.transcriptText}>{msg.content}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={handleTryAgain}
          >
            <Ionicons name="refresh" size={20} color="#2563EB" />
            <Text style={styles.secondaryButtonText}>Try Again</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleContinue}
          >
            <Text style={styles.primaryButtonText}>Continue to Trial</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Render conversation UI
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="call" size={48} color="#2563EB" />
          <Text style={styles.title}>Test Your AI Receptionist</Text>
          <Text style={styles.subtitle}>
            Have a real conversation with Flynn to see how it handles your calls
          </Text>
        </View>

        {/* State Indicator */}
        <View style={styles.stateContainer}>
          <Ionicons name={stateInfo.icon} size={32} color={stateInfo.color} />
          <Text style={[styles.stateText, { color: stateInfo.color }]}>
            {stateInfo.text}
          </Text>
        </View>

        {/* Equalizer Animation */}
        {conversationState === 'agent_speaking' && (
          <View style={styles.equalizerContainer}>
            <EqualizerAnimation isActive={true} barCount={7} height={80} />
          </View>
        )}

        {/* Microphone Indicator */}
        {(conversationState === 'ready' || conversationState === 'user_speaking') && (
          <View style={styles.micContainer}>
            <View style={styles.micCircle}>
              <Ionicons name="mic" size={40} color="#FFFFFF" />
            </View>
            <Text style={styles.micText}>
              {conversationState === 'user_speaking' ? 'Listening...' : 'Speak now'}
            </Text>
          </View>
        )}

        {/* Loading Indicator */}
        {['connecting', 'processing'].includes(conversationState) && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        )}

        {/* Transcript */}
        {transcript.length > 0 && (
          <View style={styles.transcriptContainer}>
            <Text style={styles.transcriptTitle}>Conversation</Text>
            {transcript.map((msg, index) => (
              <View
                key={index}
                style={[
                  styles.transcriptMessage,
                  msg.role === 'assistant' ? styles.assistantMessage : styles.userMessage,
                ]}
              >
                <Text style={styles.transcriptRole}>
                  {msg.role === 'assistant' ? 'Flynn' : 'You'}
                </Text>
                <Text style={styles.transcriptText}>{msg.content}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={20} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.footer}>
        {canStart && (
          <TouchableOpacity
            style={[styles.button, styles.primaryButton, styles.fullWidthButton]}
            onPress={handleStartTest}
          >
            <Ionicons name="mic" size={20} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Start Test Call</Text>
          </TouchableOpacity>
        )}

        {canEnd && (
          <TouchableOpacity
            style={[styles.button, styles.dangerButton, styles.fullWidthButton]}
            onPress={handleEndTest}
          >
            <Ionicons name="stop-circle" size={20} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>End Call</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  stateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  stateText: {
    fontSize: 16,
    fontWeight: '600',
  },
  equalizerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 24,
    paddingVertical: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  micContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  micCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  micText: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 12,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  transcriptContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  transcriptTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
  },
  transcriptMessage: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  assistantMessage: {
    backgroundColor: '#DBEAFE',
    alignSelf: 'flex-start',
    maxWidth: '80%',
  },
  userMessage: {
    backgroundColor: '#F1F5F9',
    alignSelf: 'flex-end',
    maxWidth: '80%',
  },
  transcriptRole: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
  },
  transcriptText: {
    fontSize: 14,
    color: '#1E293B',
  },
  jobCardContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  previewBadge: {
    position: 'absolute',
    top: -12,
    right: 12,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  previewBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    flex: 1,
  },
  footer: {
    padding: 24,
    paddingBottom: 32,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  fullWidthButton: {
    flex: 1,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#2563EB',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563EB',
  },
  dangerButton: {
    backgroundColor: '#EF4444',
  },
});

export default AIReceptionistTestScreen;
