'use client';

/**
 * usePermissions Hook
 * 
 * Provides permission checking for the current user in a room.
 * Uses the centralized permission manager — no hardcoded checks.
 */

import { useCallback } from 'react';
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

  return { can, requestPermission, role };
}
