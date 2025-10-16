import React, { forwardRef } from 'react';
import {
  KeyboardAwareScrollView as RNKeyboardAwareScrollView,
  KeyboardAwareScrollViewProps,
} from 'react-native-keyboard-aware-scroll-view';
import { Platform, StyleSheet } from 'react-native';
import type { KeyboardAwareScrollView as RNKeyboardAwareScrollViewType } from 'react-native-keyboard-aware-scroll-view';

interface FlynnKeyboardAwareScrollViewProps extends KeyboardAwareScrollViewProps {
  children: React.ReactNode;
}

export const FlynnKeyboardAwareScrollView = forwardRef<
  RNKeyboardAwareScrollViewType,
  FlynnKeyboardAwareScrollViewProps
>(({ contentContainerStyle,
  enableAutomaticScroll = true,
  enableOnAndroid = true,
  extraScrollHeight = 24,
  keyboardDismissMode,
  keyboardShouldPersistTaps = 'handled',
  ...rest
}, ref) => {
  const resolvedDismissMode =
    keyboardDismissMode ?? (Platform.OS === 'ios' ? 'interactive' : 'on-drag');

  return (
    <RNKeyboardAwareScrollView
      ref={ref}
      enableAutomaticScroll={enableAutomaticScroll}
      enableOnAndroid={enableOnAndroid}
      extraScrollHeight={extraScrollHeight}
      keyboardDismissMode={resolvedDismissMode}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
      {...rest}
    />
  );
});

FlynnKeyboardAwareScrollView.displayName = 'FlynnKeyboardAwareScrollView';

const styles = StyleSheet.create({
  contentContainer: {
    flexGrow: 1,
  },
});
