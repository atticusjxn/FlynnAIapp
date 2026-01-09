import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import { FlynnIcon } from '../../components/ui/FlynnIcon';
import { FlynnInput } from '../../components/ui/FlynnInput';
import { FlynnButton } from '../../components/ui/FlynnButton';
import { OnboardingHeader } from '../../components/onboarding/OnboardingHeader';
import { useOnboarding } from '../../context/OnboardingContext';
import { spacing, typography, borderRadius } from '../../theme';
import CallHandlingService from '../../services/CallHandlingService';
import { OrganizationService } from '../../services/organizationService';
import { useAuth } from '../../context/AuthContext';
import { buildDefaultGreeting } from '../../utils/greetingDefaults';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../services/supabase';

interface ReceptionistSetupScreenProps {
  onComplete: () => void;
  onBack: () => void;
}

const voiceOptions = [
  { id: 'male', label: 'Male Voice', description: 'Professional and clear tone for business calls.' },
  { id: 'female', label: 'Female Voice', description: 'Warm and friendly tone for service calls.' },
];

const starterQuestions = [
  'What can we help you with today?',
  'Where should we send the team?',
  'When do you need the work done?',
  'What is the best number to reach you on?',
];

export const ReceptionistSetupScreen: React.FC<ReceptionistSetupScreenProps> = ({
  onComplete,
  onBack,
}) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { onboardingData, updateOnboardingData } = useOnboarding();

  // Map old voice IDs to new simplified ones
  const mapVoiceId = (oldVoiceId: string | null): string => {
    if (!oldVoiceId) return 'female';
    // Map old persona names to gender-based voices
    if (['flynn_warm', 'flynn_hype', 'custom_voice'].includes(oldVoiceId)) return 'female';
    if (['flynn_expert'].includes(oldVoiceId)) return 'male';
    return oldVoiceId; // Already 'male' or 'female'
  };

  const [selectedVoice, setSelectedVoice] = useState<string>(
    mapVoiceId(onboardingData.receptionistVoice)
  );
  const defaultGreeting = useMemo(() => buildDefaultGreeting(user), [user]);
  const [greeting, setGreeting] = useState(
    onboardingData.receptionistGreeting || defaultGreeting
  );
  const [customQuestion, setCustomQuestion] = useState('');
  const [questions, setQuestions] = useState<string[]>(
    onboardingData.receptionistQuestions && onboardingData.receptionistQuestions.length > 0
      ? onboardingData.receptionistQuestions
      : starterQuestions
  );
  const [offerChoice, setOfferChoice] = useState(onboardingData.receptionistMode === 'hybrid_choice');
  const [isSaving, setIsSaving] = useState(false);
  const [isPlayingSpeech, setIsPlayingSpeech] = useState(false);

  useEffect(() => {
    if (onboardingData.receptionistQuestions && onboardingData.receptionistQuestions.length > 0) {
      setQuestions(onboardingData.receptionistQuestions);
    }
  }, [onboardingData.receptionistQuestions]);

  useEffect(() => {
    if (onboardingData.receptionistGreeting) {
      setGreeting(onboardingData.receptionistGreeting);
    } else {
      setGreeting(defaultGreeting);
    }
  }, [defaultGreeting, onboardingData.receptionistGreeting]);

  const handleAddQuestion = () => {
    const trimmed = customQuestion.trim();
    if (!trimmed) {
      return;
    }
    setQuestions(prev => [...prev, trimmed]);
    setCustomQuestion('');
  };

  const handleRemoveQuestion = (question: string) => {
    setQuestions(prev => prev.filter(q => q !== question));
  };

  const handlePreviewCall = async () => {
    try {
      if (!greeting.trim()) {
        Alert.alert('No Greeting', 'Please enter a greeting message first.');
        return;
      }

      console.log('[ReceptionistSetup] Generating Deepgram TTS preview...', { greeting, voice: selectedVoice });

      setIsPlayingSpeech(true);

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      // Map voice selection to Deepgram Aura-2 Australian voice models
      // Both Hyperion (male) and Theia (female) are confirmed Australian accents
      const deepgramVoice = selectedVoice === 'male'
        ? 'aura-2-hyperion-en'  // Australian male voice (Caring, Warm, Empathetic)
        : 'aura-2-theia-en'; // Australian female voice (Expressive, Polite, Sincere)

      // Call backend to generate speech
      const response = await fetch('https://flynnai-telephony.fly.dev/api/deepgram/generate-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          text: greeting,
          voice: deepgramVoice,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate speech');
      }

      const { audio, contentType } = await response.json();

      // Convert base64 to playable URI
      const audioUri = `data:${contentType};base64,${audio}`;

      // Set up audio mode for playback
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
      });

      // Create and play the sound
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true, volume: 1.0 },
        (status) => {
          if (status.isLoaded && status.didJustFinish) {
            console.log('[ReceptionistSetup] Audio playback completed');
            setIsPlayingSpeech(false);
            sound.unloadAsync();
          }
        }
      );

      console.log('[ReceptionistSetup] Playing Deepgram TTS audio');

      // Set up cleanup
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlayingSpeech(false);
        }
      });

    } catch (error) {
      console.error('[ReceptionistSetup] Failed to play Deepgram TTS preview', error);
      setIsPlayingSpeech(false);
      Alert.alert(
        'Preview Unavailable',
        error.message || 'Failed to generate audio preview. Please check your connection and try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const persistPreferences = async (configured: boolean) => {
    setIsSaving(true);
    try {
      const mode = configured
        ? (offerChoice ? 'hybrid_choice' : 'ai_only')
        : 'voicemail_only';

      const ackLibrary = onboardingData.receptionistAckLibrary ?? [];

      // Update onboarding context first
      const updatedData = {
        ...onboardingData,
        receptionistConfigured: configured,
        receptionistVoice: configured ? selectedVoice : null,
        receptionistGreeting: configured ? greeting : null,
        receptionistQuestions: configured ? questions : [],
        receptionistMode: mode,
        receptionistAckLibrary: configured ? ackLibrary : [],
      };

      updateOnboardingData(updatedData);

      // Save to both legacy (users table) and new (organization tables)
      await Promise.all([
        CallHandlingService.savePreferences({
          voiceId: configured ? selectedVoice : null,
          greeting: configured ? greeting : null,
          questions: configured ? questions : [],
          voiceProfileId: onboardingData.receptionistVoiceProfileId ?? null,
          configured,
          mode,
          ackLibrary,
        }),
        OrganizationService.saveOnboardingData(updatedData),
      ]);

      console.log('[ReceptionistSetup] Saved preferences successfully', { greeting, voice: selectedVoice });
    } catch (error) {
      console.error('[ReceptionistSetupScreen] Failed to save receptionist settings', error);
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Unable to save receptionist settings. Please try again.');
      return false;
    } finally {
      setIsSaving(false);
    }

    return true;
  };

  const handleComplete = async () => {
    const saved = await persistPreferences(true);
    if (saved) {
      onComplete();
    }
  };

  const handleSkip = async () => {
    const saved = await persistPreferences(false);
    if (saved) {
      onComplete();
    }
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingHeader currentStep={4} totalSteps={4} onBack={onBack} />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleContainer}>
          <View style={styles.iconContainer}>
            <FlynnIcon name="sparkles" size={32} color={colors.primary} />
          </View>
          <Text style={styles.title}>Tune your AI receptionist</Text>
          <Text style={styles.subtitle}>
            Choose a voice, set the greeting script, and decide what your AI receptionist should ask every caller.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>1. Pick a voice</Text>
          {voiceOptions.map(option => {
            const isSelected = option.id === selectedVoice;
            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.voiceOption, isSelected && styles.voiceOptionSelected]}
                onPress={() => setSelectedVoice(option.id)}
                activeOpacity={0.8}
              >
                <View style={styles.voiceIconContainer}>
                  <FlynnIcon
                    name="mic"
                    size={22}
                    color={isSelected ? '#3B82F6' : '#94a3b8'}
                  />
                </View>
                <View style={styles.voiceContent}>
                  <Text style={styles.voiceTitle}>{option.label}</Text>
                  <Text style={styles.voiceDescription}>{option.description}</Text>
                </View>
                <View style={styles.voiceCheckContainer}>
                  <FlynnIcon
                    name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={24}
                    color={isSelected ? '#3B82F6' : '#cbd5e1'}
                  />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>2. Greeting script</Text>
            <TouchableOpacity
              onPress={() => setGreeting(defaultGreeting)}
              style={styles.resetButton}
            >
              <FlynnIcon name="refresh" size={16} color="#64748B" />
              <Text style={styles.resetButtonText}>Reset</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionHint}>
            This is the first thing callers hear. Keep it warm and let them know they are speaking with your digital assistant.
          </Text>
          <FlynnInput
            multiline
            numberOfLines={3}
            value={greeting}
            onChangeText={setGreeting}
            placeholder="Hey, thanks for reaching..."
            containerStyle={styles.greetingInput}
          />
        </View>

        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text style={styles.toggleTitle}>Let callers choose</Text>
              <Text style={styles.toggleSubtitle}>
                Offer callers the option to leave a voicemail or speak with the AI receptionist (all in the same voice).
              </Text>
            </View>
            <Switch
              value={offerChoice}
              onValueChange={setOfferChoice}
              thumbColor={offerChoice ? '#3B82F6' : '#f1f5f9'}
              trackColor={{ false: '#cbd5e1', true: '#93c5fd' }}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>3. Questions to capture</Text>
          <Text style={styles.sectionHint}>
            Flynn will confirm these details before handing the call back to you or creating an event.
          </Text>
          <View style={styles.questionList}>
            {questions.map(question => (
              <View key={question} style={styles.questionItem}>
                <FlynnIcon name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
                <Text style={styles.questionText}>{question}</Text>
                <TouchableOpacity onPress={() => handleRemoveQuestion(question)}>
                  <FlynnIcon name="close" size={18} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          <FlynnInput
            value={customQuestion}
            onChangeText={setCustomQuestion}
            placeholder="Add another question"
            returnKeyType="done"
          />
          <FlynnButton
            title="Add question"
            onPress={handleAddQuestion}
            variant="secondary"
            style={styles.addQuestionButton}
            disabled={!customQuestion.trim()}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Preview</Text>
          <Text style={styles.sectionHint}>See how your AI receptionist responds to callers.</Text>
          <View style={styles.previewContainer}>
            <View style={styles.previewAvatar}>
              <FlynnIcon name="mic-circle" size={28} color="#f97316" />
              <Text style={styles.previewAvatarLabel}>AI Voice</Text>
            </View>
            <View style={styles.previewBubble}>
              <Text style={styles.previewBubbleText} numberOfLines={3}>
                "{greeting}"
              </Text>
            </View>
          </View>
          <FlynnButton
            title={isPlayingSpeech ? "🔊 Playing..." : "Play test message"}
            onPress={handlePreviewCall}
            variant="primary"
            disabled={isPlayingSpeech}
          />
        </View>
      </ScrollView>

      <View style={styles.buttonRow}>
        <FlynnButton title="Skip for now" onPress={handleSkip} variant="secondary" disabled={isSaving} style={styles.skipButton} />
        <FlynnButton title={isSaving ? 'Saving…' : 'Finish'} onPress={handleComplete} variant="primary" disabled={isSaving} style={styles.finishButton} />
      </View>
    </SafeAreaView>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    marginBottom: spacing.md,
  },
  backButton: {
    padding: spacing.xs,
  },
  progressContainer: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  progressBar: {
    width: 56,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e2e8f0',
  },
  progressActive: {
    backgroundColor: colors.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.bodyLarge,
    color: '#475569',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
    color: '#0f172a',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: '#f1f5f9',
  },
  resetButtonText: {
    ...typography.caption,
    color: '#64748B',
    fontWeight: '500',
  },
  sectionHint: {
    ...typography.bodySmall,
    color: '#6b7280',
    marginBottom: spacing.md,
  },
  voiceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: spacing.sm,
    backgroundColor: '#fff',
  },
  voiceOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  voiceIconContainer: {
    marginRight: spacing.md,
  },
  voiceContent: {
    flex: 1,
  },
  voiceCheckContainer: {
    marginLeft: spacing.sm,
  },
  voiceTitle: {
    ...typography.bodyLarge,
    color: '#0f172a',
    fontWeight: '600',
  },
  voiceDescription: {
    ...typography.bodySmall,
    color: '#475569',
    marginTop: spacing.xxxs,
  },
  voiceBadge: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  customVoiceNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  customVoiceText: {
    ...typography.bodySmall,
    color: '#1d4ed8',
    flex: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  toggleCopy: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: spacing.xs,
  },
  toggleSubtitle: {
    fontSize: 13,
    color: '#475569',
  },
  greetingInput: {
    marginTop: spacing.sm,
  },
  questionList: {
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  questionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: '#f1f5f9',
  },
  questionText: {
    flex: 1,
    ...typography.bodyMedium,
    color: '#334155',
  },
  addQuestionButton: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  previewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  previewAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewAvatarLabel: {
    ...typography.caption,
    color: '#475569',
    marginTop: spacing.xxxs,
  },
  previewBubble: {
    flex: 1,
    backgroundColor: '#fff7ed',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  previewBubbleText: {
    ...typography.bodyMedium,
    color: '#9a3412',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
    width: '100%',
  },
  skipButton: {
    flex: 1,
  },
  finishButton: {
    flex: 1,
  },
});

export default ReceptionistSetupScreen;
