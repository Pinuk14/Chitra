import { useEffect, useCallback, useRef, useState } from 'react';
import { pb } from '@/lib/api';
import { useDrawing } from '@/lib/store';
import { useAuth } from '@/lib/auth/context';
import { checkRateLimit } from '@/lib/security/rate-limiter';
import { checkForSpam } from '@/lib/security/spam-detector';
import { encryptData, decryptData, signData, verifySignature, importJWK, unwrapRoomKey } from '@/lib/security/crypto';

/**
 * Real-time sync hook — E2EE enabled
 * Integrates rate limiting, spam detection, digital signatures, and optional true E2EE room keys.
 */

const RANDOM_COLORS = ['#6C63FF', '#FF6B6B', '#4ECDC4', '#FFE66D', '#FF9F1C', '#9D4EDD', '#F15BB5'];

export const useRealtimeSync = (roomId: string, memberColor?: string) => {
  const { user } = useAuth();
  const { addStroke, setCursor, removeCursor, setStrokes } = useDrawing();
  const cursorRecordId = useRef<string | null>(null);
  const lastCursorUpdate = useRef(0);
  const userColor = useRef(memberColor || RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)]);

  const [roomKey, setRoomKey] = useState<CryptoKey | null>(null);
  
  // Use authenticated user ID or fallback
  const userId = user?.id || 'anon';
  const username = user?.username || 'Anonymous';

  useEffect(() => {
    if (memberColor) userColor.current = memberColor;
  }, [memberColor]);

  // Load Room Key if E2EE is set up for this member
  useEffect(() => {
    if (!roomId || !userId || userId === 'anon') return;
    
    // Try to get encrypted room key for this user
    pb.collection('room_members').getFirstListItem(`room_id="${roomId}" && user_id="${userId}"`)
      .then(async (memberRecord) => {
        if (memberRecord.encrypted_room_key) {
          const privExJwkStr = localStorage.getItem(`crypto_ex_${userId}`);
          if (privExJwkStr) {
            const privExJwk = JSON.parse(privExJwkStr);
            const privateExKey = await importJWK(privExJwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, ['unwrapKey']);
            const rKey = await unwrapRoomKey(memberRecord.encrypted_room_key, privateExKey);
            setRoomKey(rKey);
            console.log("E2EE Room Key loaded successfully.");
          }
        }
      }).catch(err => {
        console.debug("No E2EE room key found for user, falling back to legacy crypto.");
      });
  }, [roomId, userId]);

  useEffect(() => {
    let unsubscribeDrawings: () => void;
    let unsubscribeUsers: () => void;
    
    if (!roomId || !user) return;

    // Helper to verify stroke signature
    const verifyStrokeSignature = async (stroke: any, signature: string, senderId: string) => {
      if (!signature || !senderId) return false;
      try {
        const sender = await pb.collection('users').getOne(senderId);
        if (sender.public_key_sign) {
          const pubSignJwk = JSON.parse(sender.public_key_sign);
          const publicKey = await importJWK(pubSignJwk, { name: 'ECDSA', namedCurve: 'P-256' }, ['verify']);
          // We sign the JSON representation of the stroke without the id
          const { id, ...strokeData } = stroke;
          return await verifySignature(JSON.stringify(strokeData), signature, publicKey);
        }
      } catch(e) {
        console.warn("Signature verification failed", e);
      }
      return false;
    };

    // Fetch existing drawings
    pb.collection('drawings').getFullList({
      filter: `room_id = "${roomId}"`,
      sort: 'created',
      requestKey: null
    }).then(async (records) => {
      const initialStrokes = [];
      for (const r of records) {
        try {
          // Fallback to undefined roomKey (legacy) if we don't have one
          const decrypted = await decryptData(r.strokes, roomKey || undefined);
          if (decrypted) {
            const parsed = typeof decrypted === 'string' ? JSON.parse(decrypted) : decrypted;
            parsed.id = r.id;
            
            // Signature Check (if available)
            if (r.signature && r.user_id) {
               const isValid = await verifyStrokeSignature(parsed, r.signature, r.user_id);
               if (!isValid) {
                 console.warn("Tampering detected on stroke ID:", r.id);
                 continue; // Skip rendering tampered stroke
               }
            }
            initialStrokes.push(parsed);
          }
        } catch (e) {
          console.warn('Failed to decrypt stroke', e);
        }
      }
      setStrokes(initialStrokes);
    }).catch(err => {
      console.error('Failed to fetch initial drawings:', err);
    });

    // Subscribe to incoming drawings
    pb.collection('drawings').subscribe('*', async (e) => {
      if (e.action === 'create' && e.record.room_id === roomId && e.record.user_id !== userId) {
        try {
          const decrypted = await decryptData(e.record.strokes, roomKey || undefined);
          if (decrypted) {
            const incomingStroke = typeof decrypted === 'string' ? JSON.parse(decrypted) : decrypted;
            incomingStroke.id = e.record.id;
            
            // Signature check
            if (e.record.signature && e.record.user_id) {
               const isValid = await verifyStrokeSignature(incomingStroke, e.record.signature, e.record.user_id);
               if (!isValid) {
                 console.warn("Tampering detected on incoming stroke ID:", e.record.id);
                 return; 
               }
            }
            addStroke(incomingStroke);
          }
        } catch (err) {
          console.warn('Failed to decrypt incoming stroke', err);
        }
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
  }, [roomId, user, userId, username, setStrokes, addStroke, removeCursor, setCursor, roomKey]);

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
      const encryptedStroke = await encryptData(stroke, roomKey || undefined);
      
      let signature = "";
      const privSignJwkStr = localStorage.getItem(`crypto_sign_${userId}`);
      if (privSignJwkStr) {
         const privSignJwk = JSON.parse(privSignJwkStr);
         const privateKey = await importJWK(privSignJwk, { name: 'ECDSA', namedCurve: 'P-256' }, ['sign']);
         // Sign without ID (as it's assigned by DB later or client generates it)
         const { id, ...strokeData } = stroke;
         signature = await signData(JSON.stringify(strokeData), privateKey);
      }

      await pb.collection('drawings').create({
        id: stroke.id,
        room_id: roomId,
        user_id: userId,
        strokes: encryptedStroke,
        signature: signature,
        timestamp: new Date().toISOString(),
      }, { requestKey: null });
    } catch (err: any) {
      console.error('PB Drawings Error:', err.status, err.response, err);
    }
  }, [roomId, user, userId, roomKey]);

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

  return { broadcastStroke, broadcastUndo, broadcastCursor, userId, isE2EEActive: !!roomKey };
};
