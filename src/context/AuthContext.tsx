import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { AuthTokenStorage } from '../services/authTokenStorage';
import { registerDevicePushToken } from '../services/pushRegistration';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, businessName: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithOTP: (email: string) => Promise<void>;
  verifyOTP: (email: string, token: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const updateSessionState = (nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    return AuthTokenStorage.storeSession(nextSession).catch((error) => {
      console.error('[AuthContext] Failed to persist auth session:', error);
    });
  };

  useEffect(() => {
    console.log('[AuthContext] Initializing auth state');

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        console.log('[AuthContext] Initial session:', session ? 'exists' : 'null');
        void updateSessionState(session ?? null);
        setLoading(false);
      })
      .catch((error) => {
        console.error('[AuthContext] Error getting session:', error);
        AuthTokenStorage.clear().catch((storageError) => {
          console.error('[AuthContext] Failed clearing session storage:', storageError);
        });
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[AuthContext] Auth state changed:', _event);
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
        data: { business_name: businessName }
      }
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
      const redirectTo = makeRedirectUri({
        scheme: 'flynnai',
        path: 'auth/callback'
      });

      console.log('[AuthContext] Generated redirect URI:', redirectTo);

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
        // The session will be set automatically by the onAuthStateChange listener
        console.log('[AuthContext] Google OAuth successful');
        if ('url' in result) {
          console.log('[AuthContext] Callback URL:', result.url);
        }

        // Manually refresh session to ensure immediate state update
        console.log('[AuthContext] Manually refreshing session after OAuth');
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.getSession();
        if (refreshError) {
          console.error('[AuthContext] Error refreshing session:', refreshError);
        } else if (refreshedSession) {
          console.log('[AuthContext] Session refreshed successfully');
          await updateSessionState(refreshedSession);
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
