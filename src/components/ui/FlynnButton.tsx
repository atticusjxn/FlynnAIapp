import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  View,
} from 'react-native';
import { spacing, typography, borderRadius, shadows, opacity } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

interface FlynnButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const FlynnButton: React.FC<FlynnButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  style,
  textStyle,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  
  const handlePress = () => {
    if (!disabled && !loading) {
      onPress();
    }
  };

  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        styles[variant],
        styles[size],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={handlePress}
      disabled={isDisabled}
      activeOpacity={opacity.pressed}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={getTextColor(variant, colors)}
            style={styles.loader}
          />
        ) : (
          <>
            {icon && iconPosition === 'left' && (
              <View style={styles.iconLeft}>{icon}</View>
            )}
            <Text
              style={[
                styles.text,
                styles[`text${variant.charAt(0).toUpperCase() + variant.slice(1)}`],
                styles[`text${size.charAt(0).toUpperCase() + size.slice(1)}`],
                isDisabled && styles.textDisabled,
                textStyle,
              ]}
            >
              {title}
            </Text>
            {icon && iconPosition === 'right' && (
              <View style={styles.iconRight}>{icon}</View>
            )}
          </>
        )}
      </View>
    </TouchableOpacity>
  );
};

const getTextColor = (variant: string, colors: any): string => {
  switch (variant) {
    case 'secondary':
    case 'ghost':
      return colors.primary;
    default:
      return colors.white;
  }
};

const createStyles = (colors: any) => StyleSheet.create({
  base: {
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44, // iOS accessibility minimum
    ...shadows.sm,
  },
  
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Variants
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  success: {
    backgroundColor: colors.success,
  },
  danger: {
    backgroundColor: colors.error,
  },
  ghost: {
    backgroundColor: colors.transparent,
    ...shadows.none,
  },
  
  // Sizes
  small: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  medium: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  large: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  
  // States
  disabled: {
    backgroundColor: colors.gray300,
    opacity: opacity.disabled,
    ...shadows.none,
  },
  
  fullWidth: {
    width: '100%',
  },
  
  // Text styles
  text: {
    ...typography.button,
    textAlign: 'center',
  },
  textPrimary: {
    color: colors.white,
  },
  textSecondary: {
    color: colors.primary,
  },
  textSuccess: {
    color: colors.white,
  },
  textDanger: {
    color: colors.white,
  },
  textGhost: {
    color: colors.primary,
  },
  
  // Text sizes
  textSmall: {
    fontSize: 14,
    lineHeight: 20,
  },
  textMedium: {
    fontSize: 16,
    lineHeight: 24,
  },
  textLarge: {
    fontSize: 18,
    lineHeight: 26,
  },
  
  textDisabled: {
    color: colors.gray500,
  },
  
  // Icon styles
  iconLeft: {
    marginRight: spacing.xs,
  },
  iconRight: {
    marginLeft: spacing.xs,
  },
  
  loader: {
    marginHorizontal: spacing.xs,
  },
});