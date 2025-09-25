import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, shadows } from '../../theme';
import { FlynnCard } from '../../components/ui/FlynnCard';
import { FlynnButton } from '../../components/ui/FlynnButton';
import { useNavigation } from '@react-navigation/native';
import shortcutHandler from '../../services/ShortcutHandler';
import ShortcutSharingService from '../../services/ShortcutSharingService';

export const ShortcutSetupScreen = () => {
  const navigation = useNavigation<any>();
  const [isTestingShortcut, setIsTestingShortcut] = useState(false);
  const [isAddingShortcut, setIsAddingShortcut] = useState(false);

  const handleAddToSiri = async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert(
        'iOS Only',
        'iOS Shortcuts are only available on iOS devices. This feature will be available when you install Flynn AI on an iPhone or iPad.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsAddingShortcut(true);
    
    try {
      // Try the shared shortcut approach first (most reliable)
      const success = await ShortcutSharingService.installShortcut();

      if (success) {
        // Show success message after a delay (user will be in Shortcuts app)
        setTimeout(() => {
          Alert.alert(
            'Almost Done! ✨',
            'Just tap "Add Shortcut" in the Shortcuts app to complete setup.\n\nThen you can use it from Control Center or say "Hey Siri, process screenshot with Flynn"',
            [{ text: 'Great!' }]
          );
        }, 1000);
        return;
      }

      // If the automatic install couldn't launch, fall back to manual instructions
      handleManualSetup();
    } catch (error) {
      console.error('Error adding shortcut to Siri:', error);
      Alert.alert(
        'Setup Error',
        'Could not present the shortcut setup dialog. Would you like to try manual setup instead?',
        [
          { text: 'Manual Setup', onPress: handleManualSetup },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } finally {
      setIsAddingShortcut(false);
    }
  };

  const handleManualSetup = async () => {
    try {
      if (Platform.OS !== 'ios') {
        Alert.alert(
          'iOS Only',
          'iOS Shortcuts are only available on iOS devices. This feature will be available when you install Flynn AI on an iPhone or iPad.',
          [{ text: 'OK' }]
        );
        return;
      }

      Alert.alert(
        'Manual Setup',
        'If the automatic setup didn\'t work, you can create the shortcut manually:\n\n1. Open the Shortcuts app\n2. Tap the "+" to create a new shortcut\n3. Search for "Take Screenshot" and add it\n4. Add "Open URLs" action\n5. Set URL to: flynn-ai://process-screenshot\n6. Add the shortcut to Control Center',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Shortcuts App', onPress: openShortcutsApp }
        ]
      );
    } catch (error) {
      console.error('Error showing manual setup:', error);
      Alert.alert('Error', 'Could not show setup instructions. Please try again.');
    }
  };

  const openShortcutsApp = async () => {
    try {
      const shortcutsURL = 'shortcuts://';
      const canOpen = await Linking.canOpenURL(shortcutsURL);
      
      if (canOpen) {
        await Linking.openURL(shortcutsURL);
      } else {
        Alert.alert('Error', 'Could not open Shortcuts app. Please open it manually from your home screen.');
      }
    } catch (error) {
      console.error('Error opening Shortcuts app:', error);
      Alert.alert('Error', 'Could not open Shortcuts app. Please open it manually from your home screen.');
    }
  };

  const testShortcut = async () => {
    setIsTestingShortcut(true);
    
    try {
      const isWorking = await shortcutHandler.testShortcut();
      
      if (isWorking) {
        Alert.alert(
          'Success!',
          'Your shortcut is properly configured and ready to use.',
          [{ text: 'Great!' }]
        );
      } else {
        Alert.alert(
          'Setup Needed',
          'Your shortcut is not yet configured. Please follow the setup instructions above.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error testing shortcut:', error);
      Alert.alert(
        'Test Failed',
        'Could not test the shortcut configuration. Please make sure you have followed all setup steps.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsTestingShortcut(false);
    }
  };

  const setupSteps = [
    {
      title: 'One-Tap Setup',
      description: 'Tap "Add to Siri" to instantly add the pre-made shortcut',
      icon: 'flash' as keyof typeof Ionicons.glyphMap,
    },
    {
      title: 'Automatic Configuration',
      description: 'iOS will automatically configure everything for you',
      icon: 'settings' as keyof typeof Ionicons.glyphMap,
    },
    {
      title: 'Ready to Use',
      description: 'Access from Control Center or voice command instantly',
      icon: 'checkmark-circle' as keyof typeof Ionicons.glyphMap,
    },
  ];

  const manualSteps = [
    {
      title: 'Open Shortcuts App',
      description: 'Find and tap the Shortcuts app on your iPhone',
      icon: 'apps' as keyof typeof Ionicons.glyphMap,
    },
    {
      title: 'Create New Shortcut',
      description: 'Tap the "+" button to create a new shortcut',
      icon: 'add-circle' as keyof typeof Ionicons.glyphMap,
    },
    {
      title: 'Add Take Screenshot',
      description: 'Search for "Take Screenshot" action and add it',
      icon: 'camera' as keyof typeof Ionicons.glyphMap,
    },
    {
      title: 'Add Open URL Action',
      description: 'Add "Open URLs" action and set to: flynn-ai://process-screenshot',
      icon: 'link' as keyof typeof Ionicons.glyphMap,
    },
    {
      title: 'Add to Control Center',
      description: 'In shortcut settings, enable "Use with Control Center"',
      icon: 'settings' as keyof typeof Ionicons.glyphMap,
    },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.gray700} />
        </TouchableOpacity>
        <Text style={styles.title}>iOS Shortcuts Setup</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlynnCard style={styles.introCard}>
        <View style={styles.introContent}>
          <View style={styles.iconContainer}>
            <Ionicons name="flash" size={32} color={colors.primary} />
          </View>
          <Text style={styles.introTitle}>One-Tap Shortcut Setup</Text>
          <Text style={styles.introDescription}>
            Add a pre-made Flynn AI shortcut to your device with just one tap. No manual configuration needed!
            {__DEV__ && '\n\n✨ One-tap installation available in production builds'}
          </Text>
        </View>
      </FlynnCard>

      <View style={styles.stepsSection}>
        <Text style={styles.sectionTitle}>How It Works</Text>
        {setupSteps.map((step, index) => (
          <FlynnCard key={index} style={styles.stepCard}>
            <View style={styles.stepContent}>
              <View style={styles.stepIconContainer}>
                <Text style={styles.stepNumber}>{index + 1}</Text>
              </View>
              <View style={styles.stepTextContainer}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepDescription}>{step.description}</Text>
              </View>
              <Ionicons name={step.icon} size={24} color={colors.primary} />
            </View>
          </FlynnCard>
        ))}
      </View>

      <View style={styles.actionsSection}>
        <FlynnButton
          title={isAddingShortcut ? "Adding to Siri..." : "Add to Siri"}
          onPress={handleAddToSiri}
          disabled={isAddingShortcut}
          icon={<Ionicons name="add-circle" size={20} color={colors.white} />}
          style={styles.primaryButton}
        />
        
        <FlynnButton
          title="Manual Setup"
          onPress={handleManualSetup}
          variant="secondary"
          icon={<Ionicons name="construct" size={20} color={colors.primary} />}
          style={styles.secondaryButton}
        />
        
        <FlynnButton
          title={isTestingShortcut ? "Testing..." : "Test Shortcut"}
          onPress={testShortcut}
          variant="ghost"
          disabled={isTestingShortcut}
          icon={<Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
          style={styles.tertiaryButton}
        />
      </View>

      <FlynnCard style={styles.tipsCard}>
        <Text style={styles.tipsTitle}>Tips for Best Results</Text>
        <View style={styles.tipItem}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={styles.tipText}>Make sure screenshots include the entire conversation</Text>
        </View>
        <View style={styles.tipItem}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={styles.tipText}>Ensure text is clear and readable</Text>
        </View>
        <View style={styles.tipItem}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={styles.tipText}>Include date, time, and location details when possible</Text>
        </View>
      </FlynnCard>

      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
  },
  backButton: {
    padding: spacing.xs,
  },
  title: {
    ...typography.h2,
    color: colors.gray800,
  },
  introCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  introContent: {
    alignItems: 'center',
    padding: spacing.lg,
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
  introTitle: {
    ...typography.h3,
    color: colors.gray800,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  introDescription: {
    ...typography.bodyMedium,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: 22,
  },
  stepsSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.gray700,
    marginBottom: spacing.md,
  },
  stepCard: {
    marginBottom: spacing.sm,
  },
  stepContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  stepIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  stepNumber: {
    ...typography.caption,
    color: colors.white,
    fontWeight: 'bold',
  },
  stepTextContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },
  stepTitle: {
    ...typography.bodyMedium,
    color: colors.gray800,
    fontWeight: '600',
    marginBottom: spacing.xxs,
  },
  stepDescription: {
    ...typography.bodySmall,
    color: colors.gray600,
    lineHeight: 18,
  },
  actionsSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  primaryButton: {
    marginBottom: spacing.sm,
  },
  secondaryButton: {
    marginBottom: spacing.sm,
  },
  tertiaryButton: {
    marginBottom: spacing.md,
  },
  tipsCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  tipsTitle: {
    ...typography.h4,
    color: colors.gray700,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  tipText: {
    ...typography.bodySmall,
    color: colors.gray600,
    marginLeft: spacing.sm,
    flex: 1,
    lineHeight: 18,
  },
  bottomSpacing: {
    height: spacing.xl,
  },
});
