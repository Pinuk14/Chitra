'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

// Pre-generated random drop positions and timings for SSR-safe rendering
const INK_DROPS = [
  { left: '8%',  size: 10, delay: 0,    dur: 4.2, color: '#6C63FF' },
  { left: '17%', size: 7,  delay: 1.3,  dur: 5.5, color: '#FF6B6B' },
  { left: '26%', size: 14, delay: 0.6,  dur: 3.8, color: '#4ECDC4' },
  { left: '35%', size: 8,  delay: 2.1,  dur: 6.0, color: '#6C63FF' },
  { left: '44%', size: 12, delay: 0.3,  dur: 4.7, color: '#FF9F1C' },
  { left: '53%', size: 6,  delay: 1.8,  dur: 5.2, color: '#8338EC' },
  { left: '62%', size: 16, delay: 0.9,  dur: 3.5, color: '#FF6B6B' },
  { left: '71%', size: 9,  delay: 2.5,  dur: 6.5, color: '#4ECDC4' },
  { left: '79%', size: 11, delay: 0.1,  dur: 4.9, color: '#6C63FF' },
  { left: '88%', size: 7,  delay: 1.5,  dur: 5.8, color: '#FF006E' },
  { left: '13%', size: 13, delay: 3.0,  dur: 4.1, color: '#FFE66D' },
  { left: '58%', size: 5,  delay: 3.7,  dur: 7.0, color: '#9D4EDD' },
  { left: '91%', size: 10, delay: 2.8,  dur: 3.9, color: '#2EC4B6' },
  { left: '4%',  size: 8,  delay: 4.2,  dur: 5.3, color: '#FF9F1C' },
  { left: '74%', size: 15, delay: 1.0,  dur: 4.4, color: '#E71D36' },
];

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const router = useRouter();
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (isAuthenticated) router.replace('/dashboard');
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
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 relative overflow-hidden">
      
      {/* ── Falling ink drops ── */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {INK_DROPS.map((drop, i) => (
          <div
            key={i}
            className="absolute rounded-full drop-fall"
            style={{
              left: drop.left,
              top: `-${drop.size * 2}px`,
              width: drop.size,
              height: drop.size * 1.4,
              backgroundColor: drop.color,
              opacity: 0.55,
              animationDelay: `${drop.delay}s`,
              animationDuration: `${drop.dur}s`,
              filter: 'blur(0.5px)',
              borderRadius: '50% 50% 60% 60%',
            }}
          />
        ))}
      </div>

      {/* ── Wild SVG scribbles ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 opacity-[0.12]"
           style={{ animation: 'floatDrift 20s ease-in-out infinite' }}>
        <svg className="w-full h-full min-w-[900px] min-h-[700px]" viewBox="0 0 1000 800"
             xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">

          {/* Large bold sweeping strokes */}
          <path d="M-80,120 Q 200,-60 450,250 T 850,150 T 1100,400"
            fill="none" stroke="#6C63FF" strokeWidth="8" strokeLinecap="round"
            className="scribble-anim" />

          <path d="M1100,50 Q 750,350 500,200 T 100,500 T -100,350"
            fill="none" stroke="#FF6B6B" strokeWidth="6" strokeLinecap="round"
            className="scribble-anim-2" />

          <path d="M0,800 Q 300,400 600,700 T 900,300 T 1100,600"
            fill="none" stroke="#4ECDC4" strokeWidth="10" strokeLinecap="round"
            className="scribble-anim-3" />

          <path d="M500,-50 Q 700,200 400,450 T 600,750 T 200,600"
            fill="none" stroke="#FF9F1C" strokeWidth="5" strokeLinecap="round"
            className="scribble-anim-4" />

          <path d="M-100,300 Q 150,600 400,350 T 800,550 T 1100,200"
            fill="none" stroke="#8338EC" strokeWidth="12" strokeLinecap="round"
            className="scribble-anim-5" />

          {/* Chaotic zigzag strokes */}
          <path d="M0,400 L 80,200 L 160,500 L 240,150 L 320,480 L 400,100 L 480,550 L 560,200 L 640,600 L 720,100 L 800,500 L 880,80 L 1000,450"
            fill="none" stroke="#FF006E" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
            className="scribble-anim-6" />

          <path d="M1000,600 Q 700,100 400,600 T -100,200"
            fill="none" stroke="#FFE66D" strokeWidth="9" strokeLinecap="round"
            className="scribble-anim-7" />

          <path d="M200,800 Q 500,500 300,200 T 700,0 T 900,400"
            fill="none" stroke="#2EC4B6" strokeWidth="7" strokeLinecap="round"
            className="scribble-anim-8" />

          {/* Ink splat blobs */}
          <circle cx="100" cy="150" r="40" fill="#6C63FF" className="blob-pulse"
            style={{ animationDuration: '3s', animationDelay: '0s', opacity: 0.5 }} />
          <circle cx="870" cy="680" r="55" fill="#FF6B6B" className="blob-pulse"
            style={{ animationDuration: '4s', animationDelay: '1s', opacity: 0.4 }} />
          <circle cx="500" cy="50" r="30" fill="#4ECDC4" className="blob-pulse"
            style={{ animationDuration: '5s', animationDelay: '2s', opacity: 0.5 }} />
          <circle cx="950" cy="200" r="45" fill="#8338EC" className="blob-pulse"
            style={{ animationDuration: '3.5s', animationDelay: '0.5s', opacity: 0.4 }} />
          <circle cx="50" cy="650" r="35" fill="#FF9F1C" className="blob-pulse"
            style={{ animationDuration: '4.5s', animationDelay: '1.5s', opacity: 0.5 }} />
          <circle cx="700" cy="400" r="25" fill="#FF006E" className="blob-pulse"
            style={{ animationDuration: '2.8s', animationDelay: '0.3s', opacity: 0.4 }} />
        </svg>
      </div>

      {/* ── Login card ── */}
      <div className="neo-card w-full max-w-md relative z-10 bg-neo-bg/85 backdrop-blur-md">
        {/* Logo */}
        <div className="flex justify-center mb-4">
          <Image src="/Chitra_logo.png" alt="Chitra" width={80} height={80}
            className="object-contain drop-shadow-lg" />
        </div>

        <h1 className="text-4xl text-center text-neo-accent mb-1" style={{ fontFamily: 'var(--font-brushy)' }}>
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
            <input id="identity" type="text" value={identity}
              onChange={(e) => setIdentity(e.target.value)}
              className="neo-input w-full" placeholder="Enter username or email"
              autoComplete="username" disabled={isSubmitting} />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="text-sm font-medium text-neo-text">Password</label>
            <input id="password" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="neo-input w-full" placeholder="Enter password"
              autoComplete="current-password" disabled={isSubmitting} />
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div className="relative">
              <input type="checkbox" checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)} className="sr-only peer" />
              <div className="w-5 h-5 rounded-md bg-neo-bg shadow-neo-inset peer-checked:bg-neo-accent transition-colors" />
              <svg className="absolute top-0.5 left-0.5 w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <span className="text-sm text-neo-text">Keep me logged in</span>
          </label>

          <button type="submit" disabled={isSubmitting}
            className="neo-button w-full text-center font-bold disabled:opacity-50 disabled:cursor-not-allowed">
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
