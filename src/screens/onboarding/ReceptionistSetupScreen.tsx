import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { FlynnIcon } from '../../components/ui/FlynnIcon';
import { FlynnInput } from '../../components/ui/FlynnInput';
import { FlynnButton } from '../../components/ui/FlynnButton';
import { useOnboarding } from '../../context/OnboardingContext';
import { spacing, typography, borderRadius } from '../../theme';
import ReceptionistService from '../../services/ReceptionistService';
import { useAuth } from '../../context/AuthContext';
import { buildDefaultGreeting } from '../../utils/greetingDefaults';

interface ReceptionistSetupScreenProps {
  onComplete: () => void;
  onBack: () => void;
}

const voiceOptions = [
  { id: 'koala_warm', label: 'Avery — Warm & Friendly', description: 'Balanced tone ideal for inbound service calls.' },
  { id: 'koala_expert', label: 'Sloane — Expert Concierge', description: 'Calm, confident delivery for premium services.' },
  { id: 'koala_hype', label: 'Maya — High Energy', description: 'Upbeat tone that keeps callers engaged.' },
  { id: 'custom_voice', label: 'Record Your Own', description: 'Clone your voice so it sounds like you answering.' },
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
  const { user } = useAuth();
  const { onboardingData, updateOnboardingData } = useOnboarding();
  const [selectedVoice, setSelectedVoice] = useState<string>(
    onboardingData.receptionistVoice || voiceOptions[0].id
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
  const [isSaving, setIsSaving] = useState(false);

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

  const canRecordOwnVoice = useMemo(() => selectedVoice === 'custom_voice', [selectedVoice]);

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

  const handlePreviewCall = () => {
    Alert.alert(
      'Preview call',
      `${voiceOptions.find(v => v.id === selectedVoice)?.label || 'Selected voice'} will say:\n\n"${greeting}"` +
        (questions.length ? `\n\nFollow up with:\n• ${questions.join('\n• ')}` : ''),
      [{ text: 'Sounds good!' }]
    );
  };

  const persistPreferences = async (configured: boolean) => {
    setIsSaving(true);
    try {
      await ReceptionistService.savePreferences({
        voiceId: configured ? selectedVoice : null,
        greeting: configured ? greeting : null,
        questions: configured ? questions : [],
        voiceProfileId: onboardingData.receptionistVoiceProfileId ?? null,
        configured,
      });
      updateOnboardingData({
        receptionistConfigured: configured,
        receptionistVoice: configured ? selectedVoice : null,
        receptionistGreeting: configured ? greeting : null,
        receptionistQuestions: configured ? questions : [],
      });
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <FlynnIcon name="arrow-back" size={24} color="#3B82F6" />
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
            <FlynnIcon name="sparkles" size={32} color="#3B82F6" />
          </View>
          <Text style={styles.title}>Tune your AI receptionist</Text>
          <Text style={styles.subtitle}>
            Choose a voice, set the greeting script, and decide what your koala concierge should ask every caller.
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
                    name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={isSelected ? '#3B82F6' : '#94a3b8'}
                  />
                </View>
                <View style={styles.voiceContent}>
                  <Text style={styles.voiceTitle}>{option.label}</Text>
                  <Text style={styles.voiceDescription}>{option.description}</Text>
                </View>
                {option.id === 'koala_warm' && (
                  <Text style={styles.voiceBadge}>Popular</Text>
                )}
              </TouchableOpacity>
            );
          })}

          {canRecordOwnVoice && (
            <View style={styles.customVoiceNotice}>
              <FlynnIcon name="mic" size={20} color="#3B82F6" />
              <Text style={styles.customVoiceText}>
                We will guide you through a quick recording after onboarding so Flynn can mimic your tone perfectly.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>2. Greeting script</Text>
          <Text style={styles.sectionHint}>
            This is the first thing callers hear. Keep it warm and let them know they are speaking with your digital assistant.
          </Text>
          <FlynnInput
            multiline
            numberOfLines={3}
            value={greeting}
            onChangeText={setGreeting}
            placeholder="Hi, you have reached..."
            containerStyle={styles.greetingInput}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>3. Questions to capture</Text>
          <Text style={styles.sectionHint}>
            Flynn will confirm these details before handing the call back to you or creating an event.
          </Text>
          <View style={styles.questionList}>
            {questions.map(question => (
              <View key={question} style={styles.questionItem}>
                <FlynnIcon name="chatbubble-ellipses-outline" size={18} color="#3B82F6" />
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
          <Text style={styles.sectionHint}>See how your koala concierge responds to callers.</Text>
          <View style={styles.previewContainer}>
            <View style={styles.previewAvatar}>
              <FlynnIcon name="paw" size={28} color="#f97316" />
              <Text style={styles.previewAvatarLabel}>Koala</Text>
            </View>
            <View style={styles.previewBubble}>
              <Text style={styles.previewBubbleText} numberOfLines={3}>
                “{greeting}”
              </Text>
            </View>
          </View>
          <FlynnButton title="Play test message" onPress={handlePreviewCall} variant="primary" />
        </View>
      </ScrollView>

      <View style={styles.buttonRow}>
        <FlynnButton title="Skip for now" onPress={handleSkip} variant="secondary" disabled={isSaving} />
        <FlynnButton title={isSaving ? 'Saving…' : 'Finish onboarding'} onPress={handleComplete} variant="primary" disabled={isSaving} />
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
    backgroundColor: '#3B82F6',
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
    backgroundColor: '#e0f2fe',
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
  sectionTitle: {
    ...typography.h3,
    color: '#0f172a',
    marginBottom: spacing.sm,
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
    borderColor: '#3B82F6',
    backgroundColor: '#eff6ff',
  },
  voiceIconContainer: {
    marginRight: spacing.md,
  },
  voiceContent: {
    flex: 1,
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
    color: '#3B82F6',
    fontWeight: '600',
  },
  customVoiceNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: '#e0f2fe',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  customVoiceText: {
    ...typography.bodySmall,
    color: '#1d4ed8',
    flex: 1,
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
    gap: spacing.md,
  },
});

export default ReceptionistSetupScreen;
