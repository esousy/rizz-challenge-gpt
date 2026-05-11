/**
 * useRankedSession — centralized gate for starting new ranked sessions.
 *
 * ALL limit checking is done server-side via Neon DB.
 * Frontend never trusts local state for enforcement.
 *
 * Flow:
 *   1. Anonymous → check /check-limit, if limit → show signup modal
 *   2. Authenticated → check /check-limit, if limit → show UpgradeModal
 *   3. If allowed → increment usage via /increment-usage → navigate
 */
import { appApi } from "@/lib/app-api";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useAuth } from "./use-auth";

function getAnonymousId(): string {
  let id = localStorage.getItem("rizz_anonymous_id");
  if (!id) {
    id = `anon_${crypto.randomUUID()}`;
    localStorage.setItem("rizz_anonymous_id", id);
  }
  return id;
}

export { getAnonymousId };

export interface UseRankedSessionReturn {
  startRankedSession: (challengeId: string) => Promise<boolean>;
  showUpgradeModal: boolean;
  closeUpgradeModal: () => void;
  showSignupModal: boolean;
  closeSignupModal: () => void;
  limitInfo: { used: number; limit: number | null; tier: string } | null;
}

export function useRankedSession(): UseRankedSessionReturn {
  const auth = useAuth();
  const navigate = useNavigate();

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [limitInfo, setLimitInfo] = useState<{ used: number; limit: number | null; tier: string } | null>(null);

  const startRankedSession = useCallback(
    async (challengeId: string): Promise<boolean> => {
      const token = auth.isAuthenticated ? localStorage.getItem("rizz_session_token") : undefined;

      // Check limit via backend
      const result = await appApi.checkLimit({
        token: token ?? undefined,
        feature: "ranked_session",
        anonymousId: !auth.isAuthenticated ? getAnonymousId() : undefined,
      });

      setLimitInfo({ used: result.used, limit: result.limit, tier: result.tier });

      if (!result.allowed) {
        if (!auth.isAuthenticated) {
          setShowSignupModal(true);
        } else {
          setShowUpgradeModal(true);
        }
        return false;
      }

      // Increment usage atomically
      await appApi.incrementUsage({
        token: token ?? undefined,
        feature: "ranked_session",
        anonymousId: !auth.isAuthenticated ? getAnonymousId() : undefined,
      });

      navigate({
        to: "/challenge",
        search: { challengeId, resumeMode: undefined },
      });
      return true;
    },
    [auth.isAuthenticated, navigate],
  );

  return {
    startRankedSession,
    showUpgradeModal,
    closeUpgradeModal: () => setShowUpgradeModal(false),
    showSignupModal,
    closeSignupModal: () => setShowSignupModal(false),
    limitInfo,
  };
}
