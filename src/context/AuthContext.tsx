import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { AuthTokenStorage } from '../services/authTokenStorage';
import { registerDevicePushToken } from '../services/pushRegistration';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, businessName: string) => Promise<void>;
  signOut: () => Promise<void>;
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

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
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
