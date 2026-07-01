'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { pb } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';
import { InputField } from '@/components/ui/InputField';
import { useAuth } from '@/lib/auth/context';
import { AuthGuard } from '@/lib/auth/guard';

type AccessMode = 'public' | 'invite_only' | 'manual_approval';

function HomePage() {
  const { user, logout } = useAuth();
  const [roomId, setRoomId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [accessMode, setAccessMode] = useState<AccessMode>('public');
  const router = useRouter();

  const createRoom = async () => {
    if (!user) return;
    setIsCreating(true);
    try {
      const room = await pb.collection('rooms').create({
        name: `Room ${Math.floor(Math.random() * 10000)}`,
        created_by: user.username,
        owner_id: user.id,
        access_mode: accessMode,
      });

      // Create owner membership
      await pb.collection('room_members').create({
        room_id: room.id,
        user_id: user.id,
        username: user.username,
        role: 'owner',
        status: 'active',
        color: '#6C63FF',
      });

      router.push(`/room/${room.id}`);
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

  const ACCESS_MODE_OPTIONS: { value: AccessMode; label: string; desc: string }[] = [
    { value: 'public', label: '🌐 Public', desc: 'Anyone with the link can join' },
    { value: 'invite_only', label: '🔒 Invite Only', desc: 'Only invited users can join' },
    { value: 'manual_approval', label: '✋ Manual Approval', desc: 'Users must be approved to join' },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen relative p-8">
      <div className="absolute top-8 right-8 flex gap-3 items-center">
        <ThemeToggle />
        <div className="flex items-center gap-3 bg-neo-bg rounded-neo shadow-neo-sm px-4 py-2">
          <span className="text-sm font-medium text-neo-text">{user?.username}</span>
          <button
            onClick={logout}
            className="text-xs text-neo-accent font-bold hover:underline"
          >
            Logout
          </button>
        </div>
      </div>

      <Card className="w-full max-w-md">
        <h1 className="text-4xl mb-8 text-center text-neo-accent" style={{ fontFamily: 'var(--font-brushy)' }}>
          Chitra
        </h1>

        {/* Access Mode Selector */}
        <div className="mb-6">
          <label className="text-sm font-medium text-neo-text mb-3 block">Board Access</label>
          <div className="flex flex-col gap-2">
            {ACCESS_MODE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setAccessMode(opt.value)}
                className={`text-left px-4 py-3 rounded-neo transition-all ${
                  accessMode === opt.value
                    ? 'shadow-neo-inset text-neo-accent'
                    : 'shadow-neo-sm hover:shadow-neo-md text-neo-text'
                }`}
              >
                <div className="text-sm font-bold">{opt.label}</div>
                <div className="text-xs opacity-60 mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <Button onClick={createRoom} className="w-full mb-6" disabled={isCreating}>
          {isCreating ? 'Creating...' : 'Create Room'}
        </Button>

        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 h-px bg-neo-shadow/30" />
          <span className="text-xs text-neo-text/40 font-medium">OR JOIN</span>
          <div className="flex-1 h-px bg-neo-shadow/30" />
        </div>

        <InputField
          type="text"
          placeholder="Enter room code..."
          className="w-full mb-4"
          onChange={(e) => setRoomId(e.target.value)}
          value={roomId}
        />

        <Button onClick={joinRoom} className="w-full" variant="secondary">
          Join Room
        </Button>
      </Card>
    </div>
  );
}

export default function Home() {
  return (
    <AuthGuard>
      <HomePage />
    </AuthGuard>
  );
}
