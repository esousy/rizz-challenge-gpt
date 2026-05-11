import {
  type SessionResult as BackendSessionResult,
  createActor,
} from "@/backend";
import { RankUpModal } from "@/components/RankUpModal";
import {
  type PendingAction,
  SaveProgressModal,
} from "@/components/SaveProgressModal";
import { UpgradeModal } from "@/components/UpgradeModal";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useChat } from "@/hooks/use-chat";
import {
  clearGuestSessionResult,
  getGuestSessionResult,
  storeGuestSessionResult,
  useGuestMode,
} from "@/hooks/use-guest-mode";
import { usePlayerProgress } from "@/hooks/use-player-progress";
import { useRankedSession } from "@/hooks/use-ranked-session";
import {
  CHALLENGES,
  OUTCOME_ARCHETYPES,
  PLAYER_RANKS,
  calculateOutcome,
  calculateXPEarned,
  getCharacterProfile,
  getDailyChallenge,
  getRankForXP,
  getXPProgressInRank,
} from "@/lib/challenges";
import type { PlayerRankId } from "@/types";
import type {
  Message,
  PlayerSkills,
  ResumeSessionData,
  SessionAverages,
  SessionHistoryEntry,
} from "@/types";
import { useActor } from "@caffeineai/core-infrastructure";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronRight, MessageCircle, RotateCcw, Zap } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

/** sessionStorage key for resume session data */
const RESUME_STORAGE_KEY = "rizz-resume-session";

// ── Mood emoji map ────────────────────────────────────────────────────────────
const MOOD_EMOJI: Record<string, string> = {
  playful: "😏",
  curious: "🤔",
  flirty: "💕",
  bored: "😑",
  cold: "❄️",
  testing: "👀",
  engaged: "😊",
  neutral: "😐",
};

// ── Skill labels/emojis ───────────────────────────────────────────────────────
const SKILL_META: { key: keyof PlayerSkills; label: string; emoji: string }[] =
  [
    { key: "confidence", label: "Confidence", emoji: "💪" },
    { key: "humor", label: "Humor", emoji: "😂" },
    { key: "originality", label: "Originality", emoji: "✨" },
    { key: "tension", label: "Tension", emoji: "🔥" },
    { key: "socialAwareness", label: "Social Awareness", emoji: "🧠" },
  ];

// ── Skill color ───────────────────────────────────────────────────────────────
function skillBarColor(val: number): string {
  if (val >= 60) return "from-[oklch(0.65_0.22_280)] to-[oklch(0.58_0.24_310)]";
  if (val >= 35) return "from-[oklch(0.62_0.21_142)] to-[oklch(0.72_0.2_142)]";
  return "from-[oklch(0.62_0.19_22)] to-[oklch(0.72_0.18_22)]";
}

