'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';

/**
 * Root page — redirects authenticated users to /dashboard, others to /login.
 * Industry standard: keep '/' as a thin redirect so bookmarks and direct links work.
 */
export default function RootPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Show nothing while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-neo-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
