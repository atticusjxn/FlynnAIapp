import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  TouchableOpacity,
  StyleProp,
} from 'react-native';
import { spacing, borderRadius, shadows } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

interface FlynnCardProps {
  children: React.ReactNode;
  variant?: 'default' | 'outlined' | 'elevated';
  padding?: 'none' | 'small' | 'medium' | 'large';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

export const FlynnCard: React.FC<FlynnCardProps> = ({
  children,
  variant = 'default',
  padding = 'medium',
  onPress,
  style,
  contentStyle,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const paddingStyles: Record<NonNullable<FlynnCardProps['padding']>, ViewStyle> = {
    none: styles.paddingNone,
    small: styles.paddingSmall,
    medium: styles.paddingMedium,
    large: styles.paddingLarge,
  };
  const Component = onPress ? TouchableOpacity : View;

  return (
    <Component
      style={[
        styles.base,
        styles[variant],
        paddingStyles[padding],
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

const createStyles = (colors: any) => StyleSheet.create({
  base: {
    borderRadius: borderRadius.lg,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.black,
  },

  // Variants
  default: {
    ...shadows.sm,
  },
  outlined: {
    borderWidth: 2,
    borderColor: colors.black,
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
  style?: StyleProp<ViewStyle>;
}

export const FlynnCardHeader: React.FC<FlynnCardHeaderProps> = ({
  children,
  style,
}) => {
  const { colors } = useTheme();
  const cardStyles = createCardStyles(colors);
  return (
    <View style={[cardStyles.header, style]}>
      {children}
    </View>
  );
};

// Card Content Component
interface FlynnCardContentProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const FlynnCardContent: React.FC<FlynnCardContentProps> = ({
  children,
  style,
}) => {
  const { colors } = useTheme();
  const cardStyles = createCardStyles(colors);
  return (
    <View style={[cardStyles.content, style]}>
      {children}
    </View>
  );
};

// Card Footer Component
interface FlynnCardFooterProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const FlynnCardFooter: React.FC<FlynnCardFooterProps> = ({
  children,
  style,
}) => {
  const { colors } = useTheme();
  const cardStyles = createCardStyles(colors);
  return (
    <View style={[cardStyles.footer, style]}>
      {children}
    </View>
  );
};

const createCardStyles = (colors: any) => StyleSheet.create({
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
