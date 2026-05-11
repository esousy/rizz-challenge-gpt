import type { SessionPhase } from "@/types";
import { useEffect, useRef, useState } from "react";

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

const PHASE_LABELS: Record<SessionPhase, string> = {
  opening: "Opening",
  "build-chemistry": "Build Chemistry",
  escalation: "Escalation 🔥",
  "pressure-moment": "Pressure Moment ⚡",
  "final-outcome": "Final Outcome 👑",
};

interface Props {
  level?: string;
  round?: number;
  totalRounds?: number;
  interestLevel?: number;
  lastInterestDelta?: number | null;
  currentMood?: string;
  mockMode?: boolean;
  liveKeyActive?: boolean;
  sessionPhase?: SessionPhase;
  characterName?: string;
  characterAge?: number;
}

export function HeaderBar({
  level = "Level 1 – Easy",
  round = 1,
  totalRounds = 5,
  interestLevel = 50,
  lastInterestDelta = null,
  currentMood = "neutral",
  mockMode = false,
  liveKeyActive = false,
  sessionPhase,
  characterName = "Sofia",
  characterAge = 24,
}: Props) {
  const [barWidth, setBarWidth] = useState(interestLevel);
  const [deltaVisible, setDeltaVisible] = useState(false);
  const [phaseVisible, setPhaseVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPhaseRef = useRef<SessionPhase | undefined>(sessionPhase);

  useEffect(() => {
    setBarWidth(interestLevel);
  }, [interestLevel]);

  useEffect(() => {
    if (lastInterestDelta == null) return;
    setDeltaVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDeltaVisible(false), 2000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [lastInterestDelta]);

  // Fade-in when phase changes
  useEffect(() => {
    if (sessionPhase && sessionPhase !== prevPhaseRef.current) {
      prevPhaseRef.current = sessionPhase;
      setPhaseVisible(false);
      const t = setTimeout(() => setPhaseVisible(true), 50);
      return () => clearTimeout(t);
    }
    if (sessionPhase && !phaseVisible) {
      setPhaseVisible(true);
    }
  }, [sessionPhase, phaseVisible]);

  const interestText =
    interestLevel >= 70
      ? "text-[oklch(0.72_0.2_142)]"
      : interestLevel >= 40
        ? "text-accent"
        : "text-destructive";

  const deltaPositive = (lastInterestDelta ?? 0) >= 0;

  return (
    <header
      className="sticky top-0 z-10 bg-card border-b border-border shadow-sm"
      data-ocid="challenge.header"
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        {/* Left: Avatar + Name */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-full bg-gradient-to-br from-[oklch(0.65_0.22_280)] to-[oklch(0.62_0.26_330)] flex items-center justify-center flex-shrink-0 ring-2 ring-border"
            aria-hidden="true"
          >
            <span className="text-sm font-bold text-white">
              {characterName[0]}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-foreground font-display leading-tight">
              {characterName}, {characterAge}{" "}
              <span className="text-base" aria-label={`Mood: ${currentMood}`}>
                {MOOD_EMOJI[currentMood] ?? "😐"}
              </span>
            </span>
            <span className="text-[10px] text-muted-foreground leading-none">
              {level}
            </span>
          </div>
        </div>

        {/* Right: Round counter + Interest */}
        <div className="flex flex-col items-end gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-muted-foreground tracking-wide">
              Round <span className="text-foreground">{round}</span>/
              {totalRounds}
            </span>
            {mockMode ? (
              <span
                className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-muted text-muted-foreground/60 border border-border/60"
                title="Mock Mode — simulated AI responses"
              >
                MOCK
              </span>
            ) : liveKeyActive ? (
              <span
                className="flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                title="Live AI Mode — powered by OpenAI"
                data-ocid="challenge.live_mode_badge"
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
            ) : (
              <span
                className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/25"
                title="Live Mode — no API key configured"
                data-ocid="challenge.no_key_badge"
              >
                NO KEY
              </span>
            )}
          </div>
          {sessionPhase && (
            <span
              className={`text-[10px] text-muted-foreground/70 leading-none transition-opacity duration-300 ${
                phaseVisible ? "opacity-100" : "opacity-0"
              }`}
              data-ocid="challenge.session_phase"
            >
              {PHASE_LABELS[sessionPhase]}
            </span>
          )}
          <div className="flex items-center gap-1.5">
            <span className={`text-sm font-bold tabular-nums ${interestText}`}>
              {interestLevel}%
            </span>
            {deltaVisible && lastInterestDelta != null && (
              <span
                className={`text-[11px] font-bold animate-[fadeSlideIn_0.2s_ease-out] transition-opacity ${
                  deltaPositive
                    ? "text-[oklch(0.72_0.2_142)]"
                    : "text-destructive"
                }`}
                data-ocid="challenge.interest_delta"
              >
                {deltaPositive ? `+${lastInterestDelta}` : lastInterestDelta}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Interest progress bar */}
      <div className="h-1 bg-muted overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[oklch(0.65_0.22_280)] to-[oklch(0.62_0.26_330)] transition-all duration-700 ease-out"
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </header>
  );
}
