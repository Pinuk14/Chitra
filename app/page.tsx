'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { pb } from '@/lib/api';
import { createRoom as createRoomApi } from '@/lib/room';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';
import { InputField } from '@/components/ui/InputField';

export default function Home() {
  const [roomId, setRoomId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  const createRoom = async () => {
    setIsCreating(true);
    try {
      const id = await createRoomApi(`Room ${Math.floor(Math.random() * 10000)}`);
      router.push(`/room/${id}`);
    } catch (err) {
      console.error(err);
      alert('Failed to create room.');
      setIsCreating(false);
    }
  };

  const joinRoom = () => {
    if (roomId.trim()) {
      router.push(`/room/${roomId.trim()}`);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen relative p-8">
      <div className="absolute top-8 right-8">
        <ThemeToggle />
      </div>
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
          <Button onClick={createRoom} className="flex-1" disabled={isCreating}>
            {isCreating ? 'Creating...' : 'Create Room'}
          </Button>
          <Button onClick={joinRoom} className="flex-1" variant="secondary">Join Room</Button>
        </div>
      </Card>
    </div>
  );
}
