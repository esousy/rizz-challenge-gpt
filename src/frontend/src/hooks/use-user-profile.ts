/**
 * Profile + stats hook for authenticated users.
 * Provides real backend sync for player stats via the canister.
 */
import { createActor } from "@/backend";
import type { PlayerStats as BackendPlayerStats } from "@/backend";
import { useAuth } from "@/hooks/use-auth";
import { usePlayerProgress } from "@/hooks/use-player-progress";
import { useActor } from "@caffeineai/core-infrastructure";
import { useCallback } from "react";

const SESSION_KEY = "rizz_session_token";
function loadToken(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function useUserProfile() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { progress } = usePlayerProgress();
  const { actor } = useActor(createActor);

  /** Sync local player progress to the backend canister. */
  const syncStatsToBackend = useCallback(async () => {
    if (!actor || !isAuthenticated) return;
    try {
      const stats: BackendPlayerStats = {
        totalXP: BigInt(progress.totalXP),
        rankId: progress.rankId,
        streakCount: BigInt(progress.streak),
        skillConfidence: BigInt(progress.skills.confidence),
        skillHumor: BigInt(progress.skills.humor),
        skillOriginality: BigInt(progress.skills.originality),
        skillTension: BigInt(progress.skills.tension),
        skillSocialAwareness: BigInt(progress.skills.socialAwareness),
        bestScores: Object.entries(progress.bestScores).map(
          ([id, score]) => [id, BigInt(score)] as [string, bigint],
        ),
        sessionHistory: progress.sessionHistory.map((s) => ({
          challengeId: s.challengeId,
          outcome: s.outcome,
          score: BigInt(s.score),
          finalMood: s.finalMood,
          playedAt: BigInt(new Date(s.date).getTime() * 1_000_000),
          isRanked: true,
        })),
      };
      const token = loadToken();
      if (!token) return;
      await actor.saveCallerStats(token, stats);
    } catch {
      // silently fail — local state remains valid
    }
  }, [actor, isAuthenticated, progress]);

  /** Fetch raw stats from backend canister. */
  const fetchFromBackend = useCallback(async () => {
    if (!actor || !isAuthenticated) return null;
    try {
      const token = loadToken();
      if (!token) return null;
      return await actor.getCallerStats(token);
    } catch {
      return null;
    }
  }, [actor, isAuthenticated]);

  return {
    profile: user,
    stats: null, // use usePlayerProgress().getPlayerStats() in consuming components
    isLoading,
    isAuthenticated,
    syncStatsToBackend,
    fetchFromBackend,
  };
}
