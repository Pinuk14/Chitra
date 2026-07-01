import React, { useEffect, useState } from 'react';
import { pb } from '@/lib/api';

export const UserList: React.FC<{ roomId: string }> = ({ roomId }) => {
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    // Initial fetch
    pb.collection('users_realtime')
      .getFullList({ filter: `room_id="${roomId}"` })
      .then(setUsers)
      .catch(() => {});

    // Subscribe to changes
    let unsubscribe: (() => void) | undefined;
    pb.collection('users_realtime').subscribe('*', () => {
      // Fetch active users in room whenever there's an update
      pb.collection('users_realtime')
        .getFullList({ filter: `room_id="${roomId}"` })
        .then(setUsers)
        .catch(() => {});
    }).then(unsub => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [roomId]);

  return (
    <div className="bg-neo-bg rounded-neo shadow-neo-sm p-6 w-64 h-full">
      <h3 className="text-lg font-bold mb-6 text-neo-accent border-b-2 border-neo-shadow pb-2">Active Users</h3>
      <div className="space-y-4">
        {users.map((user) => (
          <div
            key={user.id}
            className="flex items-center gap-3 p-3 rounded-neo bg-neo-bg shadow-neo-inset"
          >
            <div
              className="w-4 h-4 rounded-full shadow-neo-sm"
              style={{ backgroundColor: user.color || '#565656' }}
            />
            <span className="text-sm font-semibold text-neo-text truncate">
              {user.name || 'Anonymous'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
