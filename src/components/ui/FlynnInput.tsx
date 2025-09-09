import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TextInputProps,
} from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../theme';

interface FlynnInputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  helperText?: string;
  errorText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  labelStyle?: TextStyle;
  required?: boolean;
}

export const FlynnInput: React.FC<FlynnInputProps> = ({
  label,
  helperText,
  errorText,
  leftIcon,
  rightIcon,
  containerStyle,
  inputStyle,
  labelStyle,
  required = false,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const hasError = Boolean(errorText);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, labelStyle]}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}
      
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputContainerFocused,
          hasError && styles.inputContainerError,
          props.editable === false && styles.inputContainerDisabled,
        ]}
      >
        {leftIcon && (
          <View style={styles.leftIconContainer}>
            {leftIcon}
          </View>
        )}
        
        <TextInput
          style={[
            styles.input,
            leftIcon ? styles.inputWithLeftIcon : undefined,
            rightIcon ? styles.inputWithRightIcon : undefined,
            inputStyle,
          ]}
          placeholderTextColor={colors.textPlaceholder}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        
        {rightIcon && (
          <View style={styles.rightIconContainer}>
            {rightIcon}
          </View>
        )}
      </View>
      
      {helperText && !hasError && (
        <Text style={styles.helperText}>{helperText}</Text>
      )}
      
      {hasError && (
        <Text style={styles.errorText}>{errorText}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  
  label: {
    ...typography.label,
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  
  required: {
    color: colors.error,
  },
  
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
    minHeight: 48,
  },
  
  inputContainerFocused: {
    borderColor: colors.borderFocus,
    borderWidth: 2,
  },
  
  inputContainerError: {
    borderColor: colors.borderError,
  },
  
  inputContainerDisabled: {
    backgroundColor: colors.gray100,
    borderColor: colors.gray200,
  },
  
  input: {
    flex: 1,
    paddingTop: spacing.sm + 0,
    paddingBottom: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    ...typography.bodyMedium,
    color: colors.textPrimary,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  
  inputWithLeftIcon: {
    paddingLeft: spacing.xs,
  },
  
  inputWithRightIcon: {
    paddingRight: spacing.xs,
  },
  
  leftIconContainer: {
    paddingLeft: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  rightIconContainer: {
    paddingRight: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  helperText: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.xxs,
    marginLeft: spacing.xxs,
  },
  
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xxs,
    marginLeft: spacing.xxs,
  },
});