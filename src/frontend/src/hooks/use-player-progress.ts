import type { SessionResult as BackendSessionResult } from "@/backend";
import { appApi } from "@/lib/app-api";
import { getDailyChallenge, getRankForXP } from "@/lib/challenges";
import type {
  BestScores,
  PlayerProgress,
  PlayerRankId,
  PlayerSkills,
  PlayerStats,
  SessionHistoryEntry,
} from "@/types";
import { useCallback, useState } from "react";

const STORAGE_KEY = "rizz-player-progress";
const MAX_HISTORY = 20;

const DEFAULT_SKILLS: PlayerSkills = {
  confidence: 10,
  humor: 10,
  originality: 10,
  tension: 10,
  socialAwareness: 10,
};

const DEFAULT_PROGRESS: PlayerProgress = {
  totalXP: 0,
  rankId: "rookie",
  skills: { ...DEFAULT_SKILLS },
  streak: 0,
  lastPlayedDate: null,
  dailyChallengeCompletedDate: null,
  completedChallenges: [],
  sessionHistory: [],
  bestScores: {},
};

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function loadProgress(): PlayerProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROGRESS, skills: { ...DEFAULT_SKILLS } };
    const parsed = JSON.parse(raw) as Partial<PlayerProgress>;
    // Auto-migrate: fill in new fields with defaults if missing
    return {
      ...DEFAULT_PROGRESS,
      ...parsed,
      skills: { ...DEFAULT_SKILLS, ...(parsed.skills ?? {}) },
      completedChallenges: parsed.completedChallenges ?? [],
      sessionHistory: parsed.sessionHistory ?? [],
      bestScores: parsed.bestScores ?? {},
    };
  } catch {
    return { ...DEFAULT_PROGRESS, skills: { ...DEFAULT_SKILLS } };
  }
}

function saveProgress(progress: PlayerProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // localStorage unavailable — silently fail
  }
}

/** Derive a playstyle label from skill values */
function derivePlaystyle(skills: PlayerSkills): string {
  const entries = Object.entries(skills) as [keyof PlayerSkills, number][];
  const [topKey] = entries.sort((a, b) => b[1] - a[1]);
  const labels: Record<keyof PlayerSkills, string> = {
    confidence: "Smooth Operator",
    humor: "Chaos Flirter",
    originality: "Wild Card",
    tension: "Slow Burn Specialist",
    socialAwareness: "Mind Reader",
  };
  return labels[topKey[0]];
}

