import type {
  AssistanceState,
  FreePlanConfig,
  UpgradeModalTrigger,
} from "@/types";
/**
 * useAssistance — tactical assistance hook for Rizz Me If You Can.
 *
 * Manages per-session limits and cooldowns for the three assistance tools:
 *   ✨ Openers  — 1 use per session (no Pro gating)
 *   💡 Hint     — freePlanConfig.hintsPerSession per session, 30 s cooldown
 *   🔥 Assist   — freePlanConfig.rizzAssistPerSession per session, 45 s cooldown
 *
 * Pro users (isPro=true): unlimited Hints and Assist, same cooldowns.
 * Free users: limits from freePlanConfig. When limit hit, buttons remain
 * clickable — the caller receives shouldShowUpgradeModal=true to show the modal.
 */
import { useCallback, useEffect, useRef, useState } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────

const _OPENERS_LIMIT = 1;
const DEFAULT_HINTS_LIMIT = 3;
const DEFAULT_ASSIST_LIMIT = 3;
const HINTS_COOLDOWN_MS = 30_000; // 30 s
const ASSIST_COOLDOWN_MS = 45_000; // 45 s

// ── Hook return type ──────────────────────────────────────────────────────────

export interface UseAssistanceReturn {
  /** Current raw state (useful for persistence) */
  state: AssistanceState;

  // Capability flags — check these before showing enabled UI
  canUseOpeners: boolean;
  canUseHints: boolean;
  canUseAssist: boolean;

  // Limit-reached flags — for greying out UI even while on cooldown
  openerLimitReached: boolean;
  hintLimitReached: boolean;
  assistLimitReached: boolean;

  // Live countdown seconds remaining (0 when no active cooldown)
  hintCooldownSecsRemaining: number;
  assistCooldownSecsRemaining: number;

  // Actions — call these when user triggers a tool
  consumeOpener: () => boolean; // returns false if limit/cooldown blocks use
  consumeHint: () => boolean;
  consumeAssist: () => boolean;

  /** Reset all counts and cooldowns — call on session start or new session */
  resetAssistance: () => void;

  // ── Upgrade modal signals ────────────────────────────────────────────────
  /** true when a free user taps a tool that is at its session limit */
  shouldShowUpgradeModal: boolean;
  /** which limit was hit — null when shouldShowUpgradeModal is false */
  upgradeModalTrigger: UpgradeModalTrigger | null;
  /** Call after UpgradeModal is shown to reset the signal */
  clearUpgradeModal: () => void;

  // ── Display limits (use for denominator in usage counters) ──────────────────
  /** Actual hints limit for the current user (Number.MAX_SAFE_INTEGER for Pro) */
  hintsLimit: number;
  /** Actual assist limit for the current user (Number.MAX_SAFE_INTEGER for Pro) */
  assistLimit: number;
  /** Whether current user is on Pro plan */
  isPro: boolean;
}

// ── Initial state factory ─────────────────────────────────────────────────────

