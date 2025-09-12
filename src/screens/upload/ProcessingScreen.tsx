import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, shadows } from '../../theme';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AuroraBorder } from '../../components/ui/SafeAuroraBorder';

export const ProcessingScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { imageUri } = route.params;
  
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: false,
      }),
    ]).start();

    // Check if this was triggered from a shortcut (will be handled by ShortcutHandler)
    const isFromShortcut = route.params?.isFromShortcut;
    
    if (!isFromShortcut) {
      // For manual uploads, use the original flow with mock data
      const timer = setTimeout(() => {
        navigation.replace('Results', {
          imageUri,
          extractedData: {
            clientName: 'John Smith',
            serviceType: 'Plumbing - Leak Repair',
            date: 'Tomorrow, Dec 15',
            time: '2:00 PM',
            location: '123 Main St, Springfield',
            notes: 'Kitchen sink is leaking, needs urgent repair. Client mentioned water damage starting to show.',
            phone: '+1 (555) 123-4567',
            estimatedDuration: '2 hours',
          },
        });
      }, 3500);

      return () => clearTimeout(timer);
    }
    
    // For shortcut processing, the ShortcutHandler will navigate automatically
  }, []);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const processingSteps = [
    'Reading screenshot...',
    'Identifying client details...',
    'Extracting job information...',
    'Organizing data...',
  ];

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.imageContainer}>
          <Image source={{ uri: imageUri }} style={styles.screenshot} />
          <Animated.View
            style={[
              styles.scanOverlay,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <AuroraBorder
              width={220}
              height={270}
              borderRadius={12}
              borderWidth={3}
              animationDuration={3000}
            />
          </Animated.View>
        </View>

        <Animated.View style={[styles.aiContainer, { opacity: fadeAnim }]}>
          <View style={styles.aiIconContainer}>
            <Ionicons name="sparkles" size={32} color={colors.primary} />
          </View>
          
          <Text style={styles.title}>AI is reading your screenshot</Text>
          <Text style={styles.subtitle}>Extracting job details automatically</Text>

          <View style={styles.progressContainer}>
            <View style={styles.progressBackground}>
              <Animated.View
                style={[
                  styles.progressBar,
                  { width: progressWidth },
                ]}
              />
            </View>
          </View>

          <View style={styles.stepsContainer}>
            {processingSteps.map((step, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.stepItem,
                  {
                    opacity: progressAnim.interpolate({
                      inputRange: [
                        index * 0.25,
                        (index + 1) * 0.25,
                      ],
                      outputRange: [0.3, 1],
                      extrapolate: 'clamp',
                    }),
                  },
                ]}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={colors.success}
                />
                <Text style={styles.stepText}>{step}</Text>
              </Animated.View>
            ))}
          </View>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
    alignItems: 'center',
  },
  imageContainer: {
    width: 200,
    height: 250,
    marginBottom: spacing.xl,
    position: 'relative',
  },
  screenshot: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    ...shadows.lg,
  },
  scanOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiContainer: {
    alignItems: 'center',
    width: '100%',
  },
  aiIconContainer: {
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
    color: colors.gray800,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.bodyMedium,
    color: colors.gray600,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  progressBackground: {
    height: 8,
    backgroundColor: colors.gray200,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  stepsContainer: {
    width: '100%',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    backgroundColor: colors.white,
    padding: spacing.sm,
    borderRadius: 8,
    ...shadows.sm,
  },
  stepText: {
    ...typography.bodyMedium,
    color: colors.gray700,
    marginLeft: spacing.sm,
  },
});