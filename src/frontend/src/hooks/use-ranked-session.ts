/**
 * useRankedSession — centralized gate for starting new ranked sessions.
 *
 * ALL entry points that create an official 5-round challenge run MUST call
 * startRankedSession(challengeId). Resume Conversation and Keep Talking are
 * continuation modes and must NOT call this function.
 *
 * Gate logic:
 *   1. Anonymous user → show signup modal, return false
 *   2. Pro user       → allow unconditionally, return true
 *   3. Free user      → check localStorage daily usage:
 *      - if limit hit  → show UpgradeModal, return false
 *      - if under limit → increment, navigate to /challenge, return true
 *
 * Daily usage is stored in localStorage under `rizz_daily_usage_${userId}`
 * and resets automatically when the local date changes.
 */
import { createActor } from "@/backend";
import type { FreePlanConfig } from "@/types";
import { useActor } from "@caffeineai/core-infrastructure";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./use-auth";

// ── Types ────────────────────────────────────────────────────────────────────

interface DailyUsage {
  date: string; // "YYYY-MM-DD"
  rankedSessionsUsed: number;
}

function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function loadDailyUsage(userId: string): DailyUsage {
  try {
    const raw = localStorage.getItem(`rizz_daily_usage_${userId}`);
    if (!raw) return { date: todayLocalISO(), rankedSessionsUsed: 0 };
    const parsed = JSON.parse(raw) as DailyUsage;
    // Reset if date changed
    if (parsed.date !== todayLocalISO()) {
      return { date: todayLocalISO(), rankedSessionsUsed: 0 };
    }
    return parsed;
  } catch {
    return { date: todayLocalISO(), rankedSessionsUsed: 0 };
  }
}

function saveDailyUsage(userId: string, usage: DailyUsage): void {
  try {
    localStorage.setItem(`rizz_daily_usage_${userId}`, JSON.stringify(usage));
  } catch {
    // localStorage unavailable — fail silently
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface UseRankedSessionReturn {
  /** Start a new ranked session. Returns true if session started, false if blocked. */
  startRankedSession: (challengeId: string) => Promise<boolean>;
  /** Whether the upgrade modal should be shown */
  showUpgradeModal: boolean;
  /** Close the upgrade modal */
  closeUpgradeModal: () => void;
  /** Whether the signup modal should be shown */
  showSignupModal: boolean;
  /** Close the signup modal */
  closeSignupModal: () => void;
  /** For callers that need to know the config was loaded */
  freePlanConfig: FreePlanConfig | null;
}

export function useRankedSession(): UseRankedSessionReturn {
  const auth = useAuth();
  const navigate = useNavigate();
  const { actor, isFetching } = useActor(createActor);

  const [freePlanConfig, setFreePlanConfig] = useState<FreePlanConfig | null>(
    null,
  );
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);

  // Load free plan config once actor is ready
  const configLoadedRef = useRef(false);
  useEffect(() => {
    if (!actor || isFetching || configLoadedRef.current) return;
    configLoadedRef.current = true;
    actor
      .getFreePlanConfig()
      .then((cfg) => {
        setFreePlanConfig({
          rankedSessionsPerDay: Number(cfg.rankedSessionsPerDay),
          rizzAssistPerSession: Number(cfg.rizzAssistPerSession),
          hintsPerSession: Number(cfg.hintsPerSession),
        });
      })
      .catch(() => {});
  }, [actor, isFetching]);

  const startRankedSession = useCallback(
    async (challengeId: string): Promise<boolean> => {
      // ── 1. Anonymous gate ────────────────────────────────────────────────
      if (!auth.isAuthenticated || !auth.user) {
        setShowSignupModal(true);
        return false;
      }

      const userId = auth.user.username;
      const dailyUsage = loadDailyUsage(userId);

      // ── 2. Pro plan — no limits ──────────────────────────────────────────
      const userPlan = (auth.user as { plan?: string }).plan ?? "free";
      if (userPlan === "pro") {
        console.log("Ranked session check", {
          plan: "pro",
          limit: "unlimited",
          usedToday: dailyUsage.rankedSessionsUsed,
          challengeId,
          allowed: true,
        });
        navigate({
          to: "/challenge",
          search: { challengeId, resumeMode: undefined },
        });
        return true;
      }

      // ── 3. Free plan — enforce daily limit ───────────────────────────────
      // Fetch config from backend if not yet loaded; fall back to 3 if unavailable
      let limit = freePlanConfig?.rankedSessionsPerDay ?? 3;
      if (!freePlanConfig && actor) {
        try {
          const cfg = await actor.getFreePlanConfig();
          limit = Number(cfg.rankedSessionsPerDay);
          setFreePlanConfig({
            rankedSessionsPerDay: limit,
            rizzAssistPerSession: Number(cfg.rizzAssistPerSession),
            hintsPerSession: Number(cfg.hintsPerSession),
          });
        } catch {
          // fail open with default limit
        }
      }

      const usedToday = dailyUsage.rankedSessionsUsed;
      const allowed = usedToday < limit;

      console.log("Ranked session check", {
        plan: "free",
        limit,
        usedToday,
        challengeId,
        allowed,
      });

      if (!allowed) {
        setShowUpgradeModal(true);
        return false;
      }

      // ── 4. Increment usage and start session ─────────────────────────────
      const updatedUsage: DailyUsage = {
        date: todayLocalISO(),
        rankedSessionsUsed: usedToday + 1,
      };
      saveDailyUsage(userId, updatedUsage);

      console.log("Ranked session incremented", {
        usedTodayAfterIncrement: updatedUsage.rankedSessionsUsed,
      });

      // ── 5. Also persist to backend profile for durability ──────────────────
      // saveCallerProgress keeps the profile in sync; we piggyback to make
      // daily usage durable. Fire-and-forget — localStorage is the primary gate.
      if (actor) {
        const token = localStorage.getItem("rizz_session_token");
        if (token) {
          const profile = auth.user as unknown as {
            rank?: string;
            totalXp?: bigint;
            streak?: bigint;
            unlockedChallenges?: string[];
          } | null;
          actor
            .saveCallerProgress(
              token,
              profile?.rank ?? "rookie",
              profile?.totalXp ?? BigInt(0),
              profile?.streak ?? BigInt(0),
              profile?.unlockedChallenges ?? [],
            )
            .catch(() => {
              // Non-critical — localStorage gate remains in place
            });
        }
      }

      navigate({
        to: "/challenge",
        search: { challengeId, resumeMode: undefined },
      });
      return true;
    },
    [auth.isAuthenticated, auth.user, actor, freePlanConfig, navigate],
  );

  return {
    startRankedSession,
    showUpgradeModal,
    closeUpgradeModal: () => setShowUpgradeModal(false),
    showSignupModal,
    closeSignupModal: () => setShowSignupModal(false),
    freePlanConfig,
  };
}
