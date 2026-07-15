'use client';

/**
 * Authentication Context Provider (Supabase)
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/api';
import { generateUserExchangeKeyPair, generateSigningKeyPair, exportKeyAsJWK } from '@/lib/security/crypto';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';

async function initializeUserCrypto(userId: string) {
  if (typeof window === 'undefined') return;
  const exKey = localStorage.getItem(`crypto_ex_${userId}`);
  const signKey = localStorage.getItem(`crypto_sign_${userId}`);

  if (exKey && signKey) return; // Already initialized on this device

  try {
    const exchangeKeys = await generateUserExchangeKeyPair();
    const signKeys = await generateSigningKeyPair();

    const pubExJwk = await exportKeyAsJWK(exchangeKeys.publicKey);
    const privExJwk = await exportKeyAsJWK(exchangeKeys.privateKey);
    const pubSignJwk = await exportKeyAsJWK(signKeys.publicKey);
    const privSignJwk = await exportKeyAsJWK(signKeys.privateKey);

    localStorage.setItem(`crypto_ex_${userId}`, JSON.stringify(privExJwk));
    localStorage.setItem(`crypto_sign_${userId}`, JSON.stringify(privSignJwk));

    await supabase.from('profiles').update({
      public_key_exchange: JSON.stringify(pubExJwk),
      public_key_sign: JSON.stringify(pubSignJwk)
    }).eq('id', userId);
  } catch (err) {
    console.error('Failed to initialize user crypto:', err);
  }
}

interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  avatar: string;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  loginAnonymously: () => Promise<void>;
  register: (username: string, email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Map Supabase auth and profile to our User interface
  const fetchAndSetUser = useCallback(async (sbUser: SupabaseUser | null) => {
    if (!sbUser) {
      setUser(null);
      return;
    }

    try {
      // Fetch profile data
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sbUser.id)
        .single();

      setUser({
        id: sbUser.id,
        email: sbUser.email || '',
        username: profile?.username || sbUser.user_metadata?.username || (sbUser.is_anonymous ? `Guest_${sbUser.id.substring(0, 5)}` : ''),
        name: profile?.name || sbUser.user_metadata?.name || (sbUser.is_anonymous ? 'Guest User' : ''),
        avatar: profile?.avatar || '',
      });
      await initializeUserCrypto(sbUser.id);
    } catch (err) {
      console.error('Error fetching user profile:', err);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    // Initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetchAndSetUser(session?.user || null).finally(() => setIsLoading(false));
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      fetchAndSetUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, [fetchAndSetUser]);

  const login = useCallback(async (email: string, password: string, rememberMe = false) => {
    // Supabase signInWithPassword natively requires email
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      throw new Error(error.message || 'Login failed');
    }

    // Temporary session handling (Supabase persists by default)
    if (!rememberMe) {
      sessionStorage.setItem('chitra_temp_session', 'true');
    } else {
      sessionStorage.removeItem('chitra_temp_session');
    }
  }, []);

  const loginAnonymously = useCallback(async () => {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      throw new Error(error.message || 'Anonymous login failed');
    }
    sessionStorage.setItem('chitra_temp_session', 'true');
  }, []);

  const register = useCallback(async (username: string, email: string, password: string, name?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          name: name || username
        }
      }
    });

    if (error) {
      if (error.message.includes('User already registered')) {
         throw new Error('Email is already registered');
      }
      throw new Error(error.message || 'Registration failed');
    }
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    sessionStorage.removeItem('chitra_temp_session');
  }, []);

  const updateProfile = useCallback(async (data: Partial<User>) => {
    if (!user) throw new Error('Not authenticated');
    
    const { error } = await supabase.from('profiles').update(data).eq('id', user.id);
    if (error) throw new Error(error.message);
    
    setUser(prev => prev ? { ...prev, ...data } : null);
  }, [user]);

  // Handle temporary sessions — clear auth when tab closes
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (sessionStorage.getItem('chitra_temp_session') === 'true') {
        // We can't await inside beforeunload, so we just clear local storage tokens
        // Supabase uses 'sb-[project]-auth-token'
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
            localStorage.removeItem(key);
          }
        });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      loginAnonymously,
      register,
      logout,
      updateProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
