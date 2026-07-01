import { useEffect, useCallback, useRef } from 'react';
import { pb } from '@/lib/api';
import { useDrawing } from '@/lib/store';
import { useAuth } from '@/lib/auth/context';
import { checkRateLimit } from '@/lib/security/rate-limiter';
import { checkForSpam } from '@/lib/security/spam-detector';

/**
 * Real-time sync hook — now uses authenticated user identity
 * instead of random IDs. Integrates rate limiting and spam detection.
 */

const RANDOM_COLORS = ['#6C63FF', '#FF6B6B', '#4ECDC4', '#FFE66D', '#FF9F1C', '#9D4EDD', '#F15BB5'];

export const useRealtimeSync = (roomId: string, memberColor?: string) => {
  const { user } = useAuth();
  const { addStroke, setCursor, removeCursor, setStrokes } = useDrawing();
  const cursorRecordId = useRef<string | null>(null);
  const lastCursorUpdate = useRef(0);
  const userColor = useRef(memberColor || RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)]);

  // Use authenticated user ID or fallback
  const userId = user?.id || 'anon';
  const username = user?.username || 'Anonymous';

  useEffect(() => {
    if (memberColor) userColor.current = memberColor;
  }, [memberColor]);

  useEffect(() => {
    let unsubscribeDrawings: () => void;
    let unsubscribeUsers: () => void;
    
    if (!roomId || !user) return;

    // Fetch existing drawings
    pb.collection('drawings').getFullList({
      filter: `room_id = "${roomId}"`,
      sort: 'created',
      requestKey: null
    }).then((records) => {
      const initialStrokes = records.map(r => {
        const parsed = typeof r.strokes === 'string' ? JSON.parse(r.strokes) : r.strokes;
        parsed.id = r.id;
        return parsed;
      });
      setStrokes(initialStrokes);
    }).catch(err => {
      console.error('Failed to fetch initial drawings:', err);
    });

    // Subscribe to incoming drawings
    pb.collection('drawings').subscribe('*', (e) => {
      if (e.action === 'create' && e.record.room_id === roomId && e.record.user_id !== userId) {
        const incomingStroke = typeof e.record.strokes === 'string' 
          ? JSON.parse(e.record.strokes) 
          : e.record.strokes;
        
        incomingStroke.id = e.record.id;
        addStroke(incomingStroke);
      } else if (e.action === 'delete') {
        useDrawing.getState().removeStroke(e.record.id);
      }
    }).then((unsub) => {
      unsubscribeDrawings = unsub;
    });

    // Subscribe to incoming users
    pb.collection('users_realtime').subscribe('*', (e) => {
      if (e.record.room_id === roomId && e.record.user_id !== userId) {
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
      user_id: userId,
      name: username,
      cursor_x: -100,
      cursor_y: -100,
      color: userColor.current,
    }, { requestKey: null }).then(record => {
      cursorRecordId.current = record.id;
    }).catch(err => {
      console.error('Failed to create users_realtime record:', err.message);
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
  }, [roomId, user, userId, username, setStrokes, addStroke, removeCursor, setCursor]);

  const broadcastStroke = useCallback(async (stroke: any) => {
    if (!roomId || !user) return;

    // Rate limiting check
    const rateCheck = checkRateLimit('draw');
    if (!rateCheck.allowed) {
      console.warn('Rate limited: too many draw actions');
      return;
    }

    // Spam detection check
    const spamCheck = checkForSpam(stroke);
    if (spamCheck.isSuspicious) {
      console.warn('Spam detected:', spamCheck.reason);
      return;
    }

    try {
      await pb.collection('drawings').create({
        id: stroke.id,
        room_id: roomId,
        user_id: userId,
        strokes: stroke,
        timestamp: new Date().toISOString(),
      }, { requestKey: null });
    } catch (err: any) {
      console.error('PB Drawings Error:', err.status, err.response, err);
    }
  }, [roomId, user, userId]);

  const broadcastUndo = useCallback(async (strokeId: string) => {
    if (!roomId || !strokeId || !user) return;
    try {
      await pb.collection('drawings').delete(strokeId);
    } catch (err: any) {
      console.error('PB Undo Error:', err.status, err.response, err);
    }
  }, [roomId, user]);

  const broadcastCursor = useCallback((x: number, y: number) => {
    if (!roomId || !user) return;
    const now = Date.now();
    if (now - lastCursorUpdate.current > 50 && cursorRecordId.current) {
      lastCursorUpdate.current = now;
      pb.collection('users_realtime').update(cursorRecordId.current, {
        cursor_x: x,
        cursor_y: y,
        color: userColor.current,
      }, { requestKey: null }).catch(err => {
        console.debug('Failed to update cursor:', err.message);
      });
    }
  }, [roomId, user]);

  return { broadcastStroke, broadcastUndo, broadcastCursor, userId };
};
