'use client';

/**
 * Admin Panel
 * 
 * A collapsible sidebar panel for room owners/admins to manage:
 * - Pending approval requests
 * - Member roles and status
 * - Permission requests
 * - Moderation actions (kick/ban/mute)
 */

import React, { useEffect, useState } from 'react';
import { pb } from '@/lib/api';
import { useAuth } from '@/lib/auth/context';
import { hasPermission, canModerate, type Role, ACTION_LABELS, type Action } from '@/lib/security/permissions';
import { Button } from './ui/Button';

interface AdminPanelProps {
  roomId: string;
  myRole: Role;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ roomId, myRole }) => {
  const { user } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [permRequests, setPermRequests] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'members' | 'permissions'>('members');

  // Fetch members and pending requests
  useEffect(() => {
    if (!roomId) return;

    const fetchData = async () => {
      try {
        const allMembers = await pb.collection('room_members').getFullList({
          filter: `room_id = "${roomId}"`,
          sort: '-created',
          requestKey: null,
        });
        
        // Deduplicate by user_id (keeps the newest record due to sort: '-created')
        const uniqueMembers: any[] = [];
        const seen = new Set();
        for (const rec of allMembers) {
          if (!seen.has(rec.user_id)) {
            seen.add(rec.user_id);
            uniqueMembers.push(rec);
          }
        }
        setMembers(uniqueMembers);

        const perms = await pb.collection('permission_requests').getFullList({
          filter: `room_id = "${roomId}" && status = "pending"`,
          sort: '-created',
          requestKey: null,
        });
        setPermRequests(perms);
      } catch {}
    };

    fetchData();

    // Real-time subscriptions
    let unsubMembers: (() => void) | undefined;
    let unsubPerms: (() => void) | undefined;

    pb.collection('room_members').subscribe('*', (e) => {
      if (e.record.room_id === roomId) fetchData();
    }).then(unsub => { unsubMembers = unsub; });

    pb.collection('permission_requests').subscribe('*', (e) => {
      if (e.record.room_id === roomId) fetchData();
    }).then(unsub => { unsubPerms = unsub; });

    return () => {
      if (unsubMembers) unsubMembers();
      if (unsubPerms) unsubPerms();
    };
  }, [roomId]);

  const pendingMembers = members.filter(m => m.status === 'pending');
  const activeMembers = members.filter(m => m.status === 'active' || m.status === 'muted');

  const approveUser = async (memberId: string) => {
    await pb.collection('room_members').update(memberId, { status: 'active' });
  };

  const rejectUser = async (memberId: string) => {
    await pb.collection('room_members').update(memberId, { status: 'kicked' });
  };

  const changeRole = async (memberId: string, newRole: Role) => {
    await pb.collection('room_members').update(memberId, { role: newRole });
    // Log the moderation action
    if (user) {
      const member = members.find(m => m.id === memberId);
      await pb.collection('moderation_log').create({
        room_id: roomId,
        actor_id: user.id,
        target_id: member?.user_id || '',
        action: newRole === 'viewer' ? 'demote' : 'promote',
        reason: `Role changed to ${newRole}`,
      }).catch(() => {});
    }
  };

  const kickUser = async (memberId: string) => {
    const member = members.find(m => m.id === memberId);
    await pb.collection('room_members').update(memberId, { status: 'kicked' });
    if (user && member) {
      await pb.collection('moderation_log').create({
        room_id: roomId, actor_id: user.id, target_id: member.user_id,
        action: 'kick', reason: 'Kicked by admin',
      }).catch(() => {});
    }
  };

  const banUser = async (memberId: string, permanent: boolean) => {
    const member = members.find(m => m.id === memberId);
    const banExpires = permanent ? '' : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await pb.collection('room_members').update(memberId, {
      status: 'banned',
      ban_expires: banExpires,
    });
    if (user && member) {
      await pb.collection('moderation_log').create({
        room_id: roomId, actor_id: user.id, target_id: member.user_id,
        action: 'ban', reason: permanent ? 'Permanent ban' : '24h ban',
        expires_at: banExpires,
      }).catch(() => {});
    }
  };

  const muteUser = async (memberId: string) => {
    const member = members.find(m => m.id === memberId);
    await pb.collection('room_members').update(memberId, { status: 'muted' });
    if (user && member) {
      await pb.collection('moderation_log').create({
        room_id: roomId, actor_id: user.id, target_id: member.user_id,
        action: 'mute', reason: 'Muted by admin',
      }).catch(() => {});
    }
  };

  const unmuteUser = async (memberId: string) => {
    const member = members.find(m => m.id === memberId);
    await pb.collection('room_members').update(memberId, { status: 'active' });
    if (user && member) {
      await pb.collection('moderation_log').create({
        room_id: roomId, actor_id: user.id, target_id: member.user_id,
        action: 'unmute',
      }).catch(() => {});
    }
  };

  const approvePermission = async (requestId: string) => {
    if (!user) return;
    await pb.collection('permission_requests').update(requestId, {
      status: 'approved',
      resolved_by: user.id,
    });
  };

  const rejectPermission = async (requestId: string) => {
    if (!user) return;
    await pb.collection('permission_requests').update(requestId, {
      status: 'rejected',
      resolved_by: user.id,
    });
  };

  const TABS = [
    { key: 'members' as const, label: 'Members', count: activeMembers.length },
    { key: 'pending' as const, label: 'Pending', count: pendingMembers.length },
    { key: 'permissions' as const, label: 'Requests', count: permRequests.length },
  ];

  return (
    <div className="bg-neo-bg rounded-neo shadow-neo-sm p-4 w-full flex flex-col h-full">
      <h3 className="text-sm font-bold text-neo-accent mb-3">Admin Panel</h3>

      {/* Tab Bar */}
      <div className="flex gap-1 mb-4">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-1.5 rounded-neo text-xs font-bold transition-all ${
              activeTab === tab.key
                ? 'shadow-neo-inset text-neo-accent'
                : 'shadow-neo-sm text-neo-text hover:shadow-neo-md'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-neo-accent text-white text-[10px]">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {activeTab === 'pending' && (
          pendingMembers.length === 0 ? (
            <p className="text-xs text-neo-text/40 text-center py-4">No pending requests</p>
          ) : (
            pendingMembers.map(member => (
              <div key={member.id} className="flex items-center justify-between p-2 rounded-neo shadow-neo-inset">
                <span className="text-sm font-medium text-neo-text">{member.username || 'Unknown'}</span>
                <div className="flex gap-1">
                  <button onClick={() => approveUser(member.id)}
                    className="px-2 py-1 rounded-neo shadow-neo-sm text-xs font-bold text-green-500 hover:shadow-neo-md">
                    ✓
                  </button>
                  <button onClick={() => rejectUser(member.id)}
                    className="px-2 py-1 rounded-neo shadow-neo-sm text-xs font-bold text-red-500 hover:shadow-neo-md">
                    ✕
                  </button>
                </div>
              </div>
            ))
          )
        )}

        {activeTab === 'members' && (
          activeMembers.map(member => {
            const isMe = member.user_id === user?.id;
            const memberRole = member.role as Role;
            const canMod = !isMe && canModerate(myRole, memberRole);

            return (
              <div key={member.id} className="p-2 rounded-neo shadow-neo-inset">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: member.color || '#565656' }} />
                    <span className="text-sm font-medium text-neo-text">
                      {member.username || 'Unknown'}
                      {isMe && <span className="text-neo-accent text-xs ml-1">(You)</span>}
                      {member.status === 'muted' && <span className="text-red-400 text-xs ml-1">🔇</span>}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-neo-accent uppercase">{member.role}</span>
                </div>

                {canMod && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {hasPermission(myRole, 'manage_roles') && member.role !== 'owner' && (
                      <select
                        value={member.role}
                        onChange={(e) => changeRole(member.id, e.target.value as Role)}
                        className="text-[10px] bg-neo-bg rounded shadow-neo-sm px-1 py-0.5 text-neo-text border-0 outline-none"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}
                    {hasPermission(myRole, 'kick_user') && (
                      <button onClick={() => kickUser(member.id)}
                        className="text-[10px] px-1.5 py-0.5 rounded shadow-neo-sm text-red-400 hover:shadow-neo-md">
                        Kick
                      </button>
                    )}
                    {hasPermission(myRole, 'ban_user') && (
                      <button onClick={() => banUser(member.id, false)}
                        className="text-[10px] px-1.5 py-0.5 rounded shadow-neo-sm text-red-500 hover:shadow-neo-md">
                        Ban 24h
                      </button>
                    )}
                    {hasPermission(myRole, 'ban_user') && (
                      <button onClick={() => banUser(member.id, true)}
                        className="text-[10px] px-1.5 py-0.5 rounded shadow-neo-sm text-red-600 hover:shadow-neo-md">
                        Perma Ban
                      </button>
                    )}
                    {member.status === 'muted' ? (
                      <button onClick={() => unmuteUser(member.id)}
                        className="text-[10px] px-1.5 py-0.5 rounded shadow-neo-sm text-green-500 hover:shadow-neo-md">
                        Unmute
                      </button>
                    ) : hasPermission(myRole, 'mute_user') && (
                      <button onClick={() => muteUser(member.id)}
                        className="text-[10px] px-1.5 py-0.5 rounded shadow-neo-sm text-yellow-500 hover:shadow-neo-md">
                        Mute
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {activeTab === 'permissions' && (
          permRequests.length === 0 ? (
            <p className="text-xs text-neo-text/40 text-center py-4">No pending permission requests</p>
          ) : (
            permRequests.map(req => (
              <div key={req.id} className="p-2 rounded-neo shadow-neo-inset">
                <p className="text-xs text-neo-text mb-1">
                  <span className="font-bold">{req.username || 'User'}</span>
                  {' requests '}
                  <span className="font-bold text-neo-accent">{ACTION_LABELS[req.action as Action] || req.action}</span>
                </p>
                <div className="flex gap-1">
                  <button onClick={() => approvePermission(req.id)}
                    className="px-2 py-1 rounded-neo shadow-neo-sm text-xs font-bold text-green-500 hover:shadow-neo-md">
                    Approve
                  </button>
                  <button onClick={() => rejectPermission(req.id)}
                    className="px-2 py-1 rounded-neo shadow-neo-sm text-xs font-bold text-red-500 hover:shadow-neo-md">
                    Reject
                  </button>
                </div>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
};
