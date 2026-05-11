import { SaveProgressModal } from "@/components/SaveProgressModal";
import { UpgradeModal } from "@/components/UpgradeModal";
import { useAuth } from "@/hooks/use-auth";
import { useGuestMode } from "@/hooks/use-guest-mode";
import { usePlayerProgress } from "@/hooks/use-player-progress";
import { useRankedSession } from "@/hooks/use-ranked-session";
import {
  CHALLENGES,
  PLAYER_RANKS,
  getDailyChallengeId,
} from "@/lib/challenges";
import type { BestScores, ChallengeConfig } from "@/types";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

// ── Difficulty dot colors ──────────────────────────────────────────────────────
const DIFFICULTY_DOT: Record<string, string> = {
  easy: "bg-green-400",
  medium: "bg-yellow-400",
  hard: "bg-red-400",
  extreme: "bg-purple-400",
};

const DIFFICULTY_BADGE: Record<string, string> = {
  easy: "bg-green-400/15 text-green-400 border-green-400/30",
  medium: "bg-yellow-400/15 text-yellow-400 border-yellow-400/30",
  hard: "bg-red-400/15 text-red-400 border-red-400/30",
  extreme: "bg-purple-400/15 text-purple-400 border-purple-400/30",
};

// ── Emoji circle background per difficulty ─────────────────────────────────────
const EMOJI_BG: Record<string, string> = {
  easy: "bg-green-400/15 border-green-400/25",
  medium: "bg-yellow-400/15 border-yellow-400/25",
  hard: "bg-red-400/15 border-red-400/25",
  extreme: "bg-purple-400/15 border-purple-400/25",
};

// ── Challenge card ─────────────────────────────────────────────────────────────
interface ChallengeCardProps {
  challenge: ChallengeConfig;
  isDaily: boolean;
  isDailyDone: boolean;
  bestScore: number | null;
  index: number;
  onUnlockedClick: (id: string) => void;
}

