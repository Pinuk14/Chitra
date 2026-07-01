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
          <div className="text-4xl mb-4">{access.status === 'banned' ? '🚫' : '🔒'}</div>
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
        <h1 className="text-4xl text-neo-accent" style={{ fontFamily: 'var(--font-brushy)' }}>Chitra</h1>
        <div className="flex gap-3 items-center">
          {isAdmin && (
            <button
              onClick={() => setShowAdmin(!showAdmin)}
              className={`px-3 py-2 rounded-neo text-sm font-bold transition-all ${
                showAdmin ? 'shadow-neo-inset text-neo-accent' : 'shadow-neo-sm hover:shadow-neo-md text-neo-text'
              }`}
            >
              ⚙ Admin
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
        <aside className="hidden lg:flex flex-col gap-6 w-72 shrink-0">
          <ShareRoom roomId={roomId} />
          
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
                <div className={`absolute inset-0 transition-transform duration-500 ease-in-out ${showChat ? '-translate-x-full' : 'translate-x-0'}`}>
                  <UserList roomId={roomId} />
                </div>
                <div className={`absolute inset-0 transition-transform duration-500 ease-in-out ${showChat ? 'translate-x-0' : 'translate-x-full'}`}>
                  <ChatRoom roomId={roomId} role={access.role} memberColor={memberColor} />
                </div>
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
