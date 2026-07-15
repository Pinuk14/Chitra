import { useEffect, useCallback, useRef, useState } from 'react';
import { supabase } from '@/lib/api';
import { useDrawing } from '@/lib/store';
import { useAuth } from '@/lib/auth/context';
import { checkRateLimit } from '@/lib/security/rate-limiter';
import { checkForSpam } from '@/lib/security/spam-detector';
import { encryptData, decryptData, signData, verifySignature, importJWK, unwrapRoomKey } from '@/lib/security/crypto';

const RANDOM_COLORS = ['#6C63FF', '#FF6B6B', '#4ECDC4', '#FFE66D', '#FF9F1C', '#9D4EDD', '#F15BB5'];

export const useRealtimeSync = (roomId: string, memberColor?: string) => {
  const { user } = useAuth();
  const { addStroke, setCursor, removeCursor, setStrokes } = useDrawing();

  const lastCursorUpdate = useRef(0);
  const lastLiveStrokeUpdate = useRef(0);
  const userColor = useRef(memberColor || RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)]);

  const roomKeyRef = useRef<CryptoKey | null>(null);
  const [isKeyLoaded, setIsKeyLoaded] = useState(false);

  const userIdRef = useRef(user?.id || 'anon');
  const usernameRef = useRef(user?.username || 'Anonymous');

  // Supabase channel ref
  const channelRef = useRef<any>(null);
  const channelConnectedRef = useRef(false);

  useEffect(() => {
    userIdRef.current = user?.id || 'anon';
    usernameRef.current = user?.username || 'Anonymous';
  }, [user]);

  useEffect(() => {
    if (memberColor) userColor.current = memberColor;
  }, [memberColor]);

  // ── Phase 1: Key Loading ──────────────────────────────────────────────────
  useEffect(() => {
    const userId = userIdRef.current;

    if (!roomId || !userId || userId === 'anon') {
      setIsKeyLoaded(true);
      return;
    }

    let cancelled = false;

    supabase
      .from('room_members')
      .select('encrypted_room_key')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .single()
      .then(async ({ data: memberRecord, error }) => {
        if (cancelled) return;

        if (!error && memberRecord?.encrypted_room_key) {
          const privExJwkStr = localStorage.getItem(`crypto_ex_${userId}`);
          if (privExJwkStr) {
            try {
              const privExJwk = JSON.parse(privExJwkStr);
              const privateExKey = await importJWK(privExJwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, ['unwrapKey']);
              const rKey = await unwrapRoomKey(memberRecord.encrypted_room_key, privateExKey);
              roomKeyRef.current = rKey;
              console.log('[Crypto] E2EE Room Key loaded successfully.');
            } catch (e) {
              console.warn('[Crypto] Failed to unwrap E2EE room key, falling back to legacy crypto.', e);
            }
          }
        }
        setIsKeyLoaded(true);
      }, () => {
        if (!cancelled) setIsKeyLoaded(true);
      });

    return () => {
      cancelled = true;
      setIsKeyLoaded(false);
    };
  }, [roomId]);

  // ── Phase 2: Subscribe & Fetch ────────────────────────────────────────────
  useEffect(() => {
    if (!roomId || !isKeyLoaded) return;

    const tryDecrypt = async (encryptedPayload: any): Promise<any> => {
      if (roomKeyRef.current) {
        try {
          const result = await decryptData(encryptedPayload, roomKeyRef.current);
          if (result !== null && result !== undefined) return result;
        } catch (_) {}
      }
      return decryptData(encryptedPayload, undefined);
    };

    const tryVerifyStroke = async (stroke: any, signature: string, senderId: string): Promise<void> => {
      if (!signature || !senderId) return;
      try {
        const { data: sender } = await supabase.from('profiles').select('public_key_sign').eq('id', senderId).single();
        if (sender?.public_key_sign) {
          const pubSignJwk = JSON.parse(sender.public_key_sign);
          const publicKey = await importJWK(pubSignJwk, { name: 'ECDSA', namedCurve: 'P-256' }, ['verify']);
          const { id, ...strokeData } = stroke;
          const isValid = await verifySignature(JSON.stringify(strokeData), signature, publicKey);
          if (!isValid) {
            console.warn('[Security] Invalid signature detected on stroke (allowing through):', stroke.id);
          }
        }
      } catch (e) {
        console.debug('[Security] Sig verification skipped:', e);
      }
    };

    // ── Fetch existing drawings ────────────────────────────────────────────
    supabase
      .from('drawings')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .then(async ({ data: records, error }) => {
        if (error) {
          console.error('[Sync] Failed to fetch initial drawings:', error);
          return;
        }

        const initialStrokes: any[] = [];
        for (const r of records || []) {
          try {
            const decrypted = await tryDecrypt(r.strokes?.payload || r.strokes);
            if (decrypted === null || decrypted === undefined) continue;

            const parsed = typeof decrypted === 'string' ? JSON.parse(decrypted) : decrypted;
            parsed.id = r.id;

            if (r.signature && r.user_id) {
              await tryVerifyStroke(parsed, r.signature, r.user_id);
            }

            initialStrokes.push(parsed);
          } catch (e) {
            console.warn('[Sync] Failed to process stroke on load:', r.id, e);
          }
        }
        setStrokes(initialStrokes);
      });

    // ── Setup Realtime Channel (DB + Broadcast + Presence) ────────────────
    const channel = supabase.channel(`room:${roomId}`, {
      config: { presence: { key: userIdRef.current } }
    });

    channelRef.current = channel;

    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drawings', filter: `room_id=eq.${roomId}` }, async (payload) => {
        const currentUserId = userIdRef.current;
        const action = payload.eventType;
        const record = (payload.new || payload.old) as any;

        if (record.user_id === currentUserId) return; // ignore our own strokes

        if (action === 'INSERT' || action === 'UPDATE') {
          try {
            const decrypted = await tryDecrypt(record.strokes?.payload || record.strokes);
            if (decrypted === null || decrypted === undefined) return;

            const incomingStroke = typeof decrypted === 'string' ? JSON.parse(decrypted) : decrypted;
            incomingStroke.id = record.id;

            if (action === 'INSERT') {
              addStroke(incomingStroke);
            } else {
              useDrawing.getState().updateStroke(incomingStroke.id, incomingStroke);
            }
          } catch (err) {
            console.warn('[Sync] Failed to decrypt incoming stroke', err);
          }
        } else if (action === 'DELETE') {
          useDrawing.getState().removeStroke(record.id);
        }
      })
      .on('broadcast', { event: 'cursor' }, (payload) => {
        // Handle incoming cursors via broadcast
        const { userId, x, y, color, name } = payload.payload;
        if (userId !== userIdRef.current) {
          setCursor(userId, x, y, color, name);
        }
      })
      .on('broadcast', { event: 'live_stroke' }, async (payload) => {
        // Handle incoming live strokes
        const { userId, stroke, signature } = payload.payload;
        if (userId === userIdRef.current) return;

        try {
          const decrypted = await tryDecrypt(stroke.payload || stroke);
          if (decrypted === null || decrypted === undefined) return;

          const incomingStroke = typeof decrypted === 'string' ? JSON.parse(decrypted) : decrypted;
          incomingStroke.id = payload.payload.strokeId;

          // Add or update the live stroke in the local state
          const existingStroke = useDrawing.getState().strokes.find(s => s.id === incomingStroke.id);
          if (existingStroke) {
            useDrawing.getState().updateStroke(incomingStroke.id, incomingStroke);
          } else {
            addStroke(incomingStroke);
          }
        } catch (err) {
          console.warn('[Sync] Failed to decrypt incoming live stroke', err);
        }
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        // When someone leaves, remove their cursor
        removeCursor(key);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channelConnectedRef.current = true;
          channel.track({
            userId: userIdRef.current,
            name: usernameRef.current,
            color: userColor.current,
            online_at: new Date().toISOString()
          });
        } else {
          channelConnectedRef.current = false;
        }
      });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      channelConnectedRef.current = false;
    };
  }, [roomId, isKeyLoaded]);

  // ── Broadcast Functions ───────────────────────────────────────────────────

  const broadcastStroke = useCallback(async (stroke: any) => {
    if (!roomId) return;

    const rateCheck = checkRateLimit('draw');
    if (!rateCheck.allowed) return;

    const spamCheck = checkForSpam(stroke);
    if (spamCheck.isSuspicious) return;

    try {
      const userId = userIdRef.current;
      const encryptedStroke = await encryptData(stroke, roomKeyRef.current || undefined);

      let signature = '';
      const privSignJwkStr = localStorage.getItem(`crypto_sign_${userId}`);
      if (privSignJwkStr) {
        const privExJwk = JSON.parse(privSignJwkStr);
        const privateKey = await importJWK(privExJwk, { name: 'ECDSA', namedCurve: 'P-256' }, ['sign']);
        const { id, ...strokeData } = stroke;
        signature = await signData(JSON.stringify(strokeData), privateKey);
      }

      await supabase.from('drawings').insert({
        id: stroke.id,
        room_id: roomId,
        user_id: userId,
        strokes: { payload: encryptedStroke },
        signature,
      });
    } catch (err: any) {
      console.error('[Sync] Broadcast stroke error:', err);
    }
  }, [roomId]);

  const broadcastUpdateStroke = useCallback(async (stroke: any) => {
    if (!roomId || !stroke.id) return;

    const rateCheck = checkRateLimit('draw');
    if (!rateCheck.allowed) return;

    try {
      const userId = userIdRef.current;
      const encryptedStroke = await encryptData(stroke, roomKeyRef.current || undefined);

      let signature = '';
      const privSignJwkStr = localStorage.getItem(`crypto_sign_${userId}`);
      if (privSignJwkStr) {
        const privExJwk = JSON.parse(privSignJwkStr);
        const privateKey = await importJWK(privExJwk, { name: 'ECDSA', namedCurve: 'P-256' }, ['sign']);
        const { id, ...strokeData } = stroke;
        signature = await signData(JSON.stringify(strokeData), privateKey);
      }

      const { error } = await supabase.from('drawings').update({
        strokes: { payload: encryptedStroke },
        signature,
      }).eq('id', stroke.id);

      if (error) {
        // Upsert fallback
        const { error: fallbackError } = await supabase.from('drawings').upsert({
          id: stroke.id,
          room_id: roomId,
          user_id: userId,
          strokes: { payload: encryptedStroke },
          signature,
        });
        if (fallbackError) console.warn('[Sync] Fallback create also failed:', fallbackError);
      }
    } catch (err: any) {
      console.error('[Sync] Crypto error in updateStroke:', err);
    }
  }, [roomId]);

  const broadcastUndo = useCallback(async (strokeId: string) => {
    if (!roomId || !strokeId) return;
    try {
      await supabase.from('drawings').delete().eq('id', strokeId);
    } catch (err: any) {
      console.error('[Sync] Undo error:', err);
    }
  }, [roomId]);

  const broadcastCursor = useCallback((x: number, y: number) => {
    if (!roomId || !channelRef.current || !channelConnectedRef.current) return;
    const now = Date.now();
    
    // Broadcast via Supabase Realtime (very lightweight, no DB writes)
    if (now - lastCursorUpdate.current > 50) {
      lastCursorUpdate.current = now;
      channelRef.current.send({
        type: 'broadcast',
        event: 'cursor',
        payload: {
          userId: userIdRef.current,
          name: usernameRef.current,
          color: userColor.current,
          x,
          y
        }
      }).catch(() => {});
    }
  }, [roomId]);

  const broadcastLiveStroke = useCallback(async (stroke: any) => {
    if (!roomId || !channelRef.current || !channelConnectedRef.current) return;
    const now = Date.now();

    // Throttle live stroke updates to 50ms
    if (now - lastLiveStrokeUpdate.current > 50) {
      lastLiveStrokeUpdate.current = now;
      try {
        const encryptedStroke = await encryptData(stroke, roomKeyRef.current || undefined);
        channelRef.current.send({
          type: 'broadcast',
          event: 'live_stroke',
          payload: {
            userId: userIdRef.current,
            strokeId: stroke.id,
            stroke: { payload: encryptedStroke },
          }
        }).catch(() => {});
      } catch (err) {
        console.warn('[Sync] Failed to encrypt live stroke:', err);
      }
    }
  }, [roomId]);

  return {
    broadcastStroke,
    broadcastUpdateStroke,
    broadcastLiveStroke,
    broadcastUndo,
    broadcastCursor,
    userId: userIdRef.current,
    isE2EEActive: !!roomKeyRef.current,
    isKeyLoaded,
  };
};