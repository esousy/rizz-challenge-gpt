import { PLAYER_RANKS } from "@/lib/challenges";
import type { PlayerRankId } from "@/types";
import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";

interface RankUpModalProps {
  isVisible: boolean;
  newRankId: PlayerRankId;
  newRankName: string;
  newRankEmoji: string;
  xpToNextRank: number;
  onDismiss: () => void;
}

export function RankUpModal({
  isVisible,
  newRankId,
  newRankName,
  newRankEmoji,
  xpToNextRank,
  onDismiss,
}: RankUpModalProps) {
  // Auto-dismiss after 3 seconds
  useEffect(() => {
    if (!isVisible) return;
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [isVisible, onDismiss]);

  const nextRankIndex = PLAYER_RANKS.findIndex((r) => r.id === newRankId) + 1;
  const nextRank =
    nextRankIndex < PLAYER_RANKS.length ? PLAYER_RANKS[nextRankIndex] : null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          data-ocid="rank_up_modal"
          className="fixed inset-0 z-50 flex items-center justify-center cursor-pointer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          onClick={onDismiss}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-background/90 backdrop-blur-md" />

          {/* Modal content */}
          <motion.div
            className="relative z-10 flex flex-col items-center gap-5 px-8 py-10 max-w-xs w-full mx-4 rounded-3xl bg-card border border-[oklch(0.78_0.18_60)]/30 shadow-[0_0_60px_rgba(0,0,0,0.6)]"
            initial={{ scale: 0.7, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: -12 }}
            transition={{
              type: "spring",
              stiffness: 280,
              damping: 20,
              delay: 0.05,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Glow ring */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-[oklch(0.78_0.18_60)]/10 to-transparent pointer-events-none" />
            <div
              className="absolute inset-0 rounded-3xl pointer-events-none"
              style={{
                boxShadow:
                  "0 0 80px 8px oklch(0.78 0.18 60 / 0.18), 0 0 30px 4px oklch(0.65 0.22 280 / 0.15)",
              }}
            />

            {/* Title */}
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[oklch(0.78_0.18_60)]">
              You ranked up!
            </p>

            {/* Animated rank emoji */}
            <motion.div
              className="relative flex items-center justify-center"
              animate={{
                filter: [
                  "drop-shadow(0 0 12px oklch(0.78 0.18 60 / 0.7))",
                  "drop-shadow(0 0 28px oklch(0.78 0.18 60 / 1))",
                  "drop-shadow(0 0 12px oklch(0.78 0.18 60 / 0.7))",
                ],
              }}
              transition={{
                duration: 1.4,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }}
            >
              <span
                className="text-8xl select-none leading-none"
                role="img"
                aria-label={newRankName}
              >
                {newRankEmoji}
              </span>
            </motion.div>

            {/* Rank name */}
            <div className="flex flex-col items-center gap-1">
              <h2 className="text-2xl font-bold font-display text-foreground tracking-tight">
                {newRankName}
              </h2>
              <p className="text-xs text-muted-foreground text-center leading-relaxed">
                A new tier of rizz awaits.
              </p>
            </div>

            {/* Next rank teaser */}
            {nextRank && (
              <div className="flex items-center gap-2 bg-muted/50 border border-border rounded-2xl px-4 py-2.5 w-full justify-center">
                <span className="text-base">{nextRank.emoji}</span>
                <div className="text-left">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
                    Next rank
                  </p>
                  <p className="text-xs font-semibold text-foreground">
                    {nextRank.name} · {xpToNextRank} XP away
                  </p>
                </div>
              </div>
            )}

            {/* Auto-dismiss hint */}
            <p
              className="text-[10px] text-muted-foreground/50"
              data-ocid="rank_up_modal.close_button"
            >
              Tap anywhere to continue
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
