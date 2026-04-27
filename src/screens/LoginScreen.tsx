import React, { useState, useEffect, useRef } from 'react';
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
  TextInput,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { FlynnButton, FlynnInput, colors, typography, spacing, shadows, borderRadius } from '../components/ui';
import { Mail, Sparkles, ArrowLeft, Phone } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';

// Simple Google Logo SVG
const GoogleIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </Svg>
);

type AuthMode =
  | 'landing'
  | 'phone_signup'      // phone-entry framed for new users
  | 'phone_login'       // phone-entry framed for returning users (pre-fills phone)
  | 'phone_verify'      // SMS OTP entry
  | 'email_picker'      // chooser between code and password
  | 'email_code'
  | 'email_password'
  | 'signup';           // email/password signup

const LAST_PHONE_KEY = 'flynn:last_login_phone';

const formatPhoneForSubmit = (raw: string): string => {
  const trimmed = raw.trim().replace(/\s+/g, '');
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return trimmed;
  // Default to AU country code if user typed a local number
  const stripped = trimmed.replace(/^0/, '');
  return `+61${stripped}`;
};

export const LoginScreen = () => {
  const {
    signIn, signUp,
    signInWithOTP, verifyOTP,
    signInWithPhone, verifyPhoneOTP,
    resetPassword, signInWithGoogle,
  } = useAuth();
  const [mode, setMode] = useState<AuthMode>('landing');

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const passwordRef = useRef<TextInput>(null);
  const codeRef = useRef<TextInput>(null);
  const signupEmailRef = useRef<TextInput>(null);
  const signupPasswordRef = useRef<TextInput>(null);
  const phoneCodeRef = useRef<TextInput>(null);

  // When entering "Login" mode, pre-fill the last phone used
  useEffect(() => {
    if (mode === 'phone_login') {
      AsyncStorage.getItem(LAST_PHONE_KEY).then((stored) => {
        if (stored) setPhone(stored);
      });
    }
  }, [mode]);

  const resetMessages = () => {
    setError('');
    setSuccessMessage('');
  };

  const goToLanding = () => {
    setMode('landing');
    resetMessages();
    setCode('');
    setCodeSent(false);
  };

  // ── Phone flow ─────────────────────────────────────────────────────────
  const handleSendPhoneCode = async () => {
    setLoading(true);
    resetMessages();
    try {
      const formatted = formatPhoneForSubmit(phone);
      if (!formatted || formatted.length < 8) {
        throw new Error('Please enter a valid mobile number.');
      }
      await signInWithPhone(formatted);
      setPhone(formatted);
      setMode('phone_verify');
      setSuccessMessage('Code sent — check your messages.');
    } catch (e: any) {
      setError(e.message || 'Failed to send code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPhoneCode = async () => {
    setLoading(true);
    resetMessages();
    try {
      await verifyPhoneOTP(phone, code);
      // Persist for "Login" mode pre-fill on next visit
      await AsyncStorage.setItem(LAST_PHONE_KEY, phone).catch(() => {});
    } catch (e: any) {
      setError(e.message || 'Invalid code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Existing email + Google flows ───────────────────────────────────────
  const handleGoogleLogin = async () => {
    setLoading(true);
    resetMessages();
    try {
      await signInWithGoogle();
    } catch (e: any) {
      setError(e.message || 'Failed to sign in with Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailCodeSubmit = async () => {
    setLoading(true);
    resetMessages();
    try {
      if (!codeSent) {
        await signInWithOTP(email);
        setCodeSent(true);
        setSuccessMessage('Code sent — check your email.');
      } else {
        await verifyOTP(email, code);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to process email code.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailPasswordSubmit = async () => {
    setLoading(true);
    resetMessages();
    try {
      await signIn(email, password);
    } catch (e: any) {
      setError(e.message || 'Failed to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUpSubmit = async () => {
    setLoading(true);
    resetMessages();
    try {
      const result = await signUp(email, password, businessName);
      if (result.needsEmailConfirmation) {
        setSuccessMessage(`Check your email — we sent a confirmation link to ${email}. Tap it to finish signing up.`);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to sign up.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }
    setLoading(true);
    resetMessages();
    try {
      await resetPassword(email);
      setSuccessMessage('Password reset email sent — check your inbox.');
    } catch (e: any) {
      setError(e.message || 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  // ── Render helpers ─────────────────────────────────────────────────────
  const renderBackButton = () => (
    <TouchableOpacity onPress={goToLanding} style={styles.backButton}>
      <ArrowLeft size={24} color={colors.black} />
    </TouchableOpacity>
  );

  const renderLanding = () => (
    <>
      {/* Hero — fills top third */}
      <View style={styles.hero}>
        <View style={styles.logoBlock}>
          <Text style={styles.logoText}>
            Flynn<Text style={styles.logoAccent}>.ai</Text>
          </Text>
        </View>
        <Text style={styles.heroTagline}>Never miss{'\n'}another lead.</Text>
        <Text style={styles.heroSubcopy}>
          The AI receptionist for tradies and service businesses.
        </Text>
      </View>

      {/* Primary action stack */}
      <View style={styles.primaryActions}>
        <FlynnButton
          title="Sign up with your phone number"
          onPress={() => { setMode('phone_signup'); resetMessages(); setPhone(''); }}
          variant="primary"
          icon={<Phone size={20} color={colors.white} />}
          iconPosition="left"
          fullWidth
          style={styles.primaryCta}
        />

        <TouchableOpacity
          onPress={() => { setMode('phone_login'); resetMessages(); }}
          style={styles.loginLink}
        >
          <Text style={styles.loginLinkText}>
            Already have an account? <Text style={styles.loginLinkBold}>Login</Text>
          </Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.tertiaryRow}>
          <TouchableOpacity
            style={styles.tertiaryButton}
            onPress={handleGoogleLogin}
            disabled={loading}
          >
            <GoogleIcon />
            <Text style={styles.tertiaryButtonText}>Google</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.tertiaryButton}
            onPress={() => { setMode('email_picker'); resetMessages(); }}
          >
            <Mail size={18} color={colors.black} />
            <Text style={styles.tertiaryButtonText}>Email</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.termsText}>
          By continuing, you accept our{' '}
          <Text style={styles.termsLink} onPress={() => Linking.openURL('https://flynn.ai/terms')}>Terms</Text>
          {' & '}
          <Text style={styles.termsLink} onPress={() => Linking.openURL('https://flynn.ai/privacy')}>Privacy Policy</Text>.
        </Text>
      </View>
    </>
  );

  const renderPhoneEntry = (variant: 'signup' | 'login') => (
    <>
      {renderBackButton()}
      <View style={styles.formHeader}>
        <Text style={styles.formTitle}>
          {variant === 'signup' ? 'Sign up with your phone number' : 'Welcome back'}
        </Text>
        <Text style={styles.formSubtitle}>
          We'll text you a 6-digit code to verify it's you.
        </Text>
      </View>
      <View style={styles.formContainer}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <FlynnInput
          label="Mobile number"
          placeholder="+61 412 345 678"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          returnKeyType="send"
          onSubmitEditing={handleSendPhoneCode}
        />
        <FlynnButton
          title="Send code"
          onPress={handleSendPhoneCode}
          loading={loading}
          fullWidth
          style={styles.submitButton}
        />
      </View>
    </>
  );

  const renderPhoneVerify = () => (
    <>
      {renderBackButton()}
      <View style={styles.formHeader}>
        <Text style={styles.formTitle}>Enter your code</Text>
        <Text style={styles.formSubtitle}>Sent to {phone}</Text>
      </View>
      <View style={styles.formContainer}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}
        <FlynnInput
          ref={phoneCodeRef}
          label="6-digit code"
          placeholder="000000"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
          textContentType="oneTimeCode"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleVerifyPhoneCode}
        />
        <FlynnButton
          title="Verify"
          onPress={handleVerifyPhoneCode}
          loading={loading}
          fullWidth
          style={styles.submitButton}
        />
        <TouchableOpacity onPress={() => { setMode('phone_signup'); setCode(''); resetMessages(); }}>
          <Text style={styles.linkText}>Use a different number</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderEmailPicker = () => (
    <>
      {renderBackButton()}
      <View style={styles.formHeader}>
        <Text style={styles.formTitle}>Continue with email</Text>
      </View>
      <View style={styles.formContainer}>
        <FlynnButton
          title="Email code (no password)"
          onPress={() => setMode('email_code')}
          variant="secondary"
          icon={<Sparkles size={20} color={colors.warning} />}
          iconPosition="left"
          fullWidth
          style={styles.actionButton}
          textStyle={styles.actionButtonText}
        />
        <FlynnButton
          title="Email & password"
          onPress={() => setMode('email_password')}
          variant="secondary"
          icon={<Mail size={20} color={colors.primary} />}
          iconPosition="left"
          fullWidth
          style={styles.actionButton}
          textStyle={styles.actionButtonText}
        />
        <View style={styles.footerLinks}>
          <Text style={styles.footerText}>New here?</Text>
          <TouchableOpacity onPress={() => setMode('signup')}>
            <Text style={styles.linkText}>Sign up with email</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );

  const renderEmailCode = () => (
    <>
      {renderBackButton()}
      <View style={styles.formHeader}>
        <Text style={styles.formTitle}>Log in with email code</Text>
      </View>
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
          autoComplete="email"
          textContentType="emailAddress"
          editable={!codeSent}
          returnKeyType={codeSent ? 'next' : 'send'}
          onSubmitEditing={() => {
            if (codeSent) codeRef.current?.focus();
            else handleEmailCodeSubmit();
          }}
          blurOnSubmit={!codeSent}
        />
        {codeSent && (
          <FlynnInput
            ref={codeRef}
            label="Enter 6-digit code"
            placeholder="000000"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            textContentType="oneTimeCode"
            returnKeyType="done"
            onSubmitEditing={handleEmailCodeSubmit}
          />
        )}
        <FlynnButton
          title={codeSent ? 'Verify code' : 'Send login code'}
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
      {renderBackButton()}
      <View style={styles.formHeader}>
        <Text style={styles.formTitle}>Log in</Text>
      </View>
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
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          blurOnSubmit={false}
        />
        <FlynnInput
          ref={passwordRef}
          label="Password"
          placeholder="Enter your password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          returnKeyType="done"
          onSubmitEditing={handleEmailPasswordSubmit}
        />
        <FlynnButton
          title="Log in"
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
      {renderBackButton()}
      <View style={styles.formHeader}>
        <Text style={styles.formTitle}>Sign up with email</Text>
      </View>
      <View style={styles.formContainer}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}
        <FlynnInput
          label="Business name"
          placeholder="Acme Plumbing"
          value={businessName}
          onChangeText={setBusinessName}
          autoComplete="organization"
          textContentType="organizationName"
          returnKeyType="next"
          onSubmitEditing={() => signupEmailRef.current?.focus()}
          blurOnSubmit={false}
        />
        <FlynnInput
          ref={signupEmailRef}
          label="Email address"
          placeholder="name@company.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => signupPasswordRef.current?.focus()}
          blurOnSubmit={false}
        />
        <FlynnInput
          ref={signupPasswordRef}
          label="Password"
          placeholder="Create a password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password-new"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={handleSignUpSubmit}
        />
        <FlynnButton
          title="Sign up"
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
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {mode === 'landing' && renderLanding()}
            {mode === 'phone_signup' && renderPhoneEntry('signup')}
            {mode === 'phone_login' && renderPhoneEntry('login')}
            {mode === 'phone_verify' && renderPhoneVerify()}
            {mode === 'email_picker' && renderEmailPicker()}
            {mode === 'email_code' && renderEmailCode()}
            {mode === 'email_password' && renderEmailPassword()}
            {mode === 'signup' && renderSignUp()}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    minHeight: 600,
  },
  // Hero (landing) — fills empty top space
  hero: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  logoBlock: {
    marginBottom: spacing.lg,
  },
  logoText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 56,
    fontWeight: '900',
    color: colors.gray800,
    letterSpacing: -2,
  },
  logoAccent: { color: colors.primary },
  heroTagline: {
    ...typography.displayMedium,
    color: colors.black,
    textAlign: 'center',
    fontWeight: '900',
    lineHeight: 44,
    marginBottom: spacing.sm,
  },
  heroSubcopy: {
    ...typography.bodyLarge,
    color: colors.gray600,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  // Primary actions on landing
  primaryActions: {
    width: '100%',
    gap: spacing.md,
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: spacing.md,
  },
  primaryCta: {
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  loginLink: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  loginLinkText: {
    ...typography.bodyMedium,
    color: colors.gray600,
  },
  loginLinkBold: {
    color: colors.primary,
    fontWeight: '700',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.sm,
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.gray200,
  },
  dividerText: {
    ...typography.bodySmall,
    color: colors.gray400,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tertiaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  tertiaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
  },
  tertiaryButtonText: {
    ...typography.bodyMedium,
    color: colors.black,
    fontWeight: '500',
  },
  // Form-mode shared
  backButton: {
    alignSelf: 'flex-start',
    padding: spacing.sm,
    marginBottom: spacing.sm,
    marginLeft: -spacing.sm,
  },
  formHeader: {
    marginBottom: spacing.lg,
  },
  formTitle: {
    ...typography.h1,
    color: colors.black,
    marginBottom: spacing.xs,
  },
  formSubtitle: {
    ...typography.bodyLarge,
    color: colors.gray600,
  },
  formContainer: {
    width: '100%',
    gap: spacing.md,
    flex: 1,
  },
  actionButton: {
    backgroundColor: colors.white,
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
  submitButton: { marginTop: spacing.sm },
  forgotPassword: { alignItems: 'center', marginTop: spacing.md },
  footerLinks: {
    alignItems: 'center',
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  footerText: { ...typography.bodyMedium, color: colors.gray600 },
  linkText: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '700',
    textAlign: 'center',
  },
  footer: { alignItems: 'center', marginTop: spacing.lg, paddingBottom: spacing.md },
  termsText: { ...typography.caption, color: colors.gray500, textAlign: 'center', lineHeight: 18 },
  termsLink: { textDecorationLine: 'underline', color: colors.gray700 },
  errorText: {
    ...typography.bodyMedium,
    color: colors.error,
    textAlign: 'center',
    backgroundColor: colors.errorLight,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  successText: {
    ...typography.bodyMedium,
    color: colors.success,
    textAlign: 'center',
    backgroundColor: colors.successLight,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
});
