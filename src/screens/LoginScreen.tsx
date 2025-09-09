import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { FlynnButton, FlynnInput, colors, typography, spacing } from '../components/ui';

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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
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
          keyboardType="email-address"
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
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  formContainer: {
    flex: 1,
    justifyContent: 'center',
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