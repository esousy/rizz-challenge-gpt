import { createActor } from "@/backend";
import { AssistanceToolbar } from "@/components/AssistanceToolbar";
import { ChatBubble } from "@/components/ChatBubble";
import { ChatInput } from "@/components/ChatInput";
import { HeaderBar } from "@/components/HeaderBar";
import { MiniCoachingChip } from "@/components/MiniCoachingChip";
import {
  type PendingAction,
  SaveProgressModal,
} from "@/components/SaveProgressModal";
import { TypingIndicator } from "@/components/TypingIndicator";
import { UpgradeModal } from "@/components/UpgradeModal";
import { useAssistance } from "@/hooks/use-assistance";
import { useAuth } from "@/hooks/use-auth";
import { type UseChatInitialState, useChat } from "@/hooks/use-chat";
import { useGuestMode } from "@/hooks/use-guest-mode";
import { CHALLENGES, getCharacterProfile } from "@/lib/challenges";
import type { FreePlanConfig } from "@/types";
import type { ResumeSessionData } from "@/types";
import { useActor } from "@caffeineai/core-infrastructure";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

/** Key used to pass resume session state via sessionStorage */
const RESUME_STORAGE_KEY = "rizz-resume-session";

export type { ResumeSessionData };

// ── Scenario card text per challenge ─────────────────────────────────────────

interface ScenarioCard {
  context: string;
  prompt: string;
}

// Per-challenge scenario pools — randomized each session for replayability
const DRY_TEXTER_SCENARIOS = [
  "Chloe liked your photo from last week 👀",
  "Chloe followed you first",
  "Chloe liked 3 of your posts in a row",
  "Chloe viewed your profile twice today",
  "Chloe reacted to your story with 🔥",
  "Chloe added you from Quick Add",
  "Chloe liked your selfie from 2 weeks ago",
  "Chloe saved your post",
  "Chloe liked your comment on a mutual's post",
  "Chloe viewed your highlight reel",
  "Chloe liked your beach photo",
  "Chloe followed you after seeing your reel",
];

const MIXED_SIGNALS_SCENARIOS = [
  "Vanessa liked your gym story 💪",
  "Vanessa followed you then liked your oldest photo",
  "Vanessa reacted to your late-night story 🌙",
  "Vanessa liked your mirror selfie",
  "Vanessa viewed your story but didn't react — then came back 👀",
  "Vanessa liked a photo from 3 weeks ago",
  "Vanessa watched your reel twice",
  "Vanessa added you after seeing you at a mutual's event",
  "Vanessa reacted to your food story 😂",
  "Vanessa liked your most recent post instantly",
  "Vanessa followed you after your mutual tagged you",
  "Vanessa liked your car photo",
];

const COLD_START_SCENARIOS = [
  "Mia matched with you",
  "Mia liked your profile",
  "Mia super liked your photo",
  "Mia swiped right on you first",
  "Mia found you through mutuals",
  "Mia replied to your comment on a public post",
  "Mia liked your beach photo",
  "Mia followed you after seeing your reel",
  "Mia liked your car photo",
  "Mia viewed your profile after a mutual tagged you",
  "Mia liked your selfie from last week",
  "Mia added you from Suggested Friends",
];

const HIGH_STANDARDS_SCENARIOS = [
  "Isabella liked your story 👀",
  "Isabella viewed your profile",
  "Isabella liked your most confident photo",
  "Isabella reacted to your travel story ✈️",
  "Isabella matched with you",
  "Isabella liked your gym progress photo",
  "Isabella followed you after seeing your comment",
  "Isabella reacted to your playlist story 🎵",
  "Isabella viewed your highlight three times",
  "Isabella liked your recent selfie",
  "Isabella found you through a mutual",
  "Isabella liked your most recent post",
];

const RECOVER_SCENARIOS = [
  "Natalie liked your story after 2 weeks of silence",
  "Natalie viewed your profile again",
  "Natalie reacted to your story with 👀",
  "Natalie liked your new photo",
  "Natalie started following your close friends story",
  "Natalie liked a photo from before you last spoke",
  "Natalie added you back after removing you",
  "Natalie reacted to your meme story 😂",
  "Natalie liked your latest post",
  "Natalie viewed your highlight reel after weeks of silence",
  "Natalie liked your gym photo out of nowhere",
  "Natalie reacted to your late-night story 🌙",
];

