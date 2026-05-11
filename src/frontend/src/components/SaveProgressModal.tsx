import { AuthModal } from "@/components/AuthModal";
import { CheckCircle2, Lock } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

const HEADLINE_MAP: Record<string, string> = {
  "rizz-masterclass": "The conversation isn't over yet.",
  "strong-chemistry": "Save your progress to keep the vibe going.",
  "almost-there": "Claim your rank before continuing.",
  "fumbled-the-bag": "Don't lose this conversation.",
  "lost-her": "Don't lose this conversation.",
};

const SUBHEADLINE_MAP: Record<string, string> = {
  "keep-talking":
    "Sign up to continue the momentum — this conversation was just getting good.",
  resume: "Sign up to pick up right where you left off.",
  "try-again": "Sign up to keep practicing and watch your rank climb.",
  "next-challenge": "Claim your rank to unlock harder challenges.",
  default:
    "Your XP and session history disappear when you leave. Claim your player profile to save everything.",
};

const BENEFITS = [
  { icon: "⚡", text: "Save XP & Rank", available: true },
  { icon: "🔓", text: "Unlock Harder Challenges", available: true },
  { icon: "🔥", text: "Track Streaks", available: true },
  { icon: "📜", text: "Save Session History", available: true },
  { icon: "📅", text: "Daily Challenges", available: true },
  { icon: "🏆", text: "Compete on Leaderboards", available: false },
];

/** What the user was trying to do when they hit the signup gate */
export type PendingAction =
  | "keep-talking"
  | "resume"
  | "try-again"
  | "next-challenge";

interface SaveProgressModalProps {
  isVisible: boolean;
  outcomeType: string;
  outcomeEmoji: string;
  outcomeName: string;
  finalInterest: number;
  xpEarned: number;
  finalMood: string;
  onDismiss: () => void;
  /** What triggered the modal — used to customise copy and resume the action after auth. */
  pendingAction?: PendingAction;
  /** Called after successful signup/login so parent can execute the pending action. */
  onAuthSuccess?: (action?: PendingAction) => void;
  /**
   * Optional post-signup hook that receives the new session token.
   * When provided it is called BEFORE onAuthSuccess/onDismiss so the caller can
   * persist guest session data to the backend. Returning a Promise is supported —
   * the modal waits for it before closing.
   */
  onGuestSignupSuccess?: (token: string) => Promise<void>;
}

export function SaveProgressModal({
  isVisible,
  outcomeType,
  outcomeEmoji,
  outcomeName,
  finalInterest,
  xpEarned,
  finalMood,
  onDismiss,
  pendingAction,
  onAuthSuccess,
  onGuestSignupSuccess,
}: SaveProgressModalProps) {
  const [showAuthModal, setShowAuthModal] = useState(false);

  const headline =
    HEADLINE_MAP[outcomeType] ?? "Claim your rank before continuing.";
  const subheadline = pendingAction
    ? (SUBHEADLINE_MAP[pendingAction] ?? SUBHEADLINE_MAP.default)
    : SUBHEADLINE_MAP.default;

  const MOOD_EMOJI: Record<string, string> = {
    playful: "😏",
    curious: "🤔",
    flirty: "💕",
    bored: "😑",
    cold: "❤️",
    testing: "👀",
    engaged: "😊",
    neutral: "😐",
  };

  return (
    <>
      <AnimatePresence>
        {isVisible && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            data-ocid="save_progress.dialog"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-background/80 backdrop-blur-md"
              onClick={onDismiss}
              onKeyDown={(e) => e.key === "Escape" && onDismiss()}
              role="presentation"
            />

            {/* Modal panel */}
            <motion.div
              className="relative z-10 w-full sm:max-w-sm bg-card/70 backdrop-blur-xl border border-border rounded-t-3xl sm:rounded-2xl overflow-hidden"
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 28,
                delay: 0.05,
              }}
            >
              {/* Drag handle (mobile) */}
              <div className="flex justify-center pt-3 pb-1 sm:hidden">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>

              <div className="px-6 pt-2 pb-8 flex flex-col gap-5">
                {/* Session stat pills */}
                <div className="flex flex-wrap gap-2 mt-1">
                  <span className="text-xs bg-card border border-border rounded-full px-3 py-1.5 font-medium text-muted-foreground">
                    {outcomeEmoji} {outcomeName}
                  </span>
                  <span className="text-xs bg-card border border-border rounded-full px-3 py-1.5 font-medium text-muted-foreground">
                    🎯 {finalInterest}% Interest
                  </span>
                  <span className="text-xs bg-accent/15 border border-accent/40 rounded-full px-3 py-1.5 font-bold text-accent">
                    +{xpEarned} XP
                  </span>
                  <span className="text-xs bg-card border border-border rounded-full px-3 py-1.5 font-medium text-muted-foreground">
                    {MOOD_EMOJI[finalMood] ?? "😐"} {finalMood}
                  </span>
                </div>

                {/* Headline + sub */}
                <div className="flex flex-col gap-1.5">
                  <h2 className="text-2xl font-bold font-display text-foreground leading-tight">
                    {headline}
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {subheadline}
                  </p>
                </div>

                {/* Accent divider */}
                <div className="h-px w-full bg-gradient-to-r from-accent/40 via-accent/20 to-transparent" />

                {/* Benefits */}
                <ul
                  className="flex flex-col gap-2"
                  data-ocid="save_progress.benefits_list"
                >
                  {BENEFITS.map((b) => (
                    <li key={b.text} className="flex items-center gap-3">
                      {b.available ? (
                        <CheckCircle2
                          size={16}
                          className="text-green-400 flex-shrink-0"
                        />
                      ) : (
                        <Lock
                          size={14}
                          className="text-muted-foreground/50 flex-shrink-0"
                        />
                      )}
                      <span
                        className={`text-sm ${b.available ? "text-foreground" : "text-muted-foreground/50"}`}
                      >
                        {b.icon} {b.text}
                        {!b.available && (
                          <span className="ml-1.5 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/40">
                            soon
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTAs */}
                <div className="flex flex-col gap-3 mt-1">
                  <button
                    type="button"
                    onClick={() => setShowAuthModal(true)}
                    className="w-full h-12 text-base font-display font-semibold rounded-xl bg-primary text-primary-foreground shadow-[0_0_24px_rgba(139,92,246,0.3)] hover:shadow-[0_0_36px_rgba(139,92,246,0.5)] hover:opacity-90 transition-all duration-200"
                    data-ocid="save_progress.primary_button"
                  >
                    Claim Your Rank 🏆
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAuthModal(true)}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                    data-ocid="save_progress.login_button"
                  >
                    Already have an account?{" "}
                    <span className="text-accent font-semibold underline underline-offset-4">
                      Sign In
                    </span>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Native auth modal */}
      <AuthModal
        isVisible={showAuthModal}
        initialTab="signup"
        onDismiss={() => setShowAuthModal(false)}
        onSuccess={async () => {
          setShowAuthModal(false);
          // If the caller supplied an onGuestSignupSuccess hook, invoke it with
          // the token that was just stored by useAuth so it can persist the
          // guest session to the backend before we dismiss the whole modal.
          if (onGuestSignupSuccess) {
            try {
              const token = localStorage.getItem("rizz_session_token");
              if (token) {
                await onGuestSignupSuccess(token);
              }
            } catch {
              // Non-critical — proceed even if the session save fails
            }
          }
          onDismiss();
          // Pass the pending action back so parent can execute it immediately after auth
          onAuthSuccess?.(pendingAction);
        }}
      />
    </>
  );
}