function makeInitialState(): AssistanceState {
  return {
    openersUsed: false,
    hintsUsed: 0,
    assistUsed: 0,
    hintsCooldownUntil: null,
    assistCooldownUntil: null,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseAssistanceOptions {
  isPro?: boolean;
  freePlanConfig?: FreePlanConfig | null;
}

export function useAssistance(
  options: UseAssistanceOptions = {},
): UseAssistanceReturn {
  const { isPro = false, freePlanConfig = null } = options;

  const [state, setState] = useState<AssistanceState>(makeInitialState);
  const [now, setNow] = useState(() => Date.now());
  const [upgradeModalTrigger, setUpgradeModalTrigger] =
    useState<UpgradeModalTrigger | null>(null);

  // Tick every second to update live countdown displays
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setNow(Date.now());
    }, 1_000);
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, []);

  // ── Derived limits ────────────────────────────────────────────────────────────
  // Pro users: unlimited (use a very large number so limit is never hit)
  // Free users: use admin-configured freePlanConfig or fallback defaults

  const hintsLimit = isPro
    ? Number.MAX_SAFE_INTEGER
    : (freePlanConfig?.hintsPerSession ?? DEFAULT_HINTS_LIMIT);
  const assistLimit = isPro
    ? Number.MAX_SAFE_INTEGER
    : (freePlanConfig?.rizzAssistPerSession ?? DEFAULT_ASSIST_LIMIT);

  // ── Limit flags ──────────────────────────────────────────────────────────────

  const openerLimitReached = state.openersUsed;
  const hintLimitReached = state.hintsUsed >= hintsLimit;
  const assistLimitReached = state.assistUsed >= assistLimit;

  // ── Cooldown seconds remaining ───────────────────────────────────────────────

  const hintCooldownSecsRemaining =
    state.hintsCooldownUntil !== null && state.hintsCooldownUntil > now
      ? Math.ceil((state.hintsCooldownUntil - now) / 1_000)
      : 0;

  const assistCooldownSecsRemaining =
    state.assistCooldownUntil !== null && state.assistCooldownUntil > now
      ? Math.ceil((state.assistCooldownUntil - now) / 1_000)
      : 0;

  // ── Capability flags ─────────────────────────────────────────────────────────
  // NOTE: canUseHints / canUseAssist return false when limit hit even for free users.
  // The toolbar always passes disabled=false to its buttons — buttons remain clickable.
  // The caller checks hintLimitReached / assistLimitReached to decide whether to
  // consume OR show the upgrade modal.

  const canUseOpeners = !openerLimitReached;
  const canUseHints = !hintLimitReached && hintCooldownSecsRemaining === 0;
  const canUseAssist = !assistLimitReached && assistCooldownSecsRemaining === 0;

  // ── Actions ──────────────────────────────────────────────────────────────────

  const consumeOpener = useCallback((): boolean => {
    if (!canUseOpeners) return false;
    setState((prev) => ({ ...prev, openersUsed: true }));
    return true;
  }, [canUseOpeners]);

  const consumeHint = useCallback((): boolean => {
    // Free user hit limit — signal upgrade modal
    if (hintLimitReached && !isPro) {
      setUpgradeModalTrigger("hints");
      return false;
    }
    if (!canUseHints) return false;
    const cooldownUntil = Date.now() + HINTS_COOLDOWN_MS;
    setState((prev) => ({
      ...prev,
      hintsUsed: prev.hintsUsed + 1,
      hintsCooldownUntil:
        prev.hintsUsed + 1 >= hintsLimit ? null : cooldownUntil,
    }));
    setNow(Date.now());
    return true;
  }, [canUseHints, hintLimitReached, hintsLimit, isPro]);

  const consumeAssist = useCallback((): boolean => {
    // Free user hit limit — signal upgrade modal
    if (assistLimitReached && !isPro) {
      setUpgradeModalTrigger("rizz_assist");
      return false;
    }
    if (!canUseAssist) return false;
    const cooldownUntil = Date.now() + ASSIST_COOLDOWN_MS;
    setState((prev) => ({
      ...prev,
      assistUsed: prev.assistUsed + 1,
      assistCooldownUntil:
        prev.assistUsed + 1 >= assistLimit ? null : cooldownUntil,
    }));
    setNow(Date.now());
    return true;
  }, [canUseAssist, assistLimitReached, assistLimit, isPro]);

  const resetAssistance = useCallback(() => {
    setState(makeInitialState());
    setNow(Date.now());
    setUpgradeModalTrigger(null);
  }, []);

  const clearUpgradeModal = useCallback(() => {
    setUpgradeModalTrigger(null);
  }, []);

  return {
    state,
    canUseOpeners,
    canUseHints,
    canUseAssist,
    openerLimitReached,
    hintLimitReached,
    assistLimitReached,
    hintCooldownSecsRemaining,
    assistCooldownSecsRemaining,
    consumeOpener,
    consumeHint,
    consumeAssist,
    resetAssistance,
    shouldShowUpgradeModal: upgradeModalTrigger !== null,
    upgradeModalTrigger,
    clearUpgradeModal,
    hintsLimit,
    assistLimit,
    isPro,
  };
}
