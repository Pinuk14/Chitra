import { useEffect, useCallback, useRef } from 'react';
import { pb } from '@/lib/api';
import { useDrawing } from '@/lib/store';

export const MY_USER_ID = 'user-' + Math.floor(Math.random() * 1000000);
const RANDOM_COLORS = ['#6C63FF', '#FF6B6B', '#4ECDC4', '#FFE66D', '#FF9F1C', '#9D4EDD', '#F15BB5'];
export const MY_USER_COLOR = RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)];

export const useRealtimeSync = (roomId: string) => {
  const { addStroke, setCursor, removeCursor, setStrokes } = useDrawing();
  const cursorRecordId = useRef<string | null>(null);
  const lastCursorUpdate = useRef(0);

  useEffect(() => {
    let unsubscribeDrawings: () => void;
    let unsubscribeUsers: () => void;
    
    if (!roomId) return;

    // Fetch existing drawings
    pb.collection('drawings').getFullList({
      filter: `room_id = "${roomId}"`,
      sort: 'created'
    }).then((records) => {
      const initialStrokes = records.map(r => {
        const parsed = typeof r.strokes === 'string' ? JSON.parse(r.strokes) : r.strokes;
        parsed.id = r.id; // Always use the actual PB record ID
        return parsed;
      });
      setStrokes(initialStrokes);
    }).catch(err => {
      console.error('Failed to fetch initial drawings:', err);
    });

    // Subscribe to incoming drawings
    pb.collection('drawings').subscribe('*', (e) => {
      if (e.action === 'create' && e.record.room_id === roomId && e.record.user_id !== MY_USER_ID) {
        const incomingStroke = typeof e.record.strokes === 'string' 
          ? JSON.parse(e.record.strokes) 
          : e.record.strokes;
        
        incomingStroke.id = e.record.id; // Always use the actual PB record ID
        addStroke(incomingStroke);
      } else if (e.action === 'delete') {
        // Find the stroke by ID and remove it locally
        useDrawing.getState().removeStroke(e.record.id);
      }
    }).then((unsub) => {
      unsubscribeDrawings = unsub;
    });

    // Subscribe to incoming users
    pb.collection('users_realtime').subscribe('*', (e) => {
      if (e.record.room_id === roomId && e.record.user_id !== MY_USER_ID) {
        if (e.action === 'create' || e.action === 'update') {
          setCursor(e.record.user_id, e.record.cursor_x, e.record.cursor_y, e.record.color, e.record.name);
        } else if (e.action === 'delete') {
          removeCursor(e.record.user_id);
        }
      }
    }).then((unsub) => {
      unsubscribeUsers = unsub;
    });

    // Create a cursor record for ourselves
    pb.collection('users_realtime').create({
      room_id: roomId,
      user_id: MY_USER_ID,
      cursor_x: -100,
      cursor_y: -100,
      color: MY_USER_COLOR,
    }, { requestKey: null }).then(record => {
      cursorRecordId.current = record.id;
    }).catch(err => {
      console.error('Failed to create users_realtime record:', err.message, err.data);
    });

    const cleanupUserRecord = () => {
      if (cursorRecordId.current) {
        pb.collection('users_realtime').delete(cursorRecordId.current).catch(() => {});
        cursorRecordId.current = null;
      }
    };

    window.addEventListener('beforeunload', cleanupUserRecord);

    return () => {
      if (unsubscribeDrawings) unsubscribeDrawings();
      if (unsubscribeUsers) unsubscribeUsers();
      cleanupUserRecord();
      window.removeEventListener('beforeunload', cleanupUserRecord);
    };
  }, [roomId, setStrokes, addStroke, removeCursor, setCursor]);

  const broadcastStroke = useCallback(async (stroke: any) => {
    if (!roomId) return;
    try {
      await pb.collection('drawings').create({
        id: stroke.id, // Enforce our generated ID as the PB record ID
        room_id: roomId,
        user_id: MY_USER_ID,
        strokes: stroke,
        timestamp: new Date().toISOString(),
      }, { requestKey: null });
    } catch (err: any) {
      console.error('PB Drawings Error:', err.status, err.response, err);
    }
  }, [roomId]);

  const broadcastUndo = useCallback(async (strokeId: string) => {
    if (!roomId || !strokeId) return;
    try {
      await pb.collection('drawings').delete(strokeId);
    } catch (err: any) {
      console.error('PB Undo Error:', err.status, err.response, err);
    }
  }, [roomId]);

  const broadcastCursor = useCallback((x: number, y: number) => {
    if (!roomId) return;
    const now = Date.now();
    if (now - lastCursorUpdate.current > 50 && cursorRecordId.current) {
      lastCursorUpdate.current = now;
      pb.collection('users_realtime').update(cursorRecordId.current, {
        cursor_x: x,
        cursor_y: y,
        color: MY_USER_COLOR,
      }, { requestKey: null }).catch(err => {
        console.debug('Failed to update cursor:', err.message, err.data);
      });
    }
  }, [roomId]);

  return { broadcastStroke, broadcastUndo, broadcastCursor };
};
