import { AuthModal } from "@/components/AuthModal";
import { ReturnPlayerBanner } from "@/components/ReturnPlayerBanner";
import { SaveProgressModal } from "@/components/SaveProgressModal";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useGuestMode } from "@/hooks/use-guest-mode";
import { usePlayerProgress } from "@/hooks/use-player-progress";
import {
  CHALLENGES,
  PLAYER_RANKS,
  getDailyChallengeId,
  getRankForXP,
  getXPProgressInRank,
} from "@/lib/challenges";
import { Link, useNavigate } from "@tanstack/react-router";
import { BarChart2, LogIn, Settings } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

export default function Home() {
  const navigate = useNavigate();
  const { progress } = usePlayerProgress();
  const { isAuthenticated } = useAuth();
  const {
    hasPassedAuthWall,
    setHasPassedAuthWall,
    guestSessionsCompleted,
    clearGuestSession,
  } = useGuestMode();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [authTab, setAuthTab] = useState<"signup" | "login">("signup");
  // Guest button only visible before first session starts
  const showGuestButton = !hasPassedAuthWall && guestSessionsCompleted === 0;
  const currentRank = getRankForXP(progress.totalXP);
  const xpProgress = getXPProgressInRank(progress.totalXP);
  const nextRank =
    PLAYER_RANKS.find((r) => r.minXP > currentRank.maxXP) ?? null;

  // Daily challenge teaser
  const dailyId = getDailyChallengeId();
  const dailyChallenge = CHALLENGES.find((c) => c.id === dailyId) ?? null;
  const todayISO = new Date().toISOString().split("T")[0];
  const isDailyDone = progress.dailyChallengeCompletedDate === todayISO;

  return (
    <main
      className="relative min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center overflow-hidden"
      data-ocid="home.page"
    >
      {/* Top-right controls: Stats + Settings */}
      <div className="absolute top-5 right-5 z-20 flex items-center gap-1.5">
        <Link
          to="/stats"
          className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-card/60 border border-transparent hover:border-border transition-smooth"
          aria-label="Stats"
          data-ocid="home.stats_link"
        >
          <BarChart2 size={18} />
        </Link>
        <Link
          to="/settings"
          className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-card/60 border border-transparent hover:border-border transition-smooth"
          aria-label="Settings"
          data-ocid="home.settings_link"
        >
          <Settings size={18} />
        </Link>
      </div>
      {/* Layered background glows */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Primary purple glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[480px] h-[480px] rounded-full bg-accent/20 blur-[120px]" />
        {/* Secondary smaller glow bottom */}
        <div className="absolute bottom-1/4 left-1/3 w-[280px] h-[280px] rounded-full bg-accent/10 blur-[80px]" />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(139,92,246,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.5) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        {/* Vignette edges */}
        <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />
      </div>

      <div className="relative z-10 max-w-sm w-full flex flex-col items-center gap-5">
        {/* Return player banner — only when authenticated */}
        {isAuthenticated && <ReturnPlayerBanner />}
        {/* Player identity chip when authenticated but no banner shown in some edge case */}
        {!isAuthenticated && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="flex items-center gap-2"
          >
            <button
              type="button"
              onClick={() => {
                setAuthTab("login");
                setShowAuthModal(true);
              }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              data-ocid="home.login_button"
            >
              <LogIn size={14} /> Log in
            </button>
            <span className="text-muted-foreground/40">•</span>
            <button
              type="button"
              onClick={() => {
                setAuthTab("signup");
                setShowAuthModal(true);
              }}
              className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 transition-colors font-semibold"
              data-ocid="home.signup_button"
            >
              Sign Up
            </button>
          </motion.div>
        )}
        {/* Emoji badge */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 20,
            delay: 0.1,
          }}
          className="relative"
        >
          <div className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl bg-accent/15 border border-accent/30 shadow-[0_0_40px_rgba(139,92,246,0.25)]">
            😈
          </div>
        </motion.div>

        {/* Rank badge + XP bar */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="flex flex-col items-center gap-2 w-full"
        >
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-card/70 border border-accent/30 text-xs font-semibold font-display text-foreground backdrop-blur-sm"
            data-ocid="home.rank_badge"
          >
            <span>{currentRank.emoji}</span>
            <span>{currentRank.name}</span>
          </div>
          {/* XP progress bar */}
          <div
            className="w-40 flex flex-col items-center gap-1"
            data-ocid="home.xp_bar"
          >
            <div className="w-full h-1.5 rounded-full bg-card/60 border border-border overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent/70 to-accent transition-all duration-700"
                style={{ width: `${xpProgress.percentage}%` }}
              />
            </div>
            <span
              className="text-muted-foreground"
              style={{ fontSize: "10px" }}
            >
              {progress.totalXP} XP
              {nextRank
                ? ` · ${nextRank.minXP - progress.totalXP} to ${nextRank.name}`
                : " · Max Rank"}
            </span>
          </div>
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="flex flex-col gap-2"
        >
          <h1 className="text-4xl font-bold font-display text-foreground leading-tight tracking-tight">
            Rizz Me If You Can <span className="sr-only">😈</span>
          </h1>
          {/* Accent underline rule */}
          <div className="mx-auto h-1 w-16 rounded-full bg-accent/70" />
        </motion.div>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="text-muted-foreground text-base leading-relaxed max-w-[260px]"
        >
          Most guys fail this test… will you?
        </motion.p>

        {/* Stats pills + streak */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.45 }}
          className="flex flex-wrap justify-center gap-2 text-xs"
        >
          {[
            { label: "Levels", value: "10+" },
            { label: "Avg Score", value: "62/100" },
            { label: "Players", value: "24K" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col items-center gap-0.5 bg-card/60 border border-border rounded-xl px-3 py-2 backdrop-blur-sm"
            >
              <span className="font-bold font-display text-foreground text-sm">
                {stat.value}
              </span>
              <span
                className="text-muted-foreground"
                style={{ fontSize: "10px" }}
              >
                {stat.label}
              </span>
            </div>
          ))}
          {/* Streak pill */}
          <div
            className="flex flex-col items-center gap-0.5 bg-card/60 border border-border rounded-xl px-3 py-2 backdrop-blur-sm"
            data-ocid="home.streak_pill"
          >
            {progress.streak >= 2 ? (
              <>
                <span className="font-bold font-display text-orange-400 text-sm">
                  🔥 {progress.streak}
                </span>
                <span
                  className="text-muted-foreground"
                  style={{ fontSize: "10px" }}
                >
                  Day Streak
                </span>
              </>
            ) : (
              <>
                <span className="font-bold font-display text-muted-foreground text-sm">
                  🎮
                </span>
                <span
                  className="text-muted-foreground"
                  style={{ fontSize: "10px" }}
                >
                  Start Streak!
                </span>
              </>
            )}
          </div>
        </motion.div>

        {/* Daily challenge teaser */}
        {dailyChallenge && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            onClick={() => navigate({ to: "/challenges" })}
            className="w-full text-left rounded-2xl border border-yellow-400/35 bg-yellow-400/5 hover:bg-yellow-400/10 hover:border-yellow-400/60 transition-all duration-200 active:scale-[0.98] px-4 py-3 flex items-center gap-3"
            data-ocid="home.daily_challenge_teaser"
          >
            <div className="w-10 h-10 rounded-xl bg-yellow-400/15 border border-yellow-400/30 flex items-center justify-center text-xl flex-shrink-0">
              {dailyChallenge.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-yellow-400/80 leading-none mb-0.5">
                Daily Challenge
              </p>
              <p className="text-sm font-semibold text-foreground truncate">
                {dailyChallenge.name}
              </p>
            </div>
            <div className="flex-shrink-0 text-right">
              {isDailyDone ? (
                <span className="text-[10px] font-bold bg-muted/60 text-muted-foreground border border-border rounded-full px-2 py-0.5">
                  DONE
                </span>
              ) : (
                <span className="text-[10px] font-bold bg-yellow-400/20 text-yellow-400 border border-yellow-400/40 rounded-full px-2 py-1 whitespace-nowrap">
                  +25 XP Bonus
                </span>
              )}
            </div>
          </motion.button>
        )}

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.6 }}
          className="w-full flex flex-col items-center gap-3 mt-1"
        >
          <Button
            size="lg"
            className="w-full text-base font-semibold h-14 rounded-2xl shadow-[0_0_24px_rgba(139,92,246,0.35)] hover:shadow-[0_0_36px_rgba(139,92,246,0.5)] transition-smooth"
            onClick={() => {
              if (!isAuthenticated && guestSessionsCompleted >= 1) {
                setShowSaveModal(true);
              } else {
                navigate({ to: "/challenges" });
              }
            }}
            data-ocid="home.start_button"
          >
            🎯 Start Challenge
          </Button>

          {showGuestButton && (
            <button
              type="button"
              onClick={() => setHasPassedAuthWall(true)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 underline-offset-4 hover:underline py-1"
              data-ocid="home.customize_button"
            >
              Continue as Guest
            </button>
          )}
        </motion.div>
      </div>

      {/* Bottom tagline */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.75 }}
        className="absolute bottom-8 text-xs text-muted-foreground/50 tracking-widest uppercase font-display"
      >
        Train your rizz. Level up. 🔥
      </motion.p>

      {/* Attribution */}
      <p className="absolute bottom-2 text-xs text-muted-foreground/30">
        Powered by Caffeine
      </p>

      {/* Guest session wall modal */}
      <SaveProgressModal
        isVisible={showSaveModal}
        outcomeType="almost-there"
        outcomeEmoji="🏆"
        outcomeName="Free Session Used"
        finalInterest={50}
        xpEarned={0}
        finalMood="neutral"
        onDismiss={() => setShowSaveModal(false)}
        onAuthSuccess={() => {
          clearGuestSession();
          setShowSaveModal(false);
          navigate({ to: "/challenges" });
        }}
      />
      {/* Native auth modal */}
      <AuthModal
        isVisible={showAuthModal}
        initialTab={authTab}
        onDismiss={() => setShowAuthModal(false)}
      />
    </main>
  );
}
