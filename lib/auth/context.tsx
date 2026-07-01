'use client';

/**
 * Authentication Context Provider
 * 
 * DESIGN DECISION: Uses PocketBase's built-in authStore which handles
 * token management, auto-refresh, and secure storage. The "Keep me logged in"
 * feature controls whether authStore persists to localStorage.
 * 
 * This context is the SINGLE entry point for all auth operations.
 * Components should never call pb.collection('users').auth* directly.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { pb } from '@/lib/api';

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
  login: (identity: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (username: string, email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Map PocketBase auth model to our User interface
  const mapUser = useCallback((model: any): User | null => {
    if (!model) return null;
    return {
      id: model.id,
      username: model.username || '',
      email: model.email || '',
      name: model.name || model.username || '',
      avatar: model.avatar || '',
    };
  }, []);

  // Initialize auth state from PocketBase's authStore
  useEffect(() => {
    const model = pb.authStore.record;
    if (pb.authStore.isValid && model) {
      setUser(mapUser(model));
    }
    setIsLoading(false);

    // Listen for auth state changes
    const unsubscribe = pb.authStore.onChange((_token, model) => {
      setUser(mapUser(model));
    });

    return () => unsubscribe();
  }, [mapUser]);

  const login = useCallback(async (identity: string, password: string, rememberMe = false) => {
    try {
      const result = await pb.collection('users').authWithPassword(identity, password);
      setUser(mapUser(result.record));

      // If "Keep me logged in" is NOT checked, mark session as temporary.
      // PocketBase SDK persists to localStorage by default. For non-persistent sessions,
      // we'll clear the auth on the next tab close via beforeunload.
      if (!rememberMe) {
        sessionStorage.setItem('chitra_temp_session', 'true');
      } else {
        sessionStorage.removeItem('chitra_temp_session');
      }
    } catch (err: any) {
      const message = err?.response?.message || err?.message || 'Login failed';
      throw new Error(message);
    }
  }, [mapUser]);

  const register = useCallback(async (username: string, email: string, password: string, name?: string) => {
    try {
      // Create the user account
      await pb.collection('users').create({
        username,
        email,
        password,
        passwordConfirm: password,
        name: name || username,
      });

      // Auto-login after registration
      const result = await pb.collection('users').authWithPassword(username, password);
      setUser(mapUser(result.record));
    } catch (err: any) {
      // Extract validation errors from PocketBase response
      const data = err?.response?.data;
      if (data) {
        if (data.username?.code === 'validation_not_unique') {
          throw new Error('Username is already taken');
        }
        if (data.email?.code === 'validation_not_unique') {
          throw new Error('Email is already registered');
        }
        if (data.password?.message) {
          throw new Error(data.password.message);
        }
      }
      throw new Error(err?.message || 'Registration failed');
    }
  }, [mapUser]);

  const logout = useCallback(() => {
    pb.authStore.clear();
    setUser(null);
    sessionStorage.removeItem('chitra_temp_session');
  }, []);

  const updateProfile = useCallback(async (data: Partial<User>) => {
    if (!user) throw new Error('Not authenticated');
    const updated = await pb.collection('users').update(user.id, data);
    setUser(mapUser(updated));
  }, [user, mapUser]);

  // Handle temporary sessions — clear auth when tab closes
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (sessionStorage.getItem('chitra_temp_session') === 'true') {
        pb.authStore.clear();
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
