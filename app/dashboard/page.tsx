'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/api';
import { createRoom } from '@/lib/room';
import { AuthGuard } from '@/lib/auth/guard';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import Image from 'next/image';
import Link from 'next/link';

type AccessMode = 'public' | 'invite_only' | 'manual_approval';

interface RoomCard {
  roomId: string;
  roomName: string;
  accessMode: AccessMode;
  role: string;
  membersCount: number;
  lastModified: string;
  isOwner: boolean;
}

const ACCESS_BADGE: Record<AccessMode, { label: string; color: string }> = {
  public:          { label: 'Public',          color: 'bg-green-500/15 text-green-600 dark:text-green-400' },
  invite_only:     { label: 'Invite Only',     color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  manual_approval: { label: 'Approval Needed', color: 'bg-orange-500/15 text-orange-600 dark:text-orange-400' },
};

function DashboardContent() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [rooms, setRooms] = useState<RoomCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [accessMode, setAccessMode] = useState<AccessMode>('public');
  const [joinCode, setJoinCode] = useState('');
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<string | null>(null);

  const fetchRooms = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data: memberships, error } = await supabase
        .from('room_members')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('joined_at', { ascending: false });

      if (error) throw error;

      // Fetch room details and member counts
      const cards: (RoomCard | null)[] = await Promise.all(
        (memberships || []).map(async (m) => {
          try {
            const [ { data: room }, { count } ] = await Promise.all([
              supabase.from('rooms').select('*').eq('id', m.room_id).single(),
              supabase.from('room_members').select('*', { count: 'exact', head: true }).eq('room_id', m.room_id).eq('status', 'active')
            ]);

            if (!room) return null;

            return {
              roomId: room.id,
              roomName: room.name || 'Untitled Canvas',
              accessMode: room.access_mode as AccessMode,
              role: m.role,
              membersCount: count || 0,
              lastModified: room.created_at,
              isOwner: m.role === 'owner',
            };
          } catch (err: any) {
            console.error(`Failed to load room ${m.room_id}:`, err);
            return null;
          }
        })
      );
      setRooms(cards.filter((c): c is RoomCard => c !== null));
    } catch (err: any) {
      console.error('Failed to fetch rooms:', err?.message || JSON.stringify(err, null, 2), err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const handleCreateRoom = async () => {
    if (!user) return;
    setIsCreating(true);
    try {
      const roomId = await createRoom(
        `Canvas ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`,
        user.id,
        user.username,
        accessMode
      );
      router.push(`/room/${roomId}`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoin = () => {
    if (joinCode.trim()) router.push(`/room/${joinCode.trim()}`);
  };

  const handleRename = async (roomId: string) => {
    if (!editingName.trim()) return;
    try {
      await supabase.from('rooms').update({ name: editingName.trim() }).eq('id', roomId);
      setRooms(prev => prev.map(r => r.roomId === roomId ? { ...r, roomName: editingName.trim() } : r));
    } catch (err) {
      console.error('Failed to rename:', err);
    } finally {
      setEditingRoomId(null);
    }
  };

  const handleDelete = async () => {
    if (!roomToDelete) return;
    try {
      await supabase.from('rooms').delete().eq('id', roomToDelete);
      setRooms(prev => prev.filter(r => r.roomId !== roomToDelete));
    } catch (err) {
      console.error('Failed to delete room:', err);
    } finally {
      setRoomToDelete(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-40 bg-neo-bg/90 backdrop-blur-md shadow-neo-sm border-b border-neo-shadow/10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3">
            <Image src="/Chitra_logo.png" alt="Chitra" width={36} height={36} className="object-contain" />
            <span className="text-2xl font-bold text-neo-accent" style={{ fontFamily: 'var(--font-brushy)' }}>
              Chitra
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="flex items-center gap-3 bg-neo-bg rounded-neo shadow-neo-sm px-4 py-2">
              <div className="w-7 h-7 rounded-full bg-neo-accent flex items-center justify-center text-white text-xs font-bold shrink-0">
                {user?.username?.[0]?.toUpperCase() ?? '?'}
              </div>
              <span className="text-sm font-medium text-neo-text hidden sm:block">{user?.username}</span>
              <button onClick={logout} className="text-xs text-neo-accent font-bold hover:underline">Logout</button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-neo-text">Your Canvases</h2>
            <p className="text-neo-text/50 text-sm mt-1">Click any canvas to open it, or create a new one.</p>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="neo-button font-bold text-sm flex items-center gap-2"
          >
            <span className="text-lg leading-none">+</span> New Canvas
          </button>
        </div>

        {/* ── Create panel ── */}
        {showCreate && (
          <div className="neo-card mb-8 border border-neo-shadow/20">
            <h3 className="font-bold text-neo-text mb-4 flex items-center gap-2">
              New Canvas Settings
            </h3>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <p className="text-xs font-bold text-neo-text/50 mb-2">ACCESS MODE</p>
                <div className="flex flex-col gap-2">
                  {(Object.keys(ACCESS_BADGE) as AccessMode[]).map((mode) => (
                    <button key={mode} onClick={() => setAccessMode(mode)}
                      className={`text-left px-3 py-2 rounded-neo text-sm transition-all ${
                        accessMode === mode
                          ? 'shadow-neo-inset text-neo-accent font-bold'
                          : 'shadow-neo-sm hover:shadow-neo-md text-neo-text'
                      }`}>
                      {ACCESS_BADGE[mode].label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col justify-end gap-3">
                <button onClick={handleCreateRoom} disabled={isCreating}
                  className="neo-button font-bold text-sm disabled:opacity-50 min-w-[140px] text-center">
                  {isCreating ? 'Creating...' : 'Create Canvas'}
                </button>
                <button onClick={() => setShowCreate(false)}
                  className="neo-button opacity-60 text-sm text-center">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Canvas grid ── */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-10 h-10 border-4 border-neo-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-30 text-neo-text">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <p className="text-neo-text/50 text-lg font-medium">No canvases yet</p>
            <p className="text-neo-text/30 text-sm">Create your first canvas or join one with a code</p>
            <button onClick={() => setShowCreate(true)} className="neo-button font-bold text-sm mt-2">
              + Create your first canvas
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {rooms.map((room) => (
              <div key={room.roomId}
                className="neo-card group relative flex flex-col gap-3 hover:shadow-neo-lg transition-all duration-200 cursor-pointer border border-neo-shadow/10"
                onClick={() => router.push(`/room/${room.roomId}`)}>

                {/* Canvas preview area */}
                <div className="h-32 rounded-xl bg-gradient-to-br from-neo-accent/10 via-neo-bg to-neo-shadow/10 flex items-center justify-center relative overflow-hidden shadow-neo-inset">
                  <div className="absolute inset-0 opacity-20"
                    style={{
                      backgroundImage: 'radial-gradient(rgba(108,99,255,0.4) 1.5px, transparent 1.5px)',
                      backgroundSize: '18px 18px',
                    }} />
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-30 group-hover:opacity-60 transition-opacity">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                  </svg>
                  <div className="absolute top-2 right-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACCESS_BADGE[room.accessMode]?.color ?? 'bg-gray-500/15 text-gray-500'}`}>
                      {ACCESS_BADGE[room.accessMode]?.label ?? room.accessMode}
                    </span>
                  </div>
                </div>

                {/* Room name + rename */}
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {editingRoomId === room.roomId ? (
                    <div className="flex items-center gap-2 flex-1" onKeyDown={(e) => e.stopPropagation()}>
                      <input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(room.roomId);
                          if (e.key === 'Escape') setEditingRoomId(null);
                        }}
                        className="neo-input flex-1 text-sm py-1 px-2"
                      />
                      <button onClick={() => handleRename(room.roomId)}
                        className="text-neo-accent text-xs font-bold hover:underline">Save</button>
                      <button onClick={() => setEditingRoomId(null)}
                        className="text-neo-text/40 text-xs hover:underline">✕</button>
                    </div>
                  ) : (
                    <>
                      <p className="font-bold text-neo-text text-sm flex-1 truncate">{room.roomName}</p>
                      {room.isOwner && (
                        <div className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity flex items-center gap-2 shrink-0">
                          <button
                            title="Rename canvas"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingRoomId(room.roomId);
                              setEditingName(room.roomName);
                            }}
                            className="text-neo-accent text-xs"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                          </button>
                          <button
                            title="Delete canvas"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRoomToDelete(room.roomId);
                            }}
                            className="text-red-500 text-xs hover:text-red-600"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Meta info */}
                <div className="flex items-center justify-between text-xs text-neo-text/40">
                  <span>{room.membersCount} member{room.membersCount !== 1 ? 's' : ''}</span>
                  <span>{formatDate(room.lastModified)}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${
                    room.role === 'owner' ? 'bg-neo-accent/15 text-neo-accent' : 'bg-neo-shadow/20 text-neo-text/60'
                  }`}>
                    {room.role}
                  </span>
                </div>

                {/* Open button overlay on hover */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-neo pointer-events-none">
                  <div className="bg-neo-accent text-white text-sm font-bold px-5 py-2 rounded-full shadow-neo-md">
                    Open Canvas →
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Join by code ── */}
        <div className="mt-12 max-w-sm mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1 h-px bg-neo-shadow/20" />
            <span className="text-xs text-neo-text/40 font-medium whitespace-nowrap">JOIN BY CODE</span>
            <div className="flex-1 h-px bg-neo-shadow/20" />
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Enter room code..."
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              className="neo-input flex-1 text-sm"
            />
            <button onClick={handleJoin} className="neo-button font-bold text-sm shrink-0">Join</button>
          </div>
        </div>
      </main>

      <ConfirmDialog
        isOpen={roomToDelete !== null}
        title="Delete Canvas?"
        message="Are you sure you want to delete this canvas? This action is permanent and cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isDangerous
        onConfirm={handleDelete}
        onCancel={() => setRoomToDelete(null)}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}
