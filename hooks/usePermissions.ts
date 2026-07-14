'use client';

/**
 * usePermissions Hook
 * 
 * Provides permission checking for the current user in a room.
 * Uses the centralized permission manager — no hardcoded checks.
 */

import { useCallback, useEffect } from 'react';
import { pb } from '@/lib/api';
import { useAuth } from '@/lib/auth/context';
import { hasPermission, type Role, type Action } from '@/lib/security/permissions';

interface UsePermissionsReturn {
  can: (action: Action) => boolean;
  requestPermission: (action: Action) => Promise<void>;
  role: Role | null;
}

export function usePermissions(roomId: string, role: Role | null): UsePermissionsReturn {
  const { user } = useAuth();

  const can = useCallback((action: Action): boolean => {
    return hasPermission(role, action);
  }, [role]);

  const requestPermission = useCallback(async (action: Action) => {
    if (!user || !roomId) return;
    try {
      // Check for existing pending request to avoid spam
      const existing = await pb.collection('permission_requests').getFullList({
        filter: `room_id = "${roomId}" && user_id = "${user.id}" && action = "${action}" && status = "pending"`,
        requestKey: null,
      });
      
      if (existing.length > 0) {
        return; // Already have a pending request
      }

      await pb.collection('permission_requests').create({
        room_id: roomId,
        user_id: user.id,
        username: user.username,
        action,
        status: 'pending',
      });
    } catch (err) {
      console.error('Failed to create permission request:', err);
    }
  }, [user, roomId]);

  // Subscribe to permission request updates to alert the user
  useEffect(() => {
    if (!user || !roomId) return;

    let unsubscribe: (() => void) | undefined;

    pb.collection('permission_requests').subscribe('*', (e) => {
      if (e.action === 'update' && e.record.user_id === user.id && e.record.room_id === roomId) {
        if (e.record.status === 'approved') {
          // Add a small delay so it doesn't block immediately if they are drawing
          setTimeout(() => {
            alert(`Your request for '${e.record.action}' permission has been approved!`);
          }, 100);
        }
      }
    }).then(unsub => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, roomId]);

  return { can, requestPermission, role };
}
