import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { AppState, AppStateStatus, Linking } from 'react-native';
import { supabase } from '../services/supabase';
import { AuthTokenStorage } from '../services/authTokenStorage';
import { registerDevicePushToken } from '../services/pushRegistration';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import Constants from 'expo-constants';

const AUTH_CALLBACK_URL = 'flynnai://auth/callback';

WebBrowser.maybeCompleteAuthSession();

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, businessName: string) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  signInWithOTP: (email: string) => Promise<void>;
  verifyOTP: (email: string, token: string) => Promise<void>;
  signInWithPhone: (phone: string) => Promise<void>;
  verifyPhoneOTP: (phone: string, token: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const appState = useRef(AppState.currentState);

  const updateSessionState = (nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    return AuthTokenStorage.storeSession(nextSession).catch((error) => {
      console.error('[AuthContext] Failed to persist auth session:', error);
    });
  };

  const restoreSessionFromStorage = async () => {
    try {
      console.log('[AuthContext] Attempting to restore session from storage');
      const storedSession = await AuthTokenStorage.getSession();

      if (storedSession) {
        console.log('[AuthContext] Found stored session, restoring');
        // Verify the session is still valid with Supabase
        const { data: { session: validSession }, error } = await supabase.auth.setSession({
          access_token: storedSession.access_token,
          refresh_token: storedSession.refresh_token,
        });

        if (error) {
          console.error('[AuthContext] Stored session invalid:', error);
          await AuthTokenStorage.clear();
          return null;
        }

        console.log('[AuthContext] Session restored successfully');
        return validSession;
      } else {
        console.log('[AuthContext] No stored session found');
        return null;
      }
    } catch (error) {
      console.error('[AuthContext] Error restoring session:', error);
      return null;
    }
  };

  // Handle app state changes (foreground/background)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      console.log('[AuthContext] AppState changed:', appState.current, '->', nextAppState);

      // When app comes to foreground from background
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[AuthContext] App came to foreground, checking session');

        // If we don't have a session but should have one (e.g., after payment sheet)
        // Try to restore from storage
        if (!session) {
          console.log('[AuthContext] No active session, attempting restore');
          const restoredSession = await restoreSessionFromStorage();
          if (restoredSession) {
            await updateSessionState(restoredSession);
          }
        } else {
          console.log('[AuthContext] Session exists, no restore needed');
        }
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [session]);

  useEffect(() => {
    console.log('[AuthContext] Initializing auth state');

    supabase.auth.getSession()
      .then(({ data: { session: supabaseSession } }) => {
        console.log('[AuthContext] Initial session from Supabase:', supabaseSession ? 'exists' : 'null');

        // If no session from Supabase, try to restore from storage
        if (!supabaseSession) {
          console.log('[AuthContext] No Supabase session, checking storage');
          restoreSessionFromStorage()
            .then((restoredSession) => {
              if (restoredSession) {
                void updateSessionState(restoredSession);
              } else {
                void updateSessionState(null);
              }
              setLoading(false);
            })
            .catch((error) => {
              console.error('[AuthContext] Error restoring from storage:', error);
              void updateSessionState(null);
              setLoading(false);
            });
        } else {
          void updateSessionState(supabaseSession);
          setLoading(false);
        }
      })
      .catch((error) => {
        console.error('[AuthContext] Error getting session:', error);
        // Try to restore from storage before giving up
        restoreSessionFromStorage()
          .then((restoredSession) => {
            if (restoredSession) {
              void updateSessionState(restoredSession);
            } else {
              void updateSessionState(null);
            }
            setLoading(false);
          })
          .catch((storageError) => {
            console.error('[AuthContext] Failed restoring from storage:', storageError);
            void updateSessionState(null);
            setLoading(false);
          });
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[AuthContext] Auth state changed:', _event);

      // Don't clear session on SIGNED_OUT if we're in the middle of a payment flow
      // (session might temporarily look signed out during deep link navigation)
      if (_event === 'SIGNED_OUT' && appState.current !== 'active') {
        console.log('[AuthContext] Ignoring SIGNED_OUT while app in background');
        return;
      }

      void updateSessionState(session ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    registerDevicePushToken().catch((error) => {
      console.warn('[AuthContext] Failed registering push notifications:', error);
    });
  }, [user]);

  // Handle email-confirmation / magic-link callbacks: flynnai://auth/callback?code=...
  useEffect(() => {
    const handleAuthCallback = async (url: string | null) => {
      if (!url || !url.startsWith('flynnai://auth/callback')) return;
      try {
        const parsed = new URL(url);
        const code = parsed.searchParams.get('code');
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          if (data?.session) await updateSessionState(data.session);
          return;
        }
        const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ''));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          if (data?.session) await updateSessionState(data.session);
        }
      } catch (e) {
        console.error('[AuthContext] Auth callback handling failed:', e);
      }
    };

    Linking.getInitialURL().then(handleAuthCallback);
    const sub = Linking.addEventListener('url', ({ url }) => handleAuthCallback(url));
    return () => sub.remove();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data?.session) {
      await updateSessionState(data.session);
    }
  };

  const signUp = async (email: string, password: string, businessName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { business_name: businessName },
        emailRedirectTo: AUTH_CALLBACK_URL,
      }
    });
    if (error) throw error;
    if (data?.session) {
      await updateSessionState(data.session);
      return { needsEmailConfirmation: false };
    }
    return { needsEmailConfirmation: true };
  };

  const signInWithPhone = async (phone: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      phone,
      options: { shouldCreateUser: true },
    });
    if (error) throw error;
  };

  const verifyPhoneOTP = async (phone: string, token: string) => {
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    });
    if (error) throw error;
    if (data?.session) {
      await updateSessionState(data.session);
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    await updateSessionState(null);
  };

  const signInWithOTP = async (email: string) => {
    console.log('[AuthContext] Sending OTP to email:', email);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      }
    });
    if (error) {
      console.error('[AuthContext] OTP send error:', error);
      console.error('[AuthContext] Error details:', JSON.stringify(error, null, 2));
      throw error;
    }
    console.log('[AuthContext] OTP sent successfully');
  };

  const verifyOTP = async (email: string, token: string) => {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email'
    });
    if (error) throw error;
    if (data?.session) {
      await updateSessionState(data.session);
    }
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'flynnai://reset-password',
    });
    if (error) throw error;
  };

  const signInWithGoogle = async () => {
    try {
      console.log('[AuthContext] Starting Google OAuth flow');

      // Generate proper redirect URI for mobile app
      // For Expo Go development, use useProxy to avoid redirect URL issues
      // For standalone builds, use custom scheme
      const redirectTo = makeRedirectUri({
        scheme: Constants.appOwnership === 'expo' ? undefined : 'flynnai',
        path: 'auth/callback',
        useProxy: Constants.appOwnership === 'expo', // Use proxy for Expo Go
      });

      console.log('[AuthContext] Generated redirect URI:', redirectTo);
      console.log('[AuthContext] App ownership:', Constants.appOwnership);

      // Start the OAuth flow - Supabase handles the callback URL
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: false,
        }
      });

      if (error) {
        console.error('[AuthContext] Google OAuth error:', error);
        console.error('[AuthContext] Error details:', JSON.stringify(error, null, 2));
        throw error;
      }

      if (!data?.url) {
        const errorMsg = 'No OAuth URL returned from Supabase';
        console.error('[AuthContext]', errorMsg);
        throw new Error(errorMsg);
      }

      console.log('[AuthContext] OAuth URL received, opening browser');
      console.log('[AuthContext] OAuth URL:', data.url);

      // Open the OAuth URL in the browser
      // Supabase's callback URL will handle the redirect and set the session
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo
      );

      console.log('[AuthContext] OAuth browser result:', JSON.stringify(result, null, 2));

      if (result.type === 'success') {
        console.log('[AuthContext] Google OAuth successful');
        if ('url' in result && result.url) {
          console.log('[AuthContext] Callback URL:', result.url);
          const callbackUrl = new URL(result.url);
          const code = callbackUrl.searchParams.get('code');
          let nextSession: Session | null = null;

          if (code) {
            const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            if (exchangeError) {
              console.error('[AuthContext] Error exchanging code for session:', exchangeError);
              throw exchangeError;
            }
            nextSession = exchangeData.session ?? null;
          } else {
            const hashParams = new URLSearchParams(callbackUrl.hash.replace(/^#/, ''));
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');
            if (accessToken && refreshToken) {
              const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              if (sessionError) {
                console.error('[AuthContext] Error setting session from callback:', sessionError);
                throw sessionError;
              }
              nextSession = sessionData.session ?? null;
            }
          }

          if (nextSession) {
            await updateSessionState(nextSession);
          } else {
            console.warn('[AuthContext] No session information found in OAuth callback URL');
          }
        } else {
          console.warn('[AuthContext] OAuth result missing callback URL');
        }
      } else if (result.type === 'cancel') {
        const errorMsg = 'Google sign-in was cancelled by user';
        console.log('[AuthContext]', errorMsg);
        throw new Error(errorMsg);
      } else {
        const errorMsg = `Google sign-in failed with result type: ${result.type}`;
        console.error('[AuthContext]', errorMsg);
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('[AuthContext] signInWithGoogle error:', error);
      if (error instanceof Error) {
        console.error('[AuthContext] Error message:', error.message);
        console.error('[AuthContext] Error stack:', error.stack);
      }
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signIn,
      signUp,
      signOut,
      signInWithOTP,
      verifyOTP,
      signInWithPhone,
      verifyPhoneOTP,
      resetPassword,
      signInWithGoogle
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
