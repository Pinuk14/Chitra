'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { Canvas } from '@/components/Canvas';
import { Toolbar } from '@/components/Toolbar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { UserList } from '@/components/UserList';
import { ShareRoom } from '@/components/ShareRoom';
import { ChatRoom } from '@/components/ChatRoom';
import { Button } from '@/components/ui/Button';

export default function RoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const [showChat, setShowChat] = useState(false);

  return (
    <div className="min-h-screen flex flex-col p-8 gap-8 max-w-[1600px] mx-auto">
      <div className="flex justify-between items-center bg-neo-bg shadow-neo-sm p-4 rounded-neo">
        <h1 className="text-4xl text-neo-accent" style={{ fontFamily: 'var(--font-brushy)' }}>Chitra</h1>
        <div className="flex gap-4 items-center">
          <ThemeToggle />
        </div>
      </div>
      
      <div className="flex-1 flex gap-6 min-h-0">
        <div className="flex-1 flex flex-col gap-6">
          <Toolbar roomId={roomId} />
          <div className="flex-1 min-h-[600px] w-full">
            <Canvas roomId={roomId} />
          </div>
        </div>
        <aside className="hidden lg:flex flex-col gap-6 w-72 shrink-0">
          <ShareRoom roomId={roomId} />
          
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
              <ChatRoom roomId={roomId} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
