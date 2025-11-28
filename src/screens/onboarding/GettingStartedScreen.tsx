import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import { FlynnIcon } from '../../components/ui/FlynnIcon';
import { FlynnButton } from '../../components/ui/FlynnButton';
import { colors, spacing, typography, shadows, borderRadius } from '../../theme';

interface GettingStartedScreenProps {
  onStartOnboarding: () => void;
}

export const GettingStartedScreen: React.FC<GettingStartedScreenProps> = ({ onStartOnboarding }) => {
  const screenHeight = Dimensions.get('window').height;
  const isSmallScreen = screenHeight < 700;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={[
          styles.content,
          isSmallScreen && styles.contentSmallScreen
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../../../assets/images/onboardinglogo.png')}
              style={[styles.logoImage, isSmallScreen && styles.logoImageSmall]}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>Welcome to FlynnAI!</Text>
          <Text style={styles.subtitle}>
            Let's get your business set up so you can start automating your workflow
          </Text>
        </View>

        <View style={[styles.featuresContainer, isSmallScreen && styles.featuresContainerSmall]}>
          <View style={styles.feature}>
            <View style={styles.featureIcon}>
              <FlynnIcon name="mic-outline" size={24} color={colors.primary} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Missed Call Protection</Text>
              <Text style={styles.featureDescription}>
                Flynn answers when you can't, 24/7.
              </Text>
            </View>
          </View>

          <View style={styles.feature}>
            <View style={styles.featureIcon}>
              <FlynnIcon name="document-text-outline" size={24} color={colors.primary} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>AI Transcription</Text>
              <Text style={styles.featureDescription}>
                Read voicemails instead of listening to them.
              </Text>
            </View>
          </View>

          <View style={styles.feature}>
            <View style={styles.featureIcon}>
              <FlynnIcon name="chatbubble-ellipses-outline" size={24} color={colors.primary} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Instant Follow-up</Text>
              <Text style={styles.featureDescription}>
                Engage leads immediately via SMS.
              </Text>
            </View>
          </View>

          <View style={styles.feature}>
            <View style={styles.featureIcon}>
              <FlynnIcon name="people-outline" size={24} color={colors.primary} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Client Management</Text>
              <Text style={styles.featureDescription}>
                Keep track of all your clients and job history.
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.buttonContainer, isSmallScreen && styles.buttonContainerSmall]}>
          <FlynnButton
            title="Set Up Your Business"
            onPress={onStartOnboarding}
            variant="primary"
            size="large"
            icon={<FlynnIcon name="arrow-forward" size={20} color={colors.white} />}
            iconPosition="right"
            fullWidth
          />

          <Text style={styles.footerText}>
            Takes less than 2 minutes to get started
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    minHeight: Dimensions.get('window').height - 100, // Ensure minimum height
  },
  contentSmallScreen: {
    minHeight: 'auto', // Remove minimum height constraint on small screens
  },
  header: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  logoImage: {
    width: 120,
    height: 120,
  },
  logoImageSmall: {
    width: 80,
    height: 80,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  featuresContainer: {
    paddingVertical: spacing.md,
    marginBottom: spacing.xl,
  },
  featuresContainerSmall: {
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.black,
    ...shadows.sm,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    borderWidth: 2,
    borderColor: colors.black,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  featureDescription: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  buttonContainer: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  buttonContainerSmall: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  footerText: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});