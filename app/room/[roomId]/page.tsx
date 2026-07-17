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
  const [activeTab, setActiveTab] = useState<'whiteboard' | 'users' | 'settings'>('whiteboard');

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
    <div className="h-[100dvh] flex flex-col md:p-8 gap-2 md:gap-8 max-w-[1600px] mx-auto overflow-hidden relative" style={{ overscrollBehavior: 'none' }}>
      
      {/* HEADER */}
      <div className="flex justify-between items-center bg-neo-bg shadow-neo-sm p-3 md:p-4 rounded-b-neo md:rounded-neo z-20 shrink-0">
        <div className="flex items-center gap-2 md:gap-4">
          <button 
            className="md:hidden p-2 text-neo-text hover:bg-neo-shadow/10 rounded-neo transition-colors"
            onClick={() => setActiveTab(activeTab === 'whiteboard' ? 'settings' : 'whiteboard')}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <Image src="/Chitra_logo.png" alt="Chitra" width={28} height={28} className="object-contain md:w-8 md:h-8" />
            <h1 className="text-2xl md:text-3xl text-neo-accent group-hover:opacity-80 transition-opacity" style={{ fontFamily: 'var(--font-brushy)' }}>Chitra</h1>
          </Link>
        </div>

        <div className="flex gap-2 md:gap-3 items-center">
          <div className="hidden md:flex items-center gap-2 bg-neo-bg rounded-neo shadow-neo-inset px-2 py-1 md:px-3 md:py-1.5">
            <span className="text-[10px] md:text-xs text-neo-text/60 font-mono mt-0.5 max-w-[100px] md:max-w-none overflow-hidden text-ellipsis whitespace-nowrap">room: {roomId}</span>
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
              className={`hidden md:flex px-3 py-2 items-center gap-2 rounded-neo text-sm font-bold transition-all ${
                showAdmin ? 'shadow-neo-inset text-neo-accent' : 'shadow-neo-sm hover:shadow-neo-md text-neo-text'
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              Admin
            </button>
          )}
          
          <div className="hidden md:block"><ThemeToggle /></div>

          <div className="hidden md:flex items-center gap-3 bg-neo-bg rounded-neo shadow-neo-inset px-4 py-2">
            <span className="text-sm font-medium text-neo-text">{user?.username}</span>
            <button onClick={logout} className="text-xs text-neo-accent font-bold hover:underline">
              Logout
            </button>
          </div>
          
          <div className="md:hidden flex items-center justify-center w-9 h-9 rounded-full bg-neo-accent text-white font-bold text-sm shadow-neo-sm ml-1">
            {user?.username?.[0]?.toUpperCase()}
          </div>
        </div>
      </div>
      
      <div className="flex-1 flex gap-6 min-h-0 min-w-0 relative">
        <div className={`flex-1 flex flex-col min-h-0 min-w-0 relative z-0 ${activeTab !== 'whiteboard' ? 'hidden md:flex' : 'flex'}`}>
          <Toolbar roomId={roomId} role={access.role} />
          <div className="flex-1 min-h-0 relative z-0 pb-[80px] md:pb-0">
            <Canvas roomId={roomId} role={access.role} memberColor={memberColor} />
          </div>
        </div>
        
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col gap-6 w-72 shrink-0 min-h-0 relative z-10">
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

              <div className="relative flex-1 overflow-hidden min-h-0">
                {!showChat ? (
                  <UserList roomId={roomId} />
                ) : (
                  <ChatRoom roomId={roomId} role={access.role} memberColor={memberColor} isMuted={isMuted} />
                )}
              </div>
            </>
          )}
        </aside>

        {/* Mobile Bottom Sheet (Overlay) */}
        {activeTab !== 'whiteboard' && (
          <div className="md:hidden absolute inset-0 z-20 bg-neo-bg flex flex-col pb-[80px] overflow-hidden">
             <div className="flex-1 overflow-y-auto px-1 py-2 flex flex-col gap-3">
                {activeTab === 'users' && (
                  <>
                    <ShareRoom roomId={roomId} canInvite={hasPermission(access.role, 'invite_users')} />
                    <div className="bg-neo-bg rounded-neo shadow-neo-sm p-1.5 flex gap-1 justify-center">
                      <button
                        onClick={() => setShowChat(false)}
                        className={`flex-1 py-2 rounded-neo font-bold text-sm transition-all ${
                          !showChat ? 'shadow-neo-inset text-neo-accent' : 'text-neo-text'
                        }`}
                      >
                        Users
                      </button>
                      <button
                        onClick={() => setShowChat(true)}
                        className={`flex-1 py-2 rounded-neo font-bold text-sm transition-all ${
                          showChat ? 'shadow-neo-inset text-neo-accent' : 'text-neo-text'
                        }`}
                      >
                        Chat
                      </button>
                    </div>
                    <div className="relative flex-1 overflow-hidden min-h-0">
                      {!showChat ? (
                        <UserList roomId={roomId} />
                      ) : (
                        <ChatRoom roomId={roomId} role={access.role} memberColor={memberColor} isMuted={isMuted} />
                      )}
                    </div>
                  </>
                )}
                
                {activeTab === 'settings' && (
                  <div className="flex flex-col gap-3">
                     <div className="bg-neo-bg rounded-neo shadow-neo-sm p-3 flex flex-col gap-4">
                        <h2 className="text-lg font-bold text-neo-text">Settings</h2>
                        <div className="flex justify-between items-center">
                           <span className="font-bold text-sm text-neo-text">Theme</span>
                           <ThemeToggle />
                        </div>
                        <div className="flex justify-between items-center pt-4 border-t border-neo-shadow/10">
                           <div className="flex flex-col">
                             <span className="font-bold text-sm text-neo-text">Room ID</span>
                             <span className="text-xs text-neo-text/60 font-mono mt-1 max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap">{roomId}</span>
                           </div>
                           <button 
                             onClick={() => {
                               navigator.clipboard.writeText(roomId);
                               alert('Room ID copied!');
                             }}
                             className="text-sm text-neo-text font-bold px-4 py-2 bg-neo-bg rounded-neo shadow-neo-sm active:shadow-neo-inset"
                           >
                             Copy
                           </button>
                        </div>
                        <div className="flex justify-between items-center pt-4 border-t border-neo-shadow/10">
                           <span className="font-bold text-sm text-neo-text">Account ({user?.username})</span>
                           <button onClick={logout} className="text-sm text-neo-accent font-bold px-4 py-2 bg-neo-bg rounded-neo shadow-neo-sm active:shadow-neo-inset">
                             Logout
                           </button>
                        </div>
                     </div>
                     
                     {isAdmin && (
                        <div className="flex-1 min-h-[400px]">
                          <AdminPanel roomId={roomId} myRole={access.role!} />
                        </div>
                     )}
                  </div>
                )}
             </div>
          </div>
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-[70px] bg-neo-bg border-t border-neo-shadow/10 z-30 flex justify-around items-center px-2 pb-safe shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
         <button 
           onClick={() => setActiveTab('whiteboard')}
           className={`flex flex-col items-center justify-center w-full h-full gap-1 ${activeTab === 'whiteboard' ? 'text-neo-accent' : 'text-neo-text/60'}`}
         >
           <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
           <span className="text-[10px] font-bold">Whiteboard</span>
         </button>
         <button 
           onClick={() => setActiveTab('users')}
           className={`flex flex-col items-center justify-center w-full h-full gap-1 ${activeTab === 'users' ? 'text-neo-accent' : 'text-neo-text/60'}`}
         >
           <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
           <span className="text-[10px] font-bold">Users</span>
         </button>
         <button 
           onClick={() => setActiveTab('settings')}
           className={`flex flex-col items-center justify-center w-full h-full gap-1 ${activeTab === 'settings' ? 'text-neo-accent' : 'text-neo-text/60'}`}
         >
           <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
           <span className="text-[10px] font-bold">Settings</span>
         </button>
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
