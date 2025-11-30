import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Linking,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { FlynnButton, FlynnInput, colors, typography, spacing, shadows, borderRadius } from '../components/ui';
import { Mail, Sparkles, KeyRound, ArrowLeft } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';

// Simple Google Logo SVG
const GoogleIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <Path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <Path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <Path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </Svg>
);

type AuthMode = 'landing' | 'email_code' | 'email_password' | 'signup';

export const LoginScreen = () => {
  const { signIn, signUp, signInWithOTP, verifyOTP, resetPassword, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<AuthMode>('landing');

  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Handlers
  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailCodeSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      if (!codeSent) {
        // Step 1: Send the code
        await signInWithOTP(email);
        setCodeSent(true);
        setSuccessMessage('Code sent! Check your email.');
      } else {
        // Step 2: Verify the code
        await verifyOTP(email, code);
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Failed to process email code');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailPasswordSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      await signIn(email, password);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUpSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      await signUp(email, password, businessName);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Failed to sign up');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address first');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await resetPassword(email);
      setSuccessMessage('Password reset email sent! Check your inbox.');
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  const renderHeader = (title: string, subtitle?: string) => (
    <View style={styles.header}>
      {mode !== 'landing' && (
        <TouchableOpacity onPress={() => setMode('landing')} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.black} />
        </TouchableOpacity>
      )}
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );

  const renderLanding = () => (
    <>
      {renderHeader('Flynn.ai', 'The phone system\nfor better customer\nservice')}
      <View style={styles.actions}>
        <FlynnButton
          title="Continue with Google"
          onPress={handleGoogleLogin}
          variant="secondary"
          icon={<GoogleIcon />}
          iconPosition="left"
          style={styles.actionButton}
          textStyle={styles.actionButtonText}
          fullWidth
        />
        <View style={styles.divider}>
          <Text style={styles.dividerText}>Or log in with your email</Text>
        </View>
        <FlynnButton
          title="Email code"
          onPress={() => setMode('email_code')}
          variant="secondary"
          icon={<Sparkles size={20} color={colors.warning} />}
          iconPosition="left"
          style={styles.actionButton}
          textStyle={styles.actionButtonText}
          fullWidth
        />
        <FlynnButton
          title="Email & password"
          onPress={() => setMode('email_password')}
          variant="secondary"
          icon={<Mail size={20} color={colors.primary} />}
          iconPosition="left"
          style={styles.actionButton}
          textStyle={styles.actionButtonText}
          fullWidth
        />
        <View style={styles.footerLinks}>
          <Text style={styles.footerText}>Don't have an account yet?</Text>
          <TouchableOpacity onPress={() => setMode('signup')}>
            <Text style={styles.linkText}>Sign up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );

  const renderEmailCode = () => (
    <>
      {renderHeader('Log in with code')}
      <View style={styles.formContainer}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}
        <FlynnInput
          label="Email address"
          placeholder="name@company.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!codeSent}
        />
        {codeSent && (
          <FlynnInput
            label="Enter 6-digit code"
            placeholder="000000"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
          />
        )}
        <FlynnButton
          title={codeSent ? "Verify Code" : "Send Login Code"}
          onPress={handleEmailCodeSubmit}
          loading={loading}
          fullWidth
          style={styles.submitButton}
        />
        {codeSent && (
          <TouchableOpacity onPress={() => { setCodeSent(false); setCode(''); setSuccessMessage(''); }}>
            <Text style={styles.linkText}>Use a different email</Text>
          </TouchableOpacity>
        )}
      </View>
    </>
  );

  const renderEmailPassword = () => (
    <>
      {renderHeader('Log in')}
      <View style={styles.formContainer}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}
        <FlynnInput
          label="Email address"
          placeholder="name@company.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <FlynnInput
          label="Password"
          placeholder="Enter your password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <FlynnButton
          title="Log In"
          onPress={handleEmailPasswordSubmit}
          loading={loading}
          fullWidth
          style={styles.submitButton}
        />
        <TouchableOpacity style={styles.forgotPassword} onPress={handleForgotPassword}>
          <Text style={styles.linkText}>Forgot password?</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderSignUp = () => (
    <>
      {renderHeader('Create Account')}
      <View style={styles.formContainer}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}
        <FlynnButton
          title="Continue with Google"
          onPress={handleGoogleLogin}
          variant="secondary"
          icon={<GoogleIcon />}
          iconPosition="left"
          style={styles.actionButton}
          textStyle={styles.actionButtonText}
          fullWidth
        />
        <View style={styles.divider}>
          <Text style={styles.dividerText}>Or sign up with email</Text>
        </View>
        <FlynnInput
          label="Business Name"
          placeholder="Acme Corp"
          value={businessName}
          onChangeText={setBusinessName}
        />
        <FlynnInput
          label="Email address"
          placeholder="name@company.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <FlynnInput
          label="Password"
          placeholder="Create a password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <FlynnButton
          title="Sign Up"
          onPress={handleSignUpSubmit}
          loading={loading}
          fullWidth
          style={styles.submitButton}
        />
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            {mode === 'landing' && renderLanding()}
            {mode === 'email_code' && renderEmailCode()}
            {mode === 'email_password' && renderEmailPassword()}
            {mode === 'signup' && renderSignUp()}

            {/* Footer Terms - Always visible or only on landing? Quo shows it on landing. */}
            {mode === 'landing' && (
              <View style={styles.footer}>
                <Text style={styles.termsText}>
                  By continuing, you acknowledge and accept our{'\n'}
                  <Text style={styles.termsLink} onPress={() => Linking.openURL('https://flynn.ai/terms')}>Terms of Service</Text>
                  {' and '}
                  <Text style={styles.termsLink} onPress={() => Linking.openURL('https://flynn.ai/privacy')}>Privacy Policy</Text>.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'space-between',
    paddingVertical: spacing.xxl,
    minHeight: 600, // Ensure minimum height for layout
  },
  header: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
    position: 'relative',
    width: '100%',
  },
  backButton: {
    position: 'absolute',
    left: -spacing.xs,
    top: spacing.xs,
    padding: spacing.sm,
    zIndex: 10,
  },
  title: {
    ...typography.displayMedium,
    color: colors.black,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.h2,
    color: colors.black,
    textAlign: 'center',
    lineHeight: 32,
  },
  actions: {
    width: '100%',
    gap: spacing.md,
    flex: 1,
    justifyContent: 'center',
  },
  formContainer: {
    width: '100%',
    gap: spacing.lg,
    flex: 1,
  },
  actionButton: {
    backgroundColor: colors.white,
    // Re-applying theme styles to match "Brutalist" but "High Quality":
    borderColor: colors.black,
    borderWidth: 2,
    ...shadows.sm,
    justifyContent: 'flex-start',
    paddingHorizontal: spacing.lg,
  },
  actionButtonText: {
    flex: 1,
    textAlign: 'center',
    color: colors.black,
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
  },
  divider: {
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  dividerText: {
    ...typography.bodyMedium,
    color: colors.gray500,
  },
  footerLinks: {
    alignItems: 'center',
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  footerText: {
    ...typography.bodyMedium,
    color: colors.gray600,
  },
  linkText: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '700',
  },
  footer: {
    alignItems: 'center',
    marginBottom: spacing.md,
    marginTop: 'auto',
  },
  termsText: {
    ...typography.caption,
    color: colors.gray400,
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    textDecorationLine: 'underline',
    color: colors.gray500,
  },
  submitButton: {
    marginTop: spacing.md,
  },
  forgotPassword: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  errorText: {
    ...typography.bodyMedium,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.sm,
    backgroundColor: colors.errorLight,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  successText: {
    ...typography.bodyMedium,
    color: colors.success,
    textAlign: 'center',
    marginBottom: spacing.sm,
    backgroundColor: colors.successLight,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
});
