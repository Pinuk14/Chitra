import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/api';

interface UserListProps {
  roomId: string;
}

export const UserList: React.FC<UserListProps> = ({ roomId }) => {
  const [members, setMembers] = useState<any[]>([]);

  const fetchMembers = useCallback(async () => {
    try {
      const { data: records } = await supabase
        .from('room_members')
        .select('*')
        .eq('room_id', roomId)
        .in('status', ['active', 'muted'])
        .order('joined_at', { ascending: false });

      if (records) {
        // Deduplicate by user_id
        const uniqueMembers: any[] = [];
        const seen = new Set();
        for (const rec of records) {
          if (!seen.has(rec.user_id)) {
            seen.add(rec.user_id);
            uniqueMembers.push(rec);
          }
        }
        setMembers(uniqueMembers);
      }
    } catch (e) {
      console.error(e);
    }
  }, [roomId]);

  useEffect(() => {
    fetchMembers();

    // Subscribe to changes
    const channel = supabase.channel(`userlist:${roomId}-${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${roomId}` }, () => fetchMembers())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, fetchMembers]);

  return (
    <div className="bg-neo-bg rounded-neo shadow-neo-sm p-3 md:p-6 w-full h-full">
      <h3 className="text-lg font-bold mb-4 md:mb-6 text-neo-accent border-b-2 border-neo-shadow pb-2">
        Active Users ({members.length})
      </h3>
      <div className="space-y-4">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center gap-3 p-3 rounded-neo bg-neo-bg shadow-neo-inset"
          >
            <div
              className="w-4 h-4 rounded-full shadow-neo-sm shrink-0"
              style={{ backgroundColor: member.color || '#565656' }}
            />
            <span className="text-sm font-semibold text-neo-text truncate flex-1">
              {member.username || 'Anonymous'}
            </span>
            <div className="flex items-center gap-1">
              {member.status === 'muted' && (
                <span className="text-xs text-red-400">🔇</span>
              )}
              <span className="text-[10px] font-bold text-neo-accent uppercase">
                {member.role}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
