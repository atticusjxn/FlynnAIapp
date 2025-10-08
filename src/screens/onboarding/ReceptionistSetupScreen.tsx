import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { FlynnIcon } from '../../components/ui/FlynnIcon';
import { FlynnInput } from '../../components/ui/FlynnInput';
import { FlynnButton } from '../../components/ui/FlynnButton';
import { FlynnKeyboardAvoidingView, FlynnKeyboardAwareScrollView } from '../../components/ui';
import { useOnboarding } from '../../context/OnboardingContext';
import { spacing, typography, borderRadius } from '../../theme';
import ReceptionistService, { VoiceProfile } from '../../services/ReceptionistService';
import { useAuth } from '../../context/AuthContext';
import { buildDefaultGreeting } from '../../utils/greetingDefaults';
import {
  DEFAULT_FOLLOW_UP_QUESTIONS,
  DEFAULT_VOICE_ID,
  KOALA_ASSETS,
  VOICE_OPTIONS,
} from '../../data/receptionist';
import { RecordVoiceModal } from '../../components/receptionist/RecordVoiceModal';

interface ReceptionistSetupScreenProps {
  onComplete: () => void;
  onBack: () => void;
}

export const ReceptionistSetupScreen: React.FC<ReceptionistSetupScreenProps> = ({
  onComplete,
  onBack,
}) => {
  const { user } = useAuth();
  const { onboardingData, updateOnboardingData } = useOnboarding();
  const [selectedVoice, setSelectedVoice] = useState<string>(
    onboardingData.receptionistVoice || DEFAULT_VOICE_ID
  );
  const defaultGreeting = useMemo(() => buildDefaultGreeting(user), [user]);
  const [greeting, setGreeting] = useState(
    onboardingData.receptionistGreeting || defaultGreeting
  );
  const [customQuestion, setCustomQuestion] = useState('');
  const [questions, setQuestions] = useState<string[]>(
    onboardingData.receptionistQuestions && onboardingData.receptionistQuestions.length > 0
      ? onboardingData.receptionistQuestions
      : DEFAULT_FOLLOW_UP_QUESTIONS.map(question => question)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile | null>(null);
  const [loadingVoiceProfile, setLoadingVoiceProfile] = useState(false);
  const previewSoundRef = useRef<Audio.Sound | null>(null);
  const previewUriRef = useRef<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [koalaAnimationKey, setKoalaAnimationKey] = useState(0);
  const [recordModalVisible, setRecordModalVisible] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isUploadingSample, setIsUploadingSample] = useState(false);
  const voiceProfileId = onboardingData.receptionistVoiceProfileId ?? null;

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

  const loadVoiceProfile = useCallback(async (targetProfileId?: string | null) => {
    const nextProfileId = targetProfileId ?? voiceProfileId;

    if (!nextProfileId) {
      setVoiceProfile(null);
      return;
    }

    setLoadingVoiceProfile(true);
    try {
      const profile = await ReceptionistService.refreshVoiceProfile(nextProfileId);
      setVoiceProfile(profile);
    } catch (error) {
      console.error('[ReceptionistSetupScreen] Failed to refresh voice profile', error);
    } finally {
      setLoadingVoiceProfile(false);
    }
  }, [voiceProfileId]);

  useEffect(() => {
    if (voiceProfileId) {
      loadVoiceProfile();
    } else {
      setVoiceProfile(null);
    }
  }, [loadVoiceProfile, voiceProfileId]);

  useEffect(() => {
    return () => {
      if (previewSoundRef.current) {
        previewSoundRef.current.unloadAsync().catch(() => {});
        previewSoundRef.current = null;
      }
      if (previewUriRef.current) {
        FileSystem.deleteAsync(previewUriRef.current, { idempotent: true }).catch(() => {});
        previewUriRef.current = null;
      }
    };
  }, []);

  const canRecordOwnVoice = useMemo(() => selectedVoice === 'custom_voice', [selectedVoice]);

  const handleQuestionChange = useCallback((index: number, value: string) => {
    setQuestions(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const stopPreview = useCallback(async () => {
    const sound = previewSoundRef.current;
    if (sound) {
      try {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          await sound.stopAsync();
        }
      } catch (error) {
        console.warn('[ReceptionistSetupScreen] Failed to stop preview playback', error);
      } finally {
        sound.unloadAsync().catch(() => {});
        previewSoundRef.current = null;
      }
    }

    if (previewUriRef.current) {
      FileSystem.deleteAsync(previewUriRef.current, { idempotent: true }).catch(() => {});
      previewUriRef.current = null;
    }

    setIsPreviewPlaying(false);
    setIsPreviewLoading(false);
  }, []);

  const handleAddQuestion = () => {
    const trimmed = customQuestion.trim();
    if (!trimmed) {
      return;
    }
    setQuestions(prev => [...prev, trimmed]);
    setCustomQuestion('');
  };

  const handleRemoveQuestion = useCallback((index: number) => {
    setQuestions(prev => prev.filter((_, itemIndex) => itemIndex !== index));
  }, []);

  const handleStartRecording = useCallback(async () => {
    try {
      setRecordingDuration(0);
      setIsRecording(true);

      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setIsRecording(false);
        Alert.alert('Microphone permission', 'We need microphone access to capture your voice sample.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      });

      const recordingInstance = new Audio.Recording();
      recordingInstance.setOnRecordingStatusUpdate(status => {
        if (status?.isRecording) {
          setRecordingDuration(status.durationMillis ?? 0);
        }
      });

      await recordingInstance.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recordingInstance.startAsync();
      setRecording(recordingInstance);
    } catch (error) {
      console.error('[ReceptionistSetupScreen] Failed to start recording', error);
      setIsRecording(false);
      setRecording(null);
      Alert.alert('Recording failed', error instanceof Error ? error.message : 'Unable to start recording.');
    }
  }, []);

  const handleStopRecording = useCallback(async () => {
    const activeRecording = recording;
    if (!activeRecording) {
      setRecordModalVisible(false);
      setIsRecording(false);
      return;
    }

    try {
      await activeRecording.stopAndUnloadAsync();
      const uri = activeRecording.getURI();
      setRecording(null);
      setIsRecording(false);

      if (!uri) {
        throw new Error('Recording file unavailable.');
      }

      setIsUploadingSample(true);

      const profile = await ReceptionistService.createVoiceProfile(
        `Your voice ${new Date().toLocaleDateString()}`,
        uri
      );

      updateOnboardingData({ receptionistVoiceProfileId: profile.id, receptionistVoice: 'custom_voice' });
      setSelectedVoice('custom_voice');
      setVoiceProfile(profile);
      await loadVoiceProfile(profile.id);
      setRecordModalVisible(false);
      Alert.alert('Voice sample uploaded', 'We are cloning your voice. This usually takes a few minutes.');
    } catch (error) {
      console.error('[ReceptionistSetupScreen] Voice sample upload failed', error);
      Alert.alert('Upload failed', error instanceof Error ? error.message : 'Unable to upload voice sample.');
    } finally {
      setIsUploadingSample(false);
      setRecordingDuration(0);
      setRecording(null);
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
          interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
        });
      } catch (audioError) {
        console.warn('[ReceptionistSetupScreen] Failed to reset audio mode', audioError);
      }
    }
  }, [loadVoiceProfile, recording, updateOnboardingData]);

  const handleDismissRecordModal = useCallback(() => {
    if (isRecording || isUploadingSample) {
      return;
    }
    setRecordModalVisible(false);
    setRecording(null);
    setIsRecording(false);
    setRecordingDuration(0);
  }, [isRecording, isUploadingSample]);

  const handlePreviewCall = useCallback(async () => {
    if (isPreviewLoading) {
      return;
    }

    if (isPreviewPlaying) {
      await stopPreview();
      return;
    }

    const trimmedGreeting = greeting.trim();
    if (!trimmedGreeting) {
      Alert.alert('Greeting missing', 'Add a greeting script before playing a preview.');
      return;
    }

    if (selectedVoice === 'custom_voice') {
      if (!voiceProfileId && !voiceProfile?.id) {
        Alert.alert('Voice not ready', 'Record your custom voice before playing a preview.');
        return;
      }

      if (loadingVoiceProfile) {
        Alert.alert('Voice cloning', 'We are still checking on your voice clone. Try again in a moment.');
        return;
      }

      if (!voiceProfile || voiceProfile.status !== 'ready') {
        Alert.alert('Voice not ready', 'We are still cloning your voice. Refresh the status or record a new sample.');
        return;
      }
    }

    try {
      if (previewSoundRef.current) {
        await stopPreview();
      }

      setIsPreviewLoading(true);

      const preview = await ReceptionistService.previewGreeting(
        trimmedGreeting,
        selectedVoice,
        selectedVoice === 'custom_voice'
          ? (voiceProfile?.id ?? voiceProfileId ?? undefined)
          : undefined
      );

      if (previewUriRef.current) {
        await FileSystem.deleteAsync(previewUriRef.current, { idempotent: true }).catch(() => {});
        previewUriRef.current = null;
      }

      const extension = preview.contentType.includes('wav')
        ? 'wav'
        : preview.contentType.includes('ogg')
        ? 'ogg'
        : 'mp3';
      const base64Encoding = (FileSystem as any).EncodingType?.Base64 ?? 'base64';
      const fileUri = `${FileSystem.cacheDirectory}receptionist-preview-${Date.now()}.${extension}`;
      await FileSystem.writeAsStringAsync(fileUri, preview.audio, { encoding: base64Encoding });
      previewUriRef.current = fileUri;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      });

      const { sound } = await Audio.Sound.createAsync({ uri: fileUri });
      previewSoundRef.current = sound;
      setIsPreviewPlaying(true);
      setIsPreviewLoading(false);
      setKoalaAnimationKey(prev => prev + 1);

      sound.setOnPlaybackStatusUpdate(status => {
        if (!status.isLoaded) {
          if (status.error) {
            console.warn('[ReceptionistSetupScreen] Preview playback error', status.error);
          }
          return;
        }

        if (status.didJustFinish) {
          stopPreview().catch(() => {});
        }
      });

      await sound.playAsync();
    } catch (error) {
      console.error('[ReceptionistSetupScreen] Failed to play receptionist preview', error);
      Alert.alert(
        'Preview unavailable',
        error instanceof Error ? error.message : 'Unable to play the preview right now. Please try again.'
      );
      await stopPreview();
    } finally {
      setIsPreviewLoading(false);
    }
  }, [
    greeting,
    isPreviewLoading,
    isPreviewPlaying,
    loadingVoiceProfile,
    selectedVoice,
    stopPreview,
    voiceProfile,
    voiceProfileId,
  ]);

  const persistPreferences = async (configured: boolean) => {
    setIsSaving(true);
    try {
      const profileIdToPersist = configured ? (voiceProfile?.id ?? voiceProfileId ?? null) : null;

      await ReceptionistService.savePreferences({
        voiceId: configured ? selectedVoice : null,
        greeting: configured ? greeting : null,
        questions: configured ? questions : [],
        voiceProfileId: profileIdToPersist,
        configured,
      });
      updateOnboardingData({
        receptionistConfigured: configured,
        receptionistVoice: configured ? selectedVoice : null,
        receptionistGreeting: configured ? greeting : null,
        receptionistQuestions: configured ? questions : [],
        receptionistVoiceProfileId: profileIdToPersist,
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

  const customVoiceStatusLabel = useMemo(() => {
    if (isUploadingSample) {
      return 'Your Voice — Uploading';
    }

    if (!voiceProfileId) {
      return 'Record Your Own';
    }

    if (loadingVoiceProfile) {
      return 'Your Voice — Checking status…';
    }

    if (!voiceProfile) {
      return 'Your Voice — Pending';
    }

    switch (voiceProfile.status) {
      case 'ready':
        return 'Your Voice — Ready';
      case 'processing':
      case 'cloning':
        return 'Your Voice — Cloning';
      case 'uploaded':
        return 'Your Voice — Queued';
      case 'error':
        return 'Your Voice — Needs attention';
      default:
        return `Your Voice — ${voiceProfile.status}`;
    }
  }, [isUploadingSample, loadingVoiceProfile, voiceProfile, voiceProfileId]);

  const displayVoiceOptions = useMemo(
    () =>
      VOICE_OPTIONS.map(option =>
        option.id === 'custom_voice'
          ? {
              ...option,
              label: customVoiceStatusLabel,
            }
          : option
      ),
    [customVoiceStatusLabel]
  );

  const customVoiceStatusMessage = useMemo(() => {
    if (isUploadingSample) {
      return 'Uploading your sample. Hang tight while we send it to Flynn.';
    }

    if (!voiceProfileId) {
      return 'Record a short greeting so Flynn can match your voice tone on every call.';
    }

    if (loadingVoiceProfile) {
      return 'Checking on your voice clone… this usually takes under a minute.';
    }

    if (!voiceProfile) {
      return 'We saved your sample. Refresh to see the latest cloning status.';
    }

    switch (voiceProfile.status) {
      case 'ready':
        return 'Your voice is ready. Flynn will now greet callers using your tone.';
      case 'processing':
      case 'cloning':
        return 'We are cloning your voice right now. You will get a notification once it is ready.';
      case 'uploaded':
        return 'Sample received. We are submitting it for cloning.';
      case 'error':
        return 'The last clone attempt hit a snag. Record a new sample when you can.';
      default:
        return 'Voice status updated. Preview will be available once cloning is complete.';
    }
  }, [isUploadingSample, loadingVoiceProfile, voiceProfile, voiceProfileId]);

  const disableVoiceActions = isRecording || isUploadingSample;

  const isKoalaActive = isPreviewPlaying || isPreviewLoading;

  return (
    <SafeAreaView style={styles.container}>
      <FlynnKeyboardAvoidingView
        contentContainerStyle={styles.keyboardContent}
        dismissOnTapOutside
      >
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

        <FlynnKeyboardAwareScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
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
          {displayVoiceOptions.map(option => {
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
                  {option.description ? (
                    <Text style={styles.voiceDescription}>{option.description}</Text>
                  ) : null}
                </View>
                {option.tag ? <Text style={styles.voiceBadge}>{option.tag}</Text> : null}
              </TouchableOpacity>
            );
          })}

          {canRecordOwnVoice && (
            <View style={styles.customVoiceNotice}>
              <View style={styles.customVoiceIconWrapper}>
                <FlynnIcon name="mic" size={22} color="#1d4ed8" />
              </View>
              <View style={styles.customVoiceContent}>
                <Text style={styles.customVoiceTitle}>Clone your voice</Text>
                <Text style={styles.customVoiceText}>{customVoiceStatusMessage}</Text>
                <View style={styles.customVoiceActions}>
                  <FlynnButton
                    title={voiceProfileId ? 'Record new sample' : 'Record sample'}
                    variant="secondary"
                    size="small"
                    onPress={() => setRecordModalVisible(true)}
                    disabled={disableVoiceActions}
                    loading={disableVoiceActions}
                  />
                  {voiceProfileId ? (
                    <TouchableOpacity
                      onPress={() => loadVoiceProfile()}
                      disabled={loadingVoiceProfile || disableVoiceActions}
                      style={styles.customVoiceRefreshButton}
                    >
                      <Text style={styles.customVoiceRefreshText}>
                        {loadingVoiceProfile ? 'Refreshing…' : 'Refresh status'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
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
            {questions.map((question, index) => {
              const disableRemoval = questions.length === 1;
              return (
                <FlynnInput
                  key={`question-${index}`}
                  value={question}
                  onChangeText={text => handleQuestionChange(index, text)}
                  placeholder={`Question ${index + 1}`}
                  multiline
                  numberOfLines={2}
                  leftIcon={<FlynnIcon name="chatbubble-ellipses-outline" size={18} color="#3B82F6" />}
                  rightIcon={
                    <TouchableOpacity
                      onPress={() => handleRemoveQuestion(index)}
                      disabled={disableRemoval}
                      style={styles.questionRemoveButton}
                    >
                      <FlynnIcon
                        name="close"
                        size={18}
                        color={disableRemoval ? '#cbd5f5' : '#94a3b8'}
                      />
                    </TouchableOpacity>
                  }
                  containerStyle={styles.questionInputContainer}
                  inputStyle={styles.questionInput}
                  returnKeyType="done"
                />
              );
            })}
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
              <Image
                key={isKoalaActive ? `koala-preview-${koalaAnimationKey}` : 'koala-static' }
                source={isKoalaActive ? KOALA_ASSETS.animation : KOALA_ASSETS.static}
                style={styles.previewKoalaImage}
                resizeMode="contain"
              />
            </View>
            <View style={styles.previewBubble}>
              <Text style={styles.previewBubbleText} numberOfLines={3}>
                “{greeting}”
              </Text>
            </View>
          </View>
          <FlynnButton
            title={isPreviewPlaying ? 'Stop preview' : 'Play test message'}
            onPress={handlePreviewCall}
            variant="primary"
            loading={isPreviewLoading}
          />
        </View>
        </FlynnKeyboardAwareScrollView>

        <View style={styles.buttonRow}>
          <FlynnButton title="Skip for now" onPress={handleSkip} variant="secondary" disabled={isSaving} />
          <FlynnButton title={isSaving ? 'Saving…' : 'Finish onboarding'} onPress={handleComplete} variant="primary" disabled={isSaving} />
        </View>

        <RecordVoiceModal
          visible={recordModalVisible}
          isRecording={isRecording}
          durationMillis={recordingDuration}
          uploading={isUploadingSample}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          onDismiss={handleDismissRecordModal}
        />
      </FlynnKeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  keyboardContent: {
    flex: 1,
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
  scrollContent: {
    paddingBottom: spacing.xxl,
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
    gap: spacing.md,
    backgroundColor: '#e0f2fe',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  customVoiceIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#c7d2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customVoiceContent: {
    flex: 1,
    gap: spacing.xs,
  },
  customVoiceTitle: {
    ...typography.bodyMedium,
    color: '#1d4ed8',
    fontWeight: '600',
  },
  customVoiceText: {
    ...typography.bodySmall,
    color: '#1d4ed8',
  },
  customVoiceActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  customVoiceRefreshButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  customVoiceRefreshText: {
    ...typography.bodySmall,
    color: '#1d4ed8',
    fontWeight: '600',
  },
  greetingInput: {
    marginTop: spacing.sm,
  },
  questionList: {
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  questionInputContainer: {
    marginBottom: 0,
  },
  questionInput: {
    minHeight: 52,
  },
  questionRemoveButton: {
    padding: spacing.xs,
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
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  previewKoalaImage: {
    width: 52,
    height: 52,
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