const GHOSTED_SCENARIOS = [
  "Ava liked your story after ghosting you for 3 weeks 👀",
  "Ava viewed your profile twice this week",
  "Ava reacted to your post after weeks of silence",
  "Ava liked your most recent selfie",
  "Ava followed you again after unfollowing",
  "Ava watched all your new stories",
  "Ava liked your gym photo after going cold",
  "Ava added you to Close Friends",
  "Ava reacted to your late-night story 🌙",
  "Ava liked 4 of your photos in one sitting",
  "Ava viewed your highlight after weeks of silence",
  "Ava liked your new selfie out of nowhere",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getScenarioCard(
  challengeId: string,
  characterName: string,
): ScenarioCard {
  switch (challengeId) {
    case "dry-texter":
      return {
        context: pickRandom(DRY_TEXTER_SCENARIOS),
        prompt: "Start the conversation.",
      };
    case "mixed-signals":
      return {
        context: pickRandom(MIXED_SIGNALS_SCENARIOS),
        prompt: "What do you send?",
      };
    case "cold-start":
      return {
        context: pickRandom(COLD_START_SCENARIOS),
        prompt: "The conversation hasn't started yet. Make your move.",
      };
    case "high-standards":
      return {
        context: pickRandom(HIGH_STANDARDS_SCENARIOS),
        prompt: "She's hard to impress. Make it count.",
      };
    case "recover-fumble":
      return {
        context: pickRandom(RECOVER_SCENARIOS),
        prompt: "Recover.",
      };
    case "re-engage-ghosted":
      return {
        context: pickRandom(GHOSTED_SCENARIOS),
        prompt: "Restart the conversation.",
      };
    default:
      return {
        context: `You matched with ${characterName}.`,
        prompt: "Start the conversation.",
      };
  }
}

export default function Challenge() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/challenge" });
  const challengeId = search.challengeId ?? "easy-flirt";
  const isResumeParam = search.resumeMode === true;

  const challengeConfig =
    CHALLENGES.find((c) => c.id === challengeId) ?? CHALLENGES[0];
  const characterProfile = getCharacterProfile(challengeId);

  // Determine user-led mode: use config flag, fallback to all non-easy-flirt as user-led
  const isUserLedMode =
    challengeConfig.isUserLedMode ?? challengeId !== "easy-flirt";

  // Read resume session from sessionStorage on first render (if resumeMode=true)
  const resumeData = useMemo((): ResumeSessionData | null => {
    if (!isResumeParam) return null;
    try {
      const raw = sessionStorage.getItem(RESUME_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as ResumeSessionData;
      if (parsed.challengeId !== challengeId) return null;
      return parsed;
    } catch {
      return null;
    }
  }, [isResumeParam, challengeId]);

  // Build initialState for useChat
  const chatInitialState = useMemo((): UseChatInitialState | undefined => {
    // Resume mode: restore existing messages AND full emotional state
    if (resumeData) {
      return {
        messages: resumeData.messages,
        interestLevel: resumeData.finalInterest,
        currentMood: resumeData.finalMood,
        isResumeMode: true,
        momentum: resumeData.momentum,
        conversationPhase: resumeData.conversationPhase,
        coachingHistory: resumeData.coachingHistory,
      };
    }
    // User-led mode: start with empty messages (user opens first)
    if (isUserLedMode) {
      return {
        messages: [],
        interestLevel: challengeConfig.startingInterest,
        currentMood: challengeConfig.startingMood,
        skipInitialGreeting: true,
      };
    }
    return undefined;
  }, [resumeData, isUserLedMode, challengeConfig]);

  const {
    messages,
    isLoading,
    isTyping,
    error,
    round,
    interestLevel,
    lastInterestDelta,
    currentMood,
    currentMomentum,
    sessionComplete,
    actorReady,
    mockMode,
    liveKeyActive,
    sendMessage,
    sessionAverages,
    sessionPhase,
    lastCoachTone,
    isResumeMode,
    enterResumeMode,
  } = useChat(challengeId, chatInitialState);

  const auth = useAuth();
  const { isAuthenticated } = auth;
  const { clearGuestSession } = useGuestMode();

  // -- Plan & Free limits (for Hint / Assist)
  const { actor: backendActor, isFetching: actorFetching } =
    useActor(createActor);
  const [freePlanConfig, setFreePlanConfig] = useState<FreePlanConfig | null>(
    null,
  );
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeModalTrigger, setUpgradeTrigger] = useState<
    import("@/types").UpgradeModalTrigger | null
  >(null);

  // Derive plan from authenticated user PublicProfile.plan field
  const userPlan =
    (
      auth.user as
        | (import("@/hooks/use-auth").PublicProfile & { plan?: string })
        | null
    )?.plan ?? "free";
  const isPro = isAuthenticated && userPlan === "pro";

  // Signup gate state for Keep Talking
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    PendingAction | undefined
  >();

  const assistance = useAssistance({ isPro, freePlanConfig });

  // Load free plan config on mount (for Hint / Assist limits)
  useEffect(() => {
    if (!backendActor || actorFetching) return;
    backendActor
      .getFreePlanConfig()
      .then((cfg) => {
        setFreePlanConfig({
          rankedSessionsPerDay: Number(cfg.rankedSessionsPerDay),
          rizzAssistPerSession: Number(cfg.rizzAssistPerSession),
          hintsPerSession: Number(cfg.hintsPerSession),
        });
      })
      .catch(() => {});
  }, [backendActor, actorFetching]);

  // Mirror upgrade modal signals from assistance hook
  // biome-ignore lint/correctness/useExhaustiveDependencies: stable clearUpgradeModal ref
  useEffect(() => {
    if (assistance.shouldShowUpgradeModal && assistance.upgradeModalTrigger) {
      setUpgradeTrigger(assistance.upgradeModalTrigger);
      setShowUpgradeModal(true);
      assistance.clearUpgradeModal();
    }
  }, [assistance.shouldShowUpgradeModal, assistance.upgradeModalTrigger]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Track dismissed coaching chips
  const [dismissedChips, setDismissedChips] = useState<Set<string>>(new Set());
  const [activeChipId, setActiveChipId] = useState<string | null>(null);

  // Injected input text from opener/assist modals
  const [injectedInputValue, setInjectedInputValue] = useState<string>("");

  // Show scenario card until first user message is sent (user-led mode only)
  const hasUserSentFirstMessage = messages.some((m) => m.role === "user");
  const showScenarioCard =
    isUserLedMode && !isResumeMode && !hasUserSentFirstMessage;

  // Reset assistance on new (non-resume) session start
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset once on mount for new sessions
  useEffect(() => {
    if (!isResumeMode) {
      assistance.resetAssistance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll whenever messages change or typing indicator toggles
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on message/typing change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Track the latest AI message with coach data and show its chip
  useEffect(() => {
    const lastCoached = [...messages]
      .reverse()
      .find((m) => m.role === "ai" && m.coach_hint != null);
    if (lastCoached && !dismissedChips.has(lastCoached.id)) {
      setActiveChipId(lastCoached.id);
    }
  }, [messages, dismissedChips]);

  // Auto-focus input after AI stops typing (but not when session is locked)
  // biome-ignore lint/correctness/useExhaustiveDependencies: focus on typing/resume change
  useEffect(() => {
    const locked = sessionComplete && !isResumeMode;
    if (!isTyping && !locked && !isLoading) {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [isTyping, isResumeMode]);

  /** Unlock the current chat in-place for authenticated users */
  function activateKeepTalking() {
    enterResumeMode();
    // Re-focus input after state settles
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  /** Keep Talking button handler — gates anonymous users, unlocks in-place for authenticated */
  function handleKeepTalking() {
    if (!isAuthenticated) {
      setPendingAction("keep-talking");
      setShowSignupModal(true);
      return;
    }
    activateKeepTalking();
  }

  /** After signup/login from the Keep Talking gate */
  function handleSignupSuccess(action?: PendingAction) {
    clearGuestSession();
    setShowSignupModal(false);
    if (action === "keep-talking") {
      activateKeepTalking();
    }
  }

  // Build navigation args for results
  function buildResultsSearch() {
    const avg = sessionAverages ?? {
      confidence: 62,
      humor: 58,
      originality: 55,
      overall: 58,
      finalInterestLevel: interestLevel,
      finalMood: currentMood,
      momentumSummary: "neutral" as const,
    };
    return {
      confidence: avg.confidence,
      humor: avg.humor,
      originality: avg.originality,
      overallScore: avg.overall,
      finalInterestLevel: avg.finalInterestLevel,
      finalMood: avg.finalMood,
      momentumSummary: avg.momentumSummary,
      challengeId,
    };
  }

  // In resume mode the session is technically "complete" but the input must be unlocked
  const inputDisabled =
    isLoading || isTyping || !actorReady || (sessionComplete && !isResumeMode);

  function handleChipDismiss(msgId: string) {
    setDismissedChips((prev) => new Set(prev).add(msgId));
    setActiveChipId(null);
  }

  function handleResumeDone() {
    sessionStorage.removeItem(RESUME_STORAGE_KEY);
    navigate({ to: "/challenges" });
  }

  // Called by AssistanceToolbar when user selects an opener or assist suggestion
  function handleInjectText(text: string) {
    setInjectedInputValue(text);
  }

  // Pick scenario once per session mount — never re-randomize on re-renders
  const [scenarioCard] = useState<ScenarioCard>(() =>
    getScenarioCard(challengeId, characterProfile.name),
  );

  return (
    <div
      className="flex flex-col h-screen bg-background"
      data-ocid="challenge.page"
    >
      {isResumeMode ? (
        // ── Resume header ──────────────────────────────────────────────────────
        <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border">
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-[oklch(0.65_0.22_280)] font-bold uppercase tracking-widest">
              😏 Continuing...
            </span>
            <span className="text-sm font-display font-semibold text-foreground truncate">
              {resumeData?.characterName ?? characterProfile.name}
            </span>
          </div>
          <button
            type="button"
            aria-label="Done"
            data-ocid="challenge.resume_done_button"
            onClick={handleResumeDone}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted"
          >
            <X size={14} />
            Done
          </button>
        </div>
      ) : (
        <HeaderBar
          level={`${challengeConfig.emoji} ${challengeConfig.name}`}
          round={round}
          totalRounds={5}
          interestLevel={interestLevel}
          lastInterestDelta={lastInterestDelta}
          currentMood={currentMood}
          mockMode={mockMode}
          liveKeyActive={liveKeyActive}
          sessionPhase={sessionPhase}
          characterName={characterProfile.name}
          characterAge={characterProfile.age}
        />
      )}

      {/* Chat area */}
      <div
        className="flex-1 overflow-y-auto pt-4 pb-2"
        data-ocid="challenge.chat_list"
      >
        {/* ── Scenario card — user-led modes, fades out after first message ── */}
        {showScenarioCard && (
          <div
            className="mx-4 mb-5 rounded-2xl border border-[oklch(0.28_0.06_280)] bg-[oklch(0.13_0.04_280)] px-5 py-4 animate-[fadeSlideIn_0.4s_ease-out]"
            data-ocid="challenge.scenario_card"
          >
            <div className="flex items-start gap-3">
              {/* Avatar initial */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[oklch(0.55_0.22_280)] to-[oklch(0.45_0.24_310)] flex items-center justify-center text-white font-display font-bold text-base flex-shrink-0">
                {characterProfile.name[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[oklch(0.88_0.06_280)] font-semibold text-sm leading-snug">
                  {scenarioCard.context}
                </p>
                <p className="mt-1 text-[oklch(0.55_0.08_280)] text-xs leading-relaxed">
                  {scenarioCard.prompt}
                </p>
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={msg.id} data-ocid={`challenge.item.${i + 1}`}>
            <ChatBubble message={msg} />
            {msg.role === "ai" &&
              msg.coach_hint != null &&
              !dismissedChips.has(msg.id) &&
              activeChipId === msg.id && (
                <MiniCoachingChip
                  interestChange={msg.interest_change ?? 0}
                  coachHint={msg.coach_hint}
                  feedbackCategory={msg.feedbackCategory ?? "neutral"}
                  momentum={msg.momentum ?? "neutral"}
                  coachTone={msg.coach_tone ?? lastCoachTone}
                  onDismiss={() => handleChipDismiss(msg.id)}
                />
              )}
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div data-ocid="challenge.loading_state">
            <TypingIndicator name={characterProfile.name} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            className="mx-4 mb-2 text-sm text-destructive bg-destructive/10 rounded-xl px-4 py-2"
            data-ocid="challenge.error_state"
          >
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Session complete sticky CTA — only in normal mode */}
      {sessionComplete && !isResumeMode && (
        <div
          className="px-4 pt-3 pb-2 bg-card border-t border-[oklch(0.65_0.22_280)]/30 animate-[fadeSlideIn_0.3s_ease-out] flex flex-col gap-2"
          data-ocid="challenge.session_complete_bar"
        >
          <button
            type="button"
            onClick={handleKeepTalking}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-[oklch(0.65_0.22_280)] to-[oklch(0.58_0.24_310)] text-white font-display font-semibold text-base flex items-center justify-center gap-2 shadow-lg hover:opacity-90 active:scale-95 transition-all duration-200"
            data-ocid="challenge.keep_talking_button"
          >
            Keep Talking 😏
          </button>
          <button
            type="button"
            onClick={() =>
              navigate({ to: "/results", search: buildResultsSearch() })
            }
            className="w-full h-11 rounded-xl border border-[oklch(0.65_0.22_280)]/40 text-muted-foreground font-display font-medium text-sm flex items-center justify-center gap-2 hover:bg-muted/60 hover:text-foreground active:scale-95 transition-all duration-200"
            data-ocid="challenge.view_results_button"
          >
            View Results 🔥
          </button>
        </div>
      )}

      {/* Upgrade modal — shown when free user hits a plan limit */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        trigger={upgradeModalTrigger}
        onClose={() => setShowUpgradeModal(false)}
      />

      {/* Signup gate — shown when anonymous user clicks Keep Talking */}
      <SaveProgressModal
        isVisible={showSignupModal}
        outcomeType="strong-chemistry"
        outcomeEmoji="😏"
        outcomeName="Keep Talking"
        finalInterest={interestLevel}
        xpEarned={0}
        finalMood={currentMood}
        pendingAction={pendingAction}
        onDismiss={() => setShowSignupModal(false)}
        onAuthSuccess={handleSignupSuccess}
      />

      {/* Tactical assistance toolbar */}
      <AssistanceToolbar
        isUserLedMode={isUserLedMode}
        sessionComplete={sessionComplete}
        isResumeMode={isResumeMode}
        roundNumber={round}
        interestLevel={interestLevel}
        currentMood={currentMood}
        currentMomentum={currentMomentum}
        conversationLength={messages.length}
        onSelectOpener={handleInjectText}
        onHintReceived={() => {}}
        onSelectAssist={handleInjectText}
        assistance={assistance}
        characterName={characterProfile.name}
        challengeId={challengeId}
        characterProfile={characterProfile}
        sessionPhase={sessionPhase}
        messages={messages}
      />

      <ChatInput
        onSend={sendMessage}
        disabled={inputDisabled}
        inputRef={inputRef}
        placeholder={
          sessionComplete && !isResumeMode
            ? "Session complete — view your results"
            : undefined
        }
        injectedValue={injectedInputValue}
        onInjectedConsumed={() => setInjectedInputValue("")}
      />

      <footer className="py-2 text-center">
        <span className="text-xs text-muted-foreground/40">
          © {new Date().getFullYear()}. Built with love using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== "undefined" ? window.location.hostname : "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-muted-foreground transition-colors"
          >
            caffeine.ai
          </a>
        </span>
      </footer>
    </div>
  );
}
