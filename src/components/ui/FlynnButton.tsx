import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  View,
  StyleProp,
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
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
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
  const variantTextStyles: Record<NonNullable<FlynnButtonProps['variant']>, TextStyle> = {
    primary: styles.textPrimary,
    secondary: styles.textSecondary,
    success: styles.textSuccess,
    danger: styles.textDanger,
    ghost: styles.textGhost,
  };
  const sizeTextStyles: Record<NonNullable<FlynnButtonProps['size']>, TextStyle> = {
    small: styles.textSmall,
    medium: styles.textMedium,
    large: styles.textLarge,
  };

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
                variantTextStyles[variant],
                sizeTextStyles[size],
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
    minHeight: 56, // Larger touch target
    borderWidth: 2,
    borderColor: colors.black,
    ...shadows.sm, // Hard shadow
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
    // Border is already in base, but we can override if needed
  },
  success: {
    backgroundColor: colors.success,
  },
  danger: {
    backgroundColor: colors.error,
  },
  ghost: {
    backgroundColor: colors.transparent,
    borderWidth: 0,
    ...shadows.none,
  },

  // Sizes
  small: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    minHeight: 40,
  },
  medium: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    minHeight: 56,
  },
  large: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    minHeight: 64,
  },

  // States
  disabled: {
    backgroundColor: colors.gray300,
    borderColor: colors.gray500,
    opacity: 1, // Keep opacity high for readability, use color to indicate disabled
    ...shadows.none,
    transform: [{ translateY: 2 }, { translateX: 2 }], // "Pressed" state for disabled
  },

  fullWidth: {
    width: '100%',
  },

  // Text styles
  text: {
    ...typography.button,
    textAlign: 'center',
    color: colors.black, // Default text color
  },
  textPrimary: {
    color: colors.white,
  },
  textSecondary: {
    color: colors.black,
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
    color: colors.gray600,
  },

  // Icon styles
  iconLeft: {
    marginRight: spacing.sm,
  },
  iconRight: {
    marginLeft: spacing.sm,
  },

  loader: {
    marginHorizontal: spacing.xs,
  },
});
