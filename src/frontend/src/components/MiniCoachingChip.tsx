import { useCallback, useEffect, useRef, useState } from "react";

export type FeedbackCategory = "positive" | "neutral" | "negative";
export type Momentum = "negative" | "neutral" | "positive";

export type CoachTone = "positive" | "neutral" | "negative";

interface Props {
  interestChange: number;
  coachHint: string;
  feedbackCategory?: FeedbackCategory;
  momentum?: Momentum;
  /** Explicitly provided tone from AI/mock response; overrides feedbackCategory when set */
  coachTone?: CoachTone;
  onDismiss: () => void;
}

/** Extract first emoji + 1–2 word label from a hint string.
 *  e.g. "🔥 Momentum building." → "🔥 Momentum" */
function extractMiniLabel(hint: string): string {
  const emojiMatch = hint.match(
    /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)\s*/u,
  );
  const emoji = emojiMatch ? emojiMatch[0].trim() : "";
  const rest = hint.replace(
    /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)\s*/u,
    "",
  );
  const words = rest
    .replace(/[.!?,]+$/, "")
    .split(/\s+/)
    .slice(0, 2)
    .join(" ");
  return emoji ? `${emoji} ${words}` : words;
}

export function MiniCoachingChip({
  interestChange,
  coachHint,
  feedbackCategory = "neutral",
  momentum: _momentum = "neutral",
  coachTone,
  onDismiss,
}: Props) {
  // coachTone takes priority over feedbackCategory when explicitly provided
  const resolvedCategory: FeedbackCategory = coachTone ?? feedbackCategory;
  const [phase, setPhase] = useState<
    "full" | "minimizing" | "mini" | "dismissed"
  >("full");
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  // Display durations by resolved category
  const fullDuration =
    resolvedCategory === "positive"
      ? 3500
      : resolvedCategory === "negative"
        ? 4500
        : 3000;

  useEffect(() => {
    clearTimers();
    timersRef.current.push(
      setTimeout(() => {
        setPhase("minimizing");
        timersRef.current.push(setTimeout(() => setPhase("mini"), 300));
      }, fullDuration),
    );
    return clearTimers;
  }, [clearTimers, fullDuration]);

  const handleDismiss = () => {
    clearTimers();
    setPhase("dismissed");
    setTimeout(onDismiss, 300);
  };

  if (phase === "dismissed") return null;

  const isPositive = interestChange >= 0;
  const sign = isPositive ? "+" : "";
  const arrow = isPositive ? "↑" : "↓";

  // Category color classes
  const colorMap: Record<FeedbackCategory, { full: string; mini: string }> = {
    positive: {
      full: "bg-[oklch(0.65_0.22_280)]/15 border-[oklch(0.65_0.22_280)]/30 text-[oklch(0.78_0.18_280)]",
      mini: "bg-[oklch(0.65_0.22_280)]/20 border-[oklch(0.65_0.22_280)]/40 text-[oklch(0.78_0.18_280)]",
    },
    neutral: {
      full: "bg-[oklch(0.35_0_0)]/60 border-[oklch(0.4_0_0)]/40 text-[oklch(0.62_0_0)]",
      mini: "bg-[oklch(0.3_0_0)]/80 border-[oklch(0.38_0_0)]/50 text-[oklch(0.58_0_0)]",
    },
    negative: {
      full: "bg-[oklch(0.65_0.19_22)]/15 border-[oklch(0.65_0.19_22)]/30 text-[oklch(0.72_0.18_22)]",
      mini: "bg-[oklch(0.65_0.19_22)]/20 border-[oklch(0.65_0.19_22)]/40 text-[oklch(0.72_0.18_22)]",
    },
  };

  const colors = colorMap[resolvedCategory];
  const miniLabel = coachHint
    ? extractMiniLabel(coachHint)
    : `${sign}${interestChange}`;

  // MINIMIZED chip — fixed bottom-right corner
  if (phase === "mini") {
    return (
      <div
        className={`fixed bottom-24 right-4 z-50 flex items-center gap-1.5 h-7 px-3 rounded-full border shadow-lg animate-[fadeSlideIn_0.25s_ease-out] ${colors.mini}`}
        style={{ backdropFilter: "blur(8px)" }}
        data-ocid="chat.coaching_chip_mini"
        aria-live="polite"
      >
        <span className="text-xs font-semibold">{miniLabel}</span>
        <button
          type="button"
          onClick={handleDismiss}
          className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity leading-none text-[11px] font-bold"
          aria-label="Dismiss feedback"
          data-ocid="chat.coaching_chip_dismiss"
        >
          ×
        </button>
      </div>
    );
  }

  // FULL chip (phase === "full" or "minimizing")
  const isMinimizing = phase === "minimizing";

  return (
    <div
      className={`mx-4 mb-3 flex items-start gap-2 transition-all duration-300 ease-in-out origin-bottom-left ${
        isMinimizing
          ? "opacity-0 scale-90 translate-y-1 pointer-events-none"
          : "opacity-100 scale-100 translate-y-0"
      }`}
      data-ocid="chat.coaching_chip"
      aria-live="polite"
    >
      <span
        className={`inline-flex flex-col gap-0.5 px-3 py-2 rounded-2xl border text-[11px] tracking-wide animate-[slideUp_0.3s_cubic-bezier(0.34,1.56,0.64,1)] ${
          resolvedCategory === "positive"
            ? "animate-[slideUp_0.3s_cubic-bezier(0.34,1.56,0.64,1),subtleGlow_2s_ease-in-out_infinite_alternate]"
            : resolvedCategory === "negative"
              ? "animate-[slideUp_0.3s_cubic-bezier(0.34,1.56,0.64,1),chipPulse_1.8s_ease-in-out_infinite]"
              : "animate-[slideUp_0.3s_cubic-bezier(0.34,1.56,0.64,1)]"
        } ${colors.full}`}
      >
        {/* Main hint */}
        {coachHint && (
          <span className="font-semibold leading-snug">{coachHint}</span>
        )}
        {/* Interest delta — smaller below hint */}
        <span
          className={`tabular-nums text-[10px] font-bold opacity-70 ${
            isPositive
              ? "text-[oklch(0.72_0.2_142)]"
              : "text-[oklch(0.72_0.18_22)]"
          }`}
        >
          {sign}
          {interestChange} {arrow}
        </span>
      </span>
    </div>
  );
}
