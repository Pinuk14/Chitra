/**
 * Room Management Module (Supabase)
 * 
 * All room operations now require authentication.
 * Room creation sets the owner and access mode.
 * Moderation actions (kick/ban/mute) create audit trail entries.
 */

import { supabase } from './api';

export const createRoom = async (
  roomName: string,
  ownerId: string,
  ownerUsername: string,
  accessMode: 'public' | 'invite_only' | 'manual_approval' = 'public'
) => {
  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .insert({
      name: roomName,
      created_by: ownerUsername,
      owner_id: ownerId,
      access_mode: accessMode,
    })
    .select()
    .single();

  if (roomError) throw new Error(roomError.message);

  // Create owner membership automatically
  const { error: memberError } = await supabase
    .from('room_members')
    .insert({
      room_id: room.id,
      user_id: ownerId,
      username: ownerUsername,
      role: 'owner',
      status: 'active',
      color: '#6C63FF',
    });

  if (memberError) {
    // If membership fails, cleanup room
    await supabase.from('rooms').delete().eq('id', room.id);
    throw new Error(memberError.message);
  }

  return room.id;
};

export const joinRoom = async (roomId: string) => {
  const { data: room, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single();
    
  if (error) throw new Error(error.message);
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
  role: 'editor' | 'viewer' = 'viewer'
) => {
  const color = ['#6C63FF', '#FF6B6B', '#4ECDC4', '#FFE66D', '#FF9F1C', '#9D4EDD', '#F15BB5'][
    Math.floor(Math.random() * 7)
  ];

  const { data, error } = await supabase
    .from('room_members')
    .insert({
      room_id: roomId,
      user_id: userId,
      username,
      role,
      status: 'active',
      color,
      invited_by: invitedBy,
    })
    .select()
    .single();
    
  if (error) throw new Error(error.message);
  return data;
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
  await supabase.from('room_members').update({ status: 'kicked' }).eq('id', memberId);
  
  await supabase.from('moderation_log').insert({
    room_id: roomId,
    moderator_id: actorId,
    target_user_id: targetId,
    action: 'kick',
  });
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
  const banExpires = permanent ? null : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  
  await supabase.from('room_members').update({
    status: 'banned',
    ban_expires: banExpires,
  }).eq('id', memberId);
  
  await supabase.from('moderation_log').insert({
    room_id: roomId,
    moderator_id: actorId,
    target_user_id: targetId,
    action: 'ban',
    reason: permanent ? 'Permanent ban' : '24h ban',
  });
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
  await supabase.from('room_members').update({ status: 'muted' }).eq('id', memberId);
  
  await supabase.from('moderation_log').insert({
    room_id: roomId,
    moderator_id: actorId,
    target_user_id: targetId,
    action: 'mute',
  });
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
  await supabase.from('room_members').update({ status: 'active' }).eq('id', memberId);
  
  await supabase.from('moderation_log').insert({
    room_id: roomId,
    moderator_id: actorId,
    target_user_id: targetId,
    action: 'unmute',
  });
};
