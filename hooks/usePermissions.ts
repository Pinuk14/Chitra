'use client';

/**
 * usePermissions Hook (Supabase)
 * 
 * Provides permission checking for the current user in a room.
 * Uses the centralized permission manager — no hardcoded checks.
 */

import { useCallback, useEffect } from 'react';
import { supabase } from '@/lib/api';
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
      const { data: existing } = await supabase
        .from('permission_requests')
        .select('*')
        .eq('room_id', roomId)
        .eq('user_id', user.id)
        .eq('status', 'pending');
      
      if (existing && existing.length > 0) {
        // If they already have a pending request, we can just update it
        // Or ignore it depending on UX. We will just update it.
        await supabase
          .from('permission_requests')
          .update({ requested_role: action })
          .eq('id', existing[0].id);
        return;
      }

      await supabase.from('permission_requests').insert({
        room_id: roomId,
        user_id: user.id,
        requested_role: action,
        status: 'pending',
      });
    } catch (err) {
      console.error('Failed to create permission request:', err);
    }
  }, [user, roomId]);

  // Subscribe to permission request updates to alert the user
  useEffect(() => {
    if (!user || !roomId) return;

    const channel = supabase
      .channel(`permission_requests:${roomId}:${user.id}-${Math.random()}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'permission_requests', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const record = payload.new as any;
          if (record.user_id === user.id && record.status === 'approved') {
            // Add a small delay so it doesn't block immediately if they are drawing
            setTimeout(() => {
              alert(`Your request for '${record.requested_role}' permission has been approved!`);
            }, 100);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, roomId]);

  return { can, requestPermission, role };
}
