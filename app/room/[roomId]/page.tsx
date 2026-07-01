'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { Canvas } from '@/components/Canvas';
import { Toolbar } from '@/components/Toolbar';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function RoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;

  return (
    <div className="min-h-screen flex flex-col p-8 gap-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center bg-neo-bg shadow-neo-sm p-4 rounded-neo">
        <h1 className="text-3xl font-bold text-neo-accent">Chitra</h1>
        <div className="flex gap-4 items-center">
          <ThemeToggle />
          <div className="px-4 py-2 shadow-neo-inset rounded-neo font-mono text-neo-text">
            Room: {roomId}
          </div>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col gap-6">
        <Toolbar />
        <div className="flex-1 min-h-[600px] w-full">
          <Canvas roomId={roomId} />
        </div>
      </div>
    </div>
  );
}
