/**
 * Room Management Module
 * 
 * All room operations now require authentication.
 * Room creation sets the owner and access mode.
 * Moderation actions (kick/ban/mute) create audit trail entries.
 */

import { pb } from './api';

export const createRoom = async (
  roomName: string,
  ownerId: string,
  ownerUsername: string,
  accessMode: 'public' | 'invite_only' | 'manual_approval' = 'public'
) => {
  const room = await pb.collection('rooms').create({
    name: roomName,
    created_by: ownerUsername,
    owner_id: ownerId,
    access_mode: accessMode,
  });

  // Create owner membership automatically
  await pb.collection('room_members').create({
    room_id: room.id,
    user_id: ownerId,
    username: ownerUsername,
    role: 'owner',
    status: 'active',
    color: '#6C63FF',
  });

  return room.id;
};

export const joinRoom = async (roomId: string) => {
  const room = await pb.collection('rooms').getOne(roomId);
  return room;
};

/**
 * Invite a user to a room (for invite_only rooms)
 */
export const inviteUser = async (
  roomId: string,
  userId: string,
  username: string,
  invitedBy: string,
  role: 'editor' | 'viewer' = 'editor'
) => {
  const color = ['#6C63FF', '#FF6B6B', '#4ECDC4', '#FFE66D', '#FF9F1C', '#9D4EDD', '#F15BB5'][
    Math.floor(Math.random() * 7)
  ];

  return await pb.collection('room_members').create({
    room_id: roomId,
    user_id: userId,
    username,
    role,
    status: 'active',
    color,
    invited_by: invitedBy,
  });
};

/**
 * Kick a user from a room
 */
export const kickUser = async (
  memberId: string,
  roomId: string,
  actorId: string,
  targetId: string
) => {
  await pb.collection('room_members').update(memberId, { status: 'kicked' });
  await pb.collection('moderation_log').create({
    room_id: roomId,
    actor_id: actorId,
    target_id: targetId,
    action: 'kick',
  }).catch(() => {});
};

/**
 * Ban a user from a room
 * @param permanent If false, bans for 24 hours
 */
export const banUser = async (
  memberId: string,
  roomId: string,
  actorId: string,
  targetId: string,
  permanent: boolean = false
) => {
  const banExpires = permanent ? '' : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await pb.collection('room_members').update(memberId, {
    status: 'banned',
    ban_expires: banExpires,
  });
  await pb.collection('moderation_log').create({
    room_id: roomId,
    actor_id: actorId,
    target_id: targetId,
    action: 'ban',
    reason: permanent ? 'Permanent ban' : '24h ban',
    expires_at: banExpires,
  }).catch(() => {});
};

/**
 * Mute a user in a room (can view but cannot draw or send messages)
 */
export const muteUser = async (
  memberId: string,
  roomId: string,
  actorId: string,
  targetId: string
) => {
  await pb.collection('room_members').update(memberId, { status: 'muted' });
  await pb.collection('moderation_log').create({
    room_id: roomId,
    actor_id: actorId,
    target_id: targetId,
    action: 'mute',
  }).catch(() => {});
};

/**
 * Unmute a user
 */
export const unmuteUser = async (
  memberId: string,
  roomId: string,
  actorId: string,
  targetId: string
) => {
  await pb.collection('room_members').update(memberId, { status: 'active' });
  await pb.collection('moderation_log').create({
    room_id: roomId,
    actor_id: actorId,
    target_id: targetId,
    action: 'unmute',
  }).catch(() => {});
};
