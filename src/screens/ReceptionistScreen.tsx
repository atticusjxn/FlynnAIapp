import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Modal,
  ActivityIndicator,
  Image,
} from 'react-native';
import { FlynnIcon } from '../components/ui/FlynnIcon';
import { useOnboarding } from '../context/OnboardingContext';
import { FlynnInput } from '../components/ui/FlynnInput';
import { FlynnButton } from '../components/ui/FlynnButton';
import { spacing, typography, borderRadius } from '../theme';
import ReceptionistService, { VoiceProfile } from '../services/ReceptionistService';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

const KOALA_ANIMATION = require('../../assets/images/koala3s.gif');
const KOALA_STATIC = require('../../assets/images/icon.png');

const BASE_VOICE_OPTIONS = [
  { id: 'koala_warm', label: 'Avery — Warm & Friendly' },
  { id: 'koala_expert', label: 'Sloane — Expert Concierge' },
  { id: 'koala_hype', label: 'Maya — High Energy' },
];

const FOLLOW_UP_TEMPLATES = [
  {
    id: 'general',
    label: 'General service',
    description: 'Works for most customer service teams.',
    questions: [
      'What can we help you with today?',
      'Where should we send the team or service pro?',
      'When do you need this completed?',
      'What is the best number or email to reach you?',
    ],
  },
  {
    id: 'trades',
    label: 'Trades & repairs',
    description: 'Tailored for electricians, plumbers, and contractors.',
    questions: [
      'What project or repair do you need help with?',
      'How urgent is the request?',
      'What time would you like the work handled?',
      'Where is the job located and are there access instructions?',
    ],
  },
  {
    id: 'events',
    label: 'Events & venues',
    description: 'Great for planners, venues, and hospitality teams.',
    questions: [
      'What type of event are you planning?',
      'When is the event and how flexible is the date?',
      'How many guests are you expecting?',
      'Is there anything special we should prepare for?',
    ],
  },
];

const DEFAULT_FOLLOW_UP_QUESTIONS = FOLLOW_UP_TEMPLATES[0].questions;

const matchTemplateId = (questions: string[]): string => {
  const normalized = questions.map(question => question.trim()).filter(Boolean);
  const match = FOLLOW_UP_TEMPLATES.find(template => {
    if (template.questions.length !== normalized.length) {
      return false;
    }
    return template.questions.every((question, index) => question === normalized[index]);
  });
  return match?.id ?? 'custom';
};

