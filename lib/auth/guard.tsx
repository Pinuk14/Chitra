'use client';

/**
 * Route Guard Component
 * 
 * DESIGN DECISION: Wraps protected pages. Shows a loading state during
 * initial auth check, then redirects to /login if unauthenticated.
 * This prevents flash-of-content for protected routes.
 */

import React from 'react';
import { useAuth } from './context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-neo-bg rounded-neo shadow-neo-md p-8 flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-neo-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-neo-text text-sm font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  return <>{children}</>;
}
