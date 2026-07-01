'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const router = useRouter();
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already logged in
  React.useEffect(() => {
    if (isAuthenticated) router.replace('/');
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!identity.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(identity.trim(), password, rememberMe);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="neo-card w-full max-w-md">
        <h1 className="text-4xl text-center text-neo-accent mb-2" style={{ fontFamily: 'var(--font-brushy)' }}>
          Chitra
        </h1>
        <p className="text-center text-neo-text/60 text-sm mb-8">Sign in to your account</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-neo px-4 py-3 text-red-500 text-sm text-center">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label htmlFor="identity" className="text-sm font-medium text-neo-text">Username or Email</label>
            <input
              id="identity"
              type="text"
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
              className="neo-input w-full"
              placeholder="Enter username or email"
              autoComplete="username"
              disabled={isSubmitting}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="text-sm font-medium text-neo-text">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="neo-input w-full"
              placeholder="Enter password"
              autoComplete="current-password"
              disabled={isSubmitting}
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div className="relative">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-5 h-5 rounded-md bg-neo-bg shadow-neo-inset peer-checked:bg-neo-accent transition-colors" />
              <svg
                className="absolute top-0.5 left-0.5 w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <span className="text-sm text-neo-text">Keep me logged in</span>
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="neo-button w-full text-center font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <span className="text-sm text-neo-text/60">Don&apos;t have an account? </span>
          <Link href="/register" className="text-sm font-bold text-neo-accent hover:underline">
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
