import { createActor } from "@/backend";
import { useAuth } from "@/hooks/use-auth";
import { usePlayerProgress } from "@/hooks/use-player-progress";
import {
  CHALLENGES,
  PLAYER_RANKS,
  getXPProgressInRank,
  isChallengeUnlocked,
} from "@/lib/challenges";
import type { PlayerRankId, PlayerSkills, SessionHistoryEntry } from "@/types";
import { useActor } from "@caffeineai/core-infrastructure";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";

// ── Helpers ───────────────────────────────────────────────────────────────────

const SKILL_LABELS: Record<keyof PlayerSkills, string> = {
  confidence: "Confidence",
  humor: "Humor",
  originality: "Originality",
  tension: "Tension",
  socialAwareness: "Social Awareness",
};

const SKILL_EMOJIS: Record<keyof PlayerSkills, string> = {
  confidence: "💪",
  humor: "😂",
  originality: "✨",
  tension: "🔥",
  socialAwareness: "🧠",
};

const OUTCOME_EMOJIS: Record<string, string> = {
  "lost-her": "❄️",
  "almost-there": "😏",
  "strong-chemistry": "🔥",
  "fumbled-the-bag": "💀",
  "rizz-masterclass": "👑",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  value,
  label,
  index,
}: {
  value: string | number;
  label: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.15 + index * 0.07 }}
      className="flex-1 flex flex-col items-center gap-0.5 bg-card border border-border rounded-2xl py-4 px-2"
    >
      <span className="font-bold font-display text-foreground text-2xl leading-none">
        {value}
      </span>
      <span className="text-muted-foreground text-[10px] uppercase tracking-wide text-center leading-tight mt-1">
        {label}
      </span>
    </motion.div>
  );
}

function SkillBar({
  skillKey,
  value,
  isStrongest,
  index,
}: {
  skillKey: keyof PlayerSkills;
  value: number;
  isStrongest: boolean;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay: 0.3 + index * 0.07 }}
      className="flex flex-col gap-1.5"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
          <span>{SKILL_EMOJIS[skillKey]}</span>
          <span>{SKILL_LABELS[skillKey]}</span>
          {isStrongest && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30">
              Top
            </span>
          )}
        </span>
        <span
          className={`text-xs font-bold font-display ${
            isStrongest ? "text-accent" : "text-muted-foreground"
          }`}
        >
          {value}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{
            duration: 0.6,
            delay: 0.4 + index * 0.07,
            ease: "easeOut",
          }}
          className={`h-full rounded-full ${
            isStrongest
              ? "bg-gradient-to-r from-accent/70 to-accent"
              : "bg-gradient-to-r from-muted-foreground/40 to-muted-foreground/60"
          }`}
        />
      </div>
    </motion.div>
  );
}

