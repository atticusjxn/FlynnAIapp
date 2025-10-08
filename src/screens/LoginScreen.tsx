import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import {
  FlynnButton,
  FlynnInput,
  FlynnKeyboardAwareScrollView,
  FlynnKeyboardAvoidingView,
  colors,
  typography,
  spacing,
} from '../components/ui';

const KOALA_LOGO = require('../../assets/images/onboardinglogo.png');

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
    <FlynnKeyboardAvoidingView style={styles.container} dismissOnTapOutside>
        <FlynnKeyboardAwareScrollView
          contentContainerStyle={styles.scrollContent}
          enableAutomaticScroll={false}
          extraScrollHeight={0}
        >
          <View style={styles.formWrapper}>
            <View style={styles.formContainer}>
              <Image source={KOALA_LOGO} style={styles.logo} accessibilityLabel="FlynnAI koala" />
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
          </View>
        </FlynnKeyboardAwareScrollView>
    </FlynnKeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  formWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  formContainer: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  logo: {
    width: 96,
    height: 96,
    alignSelf: 'center',
    marginBottom: spacing.lg,
    resizeMode: 'contain',
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
