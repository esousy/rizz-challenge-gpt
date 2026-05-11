import type { UseAssistanceReturn } from "@/hooks/use-assistance";
import { getContextualHint } from "@/lib/assistance-data";
/**
 * AssistanceToolbar
 *
 * Minimal tactical toolbar rendered above ChatInput.
 * Houses ✨ Openers, 💡 Hint, 🔥 Assist buttons with live cooldown overlays.
 * Hides entirely when sessionComplete is true.
 *
 * Rizz Assist now triggers a live AI call using the coaching strategist prompt.
 */
import type { CharacterProfile } from "@/lib/challenges";
import {
  buildLocalFallback,
  fetchRizzAssistSuggestions,
} from "@/lib/rizz-assist";
import type { RizzAssistSuggestions } from "@/lib/rizz-assist";
import type { Message, SessionPhase } from "@/types";
import { useState } from "react";
import { AssistModal } from "./AssistModal";
import { HintModal } from "./HintModal";
import { OpenerModal } from "./OpenerModal";

interface Props {
  isUserLedMode: boolean;
  sessionComplete: boolean;
  isResumeMode?: boolean;
  roundNumber: number;
  interestLevel: number;
  currentMood: string;
  currentMomentum: string;
  conversationLength: number;
  onSelectOpener: (text: string) => void;
  onHintReceived: (hint: string) => void;
  onSelectAssist: (text: string) => void;
  assistance: UseAssistanceReturn;
  characterName: string;
  challengeId: string;
  characterProfile: CharacterProfile;
  sessionPhase: SessionPhase;
  /** Full message array passed through to AssistModal for context */
  messages?: Message[];
}

// ── Sub-component: single toolbar button ──────────────────────────────────────

interface ToolButtonProps {
  label: string;
  icon: string;
  disabled: boolean;
  limitReached: boolean;
  cooldownSecs: number;
  onClick: () => void;
  "data-ocid"?: string;
}