export const ReceptionistScreen: React.FC = () => {
  const { onboardingData, updateOnboardingData } = useOnboarding();
  const [selectedVoice, setSelectedVoice] = useState<string>(
    onboardingData.receptionistVoice || BASE_VOICE_OPTIONS[0].id
  );
  const [greeting, setGreeting] = useState(
    onboardingData.receptionistGreeting || 'Hi, you have reached Flynn — how can we lend a hand today?'
  );
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
  const previewSoundRef = useRef<Audio.Sound | null>(null);
  const previewUriRef = useRef<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

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
    };
  }, []);

  useEffect(() => {
    if (onboardingData.receptionistVoice) {
      setSelectedVoice(onboardingData.receptionistVoice);
    }
    if (onboardingData.receptionistGreeting) {
      setGreeting(onboardingData.receptionistGreeting);
    }
    if (onboardingData.receptionistQuestions && onboardingData.receptionistQuestions.length > 0) {
      setFollowUpQuestions(onboardingData.receptionistQuestions.map(question => question));
      setActiveTemplateId(matchTemplateId(onboardingData.receptionistQuestions));
    }
    if (onboardingData.receptionistVoiceProfileId) {
      setActiveVoiceProfileId(onboardingData.receptionistVoiceProfileId);
    }
  }, [
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

  const voiceOptions = useMemo(() => {
    return [
      ...BASE_VOICE_OPTIONS,
      { id: 'custom_voice', label: customVoiceStatusLabel },
    ];
  }, [customVoiceStatusLabel]);

  const selectedVoiceLabel = useMemo(
    () => voiceOptions.find(v => v.id === selectedVoice)?.label || 'Avery — Warm & Friendly',
    [selectedVoice, voiceOptions]
  );

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

      Alert.alert('Receptionist updated', 'Your koala concierge will use the new settings on the next call.');
    } catch (error) {
      console.error('[ReceptionistScreen] Failed to save receptionist profile', error);
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Unable to save receptionist settings.');
    } finally {
      setIsSaving(false);
    }
  };

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
      setIsKoalaTalking(false);
      setIsPreviewPlaying(false);
    }
  }, []);

  const handlePlayGreeting = useCallback(async () => {
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

    const voiceProfileId = selectedVoice === 'custom_voice'
      ? (customVoiceProfile?.id ?? activeVoiceProfileId ?? undefined)
      : undefined;

    if (selectedVoice === 'custom_voice' && customVoiceProfile?.status !== 'ready') {
      Alert.alert('Voice not ready', 'Finish cloning your custom voice before playing a preview.');
      return;
    }

    setIsPreviewLoading(true);

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
      setIsPreviewPlaying(true);
      setIsKoalaTalking(true);

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
      setIsPreviewPlaying(false);
    } finally {
      setIsPreviewLoading(false);
    }
  }, [
    activeVoiceProfileId,
    customVoiceProfile,
    greeting,
    isPreviewLoading,
    isPreviewPlaying,
    selectedVoice,
    stopPreview,
  ]);

  const handleSimulateCall = () => {
    if (isPreviewPlaying) {
      stopPreview().catch(() => {});
    }

    setIsKoalaTalking(true);
    const talkingPoints = followUpQuestions
      .map(question => question.trim())
      .filter(Boolean);

    Alert.alert(
      'Call simulation',
      `${selectedVoiceLabel} will say:\n\n"${greeting}"` +
        (talkingPoints.length ? `\n\nTalking points:\n${talkingPoints.map(point => `• ${point}`).join('\n')}` : ''),
      [
        {
          text: 'Okay',
          onPress: () => setIsKoalaTalking(false),
        },
      ],
      {
        onDismiss: () => setIsKoalaTalking(false),
      }
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <View style={styles.heroAvatar}>
          <Image
            source={isKoalaTalking ? KOALA_ANIMATION : KOALA_STATIC}
            style={styles.heroAvatarImage}
            resizeMode="contain"
          />
        </View>
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
          disabled={isPreviewLoading}
        >
          {isPreviewLoading ? (
            <ActivityIndicator color="#2563eb" size="small" />
          ) : (
            <View style={styles.previewButtonContent}>
              <FlynnIcon
                name={isPreviewPlaying ? 'pause-circle' : 'play-circle'}
                size={22}
                color="#2563eb"
              />
              <Text style={styles.previewButtonLabel}>
                {isPreviewPlaying ? 'Stop' : 'Play greeting'}
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
        <FlynnButton title="Play test message" onPress={handleSimulateCall} variant="secondary" />
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
    </ScrollView>
  );
};

const formatDuration = (millis: number): string => {
  const seconds = Math.floor(millis / 1000);
  const mins = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
};

interface RecordVoiceModalProps {
  visible: boolean;
  isRecording: boolean;
  durationMillis: number;
  uploading: boolean;
  onStartRecording: () => Promise<void>;
  onStopRecording: () => Promise<void>;
  onDismiss: () => void;
}

const RecordVoiceModal: React.FC<RecordVoiceModalProps> = ({
  visible,
  isRecording,
  durationMillis,
  uploading,
  onStartRecording,
  onStopRecording,
  onDismiss,
}) => {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onDismiss}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.card}>
          <Text style={modalStyles.title}>Record your voice</Text>
          <Text style={modalStyles.subtitle}>
            Find a quiet space and read one of your typical phone greetings for at least 45 seconds. Flynn needs a clean sample to mimic your tone.
          </Text>

          <View style={modalStyles.timerContainer}>
            <View style={[modalStyles.timerBadge, isRecording ? modalStyles.timerBadgeActive : null]}>
              <FlynnIcon name={isRecording ? 'recording' : 'mic-outline'} size={18} color={isRecording ? '#f87171' : '#2563eb'} />
              <Text style={modalStyles.timerText}>{formatDuration(durationMillis)}</Text>
            </View>
            {uploading && (
              <View style={modalStyles.uploadRow}>
                <ActivityIndicator size="small" color="#2563eb" />
                <Text style={modalStyles.uploadText}>Uploading sample…</Text>
              </View>
            )}
          </View>

          <View style={modalStyles.actions}>
            <FlynnButton
              title={isRecording ? 'Stop recording' : uploading ? 'Uploading…' : 'Start recording'}
              variant={isRecording ? 'danger' : 'primary'}
              onPress={isRecording ? onStopRecording : onStartRecording}
              disabled={uploading}
            />
            <FlynnButton title="Cancel" variant="secondary" onPress={onDismiss} disabled={isRecording || uploading} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
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

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  title: {
    ...typography.h3,
    color: '#0f172a',
  },
  subtitle: {
    ...typography.bodyMedium,
    color: '#475569',
    lineHeight: 20,
  },
  timerContainer: {
    gap: spacing.sm,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: '#e2e8f0',
  },
  timerBadgeActive: {
    backgroundColor: '#fee2e2',
  },
  timerText: {
    ...typography.bodyMedium,
    color: '#0f172a',
    fontVariant: ['tabular-nums'],
  },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  uploadText: {
    ...typography.bodySmall,
    color: '#2563eb',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
});

export default ReceptionistScreen;