// ── XP Counter ───────────────────────────────────────────────────────────────
function XPCounter({ target }: { target: number }) {
  const [count, setCount] = useState(0);
  const frame = useRef(0);

  useEffect(() => {
    const duration = 800;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - t) ** 3;
      setCount(Math.round(eased * target));
      if (t < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [target]);

  return (
    <span
      data-ocid="results.xp_counter"
      className="text-6xl font-bold font-display tabular-nums bg-gradient-to-r from-[oklch(0.78_0.18_60)] via-[oklch(0.85_0.15_80)] to-[oklch(0.65_0.22_280)] bg-clip-text text-transparent"
    >
      +{count}
    </span>
  );
}

// ── Confetti dots ─────────────────────────────────────────────────────────────
const CONFETTI = [
  { color: "bg-[oklch(0.65_0.22_280)]", x: -32, delay: 0 },
  { color: "bg-[oklch(0.78_0.18_60)]", x: 16, delay: 80 },
  { color: "bg-[oklch(0.72_0.2_142)]", x: -12, delay: 160 },
  { color: "bg-[oklch(0.65_0.19_22)]", x: 36, delay: 60 },
  { color: "bg-[oklch(0.58_0.24_310)]", x: -42, delay: 120 },
  { color: "bg-[oklch(0.85_0.15_80)]", x: 52, delay: 40 },
];

function ConfettiDots({ active }: { active: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {CONFETTI.map((c, i) => (
        <motion.div
          key={`${c.color}-${i}`}
          className={`absolute w-2 h-2 rounded-full ${c.color} bottom-1/2 left-1/2`}
          initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
          animate={
            active
              ? {
                  opacity: [0, 1, 0],
                  x: c.x,
                  y: [-20, -60, -90],
                  scale: [0, 1.2, 0.6],
                }
              : {}
          }
          transition={{
            duration: 1.2,
            delay: c.delay / 1000,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}

// ── RankUp badge ──────────────────────────────────────────────────────────────
function RankUpBadge({
  oldRankId,
  newRankId,
}: {
  oldRankId: string;
  newRankId: string;
}) {
  const oldRank = PLAYER_RANKS.find((r) => r.id === oldRankId);
  const newRank = PLAYER_RANKS.find((r) => r.id === newRankId);
  if (!oldRank || !newRank) return null;
  return (
    <motion.div
      data-ocid="results.rank_up_badge"
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.3 }}
      className="flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-[oklch(0.78_0.18_60)]/15 border border-[oklch(0.78_0.18_60)]/40 shadow-md"
    >
      <span className="text-sm text-[oklch(0.78_0.18_60)] font-bold uppercase tracking-widest">
        🏆 Rank Up!
      </span>
      <span className="text-xs text-muted-foreground">
        {oldRank.emoji} → {newRank.emoji} {newRank.name}
      </span>
    </motion.div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Results() {
  const navigate = useNavigate();
  const { resetSession } = useChat();

  // ── Read session data from search params ───────────────────────────────────
  const search = useSearch({ strict: false }) as {
    confidence?: number;
    humor?: number;
    originality?: number;
    overallScore?: number;
    finalInterestLevel?: number;
    finalMood?: string;
    momentumSummary?: string;
    challengeId?: string;
  };

  const confidence = Number(search.confidence ?? 62);
  const humor = Number(search.humor ?? 58);
  const originality = Number(search.originality ?? 55);
  const overallScore = Number(search.overallScore ?? 58);
  const finalInterest = Number(search.finalInterestLevel ?? 50);
  const finalMood = String(search.finalMood ?? "neutral");
  const momentumSummary = String(search.momentumSummary ?? "neutral") as
    | "positive"
    | "neutral"
    | "negative";
  const challengeId = String(search.challengeId ?? "easy-flirt");
  // A fully completed session always passes real scores from useChat sessionAverages
  const sessionDidComplete =
    search.overallScore != null && search.confidence != null;

  const averages: SessionAverages = {
    confidence,
    humor,
    originality,
    overall: overallScore,
    finalInterestLevel: finalInterest,
    finalMood,
    momentumSummary,
  };

  // ── Progression hook ───────────────────────────────────────────────────────
  const { progress, completeSessionUpdate } = usePlayerProgress();

  // ── Compute outcome (trajectory-aware) ────────────────────────────────────
  // Trajectory: if interest ended significantly above the expected starting point,
  // that signals a positive arc beyond the raw final number
  const interestStartEstimate = 50;
  const trajectoryBonus = finalInterest - interestStartEstimate;
  const isPositiveTrajectory = trajectoryBonus > 10;
  const isNegativeTrajectory = trajectoryBonus < -10;

  const isWarmFinalMood =
    finalMood === "playful" ||
    finalMood === "flirty" ||
    finalMood === "warm" ||
    finalMood === "engaged";
  const isColdFinalMood =
    finalMood === "cold" || finalMood === "distant" || finalMood === "bored";

  const avgMomentum =
    momentumSummary === "positive"
      ? 0.6
      : momentumSummary === "negative"
        ? 0
        : 0.3;

  // Coherent outcome: prevents contradictions between interest, mood, and momentum
  const rawOutcomeType = calculateOutcome(finalInterest, avgMomentum, []);
  const outcomeType = (() => {
    if (finalInterest >= 75 && isWarmFinalMood)
      return "rizz-masterclass" as const;
    if (finalInterest >= 60 && isWarmFinalMood)
      return "strong-chemistry" as const;
    if (isColdFinalMood && finalInterest < 60) return "lost-her" as const;
    if (isColdFinalMood && finalInterest >= 60) return "almost-there" as const;
    if (finalInterest < 35) return "lost-her" as const;
    if (finalInterest < 50) return "fumbled-the-bag" as const;
    if (isPositiveTrajectory && finalInterest >= 55)
      return "strong-chemistry" as const;
    return rawOutcomeType;
  })();
  const outcome = OUTCOME_ARCHETYPES[outcomeType];

  // ── Daily bonus check ──────────────────────────────────────────────────────
  const todayISO = new Date().toISOString().split("T")[0];
  const dailyChallengeId = getDailyChallenge(new Date());
  const isDailyBonus =
    dailyChallengeId === challengeId &&
    progress.dailyChallengeCompletedDate !== todayISO;

  const xpEarned = calculateXPEarned(finalInterest, averages, isDailyBonus);

  // ── Skill deltas derived from session performance ─────────────────────────
  const skillDeltas: PlayerSkills = {
    confidence: confidence >= 60 ? 2 : confidence >= 40 ? 1 : 0,
    humor: humor >= 60 ? 2 : humor >= 40 ? 1 : 0,
    originality: originality >= 60 ? 2 : originality >= 40 ? 1 : 0,
    tension: finalInterest >= 60 ? 2 : finalInterest >= 40 ? 1 : 0,
    socialAwareness: overallScore >= 60 ? 2 : overallScore >= 40 ? 1 : 0,
  };

  // ── Local state ────────────────────────────────────────────────────────────
  const auth = useAuth();
  const { isAuthenticated } = auth;
  const { guestSessionsCompleted, incrementGuestSession, clearGuestSession } =
    useGuestMode();
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    PendingAction | undefined
  >();

  // -- Centralized ranked-session gate
  const {
    startRankedSession,
    showUpgradeModal: showRankedUpgradeModal,
    closeUpgradeModal: closeRankedUpgradeModal,
  } = useRankedSession();

  // After successful auth: clear guest state and execute the action the user originally wanted
  function handleAuthSuccess(action?: PendingAction) {
    clearGuestSession();
    clearGuestSessionResult();
    if (action === "keep-talking" || action === "resume") {
      // Build resume payload and navigate — same logic as handleResumeConversation
      const characterProfile = getCharacterProfile(challengeId);
      let storedMessages: Message[] = [];
      let storedMomentum: string =
        momentumSummary === "positive"
          ? "positive"
          : momentumSummary === "negative"
            ? "negative"
            : "neutral";
      let storedCoachingHistory: string[] = [];
      try {
        const existing = sessionStorage.getItem(RESUME_STORAGE_KEY);
        if (existing) {
          const parsed = JSON.parse(existing) as ResumeSessionData;
          if (parsed.challengeId === challengeId) {
            storedMessages = parsed.messages;
            storedMomentum = parsed.momentum ?? storedMomentum;
            storedCoachingHistory = parsed.coachingHistory ?? [];
          }
        }
      } catch {
        /* ignore */
      }
      if (!storedMessages.length) {
        storedMessages = [
          {
            id: "resume-context",
            role: "ai",
            content: "Hey, you're back. Where were we? 😏",
          },
        ];
      }
      const resumePayload: ResumeSessionData = {
        challengeId,
        characterName: characterProfile.name,
        messages: storedMessages,
        finalInterest,
        finalMood,
        momentum: storedMomentum,
        conversationPhase: "final-outcome",
        coachingHistory: storedCoachingHistory,
      };
      sessionStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify(resumePayload));
      navigate({ to: "/challenge", search: { challengeId, resumeMode: true } });
    } else if (action === "try-again") {
      resetSession();
      navigate({
        to: "/challenge",
        search: { challengeId, resumeMode: undefined },
      });
    } else if (action === "next-challenge") {
      navigate({ to: "/challenges" });
    }
  }

  const [rankUpInfo, setRankUpInfo] = useState<{
    didRankUp: boolean;
    oldRankId: string;
    newRankId: string;
  } | null>(null);
  const [showRankUpModal, setShowRankUpModal] = useState(false);
  const [isNewBestScore, setIsNewBestScore] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);
  const initializedRef = useRef(false);

  // ── Actor for backend persistence ─────────────────────────────────────────
  const { actor } = useActor(createActor);

  // ── One-time session commit on mount ──────────────────────────────────────
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional one-time mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Check best score BEFORE updating (use current stored best)
    const currentBest = progress.bestScores[challengeId] ?? 0;
    const isNewBest = overallScore > currentBest;
    setIsNewBestScore(isNewBest);

    // Build session history entry
    const challenge = CHALLENGES.find((c) => c.id === challengeId);
    const historyEntry: SessionHistoryEntry = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      challengeId,
      challengeName: challenge?.name ?? challengeId,
      score: overallScore,
      outcome: outcome.name,
      finalMood,
      finalInterest,
      xpEarned,
    };

    // Build backend SessionResult for saveCallerSession
    const token = localStorage.getItem("rizz_session_token");
    const characterProfile = getCharacterProfile(challengeId);
    const backendSession: BackendSessionResult | null =
      isAuthenticated && token
        ? {
            sessionId: historyEntry.id,
            challengeType: challengeId,
            characterName: characterProfile.name,
            outcomeType,
            finalInterest: BigInt(finalInterest),
            finalMood,
            rizzScore: BigInt(overallScore),
            xpEarned: BigInt(xpEarned),
            skillsDelta: {
              confidence: BigInt(skillDeltas.confidence),
              humor: BigInt(skillDeltas.humor),
              originality: BigInt(skillDeltas.originality),
              tension: BigInt(skillDeltas.tension),
              socialAwareness: BigInt(skillDeltas.socialAwareness),
            },
            bestMoment,
            areaToImprove: weakMoment,
            createdAt: BigInt(Date.now()),
            isRanked: true,
          }
        : null;

    // ATOMIC update: one call replaces all sequential stale-closure updates
    completeSessionUpdate(
      historyEntry,
      skillDeltas,
      xpEarned,
      challengeId,
      overallScore,
      isDailyBonus,
      isAuthenticated && token ? actor : null,
      token,
      backendSession,
    ).then((updatedProgress) => {
      const prevRankId = progress.rankId;
      const newRankId = getRankForXP(updatedProgress.totalXP).id;
      const didRankUp = newRankId !== prevRankId;

      setRankUpInfo({ didRankUp, oldRankId: prevRankId, newRankId });
      if (didRankUp) {
        setTimeout(() => setShowRankUpModal(true), 900);
      }
      if (didRankUp || finalInterest >= 70) {
        setTimeout(() => setConfettiActive(true), 600);
      }
    });

    // Track guest session count and store result for potential future signup.
    // We do NOT show the signup modal here — the user gets to see their results.
    // The signup wall appears only when they try to start a SECOND session
    // (Try Again, Next Challenge, Resume, or pick a new challenge).
    if (!isAuthenticated) {
      incrementGuestSession();
      const guestBackendSession: BackendSessionResult = {
        sessionId: Date.now().toString(),
        outcomeType,
        characterName: characterProfile.name,
        challengeType: challengeId,
        finalInterest: BigInt(finalInterest),
        finalMood,
        rizzScore: BigInt(overallScore),
        xpEarned: BigInt(xpEarned),
        skillsDelta: {
          confidence: BigInt(skillDeltas.confidence),
          humor: BigInt(skillDeltas.humor),
          originality: BigInt(skillDeltas.originality),
          tension: BigInt(skillDeltas.tension),
          socialAwareness: BigInt(skillDeltas.socialAwareness),
        },
        bestMoment,
        areaToImprove: weakMoment,
        isRanked: true,
        createdAt: BigInt(Date.now()),
      };
      storeGuestSessionResult(guestBackendSession);
    }
  }, []);

  // ── Post-update rank progress ─────────────────────────────────────────────
  const rankProgress = getXPProgressInRank(progress.totalXP);
  const currentRank = getRankForXP(progress.totalXP);

  // ── Best/weakest moment derivation (trajectory + mood driven) ─────────────
  const statsArr = [confidence, humor, originality];
  const maxStat = Math.max(...statsArr);
  const minStat = Math.min(...statsArr);
  const bestStatIdx = statsArr.indexOf(maxStat);
  const weakStatIdx = statsArr.indexOf(minStat);

  const bestMoment = (() => {
    if (isPositiveTrajectory && isWarmFinalMood)
      return "You built real momentum — the chemistry grew as the conversation progressed";
    if (bestStatIdx === 0)
      return "Your confident, grounded energy kept her engaged";
    if (bestStatIdx === 1)
      return "Your playful wit created genuine moments of connection";
    if (bestStatIdx === 2)
      return "Your originality surprised her and stood out from the usual";
    return "You maintained solid energy throughout";
  })();

  const weakMoment = (() => {
    if (isNegativeTrajectory)
      return "Your energy dropped mid-conversation — work on sustaining momentum";
    if (isColdFinalMood)
      return "She ended cold — focus on emotional timing and reading her energy";
    if (finalInterest < 40) return "Build chemistry before trying to escalate";
    if (weakStatIdx === 0)
      return "Work on opening with more directness and intention";
    if (weakStatIdx === 1)
      return "Add more playful teasing to keep the tension alive";
    if (weakStatIdx === 2)
      return "Try more unexpected angles — originality is the differentiator";
    return "Keep the momentum more consistent throughout";
  })();

  // ── Outcome glow color ─────────────────────────────────────────────────────
  const glowMap: Record<string, string> = {
    "lost-her": "from-blue-500/10 via-background to-background",
    "almost-there": "from-yellow-500/10 via-background to-background",
    "strong-chemistry": "from-orange-500/10 via-background to-background",
    "fumbled-the-bag": "from-red-500/10 via-background to-background",
    "rizz-masterclass":
      "from-[oklch(0.65_0.22_280)]/15 via-background to-background",
  };
  const glowClass = glowMap[outcomeType] ?? "from-background to-background";

  // -- CTAs
  async function handleTryAgain() {
    if (!isAuthenticated && guestSessionsCompleted >= 1) {
      setPendingAction("try-again");
      setShowSaveModal(true);
      return;
    }
    resetSession();
    await startRankedSession(challengeId);
  }

  function handleNextChallenge() {
    if (!isAuthenticated && guestSessionsCompleted >= 1) {
      setPendingAction("next-challenge");
      setShowSaveModal(true);
      return;
    }
    navigate({ to: "/challenges" });
  }

  /** Gate resume for anonymous users, then store resume data and navigate */
  function handleResumeConversation() {
    if (!isAuthenticated && guestSessionsCompleted >= 1) {
      setPendingAction("resume");
      setShowSaveModal(true);
      return;
    }
    const characterProfile = getCharacterProfile(challengeId);
    let storedMessages: Message[] = [];
    let storedMomentum =
      momentumSummary === "positive"
        ? "positive"
        : momentumSummary === "negative"
          ? "negative"
          : "neutral";
    let storedCoachingHistory: string[] = [];

    try {
      const existing = sessionStorage.getItem(RESUME_STORAGE_KEY);
      if (existing) {
        const parsed = JSON.parse(existing) as ResumeSessionData;
        if (parsed.challengeId === challengeId) {
          storedMessages = parsed.messages;
          storedMomentum = parsed.momentum ?? storedMomentum;
          storedCoachingHistory = parsed.coachingHistory ?? [];
        }
      }
    } catch {
      /* ignore */
    }

    if (!storedMessages.length) {
      storedMessages = [
        {
          id: "resume-context",
          role: "ai",
          content: `Hey, you're back. Where were we? \uD83D\uDE0F`,
        },
      ];
    }

    const resumePayload: ResumeSessionData = {
      challengeId,
      characterName: characterProfile.name,
      messages: storedMessages,
      finalInterest,
      finalMood,
      momentum: storedMomentum,
      conversationPhase: "final-outcome",
      coachingHistory: storedCoachingHistory,
    };
    sessionStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify(resumePayload));
    navigate({ to: "/challenge", search: { challengeId, resumeMode: true } });
  }

  // Rank-up modal data
  const rankUpNewRank = rankUpInfo?.didRankUp
    ? PLAYER_RANKS.find((r) => r.id === rankUpInfo.newRankId)
    : null;
  const rankUpNextRankIndex = rankUpNewRank
    ? PLAYER_RANKS.findIndex((r) => r.id === rankUpNewRank.id) + 1
    : -1;
  const rankUpXPToNext =
    rankUpNextRankIndex < PLAYER_RANKS.length && rankUpNextRankIndex >= 0
      ? PLAYER_RANKS[rankUpNextRankIndex].minXP - progress.totalXP
      : 0;

  return (
    <>
      <UpgradeModal
        isOpen={showRankedUpgradeModal}
        trigger="ranked_sessions"
        onClose={closeRankedUpgradeModal}
      />
      <SaveProgressModal
        isVisible={showSaveModal}
        outcomeType={outcomeType}
        outcomeEmoji={outcome.emoji}
        outcomeName={outcome.name}
        finalInterest={finalInterest}
        xpEarned={xpEarned}
        finalMood={finalMood}
        pendingAction={pendingAction}
        onDismiss={() => setShowSaveModal(false)}
        onAuthSuccess={handleAuthSuccess}
        onGuestSignupSuccess={async (token: string) => {
          // Retrieve the guest session result stored at mount time and persist it
          // to the backend so the new account starts with full session history.
          const guestSession = getGuestSessionResult();
          if (guestSession && actor) {
            try {
              await actor.saveCallerSession(token, guestSession);
            } catch {
              // Non-critical — continue even if the backend call fails
            }
          }
          clearGuestSessionResult();
        }}
      />
      {rankUpNewRank && (
        <RankUpModal
          isVisible={showRankUpModal}
          newRankId={rankUpInfo!.newRankId as PlayerRankId}
          newRankName={rankUpNewRank.name}
          newRankEmoji={rankUpNewRank.emoji}
          xpToNextRank={Math.max(0, rankUpXPToNext)}
          onDismiss={() => setShowRankUpModal(false)}
        />
      )}
      <div
        data-ocid="results.page"
        className="min-h-screen bg-background flex flex-col"
      >
        {/* ── 1. OUTCOME HERO ───────────────────────────────────────────────── */}
        <motion.div
          data-ocid="results.outcome_panel"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className={`relative pt-12 pb-8 px-6 flex flex-col items-center gap-2 text-center bg-gradient-to-b ${glowClass}`}
        >
          <motion.span
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              type: "spring",
              stiffness: 240,
              damping: 18,
              delay: 0.1,
            }}
            className="text-6xl"
            role="img"
            aria-label={outcome.name}
          >
            {outcome.emoji}
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className={`text-2xl font-bold font-display tracking-tight ${outcome.color}`}
            data-ocid="results.outcome_name"
          >
            {outcome.name}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="text-sm text-muted-foreground max-w-[240px]"
          >
            {outcome.tagline}
          </motion.p>
        </motion.div>

        {/* ── Content ────────────────────────────────────────────────────────── */}
        <div className="flex-1 px-4 pb-8 max-w-md mx-auto w-full flex flex-col gap-5">
          {/* ── 2. SESSION STATS PILLS ─────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.35 }}
            className="flex flex-wrap items-center justify-center gap-2"
            data-ocid="results.stats_pills"
          >
            <span className="text-xs bg-card border border-border rounded-full px-3 py-1.5 text-muted-foreground font-medium">
              🎯 {finalInterest}% Interest
            </span>
            <span className="text-xs bg-card border border-border rounded-full px-3 py-1.5 text-muted-foreground font-medium">
              {MOOD_EMOJI[finalMood] ?? "😐"} {finalMood}
            </span>
            <span className="text-xs bg-[oklch(0.78_0.18_60)]/10 border border-[oklch(0.78_0.18_60)]/30 rounded-full px-3 py-1.5 text-[oklch(0.78_0.18_60)] font-bold">
              +{xpEarned} XP
            </span>
            {isDailyBonus && (
              <span className="text-xs bg-[oklch(0.65_0.22_280)]/15 border border-[oklch(0.65_0.22_280)]/40 rounded-full px-3 py-1.5 text-[oklch(0.65_0.22_280)] font-bold animate-pulse">
                ⚡ Daily Bonus!
              </span>
            )}
            {isNewBestScore && (
              <span
                data-ocid="results.new_best_badge"
                className="text-xs bg-[oklch(0.72_0.2_142)]/15 border border-[oklch(0.72_0.2_142)]/40 rounded-full px-3 py-1.5 text-[oklch(0.72_0.2_142)] font-bold"
              >
                🏆 New Best!
              </span>
            )}
          </motion.div>

          {/* ── 3. XP REWARD ANIMATION ────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="relative bg-card border border-border rounded-2xl p-6 flex flex-col items-center gap-1 overflow-hidden"
            data-ocid="results.xp_panel"
          >
            <ConfettiDots active={confettiActive} />
            <div className="flex items-center gap-2 mb-1">
              <Zap size={16} className="text-[oklch(0.78_0.18_60)]" />
              <span className="text-[10px] font-bold text-[oklch(0.78_0.18_60)] uppercase tracking-widest">
                XP Earned
              </span>
            </div>
            <XPCounter target={xpEarned} />
            <span className="text-xs text-muted-foreground mt-0.5">
              experience points
            </span>
          </motion.div>

          {/* ── 4. RANK PROGRESS ─────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3"
            data-ocid="results.rank_panel"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{currentRank.emoji}</span>
                <div>
                  <p className="text-sm font-bold text-foreground font-display">
                    {currentRank.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                    Current Rank
                  </p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">
                {progress.totalXP} XP
              </span>
            </div>

            {/* XP bar */}
            <div className="flex flex-col gap-1.5">
              <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[oklch(0.65_0.22_280)] to-[oklch(0.58_0.24_310)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${rankProgress.percentage}%` }}
                  transition={{ duration: 1, delay: 0.7, ease: "easeOut" }}
                  data-ocid="results.xp_bar"
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{rankProgress.current} XP in rank</span>
                <span>
                  {rankProgress.total === 9999
                    ? "Max"
                    : `${rankProgress.total} total`}
                </span>
              </div>
            </div>

            {/* Rank up badge */}
            {rankUpInfo?.didRankUp && (
              <RankUpBadge
                oldRankId={rankUpInfo.oldRankId}
                newRankId={rankUpInfo.newRankId}
              />
            )}
          </motion.div>

          {/* ── 5. SKILL BREAKDOWN ────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.58 }}
            className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3"
            data-ocid="results.skills_panel"
          >
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
              Your Skills
            </p>
            {SKILL_META.map((skill, i) => {
              const val = progress.skills[skill.key];
              const delta = skillDeltas[skill.key];
              return (
                <div
                  key={skill.key}
                  className="flex flex-col gap-1"
                  data-ocid={`results.skill.${i + 1}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-foreground font-medium flex items-center gap-1.5">
                      <span>{skill.emoji}</span>
                      {skill.label}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {delta > 0 && (
                        <span className="text-[10px] text-[oklch(0.72_0.2_142)] font-bold">
                          +{delta}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {val}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full bg-gradient-to-r ${skillBarColor(val)}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${val}%` }}
                      transition={{
                        duration: 0.8,
                        delay: 0.65 + i * 0.12,
                        ease: "easeOut",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </motion.div>

          {/* ── 6. ANALYSIS ───────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.68 }}
            className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3"
            data-ocid="results.analysis_panel"
          >
            <div className="flex flex-col gap-1">
              <p className="text-[10px] font-bold text-[oklch(0.72_0.2_142)] uppercase tracking-widest">
                ✨ Best Moment
              </p>
              <p className="text-sm text-foreground">{bestMoment}</p>
            </div>
            <div className="h-px w-full bg-border" />
            <div className="flex flex-col gap-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                📈 Area to Improve
              </p>
              <p className="text-sm text-muted-foreground">{weakMoment}</p>
            </div>
          </motion.div>

          {/* ── 7. CTAs ───────────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.76 }}
            className="flex flex-col gap-3 mt-1"
          >
            <Button
              type="button"
              data-ocid="results.replay_button"
              onClick={handleTryAgain}
              className="w-full h-12 text-base font-display font-semibold rounded-xl bg-gradient-to-r from-[oklch(0.65_0.22_280)] to-[oklch(0.58_0.24_310)] text-white border-0 hover:opacity-90 transition-all duration-200 flex items-center justify-center gap-2 shadow-md"
            >
              <RotateCcw size={18} />
              Try Again
            </Button>
            <Button
              type="button"
              data-ocid="results.next_challenge_button"
              variant="outline"
              onClick={handleNextChallenge}
              className="w-full h-12 text-base font-display font-semibold rounded-xl border-border text-foreground hover:bg-muted transition-all duration-200 flex items-center justify-center gap-2"
            >
              Next Challenge
              <ChevronRight size={18} />
            </Button>
            {/* 😏 Resume Conversation — only if session fully completed (5 rounds) */}
            {sessionDidComplete && (
              <Button
                type="button"
                data-ocid="results.resume_button"
                variant="ghost"
                onClick={handleResumeConversation}
                className="w-full h-11 text-sm font-display font-medium rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-border/50 transition-all duration-200 flex items-center justify-center gap-2"
              >
                <MessageCircle size={16} />😏 Resume Conversation
              </Button>
            )}
          </motion.div>
        </div>

        <footer className="py-3 text-center">
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
    </>
  );
}
