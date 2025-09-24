import React from 'react';
import {
  KeyboardAvoidingView,
  KeyboardAvoidingViewProps,
  Platform,
  StyleSheet,
} from 'react-native';

interface FlynnKeyboardAvoidingViewProps extends KeyboardAvoidingViewProps {
  children: React.ReactNode;
}

export const FlynnKeyboardAvoidingView: React.FC<FlynnKeyboardAvoidingViewProps> = ({
  behavior,
  keyboardVerticalOffset,
  style,
  children,
  ...rest
}) => {
  const resolvedBehavior = behavior ?? (Platform.OS === 'ios' ? 'padding' : 'height');
  const resolvedOffset =
    keyboardVerticalOffset ?? (Platform.OS === 'ios' ? 16 : 0);

  return (
    <KeyboardAvoidingView
      behavior={resolvedBehavior}
      keyboardVerticalOffset={resolvedOffset}
      style={[styles.flex, style]}
      {...rest}
    >
      {children}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
