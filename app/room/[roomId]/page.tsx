'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Canvas } from '@/components/Canvas';
import { Toolbar } from '@/components/Toolbar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { UserList } from '@/components/UserList';
import { ShareRoom } from '@/components/ShareRoom';
import { ChatRoom } from '@/components/ChatRoom';
import { WaitingRoom } from '@/components/WaitingRoom';
import { AdminPanel } from '@/components/AdminPanel';
import { useAuth } from '@/lib/auth/context';
import { AuthGuard } from '@/lib/auth/guard';
import { useRoomAccess } from '@/hooks/useRoomAccess';
import { hasPermission } from '@/lib/security/permissions';
import Image from 'next/image';
import Link from 'next/link';

function RoomContent() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const { user, logout } = useAuth();
  const access = useRoomAccess(roomId);
  const [showChat, setShowChat] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  const isAdmin = access.role ? hasPermission(access.role, 'approve_users') : false;
  const memberColor = access.memberRecord?.color;
  const isMuted = access.memberRecord?.status === 'muted';

  // Loading state
  if (access.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-neo-bg rounded-neo shadow-neo-md p-8 flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-neo-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-neo-text text-sm">Checking room access...</p>
        </div>
      </div>
    );
  }

  // Waiting for approval
  if (access.status === 'pending') {
    return (
      <WaitingRoom
        message={access.message}
        onCancel={() => router.push('/')}
      />
    );
  }

  // Denied or banned
  if (access.status === 'denied' || access.status === 'banned') {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="neo-card w-full max-w-md text-center">
          <h1 className="text-4xl text-neo-accent mb-4" style={{ fontFamily: 'var(--font-brushy)' }}>
            Chitra
          </h1>
          <div className="flex justify-center mb-4 text-neo-text">
            {access.status === 'banned' ? (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
              </svg>
            ) : (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            )}
          </div>
          <h2 className="text-xl font-bold text-neo-text mb-2">
            {access.status === 'banned' ? 'You Are Banned' : 'Access Denied'}
          </h2>
          <p className="text-sm text-neo-text/60 mb-8">
            {access.message}
          </p>
          <button onClick={() => router.push('/')} className="neo-button">
            Return Home
          </button>
        </div>
      </div>
    );
  }

  // Granted — render the whiteboard
  return (
    <div className="min-h-screen flex flex-col p-8 gap-8 max-w-[1600px] mx-auto">
      <div className="flex justify-between items-center bg-neo-bg shadow-neo-sm p-4 rounded-neo">
        <Link href="/dashboard" className="flex items-center gap-2 group">
          <Image src="/Chitra_logo.png" alt="Chitra" width={32} height={32} className="object-contain" />
          <h1 className="text-3xl text-neo-accent group-hover:opacity-80 transition-opacity" style={{ fontFamily: 'var(--font-brushy)' }}>Chitra</h1>
        </Link>
        <div className="flex gap-3 items-center">
          <div className="flex items-center gap-2 bg-neo-bg rounded-neo shadow-neo-inset px-3 py-1.5 hidden sm:flex">
            <span className="text-[10px] text-neo-text/40 font-mono mt-0.5">Room: {roomId}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(roomId);
                alert('Room ID copied!');
              }}
              className="text-[10px] bg-neo-bg px-2 py-1 rounded shadow-neo-sm text-neo-text hover:shadow-neo-md transition-shadow font-bold"
              title="Copy Room ID"
            >
              Copy ID
            </button>
          </div>

          {isAdmin && (
            <button
              onClick={() => setShowAdmin(!showAdmin)}
              className={`px-3 py-2 flex items-center gap-2 rounded-neo text-sm font-bold transition-all ${
                showAdmin ? 'shadow-neo-inset text-neo-accent' : 'shadow-neo-sm hover:shadow-neo-md text-neo-text'
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              Admin
            </button>
          )}
          <ThemeToggle />
          <div className="flex items-center gap-3 bg-neo-bg rounded-neo shadow-neo-inset px-4 py-2">
            <span className="text-sm font-medium text-neo-text">{user?.username}</span>
            <button onClick={logout} className="text-xs text-neo-accent font-bold hover:underline">
              Logout
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 flex gap-6 min-h-0">
        <div className="flex-1 flex flex-col gap-6">
          <Toolbar roomId={roomId} role={access.role} />
          <div className="flex-1 min-h-[600px] w-full">
            <Canvas roomId={roomId} role={access.role} memberColor={memberColor} />
          </div>
        </div>
        <aside className="hidden lg:flex flex-col gap-6 w-72 shrink-0 min-h-0">
          <ShareRoom roomId={roomId} canInvite={hasPermission(access.role, 'invite_users')} />
          
          {showAdmin && isAdmin ? (
            <div className="flex-1 min-h-[400px]">
              <AdminPanel roomId={roomId} myRole={access.role!} />
            </div>
          ) : (
            <>
              <div className="bg-neo-bg rounded-neo shadow-neo-sm p-4 flex gap-2 justify-center">
                <button
                  onClick={() => setShowChat(false)}
                  className={`flex-1 py-2 rounded-neo font-bold text-sm transition-all ${
                    !showChat ? 'shadow-neo-inset text-neo-accent' : 'shadow-neo-sm hover:shadow-neo-md text-neo-text'
                  }`}
                >
                  Users
                </button>
                <button
                  onClick={() => setShowChat(true)}
                  className={`flex-1 py-2 rounded-neo font-bold text-sm transition-all ${
                    showChat ? 'shadow-neo-inset text-neo-accent' : 'shadow-neo-sm hover:shadow-neo-md text-neo-text'
                  }`}
                >
                  Chat
                </button>
              </div>

              <div className="relative flex-1 overflow-hidden min-h-[400px]">
                {!showChat ? (
                  <UserList roomId={roomId} />
                ) : (
                  <ChatRoom roomId={roomId} role={access.role} memberColor={memberColor} isMuted={isMuted} />
                )}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

export default function RoomPage() {
  return (
    <AuthGuard>
      <RoomContent />
    </AuthGuard>
  );
}
