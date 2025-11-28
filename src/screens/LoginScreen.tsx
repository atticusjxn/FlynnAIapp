import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useAuth } from '../context/AuthContext';
import { FlynnButton, FlynnInput, colors, typography, spacing, shadows, borderRadius } from '../components/ui';
import { LoginCarousel } from '../components/LoginCarousel';

const { height } = Dimensions.get('window');

export const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const { signIn, signUp } = useAuth();

  const handleSubmit = async () => {
    try {
      if (isSignUp) {
        await signUp(email, password, businessName);
      } else {
        await signIn(email, password);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Section: Carousel */}
      <View style={styles.carouselContainer}>
        <LoginCarousel />
      </View>

      {/* Bottom Section: Login Form */}
      <KeyboardAwareScrollView
        style={styles.formSection}
        contentContainerStyle={styles.scrollContent}
        extraScrollHeight={24}
        enableOnAndroid
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={styles.formContainer}>
          <Text style={styles.title}>FlynnAI</Text>
          <Text style={styles.subtitle}>
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </Text>

          {isSignUp && (
            <FlynnInput
              placeholder="Business Name"
              value={businessName}
              onChangeText={setBusinessName}
              autoCapitalize="words"
            />
          )}

          <FlynnInput
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
          />

          <FlynnInput
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <FlynnButton
            title={isSignUp ? 'Sign Up' : 'Sign In'}
            onPress={handleSubmit}
            variant="primary"
            fullWidth
            style={styles.submitButton}
          />

          <FlynnButton
            title={
              isSignUp
                ? 'Already have an account? Sign In'
                : "Don't have an account? Sign Up"
            }
            onPress={() => setIsSignUp(!isSignUp)}
            variant="ghost"
            style={styles.switchButton}
          />
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  carouselContainer: {
    height: height * 0.45, // Top 45%
    backgroundColor: colors.white,
  },
  formSection: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopWidth: 2,
    borderTopColor: colors.black,
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: spacing.xl,
  },
  formContainer: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
  },
  title: {
    ...typography.displayLarge,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  submitButton: {
    marginTop: spacing.md,
  },
  switchButton: {
    marginTop: spacing.lg,
  },
});
