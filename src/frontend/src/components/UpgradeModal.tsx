import type { UpgradeModalTrigger } from "@/types";
/**
 * UpgradeModal — soft paywall modal shown when a Free user hits a plan limit.
 *
 * Intent: feel tempting and immersive — NOT locked/disabled.
 * The user should think "I want more", not "this feature is off".
 *
 * Clicking "Upgrade to Pro" creates a Whop checkout session and redirects.
 */
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

interface Props {
  isOpen: boolean;
  trigger?: UpgradeModalTrigger | null;
  onClose: () => void;
  userId?: string;
  userEmail?: string;
}

const TRIGGER_COPY: Record<
  UpgradeModalTrigger,
  { headline: string; sub: string }
> = {
  ranked_sessions: {
    headline: "You've used your free ranked sessions for today.",
    sub: "Upgrade to keep training — or come back tomorrow.",
  },
  rizz_assist: {
    headline: "Your assists ran out 😏",
    sub: "Go Pro and get unlimited Rizz Assist in every session.",
  },
  hints: {
    headline: "No more hints for now 💡",
    sub: "Rizz Pro unlocks unlimited hints so you never fly blind.",
  },
};

export function UpgradeModal({ isOpen, trigger, onClose, userId, userEmail }: Props) {
  const copy = trigger ? TRIGGER_COPY[trigger] : null;
  const [loading, setLoading] = useState(false);

  async function handleUpgrade() {
    if (!userId || !userEmail) return;
    setLoading(true);
    try {
      const res = await fetch("/api/app/whop-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email: userEmail }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("[UpgradeModal] Checkout error:", data.error);
      }
    } catch (err) {
      console.error("[UpgradeModal] Checkout failed:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-5"
          data-ocid="upgrade_modal.dialog"
          aria-modal="true"
          aria-labelledby="upgrade-modal-title"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Card */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 8 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="relative z-10 w-full max-w-sm rounded-3xl overflow-hidden"
          >
            {/* Gradient top accent bar */}
            <div className="h-1.5 w-full bg-gradient-to-r from-[oklch(0.7_0.22_280)] via-[oklch(0.65_0.26_310)] to-[oklch(0.72_0.28_340)]" />

            <div className="bg-[oklch(0.14_0.02_280)] border border-[oklch(0.25_0.05_280)]/60 rounded-b-3xl px-6 pt-6 pb-7 flex flex-col gap-5">
              {/* Header */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">🔥</span>
                  <span
                    id="upgrade-modal-title"
                    className="text-lg font-display font-bold text-white leading-snug"
                  >
                    Unlock Rizz Pro
                  </span>
                </div>

                {copy ? (
                  <>
                    <p className="text-sm font-semibold text-[oklch(0.88_0.08_280)]">
                      {copy.headline}
                    </p>
                    <p className="text-xs text-[oklch(0.55_0.05_280)] leading-relaxed">
                      {copy.sub}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-[oklch(0.65_0.06_280)] leading-relaxed">
                    Get unlimited sessions, assists, and hints.
                  </p>
                )}
              </div>

              {/* Benefits list */}
              <ul className="flex flex-col gap-1.5">
                {[
                  "Unlimited ranked sessions",
                  "Unlimited Rizz Assist",
                  "Unlimited hints",
                  "Harder challenge modes",
                  "Future elite characters",
                ].map((b) => (
                  <li
                    key={b}
                    className="flex items-center gap-2 text-xs text-[oklch(0.72_0.06_280)]"
                  >
                    <span className="w-4 h-4 rounded-full bg-[oklch(0.65_0.22_280)]/20 border border-[oklch(0.65_0.22_280)]/30 flex items-center justify-center text-[oklch(0.72_0.16_280)] text-[9px]">
                      ✓
                    </span>
                    {b}
                  </li>
                ))}
              </ul>

              {/* Price pill */}
              <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-2xl bg-[oklch(0.65_0.22_280)]/10 border border-[oklch(0.65_0.22_280)]/20">
                <span className="text-base font-display font-bold text-[oklch(0.72_0.16_280)]">
                  $9.99
                </span>
                <span className="text-xs text-[oklch(0.5_0.05_280)]">
                  /month
                </span>
              </div>

              {/* CTA buttons */}
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  data-ocid="upgrade_modal.cta_button"
                  className="w-full h-12 rounded-2xl bg-gradient-to-r from-[oklch(0.65_0.22_280)] to-[oklch(0.6_0.26_310)] text-white font-display font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60"
                  onClick={handleUpgrade}
                  disabled={loading || !userId}
                >
                  {loading ? (
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  ) : (
                    "🔥 Upgrade to Pro"
                  )}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  data-ocid="upgrade_modal.close_button"
                  className="w-full h-10 rounded-xl text-[oklch(0.5_0.05_280)] text-xs font-medium hover:text-[oklch(0.7_0.06_280)] transition-colors"
                >
                  Not now
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
