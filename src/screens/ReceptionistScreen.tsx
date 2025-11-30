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
  Animated,
} from 'react-native';
import { FlynnIcon } from '../components/ui/FlynnIcon';
import { useOnboarding } from '../context/OnboardingContext';
import { useAuth } from '../context/AuthContext';
import { buildDefaultGreeting } from '../utils/greetingDefaults';
import { FlynnInput } from '../components/ui/FlynnInput';
import { FlynnButton } from '../components/ui/FlynnButton';
import { FlynnCard } from '../components/ui/FlynnCard';
import { spacing, typography, borderRadius, colors, shadows } from '../theme';
import ReceptionistService, { VoiceProfile } from '../services/ReceptionistService';
import { isApiConfigured } from '../services/apiClient';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { TestCallModal } from '../components/receptionist/TestCallModal';

const FLYNN_ANIMATION = require('../../assets/images/flynn3s.gif');
const FLYNN_STATIC = require('../../assets/images/icon.png');
const FLYNN_LOOP_DURATION_MS = 3000;

const BASE_VOICE_OPTIONS = [
  { id: 'flynn_warm', label: 'Avery — Warm & Friendly' },
  { id: 'flynn_expert', label: 'Sloane — Expert Concierge' },
  { id: 'flynn_hype', label: 'Maya — High Energy' },
];

