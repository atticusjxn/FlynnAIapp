import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';
import { colors, spacing, borderRadius, shadows } from '../../theme';

interface FlynnCardProps {
  children: React.ReactNode;
  variant?: 'default' | 'outlined' | 'elevated';
  padding?: 'none' | 'small' | 'medium' | 'large';
  onPress?: () => void;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}

export const FlynnCard: React.FC<FlynnCardProps> = ({
  children,
  variant = 'default',
  padding = 'medium',
  onPress,
  style,
  contentStyle,
}) => {
  const Component = onPress ? TouchableOpacity : View;
  
  return (
    <Component
      style={[
        styles.base,
        styles[variant],
        styles[`padding${padding.charAt(0).toUpperCase() + padding.slice(1)}`],
        style,
      ]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={contentStyle}>
        {children}
      </View>
    </Component>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.lg,
    backgroundColor: colors.white,
  },
  
  // Variants
  default: {
    ...shadows.sm,
  },
  outlined: {
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.none,
  },
  elevated: {
    ...shadows.md,
  },
  
  // Padding variants
  paddingNone: {
    padding: 0,
  },
  paddingSmall: {
    padding: spacing.sm,
  },
  paddingMedium: {
    padding: spacing.md,
  },
  paddingLarge: {
    padding: spacing.lg,
  },
});

// Card Header Component
interface FlynnCardHeaderProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const FlynnCardHeader: React.FC<FlynnCardHeaderProps> = ({
  children,
  style,
}) => {
  return (
    <View style={[styles.header, style]}>
      {children}
    </View>
  );
};

// Card Content Component
interface FlynnCardContentProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const FlynnCardContent: React.FC<FlynnCardContentProps> = ({
  children,
  style,
}) => {
  return (
    <View style={[styles.content, style]}>
      {children}
    </View>
  );
};

// Card Footer Component
interface FlynnCardFooterProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const FlynnCardFooter: React.FC<FlynnCardFooterProps> = ({
  children,
  style,
}) => {
  return (
    <View style={[styles.footer, style]}>
      {children}
    </View>
  );
};

const cardStyles = StyleSheet.create({
  header: {
    marginBottom: spacing.sm,
  },
  content: {
    flex: 1,
  },
  footer: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});

// Merge styles
Object.assign(styles, cardStyles);