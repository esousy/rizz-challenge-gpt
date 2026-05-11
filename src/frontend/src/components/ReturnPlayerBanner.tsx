import { useAuth } from "@/hooks/use-auth";
import { usePlayerProgress } from "@/hooks/use-player-progress";
import { getRankForXP } from "@/lib/challenges";
import { motion } from "motion/react";

const OUTCOME_EMOJI: Record<string, string> = {
  "Rizz Masterclass": "👑",
  "Strong Chemistry": "🔥",
  "Almost There": "😏",
  "Fumbled the Bag": "💀",
  "Lost Her": "❄️",
};

export function ReturnPlayerBanner() {
  const { isAuthenticated, user } = useAuth();
  const { progress } = usePlayerProgress();

  if (!isAuthenticated || !user?.username) return null;
  const profile = user;

  const rank = getRankForXP(progress.totalXP);
  const lastSession = progress.sessionHistory[0] ?? null;
  const outcomeEmoji = lastSession
    ? (OUTCOME_EMOJI[lastSession.outcome] ?? "🎮")
    : null;

  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 280, damping: 24, delay: 0.1 }}
      className="w-full max-w-sm rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/10 via-card/80 to-card/60 backdrop-blur-sm px-4 py-3 flex items-center gap-3"
      data-ocid="home.return_banner"
    >
      {/* Rank avatar */}
      <div className="w-10 h-10 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center text-xl flex-shrink-0">
        {rank.emoji}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold font-display text-foreground truncate">
          🔥 Welcome back, {profile.username} • {rank.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[10px] font-semibold text-accent/80 uppercase tracking-wide">
            {rank.name}
          </span>
          {progress.streak >= 2 && (
            <span className="text-[10px] text-orange-400 font-semibold">
              {progress.streak} day streak 🔥
            </span>
          )}
          {lastSession && outcomeEmoji && (
            <span className="text-[10px] text-muted-foreground truncate">
              Last: {outcomeEmoji} {lastSession.outcome}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
