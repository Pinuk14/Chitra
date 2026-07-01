import { pb } from './api';

export const createRoom = async (roomName: string) => {
  // PocketBase will auto-generate a valid 15-character ID for us.
  const room = await pb.collection('rooms').create({
    name: roomName,
    created_by: 'anonymous',
  });
  return room.id;
};

export const joinRoom = async (roomId: string) => {
  const room = await pb.collection('rooms').getOne(roomId);
  return room;
};

export const saveDrawing = async (roomId: string, strokes: any[]) => {
  await pb.collection('drawings').create({
    room_id: roomId,
    user_id: 'user-' + Math.floor(Math.random() * 1000000),
    strokes: strokes, // We configured 'json' type in pb, so we can pass the array directly instead of stringifying
    timestamp: new Date().toISOString(),
  });
};
