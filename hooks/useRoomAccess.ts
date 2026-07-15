'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/api';
import { useAuth } from '@/lib/auth/context';
import type { Role } from '@/lib/security/permissions';

const RANDOM_COLORS = ['#6C63FF', '#FF6B6B', '#4ECDC4', '#FFE66D', '#FF9F1C', '#9D4EDD', '#F15BB5'];

interface RoomAccessResult {
  status: 'loading' | 'granted' | 'pending' | 'denied' | 'banned';
  role: Role | null;
  memberRecord: any | null;
  room: any | null;
  message?: string;
}

/**
 * Hook that manages room access control (Supabase).
 * Checks the user's membership status and handles join flows for all access modes.
 */
export function useRoomAccess(roomId: string): RoomAccessResult {
  const { user } = useAuth();
  const [result, setResult] = useState<RoomAccessResult>({
    status: 'loading',
    role: null,
    memberRecord: null,
    room: null,
  });
  const isCheckingRef = React.useRef(false);

  const checkAccess = useCallback(async () => {
    if (!user || !roomId) return;
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;

    try {
      // 1. Fetch the room
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();
        
      if (roomError || !room) throw new Error('Room not found');

      // 2. Check if user already has a membership
      const { data: members, error: memError } = await supabase
        .from('room_members')
        .select('*')
        .eq('room_id', roomId)
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false });

      const memberList = members || [];

      // Cleanup duplicate records to prevent ghost memberships
      if (memberList.length > 1) {
        for (let i = 1; i < memberList.length; i++) {
          try {
            await supabase.from('room_members').delete().eq('id', memberList[i].id);
          } catch (e) {
            console.error('Failed to delete duplicate room_member:', e);
          }
        }
      }

      const member = memberList[0] || null;

      if (member) {
        // User has an existing membership
        switch (member.status) {
          case 'active':
            setResult({
              status: 'granted',
              role: member.role as Role,
              memberRecord: member,
              room,
            });
            return;

          case 'pending':
            setResult({
              status: 'pending',
              role: null,
              memberRecord: member,
              room,
              message: 'Waiting for approval from the room owner.',
            });
            return;

          case 'banned':
            // Check if ban has expired
            if (member.ban_expires && new Date(member.ban_expires) < new Date()) {
              // Ban expired — update status to active
              const { data: updatedMember } = await supabase
                .from('room_members')
                .update({ status: 'active', ban_expires: null })
                .eq('id', member.id)
                .select()
                .single();
                
              setResult({
                status: 'granted',
                role: (updatedMember?.role || member.role) as Role,
                memberRecord: updatedMember || member,
                room,
              });
              return;
            }
            setResult({
              status: 'banned',
              role: null,
              memberRecord: member,
              room,
              message: member.ban_expires
                ? `You are banned until ${new Date(member.ban_expires).toLocaleString()}.`
                : 'You have been permanently banned from this room.',
            });
            return;

          case 'kicked':
            // Kicked users can re-join, fall through
            break;

          case 'muted':
            // Muted users can still view
            setResult({
              status: 'granted',
              role: 'viewer' as Role, // Downgrade to viewer when muted
              memberRecord: member,
              room,
            });
            return;
        }
      }

      // 3. No active membership — handle by access mode
      const color = RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)];

      switch (room.access_mode) {
        case 'public': {
          // Auto-join as member (editor)
          const { data: newMember, error: insertError } = await supabase
            .from('room_members')
            .insert({
              room_id: roomId,
              user_id: user.id,
              username: user.username,
              role: 'editor', // Default to editor for draw permissions
              status: 'active',
              color,
            })
            .select()
            .single();
            
          if (insertError) throw insertError;
            
          setResult({
            status: 'granted',
            role: 'editor',
            memberRecord: newMember,
            room,
          });
          break;
        }

        case 'invite_only': {
          setResult({
            status: 'denied',
            role: null,
            memberRecord: null,
            room,
            message: 'This room is invite-only. Ask the room owner to invite you.',
          });
          break;
        }

        case 'manual_approval': {
          // Create pending membership
          const { data: pendingMember, error: insertError } = await supabase
            .from('room_members')
            .insert({
              room_id: roomId,
              user_id: user.id,
              username: user.username,
              role: 'member',
              status: 'pending',
              color,
            })
            .select()
            .single();
            
          if (insertError) throw insertError;
          
          setResult({
            status: 'pending',
            role: null,
            memberRecord: pendingMember,
            room,
            message: 'Waiting for approval from the room owner.',
          });
          break;
        }

        default: {
          setResult({
            status: 'denied',
            role: null,
            memberRecord: null,
            room,
            message: 'Unknown access mode.',
          });
        }
      }
    } catch (err: any) {
      console.error('Room access check failed:', err);
      setResult({
        status: 'denied',
        role: null,
        memberRecord: null,
        room: null,
        message: 'Room not found or access denied.',
      });
    } finally {
      setTimeout(() => {
        isCheckingRef.current = false;
      }, 1000);
    }
  }, [user, roomId]);

  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  // Subscribe to membership changes (for waiting room, role changes, and bans)
  useEffect(() => {
    if (!user || !roomId) return;

    const channel = supabase
      .channel(`room_members:${roomId}:${user.id}-${Math.random()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const record = payload.new as any;
          const oldRecord = payload.old as any;
          
          if ((record && record.user_id === user.id) || (oldRecord && oldRecord.user_id === user.id)) {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              if (record.status === 'active') {
                setResult(prev => ({
                  ...prev,
                  status: 'granted',
                  role: record.role as Role,
                  memberRecord: record,
                }));
              } else if (record.status === 'kicked') {
                setResult(prev => ({
                  ...prev,
                  status: 'denied',
                  role: null,
                  memberRecord: null,
                  message: 'Your access request was rejected or you were kicked.',
                }));
              } else if (record.status === 'banned') {
                setResult(prev => ({
                  ...prev,
                  status: 'banned',
                  role: null,
                  memberRecord: record,
                  message: record.ban_expires
                    ? `You are banned until ${new Date(record.ban_expires).toLocaleString()}.`
                    : 'You have been permanently banned from this room.',
                }));
              } else if (record.status === 'muted') {
                setResult(prev => ({
                  ...prev,
                  status: 'granted',
                  role: 'viewer' as Role, // Downgrade to viewer when muted
                  memberRecord: record,
                }));
              } else if (record.status === 'pending') {
                 setResult(prev => ({
                  ...prev,
                  status: 'pending',
                  role: null,
                  memberRecord: record,
                  message: 'Waiting for approval from the room owner.',
                }));
              }
            } else if (payload.eventType === 'DELETE') {
              setResult(prev => ({
                ...prev,
                status: 'denied',
                role: null,
                memberRecord: null,
                message: 'Your access was revoked.',
              }));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, roomId]);

  return result;
}
