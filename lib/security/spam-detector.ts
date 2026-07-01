/**
 * Spam Detector
 * 
 * DESIGN DECISION: Behavioral analysis for detecting suspicious patterns.
 * Tracks action frequency, payload repetition, and mass operations.
 * When suspicious behavior is detected, the system temporarily restricts
 * the user and notifies admins via a callback.
 */

interface SpamConfig {
  rapidThreshold: number;     // Actions in the rapid window to trigger
  rapidWindowMs: number;      // Window for rapid action detection
  duplicateThreshold: number; // Identical payloads to trigger
  cooldownMs: number;         // How long to restrict after detection
}

const DEFAULT_CONFIG: SpamConfig = {
  rapidThreshold: 50,       // 50+ actions in 5 seconds
  rapidWindowMs: 5_000,
  duplicateThreshold: 10,   // 10+ identical payloads
  cooldownMs: 30_000,       // 30 second cooldown
};

// In-memory tracking state
let recentActions: { timestamp: number; hash: string }[] = [];
let isRestricted = false;
let restrictedUntil = 0;
let onSuspiciousCallback: ((reason: string) => void) | null = null;

export interface SpamCheckResult {
  isSuspicious: boolean;
  reason?: string;
  restrictedUntil?: number; // timestamp when restriction lifts
}

/**
 * Generate a simple hash of a payload for duplicate detection
 */
function simpleHash(payload: any): string {
  try {
    const str = JSON.stringify(payload);
    // Use a basic hash — not cryptographic, just for pattern matching
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32-bit integer
    }
    return hash.toString(36);
  } catch {
    return 'unknown';
  }
}

/**
 * Check if the current action pattern looks suspicious.
 * Call this before performing drawing/deletion actions.
 */
export function checkForSpam(
  payload?: any,
  config: SpamConfig = DEFAULT_CONFIG
): SpamCheckResult {
  const now = Date.now();

  // Check if currently restricted
  if (isRestricted && now < restrictedUntil) {
    return {
      isSuspicious: true,
      reason: 'Temporarily restricted due to suspicious activity',
      restrictedUntil,
    };
  } else if (isRestricted && now >= restrictedUntil) {
    // Cooldown expired — lift restriction
    isRestricted = false;
    recentActions = [];
  }

  const hash = simpleHash(payload);
  recentActions.push({ timestamp: now, hash });

  // Clean up old entries
  const windowStart = now - config.rapidWindowMs;
  recentActions = recentActions.filter(a => a.timestamp > windowStart);

  // Check 1: Rapid action detection
  if (recentActions.length >= config.rapidThreshold) {
    return triggerRestriction(
      `Rapid activity detected: ${recentActions.length} actions in ${config.rapidWindowMs / 1000}s`,
      now,
      config
    );
  }

  // Check 2: Duplicate payload detection
  const duplicateCount = recentActions.filter(a => a.hash === hash).length;
  if (duplicateCount >= config.duplicateThreshold) {
    return triggerRestriction(
      `Repeated identical actions detected: ${duplicateCount} duplicates`,
      now,
      config
    );
  }

  return { isSuspicious: false };
}

function triggerRestriction(
  reason: string,
  now: number,
  config: SpamConfig
): SpamCheckResult {
  isRestricted = true;
  restrictedUntil = now + config.cooldownMs;

  // Notify admin via callback if registered
  if (onSuspiciousCallback) {
    onSuspiciousCallback(reason);
  }

  return {
    isSuspicious: true,
    reason,
    restrictedUntil,
  };
}

/**
 * Register a callback for when suspicious activity is detected.
 * Used to notify admins in real-time.
 */
export function onSuspiciousActivity(callback: (reason: string) => void): void {
  onSuspiciousCallback = callback;
}

/**
 * Clear the spam detector state (e.g., admin override)
 */
export function clearSpamState(): void {
  recentActions = [];
  isRestricted = false;
  restrictedUntil = 0;
}
