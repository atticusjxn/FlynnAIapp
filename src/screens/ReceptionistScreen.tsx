import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Switch,
  ActivityIndicator,
  Image,
  Animated,
} from 'react-native';
import { FlynnIcon } from '../components/ui/FlynnIcon';
import { useOnboarding } from '../context/OnboardingContext';
import { useAuth } from '../context/AuthContext';
import { buildDefaultGreeting } from '../utils/greetingDefaults';
import { FlynnInput } from '../components/ui/FlynnInput';
import { FlynnButton } from '../components/ui/FlynnButton';
import { spacing, typography, borderRadius } from '../theme';
import ReceptionistService, { VoiceProfile } from '../services/ReceptionistService';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import {
  FlynnKeyboardAwareScrollView,
  FlynnKeyboardAvoidingView,
} from '../components/ui';
import {
  DEFAULT_FOLLOW_UP_QUESTIONS,
  DEFAULT_VOICE_ID,
  FOLLOW_UP_TEMPLATES,
  KOALA_ASSETS,
  VOICE_OPTIONS,
  matchTemplateId,
} from '../data/receptionist';
import { RecordVoiceModal } from '../components/receptionist/RecordVoiceModal';
import { BusinessContextCard } from '../components/receptionist/BusinessContextCard';

const KOALA_LOOP_DURATION_MS = 3000;