function HistoryEntry({
  entry,
  index,
}: {
  entry: SessionHistoryEntry;
  index: number;
}) {
  const emoji = OUTCOME_EMOJIS[entry.outcome] ?? "🎮";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 + index * 0.04 }}
      className="flex items-center gap-3 py-3 border-b border-border/50 last:border-b-0"
      data-ocid={`stats.history_item.${index + 1}`}
    >
      <span className="text-xl w-8 text-center flex-shrink-0">{emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {entry.challengeName}
        </p>
        <p className="text-[10px] text-muted-foreground capitalize">
          {entry.outcome.replace(/-/g, " ")}
        </p>
      </div>
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
        <span className="text-sm font-bold font-display text-foreground">
          {entry.score}
          <span className="text-muted-foreground font-normal text-xs">
            /100
          </span>
        </span>
        <span className="text-[10px] text-muted-foreground">
          {formatDate(entry.date)}
        </span>
      </div>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Stats() {
  const navigate = useNavigate();
  const { progress, getPlayerStats } = usePlayerProgress();
  const { isAuthenticated, user } = useAuth();
  const { actor } = useActor(createActor);
  const stats = getPlayerStats();

  // Backend stats merged on top of localStorage — backend is source of truth for XP/history
  const [backendXP, setBackendXP] = useState<number | null>(null);
  const [backendRankId, setBackendRankId] = useState<string | null>(null);
  const [backendHistory, setBackendHistory] = useState<
    import("@/types").SessionHistoryEntry[] | null
  >(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !actor) return;
    const token = localStorage.getItem("rizz_session_token");
    if (!token) return;
    setIsSyncing(true);
    actor
      .getCallerStats(token)
      .then((backendStats) => {
        if (!backendStats) return;
        setBackendXP(Number(backendStats.totalXP));
        setBackendRankId(backendStats.rankId);
        // Convert backend session history entries to frontend shape
        const mapped: SessionHistoryEntry[] = backendStats.sessionHistory.map(
          (e, i) => ({
            id: `backend-${i}-${String(e.playedAt)}`,
            date: new Date(Number(e.playedAt)).toISOString(),
            challengeId: e.challengeId,
            challengeName: e.challengeId
              .replace(/-/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase()),
            score: Number(e.score),
            outcome: e.outcome,
            finalMood: e.finalMood,
            finalInterest: 0,
            xpEarned: 0,
          }),
        );
        if (mapped.length > 0) setBackendHistory(mapped);
      })
      .catch(() => {})
      .finally(() => setIsSyncing(false));
  }, [isAuthenticated, actor]);

  // Merge: prefer backend XP and history over localStorage when available
  const displayXP = backendXP !== null ? backendXP : progress.totalXP;
  const displayRankId = (backendRankId ?? progress.rankId) as PlayerRankId;
  const displayHistory =
    backendHistory !== null ? backendHistory : progress.sessionHistory;
  const displayProgress = {
    ...progress,
    totalXP: displayXP,
    rankId: displayRankId,
    sessionHistory: displayHistory,
  };

  const currentRank =
    PLAYER_RANKS.find((r) => r.id === displayProgress.rankId) ??
    PLAYER_RANKS[0];
  const nextRank =
    PLAYER_RANKS.find((r) => r.minXP > currentRank.maxXP) ?? null;
  const xpProgress = getXPProgressInRank(displayProgress.totalXP);

  const unlockedCount = CHALLENGES.filter((c) =>
    isChallengeUnlocked(c.id, displayProgress.rankId),
  ).length;
  const totalCount = CHALLENGES.length;

  // Skill entries sorted for display (still read from localStorage — skills are accumulated there)
  const skillEntries = (
    Object.keys(progress.skills) as (keyof PlayerSkills)[]
  ).map((k) => ({ key: k, value: progress.skills[k] }));
  const strongestKey = [...skillEntries].sort((a, b) => b.value - a.value)[0]
    .key;

  return (
    <main
      className="relative min-h-screen bg-background text-foreground pb-24"
      data-ocid="stats.page"
    >
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[380px] h-[280px] rounded-full bg-accent/10 blur-[100px]" />
      </div>

      {/* Header */}
      <div className="sticky top-0 z-20 bg-card/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-3 px-4 py-4 max-w-md mx-auto">
          <button
            type="button"
            onClick={() => navigate({ to: "/" })}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent hover:border-border transition-smooth"
            aria-label="Back to home"
            data-ocid="stats.back_button"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold font-display text-foreground text-lg leading-tight">
              your stats
            </h1>
            <p className="text-xs text-muted-foreground">
              social game level-up
            </p>
          </div>
        </div>
      </div>

      <div className="relative z-10 px-4 py-5 max-w-md mx-auto flex flex-col gap-5">
        {/* ── 1. Profile Header ────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-card border border-border rounded-3xl p-5 flex flex-col items-center gap-4"
          data-ocid="stats.profile_card"
        >
          {/* Rank emoji with glow ring */}
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-5xl bg-accent/15 border border-accent/30 shadow-[0_0_32px_rgba(139,92,246,0.2)]">
              {currentRank.emoji}
            </div>
          </div>

          {/* Rank name + username */}
          <div className="flex flex-col items-center gap-1">
            {isAuthenticated && user?.username && (
              <p className="text-base font-bold font-display text-foreground">
                {user.username}
              </p>
            )}
            <span className="text-xl font-bold font-display bg-gradient-to-r from-accent to-accent/60 bg-clip-text text-transparent">
              {currentRank.name}
            </span>
            {/* Streak */}
            {progress.streak > 0 && (
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-400/10 border border-orange-400/30 text-orange-400 text-xs font-semibold"
                data-ocid="stats.streak_badge"
              >
                🔥 {progress.streak}-day streak
              </div>
            )}
          </div>

          {/* XP bar */}
          <div
            className="w-full flex flex-col gap-1.5"
            data-ocid="stats.xp_bar"
          >
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-muted-foreground font-medium">
                {isSyncing
                  ? "syncing…"
                  : `${xpProgress.current} / ${xpProgress.total === 9999 ? "MAX" : xpProgress.total} XP`}
              </span>
              {nextRank ? (
                <span className="text-[11px] text-muted-foreground">
                  {nextRank.minXP - progress.totalXP} to {nextRank.name}
                </span>
              ) : (
                <span className="text-[11px] text-accent font-semibold">
                  Max Rank 👑
                </span>
              )}
            </div>
            <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${xpProgress.percentage}%` }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                className="h-full rounded-full bg-gradient-to-r from-accent/70 to-accent"
              />
            </div>
          </div>
        </motion.div>

        {/* ── 2. Lifetime Stats Cards ──────────────────────────────────────── */}
        <div>
          <SectionHeader label="lifetime stats" />
          <div className="flex gap-2.5" data-ocid="stats.lifetime_cards">
            <StatCard value={stats.totalSessions} label="Sessions" index={0} />
            <StatCard
              value={stats.avgScore || "—"}
              label="Avg Score"
              index={1}
            />
            <StatCard
              value={stats.bestScoreEver || "—"}
              label="Best Score"
              index={2}
            />
          </div>
        </div>

        {/* ── 3. Player Identity Badge ─────────────────────────────────────── */}
        {stats.totalSessions > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="flex items-center justify-between bg-gradient-to-r from-accent/10 via-card to-card border border-accent/25 rounded-2xl px-5 py-4"
            data-ocid="stats.playstyle_badge"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                playstyle
              </span>
              <span className="text-lg font-bold font-display text-foreground">
                {stats.playstyleLabel}
              </span>
            </div>
            <div className="text-3xl">🎭</div>
          </motion.div>
        )}

        {/* ── 4. Skill Breakdown ───────────────────────────────────────────── */}
        <div>
          <SectionHeader label="skills" />
          <div
            className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-4"
            data-ocid="stats.skills_panel"
          >
            {skillEntries.map((entry, i) => (
              <SkillBar
                key={entry.key}
                skillKey={entry.key}
                value={entry.value}
                isStrongest={entry.key === strongestKey}
                index={i}
              />
            ))}
            {stats.totalSessions > 0 && (
              <div className="pt-1 border-t border-border/50 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  weakest
                </span>
                <span className="text-xs text-muted-foreground">
                  {stats.weakestSkill}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── 5. Challenge Unlock Progress ─────────────────────────────────── */}
        <div>
          <SectionHeader label="challenges" />
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.3 }}
            className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3"
            data-ocid="stats.challenges_panel"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground font-display">
                {unlockedCount} / {totalCount} Unlocked
              </span>
              <span className="text-xs text-muted-foreground">
                {totalCount - unlockedCount} locked
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(unlockedCount / totalCount) * 100}%` }}
                transition={{ duration: 0.7, delay: 0.35, ease: "easeOut" }}
                className="h-full rounded-full bg-gradient-to-r from-green-400/70 to-green-400"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {CHALLENGES.map((c) => {
                const unlocked = isChallengeUnlocked(c.id, progress.rankId);
                return (
                  <span
                    key={c.id}
                    className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border transition-smooth ${
                      unlocked
                        ? "bg-card text-foreground border-border"
                        : "bg-muted/40 text-muted-foreground/50 border-border/30"
                    }`}
                  >
                    <span className={unlocked ? "" : "grayscale opacity-50"}>
                      {c.emoji}
                    </span>
                    {c.name}
                  </span>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* ── 6. Session History ───────────────────────────────────────────── */}
        <div>
          <SectionHeader label="recent runs" />
          {displayHistory.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center gap-2"
              data-ocid="stats.history_empty_state"
            >
              <span className="text-4xl">🎮</span>
              <p className="text-sm font-semibold text-foreground">
                No sessions yet
              </p>
              <p className="text-xs text-muted-foreground text-center">
                Complete a challenge to start building your history
              </p>
            </motion.div>
          ) : (
            <div
              className="bg-card border border-border rounded-2xl px-4 overflow-hidden"
              data-ocid="stats.history_list"
            >
              {displayHistory.map((entry, i) => (
                <HistoryEntry key={entry.id} entry={entry} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────
function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}
