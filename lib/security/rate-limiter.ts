/**
 * Client-Side Rate Limiter
 * 
 * DESIGN DECISION: Uses a sliding window algorithm to track action frequency.
 * Stored in memory intentionally — resets on page reload, which is acceptable
 * because rate limiting is primarily about preventing abuse during active sessions.
 * 
 * For production, this should be complemented by server-side rate limiting
 * (PocketBase v0.23+ hooks or an API gateway).
 */

interface RateLimitConfig {
  maxActions: number;  // Max actions allowed in the window
  windowMs: number;    // Window duration in milliseconds
}

// Configurable limits per action type
const RATE_LIMITS: Record<string, RateLimitConfig> = {
  draw:           { maxActions: 120, windowMs: 60_000 },  // 120 strokes/min
  create_object:  { maxActions: 60,  windowMs: 60_000 },  // 60 objects/min
  delete:         { maxActions: 30,  windowMs: 60_000 },  // 30 deletes/min
  message:        { maxActions: 20,  windowMs: 60_000 },  // 20 messages/min
  join:           { maxActions: 5,   windowMs: 60_000 },  // 5 joins/min
  cursor_update:  { maxActions: 200, windowMs: 10_000 },  // 200 cursor updates/10s
};

// In-memory timestamp tracking
const actionTimestamps: Record<string, number[]> = {};

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;     // ms until the next action is allowed
  remaining?: number;       // actions remaining in the window
}

/**
 * Check if an action is within rate limits.
 * Call this BEFORE performing the action.
 */
export function checkRateLimit(action: string): RateLimitResult {
  const config = RATE_LIMITS[action];
  if (!config) {
    // No rate limit configured for this action — allow it
    return { allowed: true };
  }

  const now = Date.now();
  const key = action;

  // Initialize or clean up old timestamps
  if (!actionTimestamps[key]) {
    actionTimestamps[key] = [];
  }

  // Remove timestamps outside the current window
  const windowStart = now - config.windowMs;
  actionTimestamps[key] = actionTimestamps[key].filter(t => t > windowStart);

  const count = actionTimestamps[key].length;

  if (count >= config.maxActions) {
    // Rate limited — calculate when the oldest timestamp expires
    const oldestInWindow = actionTimestamps[key][0];
    const retryAfter = oldestInWindow + config.windowMs - now;
    return {
      allowed: false,
      retryAfter: Math.max(0, retryAfter),
      remaining: 0,
    };
  }

  // Record this action
  actionTimestamps[key].push(now);

  return {
    allowed: true,
    remaining: config.maxActions - count - 1,
  };
}

/**
 * Reset rate limits for a specific action (e.g., after admin override)
 */
export function resetRateLimit(action: string): void {
  delete actionTimestamps[action];
}

/**
 * Reset all rate limits
 */
export function resetAllRateLimits(): void {
  Object.keys(actionTimestamps).forEach(key => delete actionTimestamps[key]);
}
