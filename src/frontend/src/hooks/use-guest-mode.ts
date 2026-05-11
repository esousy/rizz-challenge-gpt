/**
 * Tracks anonymous guest session state in localStorage.
 * - guestSessionsCompleted: how many full sessions the guest has played
 * - hasPassedAuthWall: guest explicitly chose to continue as guest after wall
 *
 * Also provides sessionStorage helpers to carry a guest session result through
 * to the signup flow so it can be persisted to the backend after auth.
 */
import type { SessionResult as BackendSessionResult } from "@/backend";
import { useCallback, useState } from "react";

const KEY_SESSIONS = "rizz-guest-sessions";
const KEY_PASSED_WALL = "rizz-guest-passed-wall";
const SESSION_RESULT_KEY = "guest_session_result";

// ── Standalone sessionStorage helpers ───────────────────────────────────────
// These are NOT inside the hook so they can be imported as plain functions.

/**
 * Persist the guest's completed session result to sessionStorage.
 * Call this from Results.tsx before showing the signup modal so the data
 * survives until the user authenticates.
 */
export function storeGuestSessionResult(result: BackendSessionResult): void {
  try {
    sessionStorage.setItem(
      SESSION_RESULT_KEY,
      JSON.stringify(result, (_, v) =>
        typeof v === "bigint" ? { __bigint__: v.toString() } : v,
      ),
    );
  } catch {
    // sessionStorage unavailable — silently fail
  }
}

/**
 * Retrieve the previously stored guest session result.
 * Returns null if nothing was stored or if the value is corrupted.
 */
export function getGuestSessionResult(): BackendSessionResult | null {
  try {
    const raw = sessionStorage.getItem(SESSION_RESULT_KEY);
    if (!raw) return null;
    // Revive bigint values serialised as { __bigint__: "..." }
    const parsed = JSON.parse(raw, (_, v) => {
      if (v && typeof v === "object" && "__bigint__" in v) {
        return BigInt(v.__bigint__ as string);
      }
      return v;
    }) as BackendSessionResult;
    return parsed;
  } catch {
    return null;
  }
}

/** Remove the stored guest session result after a successful merge. */
export function clearGuestSessionResult(): void {
  try {
    sessionStorage.removeItem(SESSION_RESULT_KEY);
  } catch {
    // silently fail
  }
}

function readInt(key: string): number {
  try {
    return Number.parseInt(localStorage.getItem(key) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

function readBool(key: string): boolean {
  try {
    return localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

export function useGuestMode() {
  const [guestSessionsCompleted, setGuestSessionsCompleted] = useState(() =>
    readInt(KEY_SESSIONS),
  );
  const [hasPassedAuthWall, setHasPassedAuthWallState] = useState(() =>
    readBool(KEY_PASSED_WALL),
  );

  const incrementGuestSession = useCallback(() => {
    const next = guestSessionsCompleted + 1;
    try {
      localStorage.setItem(KEY_SESSIONS, String(next));
    } catch {
      // silently fail
    }
    setGuestSessionsCompleted(next);
    return next;
  }, [guestSessionsCompleted]);

  const setHasPassedAuthWall = useCallback((val: boolean) => {
    try {
      localStorage.setItem(KEY_PASSED_WALL, String(val));
    } catch {
      // silently fail
    }
    setHasPassedAuthWallState(val);
  }, []);

  /**
   * Clear guest session tracking after user authenticates.
   * Resets both the session count and the auth-wall flag.
   */
  const clearGuestSession = useCallback(() => {
    try {
      localStorage.removeItem(KEY_SESSIONS);
      localStorage.removeItem(KEY_PASSED_WALL);
    } catch {
      // silently fail
    }
    setGuestSessionsCompleted(0);
    setHasPassedAuthWallState(false);
  }, []);

  /** True if the user has completed at least one session as a guest. */
  const hasCompletedFirstSession = guestSessionsCompleted >= 1;

  return {
    guestSessionsCompleted,
    incrementGuestSession,
    hasCompletedFirstSession,
    hasPassedAuthWall,
    setHasPassedAuthWall,
    clearGuestSession,
  };
}