const RECEPTIONIST_MODES: Array<{ id: 'voicemail_only' | 'ai_only' | 'hybrid_choice'; title: string; description: string }> = [
  {
    id: 'ai_only',
    title: 'AI handles missed calls',
    description: 'Every missed call is answered by Flynn immediately.',
  },
  {
    id: 'hybrid_choice',
    title: 'Offer caller a choice',
    description: 'Flynn asks whether they want to leave a voicemail or speak to the concierge.',
  },
  {
    id: 'voicemail_only',
    title: 'Voicemail capture only',
    description: 'Skip the AI receptionist and capture a standard voicemail greeting.',
  },
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

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const pickRandom = <T,>(items: T[], fallback: T): T => {
  if (!items || items.length === 0) {
    return fallback;
  }
  return items[Math.floor(Math.random() * items.length)] ?? fallback;
};

const TEST_CALL_KEYWORD_RESPONSES: Array<{ keywords: string[]; answer: string }> = [
  { keywords: ['when', 'date', 'time', 'schedule', 'day'], answer: 'We’re hoping for Saturday 24 August, but we can be flexible by a day if needed.' },
  { keywords: ['where', 'address', 'location', 'venue'], answer: 'It’s at our space in Southbank, Melbourne.' },
  { keywords: ['guest', 'people', 'attendee', 'party size'], answer: 'We’re expecting around 80 guests with a handful of VIPs.' },
  { keywords: ['budget', 'cost', 'price'], answer: 'We’re aiming to keep the budget around $7,500.' },
  { keywords: ['contact', 'email', 'phone', 'reach'], answer: 'Reach me at jess@example.com or 555-0134.' },
];

const TEST_CALL_FALLBACK_RESPONSES = [
  'We need help coordinating a launch event with catering and live music.',
  'It’s happening next month in the CBD.',
  'We’ll have about 60 attendees and a few VIP guests.',
  'Please keep everything polished but relaxed.',
  'You can text or email me the recap so I can confirm with my team.',
];
const CALLER_OPENING_LINES = [
  'Hi, I’m checking if you have availability for an upcoming event.',
  'Hello! I was referred to you and wanted to see how Flynn Concierge works.',
  'Hi there, we’re planning something special and need a reliable receptionist.',
];

const CALLER_CLOSING_LINES = [
  'That sounds perfect, thanks Flynn!',
  'Appreciate the help—chat soon!',
  'Great, I’ll look out for your summary. Thanks again!',
];

interface TestCallStep {
  role: 'concierge' | 'caller';
  text: string;
  delayMs?: number;
}

export const ReceptionistScreen: React.FC = () => {
  const { user } = useAuth();
  const { onboardingData, updateOnboardingData } = useOnboarding();
  const [selectedVoice, setSelectedVoice] = useState<string>(
    onboardingData.receptionistVoice || BASE_VOICE_OPTIONS[0].id
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
  const [isFlynnTalking, setIsFlynnTalking] = useState(false);
  const [flynnAnimationKey, setFlynnAnimationKey] = useState(0);
  const previewSoundRef = useRef<Audio.Sound | null>(null);
  const previewUriRef = useRef<string | null>(null);
  const [isGreetingPreviewLoading, setIsGreetingPreviewLoading] = useState(false);
  const [isGreetingPreviewPlaying, setIsGreetingPreviewPlaying] = useState(false);
  const [questionPreviewLoadingIndex, setQuestionPreviewLoadingIndex] = useState<number | null>(null);
  const [questionPreviewPlayingIndex, setQuestionPreviewPlayingIndex] = useState<number | null>(null);
  const [toastState, setToastState] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const flynnLoopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flynnScale = useRef(new Animated.Value(1)).current;
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mode, setMode] = useState<'voicemail_only' | 'ai_only' | 'hybrid_choice'>(
    onboardingData.receptionistMode || 'ai_only'
  );
  const [testCallModalVisible, setTestCallModalVisible] = useState(false);
  const [ackLibrary, setAckLibrary] = useState<string[]>(
    onboardingData.receptionistAckLibrary && onboardingData.receptionistAckLibrary.length > 0
      ? onboardingData.receptionistAckLibrary
      : ['Got it!', 'Perfect, thanks!', 'Understood.', 'Great, let me note that.']
  );
  const [newAckPhrase, setNewAckPhrase] = useState('');
  const [testCallModalVisible, setTestCallModalVisible] = useState(false);
  const [testCallSteps, setTestCallSteps] = useState<TestCallStep[]>([]);
  const [activeTestCallIndex, setActiveTestCallIndex] = useState(-1);
  const [isTestCallRunning, setIsTestCallRunning] = useState(false);
  const testCallSoundRef = useRef<Audio.Sound | null>(null);
  const testCallAudioUriRef = useRef<string | null>(null);
  const testCallCancelledRef = useRef(false);
  const testCallScrollRef = useRef<ScrollView | null>(null);
  const businessName = (user?.user_metadata?.business_name as string | undefined)?.trim();

  const clearFlynnLoopTimer = useCallback(() => {
    if (flynnLoopTimerRef.current) {
      clearTimeout(flynnLoopTimerRef.current);
      flynnLoopTimerRef.current = null;
    }
  }, []);

  const animateFlynnScale = useCallback(
    (toValue: number) => {
      Animated.timing(flynnScale, {
        toValue,
        duration: 250,
        useNativeDriver: true,
      }).start();
    },
    [flynnScale]
  );

  const stopFlynnAnimation = useCallback(() => {
    clearFlynnLoopTimer();
    setIsFlynnTalking(false);
    animateFlynnScale(1);
  }, [animateFlynnScale, clearFlynnLoopTimer]);

  const stopTestCallAudio = useCallback(async () => {
    if (testCallSoundRef.current) {
      try {
        await testCallSoundRef.current.stopAsync();
      } catch (_) {
        // ignore
      }
      await testCallSoundRef.current.unloadAsync().catch(() => { });
      testCallSoundRef.current = null;
    }
    if (testCallAudioUriRef.current) {
      await FileSystem.deleteAsync(testCallAudioUriRef.current, { idempotent: true }).catch(() => { });
      testCallAudioUriRef.current = null;
    }
    stopFlynnAnimation();
  }, [stopFlynnAnimation]);

  useEffect(() => {
    refreshVoiceProfiles();
  }, []);

  useEffect(() => {
    if (activeTestCallIndex < 0 || !testCallScrollRef.current?.scrollTo) {
      return;
    }
    const averageRowHeight = 96;
    testCallScrollRef.current.scrollTo({
      y: Math.max(0, activeTestCallIndex * averageRowHeight - 40),
      animated: true,
    });
  }, [activeTestCallIndex]);

  useEffect(() => {
    return () => {
      if (previewSoundRef.current) {
        previewSoundRef.current.unloadAsync().catch(() => { });
        previewSoundRef.current = null;
      }
      if (previewUriRef.current) {
        FileSystem.deleteAsync(previewUriRef.current, { idempotent: true }).catch(() => { });
        previewUriRef.current = null;
      }
      if (flynnLoopTimerRef.current) {
        clearTimeout(flynnLoopTimerRef.current);
        flynnLoopTimerRef.current = null;
      }
      flynnScale.stopAnimation(() => {
        flynnScale.setValue(1);
      });
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
      if (testCallSoundRef.current) {
        testCallSoundRef.current.unloadAsync().catch(() => { });
        testCallSoundRef.current = null;
      }
      if (testCallAudioUriRef.current) {
        FileSystem.deleteAsync(testCallAudioUriRef.current, { idempotent: true }).catch(() => { });
        testCallAudioUriRef.current = null;
      }
      testCallCancelledRef.current = true;
    };
  }, [flynnScale]);

  const generateCallerAnswer = useCallback((question: string, index: number) => {
    if (!question) {
      return TEST_CALL_FALLBACK_RESPONSES[index % TEST_CALL_FALLBACK_RESPONSES.length];
    }
    const normalized = question.toLowerCase();
    const keywordResponse = TEST_CALL_KEYWORD_RESPONSES.find(entry =>
      entry.keywords.some(keyword => normalized.includes(keyword))
    );
    if (keywordResponse) {
      return keywordResponse.answer;
    }
    return TEST_CALL_FALLBACK_RESPONSES[index % TEST_CALL_FALLBACK_RESPONSES.length];
  }, []);

  const buildTestCallScript = useCallback((): TestCallStep[] => {
    const script: TestCallStep[] = [];
    const greetingText = (greeting || defaultGreeting || 'Hello!').trim();
    const ackPhrase = pickRandom(
      ackLibrary.length > 0 ? ackLibrary : ['Great!', 'Perfect, thanks!'],
      'Great!'
    );
    const orgDescriptor = onboardingData.businessType
      ? onboardingData.businessType.replace(/_/g, ' ')
      : 'events';
    const callerOpening = pickRandom(CALLER_OPENING_LINES, CALLER_OPENING_LINES[0]);
    const callerClosing = pickRandom(CALLER_CLOSING_LINES, CALLER_CLOSING_LINES[0]);

    script.push({ role: 'concierge', text: greetingText });
    script.push({ role: 'caller', text: `${callerOpening} We’re planning a ${orgDescriptor} project.`, delayMs: 1600 });

    followUpQuestions
      .map(question => question?.trim())
      .filter((question): question is string => Boolean(question))
      .forEach((question, index) => {
        script.push({ role: 'concierge', text: question });
        script.push({
          role: 'caller',
          text: generateCallerAnswer(question, index),
          delayMs: 1700,
        });
      });

    const teamName = businessName || 'your team';
    script.push({
      role: 'concierge',
      text: `${ackPhrase} I’ll send a summary once I brief ${teamName}. Anything else you’d like me to capture?`,
    });
    script.push({ role: 'caller', text: callerClosing, delayMs: 1500 });
    script.push({ role: 'concierge', text: 'Wonderful. Chat soon!' });

    return script;
  }, [
    ackLibrary,
    businessName,
    defaultGreeting,
    followUpQuestions,
    generateCallerAnswer,
    greeting,
    onboardingData.businessType,
  ]);

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
    if (onboardingData.receptionistMode) {
      setMode(onboardingData.receptionistMode);
    }
    if (onboardingData.receptionistAckLibrary) {
      const cleaned = onboardingData.receptionistAckLibrary.filter((phrase) => typeof phrase === 'string' && phrase.trim().length > 0);
      if (cleaned.length > 0) {
        setAckLibrary(cleaned);
      }
    }
  }, [
    defaultGreeting,
    onboardingData.receptionistVoice,
    onboardingData.receptionistGreeting,
    onboardingData.receptionistQuestions,
    onboardingData.receptionistVoiceProfileId,
    onboardingData.receptionistMode,
    onboardingData.receptionistAckLibrary,
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

  const handleAddAckPhrase = useCallback(() => {
    const trimmed = newAckPhrase.trim();
    if (!trimmed) {
      return;
    }

    if (ackLibrary.some(phrase => phrase.toLowerCase() === trimmed.toLowerCase())) {
      showToast('That acknowledgement is already in the list.', 'error');
      return;
    }

    setAckLibrary(prev => [...prev, trimmed]);
    setNewAckPhrase('');
  }, [ackLibrary, newAckPhrase, showToast]);

  const handleRemoveAckPhrase = useCallback((phrase: string) => {
    setAckLibrary(prev => prev.filter(item => item !== phrase));
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
        mode,
        ackLibrary,
      });

      updateOnboardingData({
        receptionistConfigured: true,
        receptionistVoice: selectedVoice,
        receptionistGreeting: greeting,
        receptionistQuestions: questions,
        receptionistVoiceProfileId: voiceProfileId,
        receptionistMode: mode,
        receptionistAckLibrary: ackLibrary,
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



  const startFlynnAnimationLoop = useCallback(
    (durationMillis?: number) => {
      clearFlynnLoopTimer();
      const loops = durationMillis
        ? Math.max(1, Math.round(durationMillis / FLYNN_LOOP_DURATION_MS))
        : 1;

      if (!loops) {
        setIsFlynnTalking(false);
        return;
      }

      let remaining = loops;
      setIsFlynnTalking(true);
      setFlynnAnimationKey(prev => prev + 1);
      animateFlynnScale(1.35);

      const scheduleNext = () => {
        remaining -= 1;
        if (remaining <= 0) {
          flynnLoopTimerRef.current = null;
          return;
        }

        setFlynnAnimationKey(prev => prev + 1);
        flynnLoopTimerRef.current = setTimeout(scheduleNext, FLYNN_LOOP_DURATION_MS);
      };

      flynnLoopTimerRef.current = setTimeout(scheduleNext, FLYNN_LOOP_DURATION_MS);
    },
    [animateFlynnScale, clearFlynnLoopTimer]
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
      sound.unloadAsync().catch(() => { });
      previewSoundRef.current = null;
      if (previewUriRef.current) {
        FileSystem.deleteAsync(previewUriRef.current, { idempotent: true }).catch(() => { });
        previewUriRef.current = null;
      }
      stopFlynnAnimation();
      setIsGreetingPreviewPlaying(false);
      setIsGreetingPreviewLoading(false);
      setQuestionPreviewPlayingIndex(null);
      setQuestionPreviewLoadingIndex(null);
    }
  }, [stopFlynnAnimation]);

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
        await FileSystem.deleteAsync(previewUriRef.current, { idempotent: true }).catch(() => { });
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
      startFlynnAnimationLoop(durationMillis);

      sound.setOnPlaybackStatusUpdate(status => {
        if (!status.isLoaded) {
          if (status.error) {
            console.warn('[ReceptionistScreen] Preview playback error', status.error);
          }
          return;
        }

        if (status.didJustFinish) {
          stopPreview().catch(() => { });
        }
      });

      await sound.playAsync();
    } catch (error) {
      console.error('[ReceptionistScreen] Failed to play greeting preview', error);
      stopPreview().catch(() => { });
      Alert.alert('Preview failed', error instanceof Error ? error.message : 'Unable to play the greeting right now.');
      setIsFlynnTalking(false);
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
    startFlynnAnimationLoop,
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
        await FileSystem.deleteAsync(previewUriRef.current, { idempotent: true }).catch(() => { });
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
      startFlynnAnimationLoop(durationMillis);

      sound.setOnPlaybackStatusUpdate(status => {
        if (!status.isLoaded) {
          if (status.error) {
            console.warn('[ReceptionistScreen] Question preview playback error', status.error);
          }
          return;
        }

        if (status.didJustFinish) {
          stopPreview().catch(() => { });
        }
      });

      await sound.playAsync();
    } catch (error) {
      console.error('[ReceptionistScreen] Failed to play question preview', error);
      stopPreview().catch(() => { });
      Alert.alert('Preview failed', error instanceof Error ? error.message : 'Unable to play this question right now.');
      setIsFlynnTalking(false);
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
    startFlynnAnimationLoop,
    stopPreview,
  ]);

  const playTestCallAudio = useCallback(async (text: string) => {
    if (!text?.trim()) {
      await wait(800);
      return;
    }

    if (selectedVoice === 'custom_voice' && customVoiceProfile?.status !== 'ready') {
      throw new Error('Custom voice not ready');
    }

    await stopTestCallAudio();

    const voiceProfileId = selectedVoice === 'custom_voice'
      ? (customVoiceProfile?.id ?? activeVoiceProfileId ?? undefined)
      : undefined;

    const preview = await ReceptionistService.previewGreeting(text, selectedVoice, voiceProfileId);

    if (testCallAudioUriRef.current) {
      await FileSystem.deleteAsync(testCallAudioUriRef.current, { idempotent: true }).catch(() => { });
      testCallAudioUriRef.current = null;
    }

    const extension = preview.contentType.includes('wav')
      ? 'wav'
      : preview.contentType.includes('ogg')
        ? 'ogg'
        : 'mp3';
    const base64Encoding = (FileSystem as any).EncodingType?.Base64 ?? 'base64';
    const fileUri = `${FileSystem.cacheDirectory}receptionist-test-${Date.now()}.${extension}`;
    await FileSystem.writeAsStringAsync(fileUri, preview.audio, { encoding: base64Encoding });
    testCallAudioUriRef.current = fileUri;

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
    testCallSoundRef.current = sound;

    const status = await sound.getStatusAsync();
    const durationMillis = status.isLoaded ? status.durationMillis ?? undefined : undefined;
    startFlynnAnimationLoop(durationMillis);

    await new Promise<void>((resolve, reject) => {
      sound.setOnPlaybackStatusUpdate((playbackStatus) => {
        if (!playbackStatus.isLoaded) {
          if (playbackStatus.error) {
            reject(new Error(playbackStatus.error));
          }
          return;
        }

        if (testCallCancelledRef.current) {
          sound.setOnPlaybackStatusUpdate(null);
          resolve();
          return;
        }

        if (playbackStatus.didJustFinish) {
          sound.setOnPlaybackStatusUpdate(null);
          resolve();
        }
      });

      sound.playAsync().catch((error) => {
        sound.setOnPlaybackStatusUpdate(null);
        reject(error);
      });
    });
  }, [
    activeVoiceProfileId,
    customVoiceProfile,
    selectedVoice,
    startFlynnAnimationLoop,
    stopTestCallAudio,
  ]);

  const handleCloseTestCallModal = useCallback(() => {
    testCallCancelledRef.current = true;
    setTestCallModalVisible(false);
    setIsTestCallRunning(false);
    setActiveTestCallIndex(-1);
    stopTestCallAudio().catch(() => { });
  }, [stopTestCallAudio]);

  const handleStartTestCall = useCallback(async () => {
    if (isTestCallRunning) {
      return;
    }

    if (!isApiConfigured()) {
      Alert.alert(
        'Test call unavailable',
        'Connect the API base URL to enable Flynn test calls. This Beta feature stays hidden until configured.'
      );
      return;
    }

    if (selectedVoice === 'custom_voice' && customVoiceProfile?.status !== 'ready') {
      Alert.alert('Voice not ready', 'Finish cloning your custom voice before running a test call.');
      return;
    }

    await stopPreview();
    const script = buildTestCallScript();

    if (script.length === 0) {
      Alert.alert('Add greeting', 'Configure a greeting or questions before running a test call.');
      return;
    }

    setTestCallSteps(script);
    setTestCallModalVisible(true);
    setActiveTestCallIndex(-1);
    setIsTestCallRunning(true);
    testCallCancelledRef.current = false;

    try {
      for (let i = 0; i < script.length; i += 1) {
        if (testCallCancelledRef.current) {
          break;
        }

        setActiveTestCallIndex(i);
        const step = script[i];

        if (step.role === 'concierge') {
          await playTestCallAudio(step.text);
        } else {
          await wait(step.delayMs ?? 1800);
        }
      }
    } catch (error) {
      console.error('[ReceptionistScreen] Test call simulation failed', error);
      Alert.alert('Test call', error instanceof Error ? error.message : 'Simulation interrupted.');
    } finally {
      setIsTestCallRunning(false);
      stopTestCallAudio().catch(() => { });
    }
  }, [
    buildTestCallScript,
    customVoiceProfile,
    isTestCallRunning,
    playTestCallAudio,
    selectedVoice,
    stopPreview,
    stopTestCallAudio,
  ]);

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <Animated.View style={[styles.heroAvatar, { transform: [{ scale: flynnScale }] }]}>
            <Image
              key={isFlynnTalking ? `flynn-${flynnAnimationKey}` : 'flynn-static'}
              source={isFlynnTalking ? FLYNN_ANIMATION : FLYNN_STATIC}
              style={styles.heroAvatarImage}
              resizeMode="contain"
            />
          </Animated.View>
          <View style={styles.heroTextWrapper}>
            <Text style={styles.heroTitle}>Flynn Concierge</Text>
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

        <FlynnCard style={styles.testCallCard}>
          <View style={styles.testCallHeader}>
            <Text style={styles.cardTitle}>Run a Flynn test call</Text>
            <Text style={styles.betaPill}>Beta</Text>
          </View>
          <Text style={styles.cardHint}>
            Talk to your AI receptionist live to test how the conversation flows. Experience the same low-latency
            interaction your callers will have before you provision a number.
          </Text>
          <FlynnButton
            title="START TEST CALL"
            onPress={() => setTestCallModalVisible(true)}
            variant="secondary"
          />
        </FlynnCard>

        <FlynnCard style={styles.card}>
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
              <FlynnIcon name="mic" size={18} color={colors.primary} style={styles.noticeIcon} />
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
                  <FlynnIcon name={customVoiceProfile.status === 'ready' ? 'checkmark-circle' : 'time'} size={16} color={customVoiceProfile.status === 'ready' ? colors.success : colors.primary} />
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
        </FlynnCard>

        <FlynnCard style={styles.card}>
          <Text style={styles.cardTitle}>Call routing</Text>
          <Text style={styles.cardHint}>Decide whether Flynn greets everyone or offers a voicemail fallback.</Text>
          {RECEPTIONIST_MODES.map(option => {
            const isSelected = mode === option.id;
            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.modeOption, isSelected && styles.modeOptionSelected]}
                onPress={() => setMode(option.id)}
                activeOpacity={0.85}
              >
                <View style={styles.modeCopy}>
                  <Text style={[styles.modeTitle, isSelected && styles.modeTitleSelected]}>{option.title}</Text>
                  <Text style={styles.modeDescription}>{option.description}</Text>
                </View>
                <FlynnIcon
                  name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={20}
                  color={isSelected ? colors.primary : colors.gray400}
                />
              </TouchableOpacity>
            );
          })}
        </FlynnCard>

        <FlynnCard style={styles.card}>
          <Text style={styles.cardTitle}>Greeting script</Text>
          <Text style={styles.cardHint}>Set the opening line and tone for every caller.</Text>
          <FlynnInput
            multiline
            numberOfLines={3}
            value={greeting}
            onChangeText={setGreeting}
            placeholder="Hello! You've reached ..."
          />
        </FlynnCard>

        <FlynnCard style={styles.card}>
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
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <FlynnIcon
                        name={questionPreviewPlayingIndex === index ? 'pause-circle' : 'play-circle'}
                        size={22}
                        color={colors.primary}
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
                      color={canRemove ? colors.white : colors.gray400}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          <FlynnButton
            title="Add question"
            variant="secondary"
            icon={<FlynnIcon name="add" size={18} color={colors.primary} />}
            onPress={handleAddQuestion}
            size="small"
            style={styles.addQuestionButton}
            textStyle={styles.addQuestionButtonText}
          />
        </FlynnCard>

        <FlynnCard style={styles.card}>
          <Text style={styles.cardTitle}>Acknowledgement phrases</Text>
          <Text style={styles.cardHint}>Flynn rotates through these quick responses while processing the caller&apos;s answer.</Text>
          <View style={styles.ackList}>
            {ackLibrary.map((phrase) => {
              const canRemove = ackLibrary.length > 3;
              return (
                <View key={phrase} style={styles.ackItem}>
                  <Text style={styles.ackText}>{phrase}</Text>
                  <TouchableOpacity
                    onPress={() => handleRemoveAckPhrase(phrase)}
                    disabled={!canRemove}
                    style={[styles.ackRemoveButton, !canRemove && styles.ackRemoveButtonDisabled]}
                    activeOpacity={0.7}
                  >
                    <FlynnIcon name="close" size={16} color={canRemove ? colors.white : colors.gray400} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
          <FlynnInput
            value={newAckPhrase}
            onChangeText={setNewAckPhrase}
            placeholder="Add a new acknowledgement"
            containerStyle={styles.ackInput}
          />
          <FlynnButton
            title="Add phrase"
            variant="secondary"
            onPress={handleAddAckPhrase}
            disabled={!newAckPhrase.trim()}
            size="small"
          />
        </FlynnCard>

        <FlynnCard style={styles.card}>
          <Text style={styles.cardTitle}>Call intelligence</Text>
          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text style={styles.toggleLabel}>Call recording</Text>
              <Text style={styles.toggleHint}>Keep high-quality recordings for coaching and compliance.</Text>
            </View>
            <Switch
              value={callRecordingEnabled}
              onValueChange={setCallRecordingEnabled}
              thumbColor={callRecordingEnabled ? colors.primary : colors.gray100}
              trackColor={{ false: colors.gray300, true: colors.primaryLight }}
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
              thumbColor={autoSummaryEnabled ? colors.primary : colors.gray100}
              trackColor={{ false: colors.gray300, true: colors.primaryLight }}
            />
          </View>
        </FlynnCard>

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

        <TestCallModal
          visible={testCallModalVisible}
          steps={testCallSteps}
          activeIndex={activeTestCallIndex}
          running={isTestCallRunning}
          onClose={handleCloseTestCallModal}
          scrollRef={testCallScrollRef}
        />
      </ScrollView>

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

      <TestCallModal
        visible={testCallModalVisible}
        onClose={() => setTestCallModalVisible(false)}
        greeting={greeting}
        questions={followUpQuestions}
        voiceId={selectedVoice}
      />
    </View>
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

interface TestCallModalProps {
  visible: boolean;
  steps: TestCallStep[];
  activeIndex: number;
  running: boolean;
  onClose: () => void;
  scrollRef: React.RefObject<ScrollView | null>;
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

const TestCallModal: React.FC<TestCallModalProps> = ({
  visible,
  steps,
  activeIndex,
  running,
  onClose,
  scrollRef,
}) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={modalStyles.overlay}>
      <View style={modalStyles.testCallCard}>
        <View style={modalStyles.testCallHeader}>
          <Text style={modalStyles.title}>Flynn concierge test call</Text>
          <TouchableOpacity onPress={onClose} style={modalStyles.closeButton}>
            <FlynnIcon name="close" size={18} color="#0f172a" />
          </TouchableOpacity>
        </View>
        <Text style={modalStyles.testCallDescription}>
          {running
            ? 'Flynn is playing your script with realistic caller replies. Sit back and listen!'
            : 'Review the simulated call below. Update your script and run it again any time.'}
        </Text>
        <ScrollView
          ref={scrollRef}
          style={modalStyles.testCallScroll}
          contentContainerStyle={modalStyles.testCallContent}
        >
          {steps.map((step, index) => (
            <View
              key={`${index}-${step.role}`}
              style={[
                modalStyles.chatRow,
                step.role === 'concierge'
                  ? modalStyles.conciergeChatRow
                  : modalStyles.callerChatRow,
                activeIndex === index && modalStyles.chatRowActive,
              ]}
            >
              <Text style={modalStyles.chatRole}>{step.role === 'concierge' ? 'Flynn' : 'Caller'}</Text>
              <Text style={modalStyles.chatText}>{step.text}</Text>
            </View>
          ))}
        </ScrollView>
        <FlynnButton
          title={running ? 'Stop simulation' : 'Close'}
          onPress={onClose}
          variant={running ? 'danger' : 'secondary'}
          fullWidth
        />
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  heroCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
    borderWidth: 2,
    borderColor: colors.black,
    alignItems: 'center',
    ...shadows.md,
  },
  heroAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.black,
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
    color: colors.textPrimary,
  },
  heroSubtitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  previewButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.black,
    ...shadows.xs,
  },
  previewButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxxs,
  },
  previewButtonLabel: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
    marginLeft: spacing.xxxs,
    textTransform: 'uppercase',
  },
  card: {
    // Styles now handled by FlynnCard, but keeping for layout if needed
    marginBottom: spacing.sm,
  },
  cardTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  cardHint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  testCallCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.black,
    marginBottom: spacing.xl,
    ...shadows.md,
  },
  testCallHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  betaPill: {
    ...typography.caption,
    color: colors.black,
    backgroundColor: colors.warning,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxxs,
    borderRadius: borderRadius.full,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: colors.black,
  },
  cardWarning: {
    ...typography.bodySmall,
    color: colors.black,
    backgroundColor: colors.warning,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.black,
    marginBottom: spacing.md,
  },
  sectionLabel: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.textSecondary,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  templateList: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  templateChip: {
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    backgroundColor: colors.white,
    ...shadows.xs,
  },
  templateChipSelected: {
    borderColor: colors.black,
    backgroundColor: colors.primaryLight,
    ...shadows.sm,
  },
  templateChipLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  templateChipLabelSelected: {
    color: colors.primaryDark,
  },
  templateChipDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xxxs,
  },
  templateChipDescriptionSelected: {
    color: colors.textPrimary,
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
    height: 52,
    width: 52,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.black,
    ...shadows.xs,
  },
  removeQuestionButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    height: 52,
    width: 52,
    borderWidth: 2,
    borderColor: colors.black,
    ...shadows.xs,
  },
  removeQuestionButtonDisabled: {
    backgroundColor: colors.gray200,
    borderColor: colors.gray400,
  },
  addQuestionButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  addQuestionButtonText: {
    color: colors.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  toast: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.black,
    borderWidth: 2,
    borderColor: colors.black,
    ...shadows.lg,
  },
  toastSuccess: {
    backgroundColor: colors.success,
    borderColor: colors.black,
  },
  toastError: {
    backgroundColor: colors.error,
    borderColor: colors.black,
  },
  toastIcon: {
    marginRight: spacing.xs,
  },
  toastText: {
    ...typography.bodySmall,
    color: colors.black,
    fontWeight: '600',
    flex: 1,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  listItemSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.black,
    ...shadows.xs,
  },
  listItemLabel: {
    flex: 1,
    ...typography.bodyLarge,
    color: colors.textPrimary,
  },
  modeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.white,
    gap: spacing.md,
    ...shadows.xs,
  },
  modeOptionSelected: {
    borderColor: colors.black,
    backgroundColor: colors.primaryLight,
    ...shadows.sm,
  },
  modeCopy: {
    flex: 1,
  },
  modeTitle: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.xs / 2,
  },
  modeTitleSelected: {
    color: colors.primaryDark,
  },
  modeDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  ackList: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  ackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    ...shadows.xs,
  },
  ackText: {
    flex: 1,
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  ackRemoveButton: {
    marginLeft: spacing.md,
    padding: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.error,
    borderWidth: 1,
    borderColor: colors.black,
  },
  ackRemoveButtonDisabled: {
    backgroundColor: colors.gray200,
    borderColor: colors.gray400,
  },
  ackInput: {
    marginBottom: spacing.sm,
  },
  noticeBanner: {
    marginTop: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: colors.black,
  },
  noticeIcon: {
    marginBottom: spacing.xs,
  },
  noticeText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
  },
  profileStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  profileStatusText: {
    ...typography.bodySmall,
    color: colors.primary,
    flex: 1,
    fontWeight: '600',
  },
  refreshLink: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
    textDecorationLine: 'underline',
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
    color: colors.textPrimary,
    fontWeight: '700',
  },
  toggleHint: {
    ...typography.caption,
    color: colors.textSecondary,
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
    borderWidth: 2,
    borderColor: colors.black,
    ...shadows.lg,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
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
    backgroundColor: colors.gray100,
    borderWidth: 2,
    borderColor: colors.black,
  },
  timerBadgeActive: {
    backgroundColor: colors.error,
    borderColor: colors.black,
  },
  timerText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  uploadText: {
    ...typography.bodySmall,
    color: colors.primary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  testCallCard: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 2,
    borderColor: colors.black,
    ...shadows.lg,
  },
  testCallHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    padding: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.black,
  },
  testCallDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  testCallScroll: {
    flex: 1,
  },
  testCallContent: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  chatRow: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.black,
    ...shadows.xs,
  },
  conciergeChatRow: {
    backgroundColor: colors.primaryLight,
  },
  callerChatRow: {
    backgroundColor: colors.white,
  },
  chatRowActive: {
    borderColor: colors.primary,
    ...shadows.sm,
  },
  chatRole: {
    ...typography.caption,
    color: colors.textPrimary,
    marginBottom: spacing.xxxs,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  chatText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    lineHeight: 20,
  },
});

export default ReceptionistScreen;
