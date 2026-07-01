'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { pb } from '@/lib/api';
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
 * Hook that manages room access control.
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

  const checkAccess = useCallback(async () => {
    if (!user || !roomId) return;

    try {
      // 1. Fetch the room
      const room = await pb.collection('rooms').getOne(roomId, { requestKey: null });

      // 2. Check if user already has a membership
      let members: any[];
      try {
        members = await pb.collection('room_members').getFullList({
          filter: `room_id = "${roomId}" && user_id = "${user.id}"`,
          requestKey: null,
        });
      } catch {
        members = [];
      }

      const member = members[0] || null;

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
              await pb.collection('room_members').update(member.id, { status: 'active', ban_expires: '' });
              setResult({
                status: 'granted',
                role: member.role as Role,
                memberRecord: member,
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
            // Kicked users can re-join
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
          // Auto-join as editor
          const newMember = await pb.collection('room_members').create({
            room_id: roomId,
            user_id: user.id,
            username: user.username,
            role: 'editor',
            status: 'active',
            color,
          });
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
          const pendingMember = await pb.collection('room_members').create({
            room_id: roomId,
            user_id: user.id,
            username: user.username,
            role: 'editor',
            status: 'pending',
            color,
          });
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
      setResult({
        status: 'denied',
        role: null,
        memberRecord: null,
        room: null,
        message: 'Room not found.',
      });
    }
  }, [user, roomId]);

  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  // Subscribe to membership changes (for waiting room auto-transition)
  useEffect(() => {
    if (!user || !roomId || result.status !== 'pending') return;

    let unsubscribe: (() => void) | undefined;

    pb.collection('room_members').subscribe('*', (e) => {
      if (e.record.room_id === roomId && e.record.user_id === user.id) {
        if (e.action === 'update') {
          if (e.record.status === 'active') {
            setResult({
              status: 'granted',
              role: e.record.role as Role,
              memberRecord: e.record,
              room: result.room,
            });
          } else if (e.record.status === 'kicked') {
            setResult({
              status: 'denied',
              role: null,
              memberRecord: null,
              room: result.room,
              message: 'Your request was rejected.',
            });
          }
        }
      }
    }).then(unsub => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, roomId, result.status, result.room]);

  return result;
}
