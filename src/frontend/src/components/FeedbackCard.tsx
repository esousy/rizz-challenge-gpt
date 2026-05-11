import { Button } from "@/components/ui/button";
import type { Message } from "@/types";
import { useEffect, useRef, useState } from "react";

interface Props {
  message: Message;
  onTryAgain: () => void;
  onShowBetter?: (improved: string) => void;
  onNext: () => void;
  show?: boolean;
}

function AnimatedScore({ target, color }: { target: number; color: string }) {
  const [displayed, setDisplayed] = useState(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const duration = 600;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      setDisplayed(Math.round(progress * target));
      if (progress < 1) frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target]);

  return (
    <span
      className={`text-6xl font-bold font-display tracking-tight ${color} animate-[countUp_0.4s_ease-out]`}
    >
      {displayed}
    </span>
  );
}

function AnimatedBar({ pct }: { pct: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), 80);
    return () => clearTimeout(t);
  }, [pct]);
  return (
    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-[oklch(0.65_0.22_280)] to-[oklch(0.58_0.24_310)] transition-all duration-700 ease-out"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export function FeedbackCard({
  message,
  onTryAgain,
  onNext,
  show = true,
}: Props) {
  if (message.role !== "ai" || message.score == null) return null;
  const { score, breakdown } = message;

  const scoreColor =
    (score ?? 0) >= 70
      ? "text-[oklch(0.72_0.2_142)]"
      : (score ?? 0) >= 50
        ? "text-[oklch(0.78_0.2_72)]"
        : "text-destructive";

  const metrics: {
    key: "confidence" | "humor" | "originality";
    label: string;
    emoji: string;
  }[] = [
    { key: "confidence", label: "Confidence", emoji: "💪" },
    { key: "humor", label: "Humor", emoji: "😄" },
    { key: "originality", label: "Originality", emoji: "✨" },
  ];

  return (
    <div
      className={`mx-4 mb-4 bg-card border border-border rounded-2xl p-5 shadow-xl transition-all duration-300 ease-out ${
        show
          ? "animate-[slideUp_0.3s_ease-out]"
          : "opacity-0 translate-y-4 pointer-events-none"
      }`}
      data-ocid="chat.feedback_card"
    >
      {/* Score headline */}
      <div className="text-center mb-5">
        <div className="flex items-baseline justify-center gap-1.5">
          <AnimatedScore target={score ?? 0} color={scoreColor} />
          <span className="text-xl font-bold text-muted-foreground">/100</span>
        </div>
        <p className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase mt-1 letter-spacing-wider">
          Rizz Score
        </p>
      </div>

      {/* Breakdown with animated progress bars */}
      {breakdown && (
        <div className="space-y-3 mb-4">
          {metrics.map(({ key, label, emoji }) => {
            const val = breakdown[key];
            const pct = Math.min(100, Math.max(0, val));
            return (
              <div key={key}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm font-medium text-foreground">
                    <span className="mr-1.5">{emoji}</span>
                    {label}
                  </span>
                  <span className="text-sm font-bold">
                    <span className="text-foreground">
                      {Math.round(pct / 10)}
                    </span>
                    <span className="text-muted-foreground text-xs">/10</span>
                  </span>
                </div>
                <AnimatedBar pct={pct} />
              </div>
            );
          })}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onTryAgain}
          className="text-muted-foreground hover:text-foreground text-xs"
          data-ocid="chat.try_again_button"
        >
          Try Again
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onNext}
          className="ml-auto text-xs bg-gradient-to-r from-[oklch(0.65_0.22_280)] to-[oklch(0.58_0.24_310)] text-white border-0 hover:opacity-90 transition-opacity shadow-sm"
          data-ocid="chat.next_button"
        >
          Next Round →
        </Button>
      </div>
    </div>
  );
}
