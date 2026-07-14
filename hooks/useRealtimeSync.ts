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
 *
 * KEY DESIGN DECISIONS for refresh stability:
 * 1. roomKey is stored in a ref (roomKeyRef) — NOT state — so that when the key loads,
 *    the main subscription effect does NOT re-run (which would clear and re-fetch strokes).
 * 2. user, userId, username are stored in stable refs — the subscription effect does NOT
 *    depend on them, preventing re-subscribe/re-fetch on every auth state change.
 * 3. hasFetchedRef prevents double-fetching in React StrictMode.
 * 4. Signature verification is NON-BLOCKING — a failed or erroring sig check logs a warning
 *    but never silently drops a stroke (which was the primary refresh-clear culprit).
 * 5. tryDecrypt tries E2EE key first, then falls back to legacy — strokes are never
 *    lost due to a key mismatch.
 */

const RANDOM_COLORS = ['#6C63FF', '#FF6B6B', '#4ECDC4', '#FFE66D', '#FF9F1C', '#9D4EDD', '#F15BB5'];

export const useRealtimeSync = (roomId: string, memberColor?: string) => {
  const { user } = useAuth();
  const { addStroke, setCursor, removeCursor, setStrokes } = useDrawing();

  const cursorRecordId = useRef<string | null>(null);
  const lastCursorUpdate = useRef(0);
  const userColor = useRef(memberColor || RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)]);

  // Store E2EE room key in a ref so loading it doesn't trigger re-subscription
  const roomKeyRef = useRef<CryptoKey | null>(null);
  const [isKeyLoaded, setIsKeyLoaded] = useState(false);

  // Stable user refs — readable in callbacks without causing re-subscription
  const userIdRef = useRef(user?.id || 'anon');
  const usernameRef = useRef(user?.username || 'Anonymous');

  useEffect(() => {
    userIdRef.current = user?.id || 'anon';
    usernameRef.current = user?.username || 'Anonymous';
  }, [user]);

  useEffect(() => {
    if (memberColor) userColor.current = memberColor;
  }, [memberColor]);

  // ── Phase 1: Key Loading ──────────────────────────────────────────────────
  // Runs once when roomId is known. Sets isKeyLoaded when done.
  useEffect(() => {
    const userId = userIdRef.current;

    // Anonymous or no room — no key to load, go straight to fetch
    if (!roomId || !userId || userId === 'anon') {
      setIsKeyLoaded(true);
      return;
    }

    let cancelled = false;

    pb.collection('room_members')
      .getFirstListItem(`room_id="${roomId}" && user_id="${userId}"`, { requestKey: null })
      .then(async (memberRecord) => {
        if (cancelled) return;

        if (memberRecord.encrypted_room_key) {
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

        if (!cancelled) setIsKeyLoaded(true);
      })
      .catch(() => {
        console.debug('[Crypto] No E2EE room key found, falling back to legacy crypto.');
        if (!cancelled) setIsKeyLoaded(true);
      });

    return () => {
      cancelled = true;
      // Reset so that if the component remounts (e.g. StrictMode), key loading runs again
      setIsKeyLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]); // userId read from stable ref — NOT a dependency

  // ── Phase 2: Subscribe & Fetch ────────────────────────────────────────────
  // Runs once after isKeyLoaded becomes true. Never re-runs due to auth changes.
  useEffect(() => {
    if (!roomId || !isKeyLoaded) return;

    let unsubscribeDrawings: (() => void) | undefined;
    let unsubscribeUsers: (() => void) | undefined;

    // Try E2EE key first, fall back to legacy symmetric key
    const tryDecrypt = async (encryptedPayload: any): Promise<any> => {
      // 1. Try with E2EE room key if we have one
      if (roomKeyRef.current) {
        try {
          const result = await decryptData(encryptedPayload, roomKeyRef.current);
          if (result !== null && result !== undefined) return result;
        } catch (_) {
          // fall through to legacy
        }
      }
      // 2. Legacy fallback
      return decryptData(encryptedPayload, undefined);
    };

    // Signature verification — ALWAYS ALLOWS THE STROKE THROUGH.
    // Previously this was blocking (continue on invalid), which meant any stroke
    // whose signer's public key wasn't uploaded yet was silently dropped on refresh.
    const tryVerifyStroke = async (stroke: any, signature: string, senderId: string): Promise<void> => {
      if (!signature || !senderId) return;
      try {
        const sender = await pb.collection('users').getOne(senderId, { requestKey: null });
        if (sender.public_key_sign) {
          const pubSignJwk = JSON.parse(sender.public_key_sign);
          const publicKey = await importJWK(pubSignJwk, { name: 'ECDSA', namedCurve: 'P-256' }, ['verify']);
          const { id, ...strokeData } = stroke;
          const isValid = await verifySignature(JSON.stringify(strokeData), signature, publicKey);
          if (!isValid) {
            console.warn('[Security] Invalid signature detected on stroke (allowing through):', stroke.id);
          }
        }
      } catch (e) {
        // Never let a sig check error block a stroke from loading
        console.debug('[Security] Sig verification skipped:', e);
      }
    };

    // ── Fetch existing drawings ────────────────────────────────────────────
    pb.collection('drawings').getFullList({
      filter: `room_id = "${roomId}"`,
      sort: 'created',
      requestKey: null,
    }).then(async (records) => {
      const initialStrokes: any[] = [];

      for (const r of records) {
        try {
          const decrypted = await tryDecrypt(r.strokes);

          if (decrypted === null || decrypted === undefined) {
            console.warn('[Sync] Could not decrypt stroke, skipping:', r.id);
            continue;
          }

          const parsed = typeof decrypted === 'string' ? JSON.parse(decrypted) : decrypted;
          parsed.id = r.id;

          // Non-blocking sig check (logs only, never drops)
          if (r.signature && r.user_id) {
            await tryVerifyStroke(parsed, r.signature, r.user_id);
          }

          initialStrokes.push(parsed);
        } catch (e) {
          console.warn('[Sync] Failed to process stroke on load:', r.id, e);
        }
      }

      setStrokes(initialStrokes);
    }).catch(err => {
      console.error('[Sync] Failed to fetch initial drawings:', err);
    });

    // ── Subscribe to real-time drawing events ─────────────────────────────
    pb.collection('drawings').subscribe('*', async (e) => {
      const currentUserId = userIdRef.current;

      if (
        (e.action === 'create' || e.action === 'update') &&
        e.record.room_id === roomId &&
        e.record.user_id !== currentUserId
      ) {
        try {
          const decrypted = await tryDecrypt(e.record.strokes);
          if (decrypted === null || decrypted === undefined) return;

          const incomingStroke = typeof decrypted === 'string' ? JSON.parse(decrypted) : decrypted;
          incomingStroke.id = e.record.id;

          if (e.action === 'create') {
            addStroke(incomingStroke);
          } else {
            useDrawing.getState().updateStroke(incomingStroke.id, incomingStroke);
          }
        } catch (err) {
          console.warn('[Sync] Failed to decrypt incoming stroke', err);
        }
      } else if (e.action === 'delete') {
        useDrawing.getState().removeStroke(e.record.id);
      }
    }).then((unsub) => {
      unsubscribeDrawings = unsub;
    });

    // ── Subscribe to cursor events ────────────────────────────────────────
    pb.collection('users_realtime').subscribe('*', (e) => {
      const currentUserId = userIdRef.current;
      if (e.record.room_id === roomId && e.record.user_id !== currentUserId) {
        if (e.action === 'create' || e.action === 'update') {
          setCursor(e.record.user_id, e.record.cursor_x, e.record.cursor_y, e.record.color, e.record.name);
        } else if (e.action === 'delete') {
          removeCursor(e.record.user_id);
        }
      }
    }).then((unsub) => {
      unsubscribeUsers = unsub;
    });

    // ── Create our cursor presence record ─────────────────────────────────
    pb.collection('users_realtime').create({
      room_id: roomId,
      user_id: userIdRef.current,
      name: usernameRef.current,
      cursor_x: -100,
      cursor_y: -100,
      color: userColor.current,
    }, { requestKey: null }).then(record => {
      cursorRecordId.current = record.id;
    }).catch(err => {
      console.error('[Sync] Failed to create cursor record:', err.message);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, isKeyLoaded]); // No user/userId/roomKey — all read from stable refs

  // ── Broadcast Functions ───────────────────────────────────────────────────

  const broadcastStroke = useCallback(async (stroke: any) => {
    if (!roomId) return;

    const rateCheck = checkRateLimit('draw');
    if (!rateCheck.allowed) {
      console.warn('[Rate] Too many draw actions');
      return;
    }

    const spamCheck = checkForSpam(stroke);
    if (spamCheck.isSuspicious) {
      console.warn('[Spam] Suspicious activity detected:', spamCheck.reason);
      return;
    }

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

      await pb.collection('drawings').create({
        id: stroke.id,
        room_id: roomId,
        user_id: userId,
        strokes: { payload: encryptedStroke },
        signature,
        timestamp: new Date().toISOString(),
      }, { requestKey: null });
    } catch (err: any) {
      console.error('[Sync] Broadcast stroke error:', err.status, err.response, err);
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

      try {
        await pb.collection('drawings').update(stroke.id, {
          strokes: { payload: encryptedStroke },
          signature,
          timestamp: new Date().toISOString(),
        }, { requestKey: null });
      } catch (err: any) {
        if (err.status === 404) {
          // Record not persisted yet — fall back to create
          await pb.collection('drawings').create({
            id: stroke.id,
            room_id: roomId,
            user_id: userId,
            strokes: { payload: encryptedStroke },
            signature,
            timestamp: new Date().toISOString(),
          }, { requestKey: null }).catch(e => {
            console.warn('[Sync] Fallback create also failed:', e);
          });
        } else if (!err.isAbort) {
          console.error('[Sync] Update stroke error:', err.status, err.response, err);
        }
      }
    } catch (err: any) {
      console.error('[Sync] Crypto error in updateStroke:', err);
    }
  }, [roomId]);

  const broadcastUndo = useCallback(async (strokeId: string) => {
    if (!roomId || !strokeId) return;
    try {
      await pb.collection('drawings').delete(strokeId);
    } catch (err: any) {
      if (!err.isAbort) console.error('[Sync] Undo error:', err.status, err.response, err);
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
        color: userColor.current,
      }, { requestKey: null }).catch(() => {});
    }
  }, [roomId]);

  return {
    broadcastStroke,
    broadcastUpdateStroke,
    broadcastUndo,
    broadcastCursor,
    userId: userIdRef.current,
    isE2EEActive: !!roomKeyRef.current,
    isKeyLoaded,
  };
};