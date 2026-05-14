/**
 * useAssistance — manages hint and assist limits using Neon DB.
 *
 * ALL limit checking is server-side via /check-limit and /increment-usage.
 * No more session-based or hardcoded limits.
 * Admin configures limits per tier in App Settings.
 */
import { appApi } from "@/lib/app-api";
import { getAnonymousId } from "@/hooks/use-ranked-session";
import type { AssistanceState, FreePlanConfig, UpgradeModalTrigger } from "@/types";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./use-auth";

interface UseAssistanceOptions {
  isPro?: boolean;
  freePlanConfig?: FreePlanConfig | null;
}

export function useAssistance(_options: UseAssistanceOptions = {}) {
  const auth = useAuth();

  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintsLimit, setHintsLimit] = useState<number | null>(3);
  const [assistsUsed, setAssistsUsed] = useState(0);
  const [assistsLimit, setAssistsLimit] = useState<number | null>(1);
  const [openersUsed, setOpenersUsed] = useState(false);
  const [loading, setLoading] = useState(true);

  // Upgrade modal state
  const [shouldShowUpgradeModal, setShouldShowUpgradeModal] = useState(false);
  const [upgradeModalTrigger, setUpgradeModalTrigger] =
    useState<UpgradeModalTrigger | null>(null);

  // Fetch current usage from backend
  const refreshUsage = useCallback(async () => {
    try {
      const token = auth.isAuthenticated
        ? localStorage.getItem("rizz_session_token") ?? undefined
        : undefined;
      const result = await appApi.getUsage({
        token,
        anonymousId: !auth.isAuthenticated ? getAnonymousId() : undefined,
      });
      setHintsUsed(result.usage.hints ?? 0);
      setAssistsUsed(result.usage.assists ?? 0);
      setHintsLimit(result.limits.hintsPerDay ?? null);
      setAssistsLimit(result.limits.assistsPerDay ?? null);
    } catch {
      setHintsLimit(3);
      setAssistsLimit(1);
    } finally {
      setLoading(false);
    }
  }, [auth.isAuthenticated]);

  useEffect(() => {
    refreshUsage();
  }, [refreshUsage]);

  const hintsRemaining =
    hintsLimit === null ? Infinity : Math.max(0, hintsLimit - hintsUsed);
  const assistsRemaining =
    assistsLimit === null ? Infinity : Math.max(0, assistsLimit - assistsUsed);
  const hasHints = hintsRemaining > 0;
  const hasAssists = assistsRemaining > 0;

  async function consumeHint(): Promise<{
    allowed: boolean;
    reason?: string;
    upgradeModal?: UpgradeModalTrigger;
  }> {
    const token = auth.isAuthenticated
      ? localStorage.getItem("rizz_session_token") ?? undefined
      : undefined;
    const check = await appApi.checkLimit({
      token,
      feature: "hint",
      anonymousId: !auth.isAuthenticated ? getAnonymousId() : undefined,
    });

    if (!check.allowed) {
      const trigger: UpgradeModalTrigger = "hints";
      setUpgradeModalTrigger(trigger);
      setShouldShowUpgradeModal(true);
      return { allowed: false, reason: "limit_reached", upgradeModal: trigger };
    }

    await appApi.incrementUsage({
      token,
      feature: "hint",
      anonymousId: !auth.isAuthenticated ? getAnonymousId() : undefined,
    });

    setHintsUsed((prev) => prev + 1);
    return { allowed: true };
  }

  async function consumeAssist(): Promise<{
    allowed: boolean;
    reason?: string;
    upgradeModal?: UpgradeModalTrigger;
  }> {
    const token = auth.isAuthenticated
      ? localStorage.getItem("rizz_session_token") ?? undefined
      : undefined;
    const check = await appApi.checkLimit({
      token,
      feature: "assist",
      anonymousId: !auth.isAuthenticated ? getAnonymousId() : undefined,
    });

    if (!check.allowed) {
      const trigger: UpgradeModalTrigger = "rizz_assist";
      setUpgradeModalTrigger(trigger);
      setShouldShowUpgradeModal(true);
      return { allowed: false, reason: "limit_reached", upgradeModal: trigger };
    }

    await appApi.incrementUsage({
      token,
      feature: "assist",
      anonymousId: !auth.isAuthenticated ? getAnonymousId() : undefined,
    });

    setAssistsUsed((prev) => prev + 1);
    return { allowed: true };
  }

  function consumeOpener() {
    setOpenersUsed(true);
  }

  function dismissUpgradeModal() {
    setShouldShowUpgradeModal(false);
    setUpgradeModalTrigger(null);
  }

  const state: AssistanceState = {
    openersUsed,
    hintsUsed,
    hintsLimit,
    hintsRemaining,
    hasHints,
    assistsUsed,
    assistsLimit,
    assistsRemaining,
    hasAssists,
  };

  return {
    state,
    consumeHint,
    consumeAssist,
    consumeOpener,
    refreshUsage,
    loading,
    shouldShowUpgradeModal,
    upgradeModalTrigger,
    dismissUpgradeModal,
  };
}

export type UseAssistanceReturn = ReturnType<typeof useAssistance>;
