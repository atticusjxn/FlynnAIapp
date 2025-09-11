import React, { useState, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  Modal,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { typography, spacing, borderRadius, shadows } from '../../theme';
import { BlurView } from 'expo-blur';

interface FloatingActionButtonProps {
  onUploadScreenshot: () => void;
  onQuickAddJob: () => void;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  onUploadScreenshot,
  onQuickAddJob,
}) => {
  const { colors } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const rotateAnimation = useRef(new Animated.Value(0)).current;
  const scaleAnimation = useRef(new Animated.Value(1)).current;
  const styles = createStyles(colors);

  const handlePress = () => {
    const toValue = isOpen ? 0 : 1;
    
    // Rotate animation
    Animated.parallel([
      Animated.spring(rotateAnimation, {
        toValue,
        useNativeDriver: true,
        tension: 40,
        friction: 7,
      }),
      Animated.spring(scaleAnimation, {
        toValue: isOpen ? 1 : 0.95,
        useNativeDriver: true,
        tension: 40,
        friction: 7,
      }),
    ]).start();

    setIsOpen(!isOpen);
  };

  const handleActionPress = (action: () => void) => {
    setIsOpen(false);
    Animated.parallel([
      Animated.spring(rotateAnimation, {
        toValue: 0,
        useNativeDriver: true,
        tension: 40,
        friction: 7,
      }),
      Animated.spring(scaleAnimation, {
        toValue: 1,
        useNativeDriver: true,
        tension: 40,
        friction: 7,
      }),
    ]).start();
    action();
  };

  const spin = rotateAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  return (
    <>
      {/* Action Sheet Modal */}
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsOpen(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.actionSheet}>
                <View style={styles.actionSheetHandle} />
                <Text style={styles.actionSheetTitle}>Quick Actions</Text>
                
                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={() => handleActionPress(onUploadScreenshot)}
                  activeOpacity={0.7}
                >
                  <View style={styles.actionIconContainer}>
                    <MaterialIcons name="file-upload" size={24} color={colors.primary} />
                  </View>
                  <View style={styles.actionTextContainer}>
                    <Text style={styles.actionTitle}>Upload Screenshot</Text>
                    <Text style={styles.actionDescription}>Extract job details from a screenshot</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={() => handleActionPress(onQuickAddJob)}
                  activeOpacity={0.7}
                >
                  <View style={styles.actionIconContainer}>
                    <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                  </View>
                  <View style={styles.actionTextContainer}>
                    <Text style={styles.actionTitle}>Quick Add Job</Text>
                    <Text style={styles.actionDescription}>Manually create a new job</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Floating Action Button */}
      <Animated.View style={[styles.fabContainer, { transform: [{ scale: scaleAnimation }] }]}>
        <TouchableOpacity
          style={styles.fab}
          onPress={handlePress}
          activeOpacity={0.8}
        >
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Ionicons name="add" size={28} color={colors.white} />
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    </>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 24,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl + 20, // Extra padding for home indicator
    paddingTop: spacing.md,
  },
  actionSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.gray300,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  actionSheetTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: spacing.xxs,
  },
  actionDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});