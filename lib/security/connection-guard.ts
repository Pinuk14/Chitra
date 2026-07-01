/**
 * Connection Guard
 * 
 * DESIGN DECISION: Prevents abuse from rapid repeated connections.
 * Uses sessionStorage (survives page reloads within a tab, but resets on tab close)
 * to track join attempts and detect reconnection flooding.
 */

interface ConnectionConfig {
  maxJoinsPerWindow: number;   // Max join attempts in the window
  windowMs: number;            // Window duration in milliseconds
  maxReconnectsPerWindow: number;
  reconnectWindowMs: number;
}

const DEFAULT_CONFIG: ConnectionConfig = {
  maxJoinsPerWindow: 5,
  windowMs: 60_000,            // 5 joins per 60 seconds
  maxReconnectsPerWindow: 10,
  reconnectWindowMs: 30_000,   // 10 reconnects per 30 seconds
};

const STORAGE_KEY = 'chitra_connection_guard';

interface StoredState {
  joinAttempts: number[];
  reconnectAttempts: number[];
}

function getState(): StoredState {
  if (typeof window === 'undefined') return { joinAttempts: [], reconnectAttempts: [] };
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { joinAttempts: [], reconnectAttempts: [] };
}

function saveState(state: StoredState): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export interface ConnectionCheckResult {
  allowed: boolean;
  reason?: string;
  retryAfterMs?: number;
}

/**
 * Check if a room join attempt should be allowed
 */
export function checkJoinAttempt(
  config: ConnectionConfig = DEFAULT_CONFIG
): ConnectionCheckResult {
  const now = Date.now();
  const state = getState();

  // Clean old attempts
  const windowStart = now - config.windowMs;
  state.joinAttempts = state.joinAttempts.filter(t => t > windowStart);

  if (state.joinAttempts.length >= config.maxJoinsPerWindow) {
    const oldest = state.joinAttempts[0];
    const retryAfterMs = oldest + config.windowMs - now;
    saveState(state);
    return {
      allowed: false,
      reason: `Too many join attempts. Please wait ${Math.ceil(retryAfterMs / 1000)} seconds.`,
      retryAfterMs,
    };
  }

  state.joinAttempts.push(now);
  saveState(state);
  return { allowed: true };
}

/**
 * Check if a reconnect attempt should be allowed
 */
export function checkReconnectAttempt(
  config: ConnectionConfig = DEFAULT_CONFIG
): ConnectionCheckResult {
  const now = Date.now();
  const state = getState();

  const windowStart = now - config.reconnectWindowMs;
  state.reconnectAttempts = state.reconnectAttempts.filter(t => t > windowStart);

  if (state.reconnectAttempts.length >= config.maxReconnectsPerWindow) {
    const oldest = state.reconnectAttempts[0];
    const retryAfterMs = oldest + config.reconnectWindowMs - now;
    saveState(state);
    return {
      allowed: false,
      reason: `Too many reconnection attempts. Please wait ${Math.ceil(retryAfterMs / 1000)} seconds.`,
      retryAfterMs,
    };
  }

  state.reconnectAttempts.push(now);
  saveState(state);
  return { allowed: true };
}

/**
 * Reset connection guard state
 */
export function resetConnectionGuard(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(STORAGE_KEY);
}
