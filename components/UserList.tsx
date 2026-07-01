import React, { useEffect, useState } from 'react';
import { pb } from '@/lib/api';

interface UserListProps {
  roomId: string;
}

export const UserList: React.FC<UserListProps> = ({ roomId }) => {
  const [members, setMembers] = useState<any[]>([]);

  useEffect(() => {
    // Fetch active room members
    const fetchMembers = () => {
      pb.collection('room_members')
        .getFullList({ filter: `room_id="${roomId}" && (status="active" || status="muted")`, requestKey: null })
        .then(setMembers)
        .catch(() => {});
    };

    fetchMembers();

    // Subscribe to changes
    let unsubscribe: (() => void) | undefined;
    pb.collection('room_members').subscribe('*', (e) => {
      if (e.record.room_id === roomId) fetchMembers();
    }).then(unsub => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [roomId]);

  return (
    <div className="bg-neo-bg rounded-neo shadow-neo-sm p-6 w-full h-full">
      <h3 className="text-lg font-bold mb-6 text-neo-accent border-b-2 border-neo-shadow pb-2">
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
