'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { InputField } from '@/components/ui/InputField';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [roomId, setRoomId] = useState('');
  const router = useRouter();

  const createRoom = () => {
    // TODO: Call PocketBase to create room
  };

  const joinRoom = () => {
    if (roomId.trim()) {
      router.push(`/room/${roomId.trim()}`);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-md">
        <h1 className="text-4xl font-bold mb-8 text-center text-neo-accent">Chitra</h1>
        
        <InputField
          type="text"
          placeholder="Enter room code..."
          className="w-full mb-6"
          onChange={(e) => setRoomId(e.target.value)}
          value={roomId}
        />
        
        <div className="flex gap-4">
          <Button onClick={createRoom} className="flex-1">Create Room</Button>
          <Button onClick={joinRoom} className="flex-1" variant="secondary">Join Room</Button>
        </div>
      </Card>
    </div>
  );
}
