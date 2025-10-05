import React from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  KeyboardAvoidingViewProps,
  Platform,
  StyleProp,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface FlynnKeyboardAvoidingViewProps extends KeyboardAvoidingViewProps {
  children: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  dismissOnTapOutside?: boolean;
}

export const FlynnKeyboardAvoidingView: React.FC<FlynnKeyboardAvoidingViewProps> = ({
  behavior,
  keyboardVerticalOffset,
  style,
  contentContainerStyle,
  dismissOnTapOutside = false,
  children,
  ...rest
}) => {
  const insets = useSafeAreaInsets();
  const resolvedBehavior = behavior ?? (Platform.OS === 'ios' ? 'padding' : 'height');
  const resolvedOffset =
    keyboardVerticalOffset ?? insets.top + (Platform.OS === 'ios' ? 16 : 0);

  const renderContent = () => (
    <View style={[styles.flex, contentContainerStyle]}>{children}</View>
  );

  return (
    <KeyboardAvoidingView
      behavior={resolvedBehavior}
      keyboardVerticalOffset={resolvedOffset}
      style={[styles.flex, style]}
      {...rest}
    >
      {dismissOnTapOutside ? (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          {renderContent()}
        </TouchableWithoutFeedback>
      ) : (
        renderContent()
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