export function usePlayerProgress() {
  const [progress, setProgress] = useState<PlayerProgress>(() =>
    loadProgress(),
  );

  const updateProgress = useCallback((next: PlayerProgress) => {
    saveProgress(next);
    setProgress(next);
  }, []);

  /** Add XP and recalculate rank. Returns rank-up info. */
  const addXP = useCallback(
    (amount: number) => {
      // Apply streak multiplier if streak > 1
      const multiplier = progress.streak > 1 ? 1.25 : 1;
      const adjusted = Math.round(amount * multiplier);
      const newXP = progress.totalXP + adjusted;
      const newRank = getRankForXP(newXP);
      const prevRankId = progress.rankId;
      const newProgress: PlayerProgress = {
        ...progress,
        totalXP: newXP,
        rankId: newRank.id,
      };
      updateProgress(newProgress);
      return {
        newProgress,
        didRankUp: newRank.id !== prevRankId,
        prevRankId,
        newRankId: newRank.id,
        adjustedAmount: adjusted,
      };
    },
    [progress, updateProgress],
  );

  /** Apply skill deltas, clamped to 0–100. */
  const updateSkills = useCallback(
    (deltas: PlayerSkills) => {
      const s = progress.skills;
      const newSkills: PlayerSkills = {
        confidence: clamp(s.confidence + deltas.confidence, 0, 100),
        humor: clamp(s.humor + deltas.humor, 0, 100),
        originality: clamp(s.originality + deltas.originality, 0, 100),
        tension: clamp(s.tension + deltas.tension, 0, 100),
        socialAwareness: clamp(
          s.socialAwareness + deltas.socialAwareness,
          0,
          100,
        ),
      };
      updateProgress({ ...progress, skills: newSkills });
    },
    [progress, updateProgress],
  );

  /** Prepend a session history entry, capped at MAX_HISTORY. */
  const addSessionHistory = useCallback(
    (entry: SessionHistoryEntry) => {
      const updated = [entry, ...progress.sessionHistory].slice(0, MAX_HISTORY);
      updateProgress({ ...progress, sessionHistory: updated });
    },
    [progress, updateProgress],
  );

  /** Update best score for a challenge only if new score is higher. */
  const updateBestScore = useCallback(
    (challengeId: string, score: number) => {
      const current = progress.bestScores[challengeId] ?? 0;
      if (score <= current) return;
      const newBestScores: BestScores = {
        ...progress.bestScores,
        [challengeId]: score,
      };
      updateProgress({ ...progress, bestScores: newBestScores });
    },
    [progress, updateProgress],
  );

  /** Derive aggregate stats from stored history and skills. */
  const getPlayerStats = useCallback((): PlayerStats => {
    const history = progress.sessionHistory;
    const totalSessions = history.length;
    const avgScore =
      totalSessions > 0
        ? Math.round(
            history.reduce((sum, e) => sum + e.score, 0) / totalSessions,
          )
        : 0;
    const bestScoreEver =
      totalSessions > 0 ? Math.max(...history.map((e) => e.score)) : 0;

    const skillEntries = Object.entries(progress.skills) as [
      keyof PlayerSkills,
      number,
    ][];
    const skillLabels: Record<keyof PlayerSkills, string> = {
      confidence: "Confidence",
      humor: "Humor",
      originality: "Originality",
      tension: "Tension",
      socialAwareness: "Social Awareness",
    };
    const sorted = [...skillEntries].sort((a, b) => b[1] - a[1]);
    const strongestSkill = skillLabels[sorted[0][0]];
    const weakestSkill = skillLabels[sorted[sorted.length - 1][0]];
    const playstyleLabel = derivePlaystyle(progress.skills);

    return {
      totalSessions,
      avgScore,
      bestScoreEver,
      strongestSkill,
      weakestSkill,
      playstyleLabel,
    };
  }, [progress]);

  /** Record a challenge as completed (idempotent). */
  const markChallengeCompleted = useCallback(
    (challengeId: string) => {
      if (progress.completedChallenges.includes(challengeId)) return;
      updateProgress({
        ...progress,
        completedChallenges: [...progress.completedChallenges, challengeId],
      });
    },
    [progress, updateProgress],
  );

  /**
   * Check and update streak on session completion.
   * - If played today already: no streak change, just update date.
   * - If played yesterday: streak +1.
   * - If gap > 1 day: streak resets to 1.
   */
  const checkAndUpdateStreak = useCallback(() => {
    const today = todayISO();
    if (progress.lastPlayedDate === today) return;

    let newStreak = 1;
    if (progress.lastPlayedDate) {
      const last = new Date(progress.lastPlayedDate).getTime();
      const now = new Date(today).getTime();
      const diffDays = Math.round((now - last) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) newStreak = progress.streak + 1;
    }

    updateProgress({
      ...progress,
      streak: newStreak,
      lastPlayedDate: today,
    });
  }, [progress, updateProgress]);

  // Keep backward-compat alias
  const updateStreak = checkAndUpdateStreak;

  /** Mark daily challenge done for today. */
  const markDailyChallengeCompleted = useCallback(() => {
    const today = todayISO();
    if (progress.dailyChallengeCompletedDate === today) return;
    updateProgress({ ...progress, dailyChallengeCompletedDate: today });
  }, [progress, updateProgress]);

  /** Returns today’s deterministic daily challenge ID. */
  const getDailyChallengeId = useCallback((): string => {
    return getDailyChallenge(new Date());
  }, []);

  /** Check whether the given challenge is today’s daily challenge. */
  const isDailyChallengeToday = useCallback((challengeId: string): boolean => {
    return getDailyChallenge(new Date()) === challengeId;
  }, []);

  /** Wipe all progress back to defaults. */
  const resetProgress = useCallback(() => {
    const fresh: PlayerProgress = {
      ...DEFAULT_PROGRESS,
      skills: { ...DEFAULT_SKILLS },
    };
    updateProgress(fresh);
  }, [updateProgress]);

  /**
   * ATOMIC session completion update.
   *
   * Reads current progress ONCE, computes all changes in memory, then calls
   * setProgress/saveProgress exactly ONCE — eliminating stale-closure races
   * that occur when addXP, updateSkills, etc. are called sequentially.
   *
   * Optionally persists to the IC backend via saveCallerSession.
   *
   * @param sessionEntry  The session history record to prepend.
   * @param skillDeltas   Skill increases to merge in (clamped 0–100).
   * @param xpEarned      XP to award (streak multiplier applied automatically).
   * @param challengeId   Used for best-score tracking and completed-challenge list.
   * @param score         Final rizz score for best-score comparison.
   * @param isDailyBonus  True when this was today's daily challenge.
   * @param actor         Optional IC actor for backend persistence.
   * @param token         Optional session token for backend calls.
   * @param backendSession Optional pre-built backend SessionResult for saveCallerSession.
   * @returns The fully updated PlayerProgress (already persisted to localStorage).
   */
  const completeSessionUpdate = useCallback(
    async (
      sessionEntry: SessionHistoryEntry,
      skillDeltas: PlayerSkills,
      xpEarned: number,
      challengeId: string,
      score: number,
      isDailyBonus: boolean,
      actor?: {
        saveCallerSession: (
          token: string,
          session: BackendSessionResult,
        ) => Promise<unknown>;
      } | null,
      token?: string | null,
      backendSession?: BackendSessionResult | null,
    ): Promise<PlayerProgress> => {
      // Read progress once via the functional updater pattern so we always
      // work from the freshest value — avoids stale-closure issues.
      let updatedProgress: PlayerProgress = {} as PlayerProgress;

      // Use the setState functional form so we read the latest state atomically.
      setProgress((current) => {
        const today = new Date().toISOString().split("T")[0];

        // ── XP + streak multiplier ────────────────────────────────────────
        const multiplier = current.streak > 1 ? 1.25 : 1;
        const adjustedXP = Math.round(xpEarned * multiplier);
        const newTotalXP = current.totalXP + adjustedXP;
        const newRank = getRankForXP(newTotalXP);

        // ── Skills (clamp 0–100) ──────────────────────────────────────────
        const s = current.skills;
        const newSkills: PlayerSkills = {
          confidence: clamp(s.confidence + skillDeltas.confidence, 0, 100),
          humor: clamp(s.humor + skillDeltas.humor, 0, 100),
          originality: clamp(s.originality + skillDeltas.originality, 0, 100),
          tension: clamp(s.tension + skillDeltas.tension, 0, 100),
          socialAwareness: clamp(
            s.socialAwareness + skillDeltas.socialAwareness,
            0,
            100,
          ),
        };

        // ── Best scores ───────────────────────────────────────────────────
        const currentBest = current.bestScores[challengeId] ?? 0;
        const newBestScores: BestScores = {
          ...current.bestScores,
          ...(score > currentBest ? { [challengeId]: score } : {}),
        };

        // ── Session history (cap at 50) ───────────────────────────────────
        const newHistory = [sessionEntry, ...current.sessionHistory].slice(
          0,
          50,
        );

        // ── Streak ────────────────────────────────────────────────────────
        let newStreak = current.streak;
        let newLastPlayedDate = current.lastPlayedDate;
        if (current.lastPlayedDate !== today) {
          if (current.lastPlayedDate) {
            const last = new Date(current.lastPlayedDate).getTime();
            const now = new Date(today).getTime();
            const diffDays = Math.round((now - last) / (1000 * 60 * 60 * 24));
            newStreak = diffDays === 1 ? current.streak + 1 : 1;
          } else {
            newStreak = 1;
          }
          newLastPlayedDate = today;
        }

        // ── Completed challenges ──────────────────────────────────────────
        const newCompleted = current.completedChallenges.includes(challengeId)
          ? current.completedChallenges
          : [...current.completedChallenges, challengeId];

        // ── Daily challenge ───────────────────────────────────────────────
        const newDailyDate = isDailyBonus
          ? today
          : current.dailyChallengeCompletedDate;

        const next: PlayerProgress = {
          ...current,
          totalXP: newTotalXP,
          rankId: newRank.id,
          skills: newSkills,
          bestScores: newBestScores,
          sessionHistory: newHistory,
          streak: newStreak,
          lastPlayedDate: newLastPlayedDate,
          completedChallenges: newCompleted,
          dailyChallengeCompletedDate: newDailyDate,
        };

        // Persist to localStorage inside the updater
        saveProgress(next);
        updatedProgress = next;
        return next;
      });

      // Wait a tick so state has settled before returning
      await new Promise<void>((res) => setTimeout(res, 0));

      // ── Backend persistence (fire-and-forget) ─────────────────────────
      if (actor && token && backendSession) {
        actor.saveCallerSession(token, backendSession).catch(() => {
          // Non-critical — localStorage is the fallback
        });
      } else if (token) {
        appApi.saveProgress(token, updatedProgress).catch(() => {
          // Non-critical — localStorage is the fallback
        });
        appApi
          .saveSession(token, {
            ...sessionEntry,
            characterName: backendSession?.characterName,
            metadata: { isDailyBonus, skillsDelta: skillDeltas },
          })
          .catch(() => {
            // Non-critical — localStorage is the fallback
          });
      }

      return updatedProgress;
    },
    [],
  );

  return {
    progress,
    addXP,
    updateSkills,
    addSessionHistory,
    updateBestScore,
    getPlayerStats,
    markChallengeCompleted,
    checkAndUpdateStreak,
    updateStreak,
    markDailyChallengeCompleted,
    getDailyChallengeId,
    isDailyChallengeToday,
    resetProgress,
    completeSessionUpdate,
  };
}

export type UsePlayerProgressReturn = ReturnType<typeof usePlayerProgress>;

// Convenience re-export so callers know the default rank ID type
export type { PlayerRankId };