function ChallengeCard({
  challenge,
  isDaily,
  isDailyDone,
  bestScore,
  index,
  onUnlockedClick,
}: ChallengeCardProps) {
  const cardBase =
    "relative flex items-center gap-4 rounded-2xl border bg-card p-4 select-none transition-all duration-200";

  const cardVariant = isDaily
    ? "cursor-pointer border-yellow-400/50 shadow-[0_0_18px_rgba(250,204,21,0.15)] hover:shadow-[0_0_28px_rgba(250,204,21,0.25)] hover:border-yellow-400/70 active:scale-[0.98]"
    : "cursor-pointer border-border hover:border-accent/50 hover:bg-card/80 active:scale-[0.98]";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      data-ocid={`challenge_select.item.${index + 1}`}
    >
      <button
        type="button"
        className={`${cardBase} ${cardVariant} w-full text-left`}
        onClick={() => onUnlockedClick(challenge.id)}
      >
        {/* Daily golden glow overlay */}
        {isDaily && (
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-yellow-400/5 to-transparent pointer-events-none" />
        )}

        {/* Emoji circle */}
        <div
          className={`flex-shrink-0 w-12 h-12 rounded-2xl border flex items-center justify-center text-2xl ${
            EMOJI_BG[challenge.difficulty]
          }`}
        >
          {challenge.emoji}
        </div>

        {/* Text content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold font-display text-foreground text-sm leading-tight truncate">
              {challenge.name}
            </span>
            {/* Difficulty badge */}
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                DIFFICULTY_BADGE[challenge.difficulty]
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${DIFFICULTY_DOT[challenge.difficulty]}`}
              />
              {challenge.difficultyLabel}
            </span>
            {/* Daily label */}
            {isDaily && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-400/15 border border-yellow-400/40 text-yellow-400">
                Daily 🌟
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">
            {challenge.description}
          </p>
        </div>

        {/* Right indicator */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
          {isDailyDone ? (
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] font-bold bg-muted/60 text-muted-foreground border border-border rounded-full px-2 py-0.5">
                DONE
              </span>
              {bestScore !== null && (
                <span className="text-[10px] font-bold text-[oklch(0.78_0.18_60)] whitespace-nowrap">
                  Best: {bestScore}
                </span>
              )}
            </div>
          ) : isDaily ? (
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] font-bold bg-yellow-400/20 text-yellow-400 border border-yellow-400/40 rounded-full px-2 py-0.5 whitespace-nowrap">
                +25 XP bonus
              </span>
              {bestScore !== null && (
                <span className="text-[10px] font-bold text-[oklch(0.78_0.18_60)] whitespace-nowrap">
                  Best: {bestScore}
                </span>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-end gap-1">
              <div className="w-7 h-7 rounded-xl bg-accent/15 flex items-center justify-center">
                <ChevronRight size={14} className="text-accent" />
              </div>
              {bestScore !== null && (
                <span className="text-[10px] font-bold text-[oklch(0.78_0.18_60)] whitespace-nowrap">
                  Best: {bestScore}
                </span>
              )}
            </div>
          )}
        </div>
      </button>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ChallengeSelect() {
  const navigate = useNavigate();
  const { progress } = usePlayerProgress();
  const auth = useAuth();
  const { isSuspended, logout, isAuthenticated } = auth;
  const { guestSessionsCompleted, clearGuestSession } = useGuestMode();

  const [showGuestWall, setShowGuestWall] = useState(false);

  // ── Centralized ranked-session gate ──────────────────────────────────────
  const { startRankedSession, showUpgradeModal, closeUpgradeModal } =
    useRankedSession();

  function handleAuthSuccess() {
    clearGuestSession();
    setShowGuestWall(false);
  }

  const todayISO = new Date().toISOString().split("T")[0];
  const dailyChallengeId = getDailyChallengeId();
  const isDailyDone = progress.dailyChallengeCompletedDate === todayISO;
  const bestScores: BestScores = progress.bestScores;

  async function handleChallengeClick(challengeId: string) {
    // All limit checking is now done server-side via useRankedSession
    await startRankedSession(challengeId);
  }

  // Rank badge info
  const currentRank = PLAYER_RANKS.find((r) => r.id === progress.rankId);

  return (
    <main
      className="relative min-h-screen bg-background text-foreground"
      data-ocid="challenge_select.page"
    >
      <SaveProgressModal
        isVisible={showGuestWall}
        outcomeType="almost-there"
        outcomeEmoji="🏆"
        outcomeName="Free Session Used"
        finalInterest={50}
        xpEarned={0}
        finalMood="neutral"
        onDismiss={() => setShowGuestWall(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* Upgrade modal — ranked sessions limit reached */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        trigger="ranked_sessions"
        onClose={closeUpgradeModal}
      />

      {/* Suspension overlay */}
      {isSuspended && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm px-6 text-center"
          data-ocid="challenge_select.suspended_overlay"
        >
          <div className="text-5xl mb-4">⛔</div>
          <h2 className="text-xl font-bold font-display text-foreground mb-2">
            Account Suspended
          </h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs">
            Your account is suspended. You cannot access gameplay. Please
            contact support to resolve this.
          </p>
          <button
            type="button"
            onClick={() => logout().then(() => navigate({ to: "/" }))}
            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
            data-ocid="challenge_select.suspended_logout_button"
          >
            Log out
          </button>
        </div>
      )}
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[300px] rounded-full bg-accent/10 blur-[100px]" />
      </div>

      {/* Header */}
      <div className="sticky top-0 z-20 bg-card/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-3 px-4 py-4 max-w-lg mx-auto">
          <button
            type="button"
            onClick={() => navigate({ to: "/" })}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent hover:border-border transition-smooth"
            aria-label="Back"
            data-ocid="challenge_select.back_button"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="font-bold font-display text-foreground text-lg leading-tight">
              Choose Your Challenge
            </h1>
            <p className="text-xs text-muted-foreground">Pick your opponent</p>
          </div>

          {/* Player rank chip */}
          {currentRank && (
            <div className="flex items-center gap-1.5 bg-accent/10 border border-accent/25 rounded-xl px-3 py-1.5">
              <span className="text-sm">{currentRank.emoji}</span>
              <span className="text-xs font-semibold text-accent">
                {currentRank.name}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Challenge list */}
      <div className="relative z-10 px-4 py-5 flex flex-col gap-3 max-w-lg mx-auto pb-24">
        {/* Daily streak banner */}
        {progress.streak > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-2 bg-orange-400/10 border border-orange-400/30 rounded-2xl px-4 py-2.5 text-sm"
            data-ocid="challenge_select.streak_banner"
          >
            <span className="text-base">🔥</span>
            <span className="text-orange-400 font-semibold font-display">
              {progress.streak}-day streak
            </span>
            <span className="text-muted-foreground text-xs ml-auto">
              Keep it going!
            </span>
          </motion.div>
        )}

        {/* Section header */}
        <div className="flex items-center gap-2 px-1 mt-1 mb-1">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            All Challenges
          </span>
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">
            {CHALLENGES.length}/{CHALLENGES.length} unlocked
          </span>
        </div>

        {/* Cards */}
        {CHALLENGES.map((challenge, i) => (
          <ChallengeCard
            key={challenge.id}
            challenge={challenge}
            isDaily={challenge.id === dailyChallengeId}
            isDailyDone={isDailyDone && challenge.id === dailyChallengeId}
            bestScore={bestScores[challenge.id] ?? null}
            index={i}
            onUnlockedClick={handleChallengeClick}
          />
        ))}
      </div>
    </main>
  );
}