export const ReceptionistScreen: React.FC = () => {
  const { user } = useAuth();
  const { onboardingData, updateOnboardingData } = useOnboarding();
  const [selectedVoice, setSelectedVoice] = useState<string>(
    onboardingData.receptionistVoice || DEFAULT_VOICE_ID
  );
  const defaultGreeting = useMemo(() => buildDefaultGreeting(user), [user]);

  const [greeting, setGreeting] = useState(onboardingData.receptionistGreeting || defaultGreeting);
  const [followUpQuestions, setFollowUpQuestions] = useState<string[]>(() => {
    const existing = onboardingData.receptionistQuestions;
    const source = existing && existing.length > 0 ? existing : DEFAULT_FOLLOW_UP_QUESTIONS;
    return source.map(question => question);
  });
  const [activeTemplateId, setActiveTemplateId] = useState<string>(() => {
    const existing = onboardingData.receptionistQuestions;
    const source = existing && existing.length > 0 ? existing : DEFAULT_FOLLOW_UP_QUESTIONS;
    return matchTemplateId(source);
  });
  const [callRecordingEnabled, setCallRecordingEnabled] = useState(true);
  const [autoSummaryEnabled, setAutoSummaryEnabled] = useState(true);
  const [voiceProfiles, setVoiceProfiles] = useState<VoiceProfile[]>([]);
  const [activeVoiceProfileId, setActiveVoiceProfileId] = useState<string | null>(
    onboardingData.receptionistVoiceProfileId || null
  );
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [recordModalVisible, setRecordModalVisible] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isUploadingSample, setIsUploadingSample] = useState(false);
  const [isKoalaTalking, setIsKoalaTalking] = useState(false);
  const [koalaAnimationKey, setKoalaAnimationKey] = useState(0);
  const previewSoundRef = useRef<Audio.Sound | null>(null);
  const previewUriRef = useRef<string | null>(null);
  const [isGreetingPreviewLoading, setIsGreetingPreviewLoading] = useState(false);
  const [isGreetingPreviewPlaying, setIsGreetingPreviewPlaying] = useState(false);
  const [questionPreviewLoadingIndex, setQuestionPreviewLoadingIndex] = useState<number | null>(null);
  const [questionPreviewPlayingIndex, setQuestionPreviewPlayingIndex] = useState<number | null>(null);
  const [toastState, setToastState] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const koalaLoopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const koalaScale = useRef(new Animated.Value(1)).current;
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    refreshVoiceProfiles();
  }, []);

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
      if (koalaLoopTimerRef.current) {
        clearTimeout(koalaLoopTimerRef.current);
        koalaLoopTimerRef.current = null;
      }
      koalaScale.stopAnimation(() => {
        koalaScale.setValue(1);
      });
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, [koalaScale]);

  useEffect(() => {
    if (onboardingData.receptionistVoice) {
      setSelectedVoice(onboardingData.receptionistVoice);
    }
    if (onboardingData.receptionistGreeting) {
      setGreeting(onboardingData.receptionistGreeting);
    } else {
      setGreeting(defaultGreeting);
    }
    if (onboardingData.receptionistQuestions && onboardingData.receptionistQuestions.length > 0) {
      setFollowUpQuestions(onboardingData.receptionistQuestions.map(question => question));
      setActiveTemplateId(matchTemplateId(onboardingData.receptionistQuestions));
    }
    if (onboardingData.receptionistVoiceProfileId) {
      setActiveVoiceProfileId(onboardingData.receptionistVoiceProfileId);
    }
  }, [
    defaultGreeting,
    onboardingData.receptionistVoice,
    onboardingData.receptionistGreeting,
    onboardingData.receptionistQuestions,
    onboardingData.receptionistVoiceProfileId,
  ]);

  const refreshVoiceProfiles = useCallback(async () => {
    setLoadingProfiles(true);
    try {
      const profiles = await ReceptionistService.listVoiceProfiles();
      setVoiceProfiles(profiles);
    } catch (error) {
      console.error('[ReceptionistScreen] Failed to load voice profiles', error);
      Alert.alert('Voice profiles', error instanceof Error ? error.message : 'Unable to load voice profiles right now.');
    } finally {
      setLoadingProfiles(false);
    }
  }, []);

  const customVoiceProfile = useMemo(() => {
    if (!activeVoiceProfileId) {
      return null;
    }
    return voiceProfiles.find(profile => profile.id === activeVoiceProfileId) || null;
  }, [activeVoiceProfileId, voiceProfiles]);

  const customVoiceStatusLabel = useMemo(() => {
    if (!customVoiceProfile) {
      return 'Recorded Voice (setup required)';
    }

    switch (customVoiceProfile.status) {
      case 'ready':
        return 'Your Voice — Ready';
      case 'cloning':
      case 'processing':
        return 'Your Voice — Cloning in progress';
      case 'uploaded':
        return 'Your Voice — Waiting to clone';
      case 'error':
        return 'Your Voice — Clone failed (retry)';
      default:
        return `Your Voice — ${customVoiceProfile.status}`;
    }
  }, [customVoiceProfile]);

  const baseVoiceOptions = useMemo(
    () => VOICE_OPTIONS.filter(option => option.id !== 'custom_voice'),
    []
  );

  const customVoiceDefinition = useMemo(
    () => VOICE_OPTIONS.find(option => option.id === 'custom_voice'),
    []
  );

  const voiceOptions = useMemo(() => {
    const customOption = customVoiceDefinition
      ? { ...customVoiceDefinition, label: customVoiceStatusLabel }
      : { id: 'custom_voice', label: customVoiceStatusLabel };

    return [...baseVoiceOptions, customOption];
  }, [baseVoiceOptions, customVoiceDefinition, customVoiceStatusLabel]);

  const handleQuestionChange = useCallback((index: number, value: string) => {
    setFollowUpQuestions(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    setActiveTemplateId('custom');
  }, []);

  const handleRemoveQuestion = useCallback((index: number) => {
    setFollowUpQuestions(prev => prev.filter((_, questionIndex) => questionIndex !== index));
    setActiveTemplateId('custom');
  }, []);

  const handleAddQuestion = useCallback(() => {
    setFollowUpQuestions(prev => [...prev, '']);
    setActiveTemplateId('custom');
  }, []);

  const handleApplyTemplate = useCallback(
    (templateId: string) => {
      const template = FOLLOW_UP_TEMPLATES.find(option => option.id === templateId);
      if (!template) {
        return;
      }

      const templateQuestions = template.questions.map(question => question);
      const cleanedCurrent = followUpQuestions.map(question => question.trim()).filter(Boolean);
      const differs =
        cleanedCurrent.length !== templateQuestions.length ||
        cleanedCurrent.some((question, index) => question !== templateQuestions[index]);

      if (differs && cleanedCurrent.length > 0) {
        Alert.alert(
          'Replace follow-up questions?',
          'Applying this template will replace the questions you have customised.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Use template',
              style: 'destructive',
              onPress: () => {
                setFollowUpQuestions(templateQuestions);
                setActiveTemplateId(templateId);
              },
            },
          ]
        );
        return;
      }

      setFollowUpQuestions(templateQuestions);
      setActiveTemplateId(templateId);
    },
    [followUpQuestions]
  );

  const showToast = useCallback((message: string, tone: 'success' | 'error') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }

    setToastState({ message, tone });

    toastTimerRef.current = setTimeout(() => {
      setToastState(null);
      toastTimerRef.current = null;
    }, 4000);
  }, []);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const questions = followUpQuestions.map(question => question.trim()).filter(Boolean);
      const voiceProfileId = selectedVoice === 'custom_voice' ? activeVoiceProfileId : null;

      await ReceptionistService.savePreferences({
        voiceId: selectedVoice,
        greeting,
        questions,
        voiceProfileId,
        configured: true,
      });

      updateOnboardingData({
        receptionistConfigured: true,
        receptionistVoice: selectedVoice,
        receptionistGreeting: greeting,
        receptionistQuestions: questions,
        receptionistVoiceProfileId: voiceProfileId,
      });
      showToast('Receptionist settings saved. Flynn will use the new script on the next call.', 'success');
    } catch (error) {
      console.error('[ReceptionistScreen] Failed to save receptionist profile', error);
      showToast(
        error instanceof Error ? error.message : 'Unable to save receptionist settings right now.',
        'error'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const clearKoalaLoopTimer = useCallback(() => {
    if (koalaLoopTimerRef.current) {
      clearTimeout(koalaLoopTimerRef.current);
      koalaLoopTimerRef.current = null;
    }
  }, []);

  const animateKoalaScale = useCallback(
    (toValue: number) => {
      Animated.timing(koalaScale, {
        toValue,
        duration: 250,
        useNativeDriver: true,
      }).start();
    },
    [koalaScale]
  );

  const stopKoalaAnimation = useCallback(() => {
    clearKoalaLoopTimer();
    setIsKoalaTalking(false);
    animateKoalaScale(1);
  }, [animateKoalaScale, clearKoalaLoopTimer]);

  const startKoalaAnimationLoop = useCallback(
    (durationMillis?: number) => {
      clearKoalaLoopTimer();
      const loops = durationMillis
        ? Math.max(1, Math.round(durationMillis / KOALA_LOOP_DURATION_MS))
        : 1;

      if (!loops) {
        setIsKoalaTalking(false);
        return;
      }

      let remaining = loops;
      setIsKoalaTalking(true);
      setKoalaAnimationKey(prev => prev + 1);
      animateKoalaScale(1.35);

      const scheduleNext = () => {
        remaining -= 1;
        if (remaining <= 0) {
          koalaLoopTimerRef.current = null;
          return;
        }

        setKoalaAnimationKey(prev => prev + 1);
        koalaLoopTimerRef.current = setTimeout(scheduleNext, KOALA_LOOP_DURATION_MS);
      };

      koalaLoopTimerRef.current = setTimeout(scheduleNext, KOALA_LOOP_DURATION_MS);
    },
    [animateKoalaScale, clearKoalaLoopTimer]
  );

  const stopPreview = useCallback(async () => {
    const sound = previewSoundRef.current;
    if (!sound) {
      return;
    }

    try {
      const status = await sound.getStatusAsync();
      if (status.isLoaded) {
        await sound.stopAsync();
      }
    } catch (error) {
      console.warn('[ReceptionistScreen] Failed to stop preview', error);
    } finally {
      sound.unloadAsync().catch(() => {});
      previewSoundRef.current = null;
      if (previewUriRef.current) {
        FileSystem.deleteAsync(previewUriRef.current, { idempotent: true }).catch(() => {});
        previewUriRef.current = null;
      }
      stopKoalaAnimation();
      setIsGreetingPreviewPlaying(false);
      setIsGreetingPreviewLoading(false);
      setQuestionPreviewPlayingIndex(null);
      setQuestionPreviewLoadingIndex(null);
    }
  }, [stopKoalaAnimation]);

  const handlePlayGreeting = useCallback(async () => {
    if (isGreetingPreviewLoading) {
      return;
    }

    if (isGreetingPreviewPlaying) {
      await stopPreview();
      return;
    }

    const trimmedGreeting = greeting.trim();
    if (!trimmedGreeting) {
      Alert.alert('Greeting missing', 'Add a greeting script before playing a preview.');
      return;
    }

    const voiceProfileId = selectedVoice === 'custom_voice'
      ? (customVoiceProfile?.id ?? activeVoiceProfileId ?? undefined)
      : undefined;

    if (selectedVoice === 'custom_voice' && customVoiceProfile?.status !== 'ready') {
      Alert.alert('Voice not ready', 'Finish cloning your custom voice before playing a preview.');
      return;
    }

    setIsGreetingPreviewLoading(true);
    setQuestionPreviewPlayingIndex(null);
    setQuestionPreviewLoadingIndex(null);

    try {
      if (previewSoundRef.current) {
        await stopPreview();
      }

      const preview = await ReceptionistService.previewGreeting(trimmedGreeting, selectedVoice, voiceProfileId);

      if (previewUriRef.current) {
        await FileSystem.deleteAsync(previewUriRef.current, { idempotent: true }).catch(() => {});
        previewUriRef.current = null;
      }

      const extension = preview.contentType.includes('wav') ? 'wav' : preview.contentType.includes('ogg') ? 'ogg' : 'mp3';
      const base64Encoding = (FileSystem as any).EncodingType?.Base64 ?? 'base64';
      const fileUri = `${FileSystem.cacheDirectory}receptionist-preview-${Date.now()}.${extension}`;
      await FileSystem.writeAsStringAsync(fileUri, preview.audio, { encoding: base64Encoding });
      previewUriRef.current = fileUri;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      });

      const { sound } = await Audio.Sound.createAsync({ uri: fileUri });
      previewSoundRef.current = sound;
      setIsGreetingPreviewPlaying(true);
      setIsGreetingPreviewLoading(false);

      const playbackStatus = await sound.getStatusAsync();
      const durationMillis = playbackStatus.isLoaded ? playbackStatus.durationMillis ?? undefined : undefined;
      startKoalaAnimationLoop(durationMillis);

      sound.setOnPlaybackStatusUpdate(status => {
        if (!status.isLoaded) {
          if (status.error) {
            console.warn('[ReceptionistScreen] Preview playback error', status.error);
          }
          return;
        }

        if (status.didJustFinish) {
          stopPreview().catch(() => {});
        }
      });

      await sound.playAsync();
    } catch (error) {
      console.error('[ReceptionistScreen] Failed to play greeting preview', error);
      stopPreview().catch(() => {});
      Alert.alert('Preview failed', error instanceof Error ? error.message : 'Unable to play the greeting right now.');
      setIsKoalaTalking(false);
      setIsGreetingPreviewPlaying(false);
    } finally {
      setIsGreetingPreviewLoading(false);
    }
  }, [
    activeVoiceProfileId,
    customVoiceProfile,
    greeting,
    isGreetingPreviewLoading,
    isGreetingPreviewPlaying,
    selectedVoice,
    stopPreview,
    startKoalaAnimationLoop,
  ]);

  const handlePlayQuestion = useCallback(async (index: number) => {
    const questionText = followUpQuestions[index]?.trim();

    if (questionPreviewLoadingIndex !== null) {
      return;
    }

    if (!questionText) {
      Alert.alert('Question missing', 'Add text to this question before playing a preview.');
      return;
    }

    if (questionPreviewPlayingIndex === index) {
      await stopPreview();
      return;
    }

    setIsGreetingPreviewPlaying(false);
    setQuestionPreviewLoadingIndex(index);

    const voiceProfileId = selectedVoice === 'custom_voice'
      ? (customVoiceProfile?.id ?? activeVoiceProfileId ?? undefined)
      : undefined;

    if (selectedVoice === 'custom_voice' && customVoiceProfile?.status !== 'ready') {
      Alert.alert('Voice not ready', 'Finish cloning your custom voice before playing a preview.');
      setQuestionPreviewLoadingIndex(null);
      return;
    }

    try {
      if (previewSoundRef.current) {
        await stopPreview();
      }

      setQuestionPreviewLoadingIndex(index);

      const preview = await ReceptionistService.previewGreeting(questionText, selectedVoice, voiceProfileId);

      if (previewUriRef.current) {
        await FileSystem.deleteAsync(previewUriRef.current, { idempotent: true }).catch(() => {});
        previewUriRef.current = null;
      }

      const extension = preview.contentType.includes('wav') ? 'wav' : preview.contentType.includes('ogg') ? 'ogg' : 'mp3';
      const base64Encoding = (FileSystem as any).EncodingType?.Base64 ?? 'base64';
      const fileUri = `${FileSystem.cacheDirectory}receptionist-question-${index}-${Date.now()}.${extension}`;
      await FileSystem.writeAsStringAsync(fileUri, preview.audio, { encoding: base64Encoding });
      previewUriRef.current = fileUri;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      });

      const { sound } = await Audio.Sound.createAsync({ uri: fileUri });
      previewSoundRef.current = sound;
      setQuestionPreviewPlayingIndex(index);
      setQuestionPreviewLoadingIndex(null);

      const playbackStatus = await sound.getStatusAsync();
      const durationMillis = playbackStatus.isLoaded ? playbackStatus.durationMillis ?? undefined : undefined;
      startKoalaAnimationLoop(durationMillis);

      sound.setOnPlaybackStatusUpdate(status => {
        if (!status.isLoaded) {
          if (status.error) {
            console.warn('[ReceptionistScreen] Question preview playback error', status.error);
          }
          return;
        }

        if (status.didJustFinish) {
          stopPreview().catch(() => {});
        }
      });

      await sound.playAsync();
    } catch (error) {
      console.error('[ReceptionistScreen] Failed to play question preview', error);
      stopPreview().catch(() => {});
      Alert.alert('Preview failed', error instanceof Error ? error.message : 'Unable to play this question right now.');
      setIsKoalaTalking(false);
    } finally {
      setQuestionPreviewLoadingIndex(prev => (prev === index ? null : prev));
    }
  }, [
    activeVoiceProfileId,
    customVoiceProfile,
    followUpQuestions,
    questionPreviewLoadingIndex,
    questionPreviewPlayingIndex,
    selectedVoice,
    startKoalaAnimationLoop,
    stopPreview,
  ]);

  return (
    <FlynnKeyboardAvoidingView style={styles.screen} dismissOnTapOutside>
      <FlynnKeyboardAwareScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <View style={styles.heroCard}>
          <Animated.View style={[styles.heroAvatar, { transform: [{ scale: koalaScale }] }]}>
            <Image
              key={isKoalaTalking ? `koala-${koalaAnimationKey}` : 'koala-static'}
              source={isKoalaTalking ? KOALA_ASSETS.animation : KOALA_ASSETS.static}
              style={styles.heroAvatarImage}
              resizeMode="contain"
            />
          </Animated.View>
          <View style={styles.heroTextWrapper}>
            <Text style={styles.heroTitle}>Koala Concierge</Text>
            <Text style={styles.heroSubtitle}>
              Manage the voice, behaviour, and scripts your AI receptionist uses on every call.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.previewButton}
            onPress={handlePlayGreeting}
            activeOpacity={0.85}
            disabled={isGreetingPreviewLoading}
          >
            {isGreetingPreviewLoading ? (
              <ActivityIndicator color="#2563eb" size="small" />
            ) : (
              <View style={styles.previewButtonContent}>
                <FlynnIcon
                  name={isGreetingPreviewPlaying ? 'pause-circle' : 'play-circle'}
                  size={22}
                  color="#2563eb"
                />
                <Text style={styles.previewButtonLabel}>
                  {isGreetingPreviewPlaying ? 'Stop' : 'Play greeting'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Voice profile</Text>
        <Text style={styles.cardHint}>Choose who callers hear when Flynn answers.</Text>
        {voiceOptions.map(option => {
          const isSelected = option.id === selectedVoice;
          return (
            <TouchableOpacity
              key={option.id}
              style={[styles.listItem, isSelected && styles.listItemSelected]}
              onPress={() => setSelectedVoice(option.id)}
              activeOpacity={0.85}
            >
              <Text style={styles.listItemLabel}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
        {selectedVoice === 'custom_voice' && (
          <View style={styles.noticeBanner}>
            <FlynnIcon name="mic" size={18} color="#1d4ed8" style={styles.noticeIcon} />
            <Text style={styles.noticeText}>
              Upload 60 seconds of clean audio so Flynn can clone your voice. We guide you through the script when you tap “Record now”.
            </Text>
            <FlynnButton
              title={isUploadingSample ? 'Uploading…' : 'Record now'}
              onPress={() => setRecordModalVisible(true)}
              variant="secondary"
              disabled={isUploadingSample}
            />
            {customVoiceProfile && (
              <View style={styles.profileStatusRow}>
                <FlynnIcon name={customVoiceProfile.status === 'ready' ? 'checkmark-circle' : 'time'} size={16} color={customVoiceProfile.status === 'ready' ? '#10B981' : '#2563eb'} />
                <Text style={styles.profileStatusText}>
                  {customVoiceProfile.status === 'ready'
                    ? 'Ready for calls'
                    : customVoiceProfile.status === 'error'
                      ? 'Clone failed — record a new sample'
                      : customVoiceProfile.status === 'cloning'
                        ? 'Cloning in progress'
                        : 'Awaiting cloning'}
                </Text>
                <TouchableOpacity onPress={refreshVoiceProfiles} disabled={loadingProfiles}>
                  <Text style={styles.refreshLink}>{loadingProfiles ? 'Refreshing…' : 'Refresh'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Greeting script</Text>
        <Text style={styles.cardHint}>Set the opening line and tone for every caller.</Text>
        <FlynnInput
          multiline
          numberOfLines={3}
          value={greeting}
          onChangeText={setGreeting}
          placeholder="Hello! You've reached ..."
        />
      </View>

      <BusinessContextCard />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Conversation flow</Text>
        <Text style={styles.cardHint}>
          Choose a template and tailor the follow-up questions Flynn uses to capture event details.
        </Text>

        <Text style={styles.sectionLabel}>Start from a template</Text>
        <View style={styles.templateList}>
          {FOLLOW_UP_TEMPLATES.map(template => {
            const isSelected = activeTemplateId === template.id;
            return (
              <TouchableOpacity
                key={template.id}
                style={[styles.templateChip, isSelected && styles.templateChipSelected]}
                onPress={() => handleApplyTemplate(template.id)}
                activeOpacity={0.85}
              >
                <Text style={[styles.templateChipLabel, isSelected && styles.templateChipLabelSelected]}>
                  {template.label}
                </Text>
                <Text
                  style={[styles.templateChipDescription, isSelected && styles.templateChipDescriptionSelected]}
                >
                  {template.description}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>Customise the questions</Text>
        {followUpQuestions.map((question, index) => {
          const canRemove = followUpQuestions.length > 1;
          return (
            <View key={`question-${index}`} style={styles.questionRow}>
              <FlynnInput
                multiline
                numberOfLines={2}
                value={question}
                onChangeText={value => handleQuestionChange(index, value)}
                placeholder={`Follow-up question ${index + 1}`}
                containerStyle={styles.questionInputContainer}
              />
              <View style={styles.questionActions}>
                <TouchableOpacity
                  onPress={() => handlePlayQuestion(index)}
                  style={styles.questionActionButton}
                  activeOpacity={0.7}
                  disabled={questionPreviewLoadingIndex !== null && questionPreviewLoadingIndex !== index}
                >
                  {questionPreviewLoadingIndex === index ? (
                    <ActivityIndicator size="small" color="#2563eb" />
                  ) : (
                    <FlynnIcon
                      name={questionPreviewPlayingIndex === index ? 'pause-circle' : 'play-circle'}
                      size={22}
                      color="#2563eb"
                    />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleRemoveQuestion(index)}
                  style={[styles.removeQuestionButton, !canRemove && styles.removeQuestionButtonDisabled]}
                  disabled={!canRemove}
                  activeOpacity={0.7}
                >
                  <FlynnIcon
                    name="trash"
                    size={18}
                    color={canRemove ? '#dc2626' : '#94a3b8'}
                  />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        <FlynnButton
          title="Add question"
          variant="secondary"
          icon={<FlynnIcon name="add" size={18} color="#2563eb" />}
          onPress={handleAddQuestion}
          size="small"
          style={styles.addQuestionButton}
          textStyle={styles.addQuestionButtonText}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Call intelligence</Text>
        <View style={styles.toggleRow}>
          <View style={styles.toggleCopy}>
            <Text style={styles.toggleLabel}>Call recording</Text>
            <Text style={styles.toggleHint}>Keep high-quality recordings for coaching and compliance.</Text>
          </View>
          <Switch
            value={callRecordingEnabled}
            onValueChange={setCallRecordingEnabled}
            thumbColor={callRecordingEnabled ? '#3B82F6' : '#f1f5f9'}
            trackColor={{ false: '#cbd5f5', true: '#bfdbfe' }}
          />
        </View>
        <View style={styles.toggleRow}>
          <View style={styles.toggleCopy}>
            <Text style={styles.toggleLabel}>Automatic summaries</Text>
            <Text style={styles.toggleHint}>Send AI-generated summaries and follow-up tasks to your team.</Text>
          </View>
          <Switch
            value={autoSummaryEnabled}
            onValueChange={setAutoSummaryEnabled}
            thumbColor={autoSummaryEnabled ? '#3B82F6' : '#f1f5f9'}
            trackColor={{ false: '#cbd5f5', true: '#bfdbfe' }}
          />
        </View>
      </View>

      <View style={styles.actions}>
        <FlynnButton title={isSaving ? 'Saving…' : 'Save profile'} onPress={handleSaveProfile} variant="primary" disabled={isSaving} />
      </View>

      <RecordVoiceModal
        visible={recordModalVisible}
        onDismiss={() => {
          setRecordModalVisible(false);
          setRecording(null);
          setIsRecording(false);
          setRecordingDuration(0);
        }}
        onStartRecording={async () => {
          try {
            setRecordingDuration(0);
            setIsRecording(true);

            const permission = await Audio.requestPermissionsAsync();
            if (!permission.granted) {
              setIsRecording(false);
              setIsUploadingSample(false);
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
            recordingInstance.setOnRecordingStatusUpdate((status) => {
              if (status?.isRecording) {
                setRecordingDuration(status.durationMillis ?? 0);
              }
            });
            await recordingInstance.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
            await recordingInstance.startAsync();
            setRecording(recordingInstance);
          } catch (error) {
            console.error('[ReceptionistScreen] Failed to start recording', error);
            setIsRecording(false);
            Alert.alert('Recording failed', error instanceof Error ? error.message : 'Unable to start recording.');
          }
        }}
        onStopRecording={async () => {
          if (!recording) {
            setRecordModalVisible(false);
            setIsRecording(false);
            return;
          }

          try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            setRecording(null);
            setIsRecording(false);

            if (!uri) {
              throw new Error('Recording file unavailable.');
            }

            setIsUploadingSample(true);
            const profile = await ReceptionistService.createVoiceProfile(
              `Your voice ${new Date().toLocaleDateString()}`,
              uri,
            );

            setActiveVoiceProfileId(profile.id);
            setSelectedVoice('custom_voice');
            updateOnboardingData({ receptionistVoiceProfileId: profile.id, receptionistVoice: 'custom_voice' });
            await refreshVoiceProfiles();
            Alert.alert('Voice sample uploaded', 'We are cloning your voice. This usually takes a few minutes.');
          } catch (error) {
            console.error('[ReceptionistScreen] Voice sample upload failed', error);
            Alert.alert('Upload failed', error instanceof Error ? error.message : 'Unable to upload voice sample.');
          } finally {
            setRecordModalVisible(false);
            setIsUploadingSample(false);
            setRecordingDuration(0);
            await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
          }
        }}
        isRecording={isRecording}
        durationMillis={recordingDuration}
        uploading={isUploadingSample}
      />
      </FlynnKeyboardAwareScrollView>

      {toastState && (
        <View
          pointerEvents="none"
          style={[
            styles.toast,
            toastState.tone === 'success' ? styles.toastSuccess : styles.toastError,
          ]}
        >
          <FlynnIcon
            name={toastState.tone === 'success' ? 'checkmark-circle' : 'alert-circle'}
            size={18}
            color={toastState.tone === 'success' ? '#15803d' : '#b91c1c'}
            style={styles.toastIcon}
          />
          <Text style={styles.toastText}>{toastState.message}</Text>
        </View>
      )}
    </FlynnKeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  heroCard: {
    backgroundColor: '#fff7ed',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: '#fed7aa',
    alignItems: 'center',
  },
  heroAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  heroAvatarImage: {
    width: '100%',
    height: '100%',
  },
  heroTextWrapper: {
    flex: 1,
  },
  heroTitle: {
    ...typography.h3,
    color: '#9a3412',
  },
  heroSubtitle: {
    ...typography.bodyMedium,
    color: '#b45309',
    marginTop: spacing.xs,
  },
  previewButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.lg,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  previewButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxxs,
  },
  previewButtonLabel: {
    ...typography.caption,
    color: '#2563eb',
    fontWeight: '600',
    marginLeft: spacing.xxxs,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitle: {
    ...typography.h3,
    color: '#0f172a',
    marginBottom: spacing.sm,
  },
  cardHint: {
    ...typography.bodySmall,
    color: '#64748b',
    marginBottom: spacing.md,
  },
  sectionLabel: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#1d4ed8',
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  templateList: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  templateChip: {
    borderWidth: 1,
    borderColor: '#cbd5f5',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    backgroundColor: '#f8fbff',
  },
  templateChipSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#e0f2fe',
  },
  templateChipLabel: {
    ...typography.bodyMedium,
    color: '#0f172a',
    fontWeight: '600',
  },
  templateChipLabelSelected: {
    color: '#1d4ed8',
  },
  templateChipDescription: {
    ...typography.bodySmall,
    color: '#475569',
    marginTop: spacing.xxxs,
  },
  templateChipDescriptionSelected: {
    color: '#1d4ed8',
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  questionInputContainer: {
    flex: 1,
    marginBottom: 0,
  },
  questionActions: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: spacing.xs,
  },
  questionActionButton: {
    height: 48,
    width: 48,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeQuestionButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
    height: 48,
    width: 48,
  },
  removeQuestionButtonDisabled: {
    backgroundColor: '#f1f5f9',
  },
  addQuestionButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  addQuestionButtonText: {
    color: '#2563eb',
    fontWeight: '600',
  },
  toast: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    borderWidth: 1,
  },
  toastSuccess: {
    backgroundColor: '#ecfdf5',
    borderColor: '#bbf7d0',
  },
  toastError: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  toastIcon: {
    marginRight: spacing.xs,
  },
  toastText: {
    ...typography.bodySmall,
    color: '#0f172a',
    flex: 1,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
  },
  listItemSelected: {
    backgroundColor: '#eff6ff',
  },
  listItemLabel: {
    flex: 1,
    ...typography.bodyLarge,
    color: '#0f172a',
  },
  noticeBanner: {
    marginTop: spacing.md,
    backgroundColor: '#e0f2fe',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  noticeIcon: {
    marginBottom: spacing.xs,
  },
  noticeText: {
    ...typography.bodySmall,
    color: '#1d4ed8',
  },
  profileStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  profileStatusText: {
    ...typography.bodySmall,
    color: '#1d4ed8',
    flex: 1,
  },
  refreshLink: {
    ...typography.bodySmall,
    color: '#2563eb',
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  toggleCopy: {
    flex: 1,
    marginRight: spacing.md,
  },
  toggleLabel: {
    ...typography.bodyMedium,
    color: '#0f172a',
    fontWeight: '600',
  },
  toggleHint: {
    ...typography.caption,
    color: '#64748b',
    marginTop: spacing.xxxs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
});

export default ReceptionistScreen;