function ToolButton({
  label,
  icon,
  disabled,
  limitReached,
  cooldownSecs,
  onClick,
  "data-ocid": ocid,
}: ToolButtonProps) {
  // When limit is reached: button stays CLICKABLE so upgrade modal can fire.
  // Only true system-disabled states (wrong round, session done) block interaction.
  const isOnCooldown = !limitReached && cooldownSecs > 0;
  const isDisabled = disabled || isOnCooldown;

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onClick}
      data-ocid={ocid}
      aria-label={label}
      className={[
        "relative flex items-center gap-1 h-8 px-3 rounded-full text-xs font-semibold border transition-all duration-200 select-none",
        isDisabled && !limitReached
          ? "opacity-30 cursor-not-allowed border-[oklch(0.28_0_0)] text-[oklch(0.45_0_0)] bg-transparent"
          : limitReached
            ? "border-[oklch(0.3_0.06_280)] text-[oklch(0.65_0.18_280)] bg-[oklch(0.65_0.22_280)]/12 hover:bg-[oklch(0.65_0.22_280)]/22 hover:border-[oklch(0.5_0.14_280)] active:scale-95 cursor-pointer"
            : "border-[oklch(0.3_0.06_280)] text-[oklch(0.72_0.14_280)] bg-[oklch(0.65_0.22_280)]/8 hover:bg-[oklch(0.65_0.22_280)]/18 hover:border-[oklch(0.5_0.14_280)] active:scale-95",
      ].join(" ")}
    >
      <span className="text-sm leading-none">{icon}</span>
      <span className="leading-none">{label}</span>

      {/* Cooldown countdown badge */}
      {isOnCooldown && (
        <span
          className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[oklch(0.2_0_0)] border border-[oklch(0.32_0_0)] text-[oklch(0.6_0_0)] text-[9px] font-bold tabular-nums flex items-center justify-center leading-none"
          aria-label={`Cooldown: ${cooldownSecs} seconds`}
        >
          :{cooldownSecs < 10 ? `0${cooldownSecs}` : cooldownSecs}
        </span>
      )}

      {/* Pro upgrade badge — shown when free limit hit */}
      {limitReached && (
        <span
          className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[oklch(0.65_0.22_280)]/20 border border-[oklch(0.65_0.22_280)]/40 text-[oklch(0.72_0.18_280)] text-[8px] font-bold flex items-center justify-center leading-none"
          aria-label="Go Pro for more"
        >
          ✦
        </span>
      )}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AssistanceToolbar({
  isUserLedMode,
  sessionComplete,
  isResumeMode = false,
  roundNumber,
  interestLevel,
  currentMood,
  currentMomentum,
  conversationLength,
  onSelectOpener,
  onHintReceived,
  onSelectAssist,
  assistance,
  characterName,
  challengeId,
  characterProfile,
  sessionPhase,
  messages = [],
}: Props) {
  const [openerOpen, setOpenerOpen] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [assistOpen, setAssistOpen] = useState(false);
  const [activeHint, setActiveHint] = useState("");
  const [assistSuggestions, setAssistSuggestions] =
    useState<RizzAssistSuggestions | null>(null);
  const [isLoadingAssist, setIsLoadingAssist] = useState(false);

  // Hide toolbar only when session is complete AND we're NOT in resume mode
  if (sessionComplete && !isResumeMode) return null;

  const showOpeners = isUserLedMode && !isResumeMode;
  const openerUsed = assistance.openerLimitReached;
  const openerDisabled = openerUsed || conversationLength > 0;

  // Assist disabled in round 1, but NOT in resume mode (which stays at round 1 forever)
  const assistDisabledByRound = !isResumeMode && roundNumber <= 1;

  const handleOpenerClick = () => {
    if (!assistance.canUseOpeners || conversationLength > 0) return;
    setOpenerOpen(true);
  };

  const handleOpenerSelect = (text: string) => {
    assistance.consumeOpener();
    onSelectOpener(text);
  };

  const handleHintClick = () => {
    // consumeHint handles upgrade modal signaling if limit reached for free users
    const hint = getContextualHint(
      interestLevel,
      currentMood,
      roundNumber,
      conversationLength,
    );
    const used = assistance.consumeHint();
    if (used) {
      setActiveHint(hint);
      setHintOpen(true);
      onHintReceived(hint);
    }
    // If not used, consumeHint already set upgradeModalTrigger on the hook
  };

  const handleAssistClick = async () => {
    if (assistDisabledByRound) return;
    // consumeAssist handles upgrade modal signaling if limit reached for free users
    const used = assistance.consumeAssist();
    if (!used) return; // Either on cooldown or upgrade modal triggered

    setAssistSuggestions(null);
    setIsLoadingAssist(true);
    setAssistOpen(true);

    try {
      const lastAIMsg =
        [...messages].reverse().find((m) => m.role === "ai")?.content ?? "";

      // Call the server-side proxy — no API key needed from the client
      const result = await fetchRizzAssistSuggestions({
        conversationHistory: messages,
        lastAIMessage: lastAIMsg,
        characterProfile,
        currentMood,
        currentInterest: interestLevel,
        momentum: currentMomentum,
        challengeType: challengeId,
        conversationPhase: sessionPhase,
      });
      setAssistSuggestions(result);
    } catch {
      // On error, use context-aware local fallback
      const fallback = buildLocalFallback(
        currentMood,
        interestLevel,
        sessionPhase,
        [...messages].reverse().find((m) => m.role === "ai")?.content ?? "",
      );
      setAssistSuggestions(fallback);
    } finally {
      setIsLoadingAssist(false);
    }
  };

  return (
    <>
      {/* Toolbar strip */}
      <div
        className="flex items-center gap-2 px-3 py-2 bg-[oklch(0.12_0_0)]/90 border-t border-[oklch(0.22_0.02_280)]/40"
        style={{ backdropFilter: "blur(8px)" }}
        role="toolbar"
        aria-label="Tactical assistance"
        data-ocid="assistance.toolbar"
      >
        {/* ✨ Openers — hidden in Easy Flirt and Resume mode */}
        {showOpeners && (
          <ToolButton
            label="Openers"
            icon="✨"
            disabled={openerDisabled}
            limitReached={openerUsed}
            cooldownSecs={0}
            onClick={handleOpenerClick}
            data-ocid="assistance.openers_button"
          />
        )}

        {/* 💡 Hint */}
        <ToolButton
          label="Hint"
          icon="💡"
          disabled={false}
          limitReached={assistance.hintLimitReached}
          cooldownSecs={assistance.hintCooldownSecsRemaining}
          onClick={handleHintClick}
          data-ocid="assistance.hint_button"
        />

        {/* 🔥 Assist — disabled in Round 1 */}
        <ToolButton
          label="Assist"
          icon="🔥"
          disabled={assistDisabledByRound || isLoadingAssist}
          limitReached={assistance.assistLimitReached}
          cooldownSecs={assistance.assistCooldownSecsRemaining}
          onClick={() => {
            void handleAssistClick();
          }}
          data-ocid="assistance.assist_button"
        />

        {/* Subtle usage indicator on right */}
        <div className="ml-auto flex items-center gap-3 pr-1">
          {!assistance.hintLimitReached && (
            <span
              className="text-[9px] text-[oklch(0.35_0_0)] tabular-nums"
              aria-hidden="true"
            >
              💡{assistance.state.hintsUsed}/
              {assistance.isPro ? "∞" : assistance.hintsLimit}
            </span>
          )}
          {!assistance.assistLimitReached && (
            <span
              className="text-[9px] text-[oklch(0.35_0_0)] tabular-nums"
              aria-hidden="true"
            >
              🔥{assistance.state.assistUsed}/
              {assistance.isPro ? "∞" : assistance.assistLimit}
            </span>
          )}
        </div>
      </div>

      {/* Modals */}
      <OpenerModal
        characterName={characterName}
        challengeId={challengeId}
        isOpen={openerOpen}
        onSelect={handleOpenerSelect}
        onClose={() => setOpenerOpen(false)}
      />

      <HintModal
        hint={activeHint}
        isOpen={hintOpen}
        onClose={() => setHintOpen(false)}
      />

      <AssistModal
        characterName={characterName}
        isOpen={assistOpen}
        suggestions={assistSuggestions}
        isLoadingAssist={isLoadingAssist}
        onSelect={onSelectAssist}
        onClose={() => setAssistOpen(false)}
      />
    </>
  );
}
