import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { AuthTokenStorage } from '../services/authTokenStorage';
import { registerDevicePushToken } from '../services/pushRegistration';
import * as WebBrowser from 'expo-web-browser';

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
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      }
    });
    if (error) throw error;
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

      // Start the OAuth flow - Supabase handles the callback URL
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Supabase will use its own callback URL: https://zvfeafmmtfplzpnocyjw.supabase.co/auth/v1/callback
          skipBrowserRedirect: false,
        }
      });

      if (error) {
        console.error('[AuthContext] Google OAuth error:', error);
        throw error;
      }

      if (!data?.url) {
        throw new Error('No OAuth URL returned from Supabase');
      }

      console.log('[AuthContext] Opening OAuth URL');

      // Open the OAuth URL in the browser
      // Supabase's callback URL will handle the redirect and set the session
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        // Return to app after OAuth completes
        'flynnai://'
      );

      console.log('[AuthContext] OAuth result:', result);

      if (result.type === 'success') {
        // The session will be set automatically by the onAuthStateChange listener
        console.log('[AuthContext] Google OAuth successful');
      } else if (result.type === 'cancel') {
        throw new Error('Google sign-in was cancelled');
      } else {
        throw new Error('Google sign-in failed');
      }
    } catch (error) {
      console.error('[AuthContext] signInWithGoogle error:', error);
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
