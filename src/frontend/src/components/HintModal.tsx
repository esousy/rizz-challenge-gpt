import { useEffect, useRef } from "react";

interface Props {
  hint: string;
  isOpen: boolean;
  onClose: () => void;
}

export function HintModal({ hint, isOpen, onClose }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss after 4 s
  useEffect(() => {
    if (!isOpen) return;
    timerRef.current = setTimeout(onClose, 4_000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isOpen, onClose]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      data-ocid="hint_modal.dialog"
      aria-modal="true"
      aria-live="assertive"
      aria-label="Tactical hint"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        style={{ backdropFilter: "blur(6px)" }}
        aria-hidden="true"
      />

      {/* Card */}
      <div
        className="relative w-full max-w-sm rounded-2xl border border-[oklch(0.55_0.18_220)]/40 bg-[oklch(0.13_0.03_220)] shadow-2xl px-6 py-8 text-center animate-[fadeSlideIn_0.25s_ease-out]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Icon + label */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="text-xl">💡</span>
          <span className="text-xs font-bold uppercase tracking-widest text-[oklch(0.65_0.16_220)]">
            Tactical Hint
          </span>
        </div>

        {/* Hint text */}
        <p className="text-[oklch(0.9_0.02_220)] text-lg font-semibold leading-snug">
          {hint}
        </p>

        {/* Tap to dismiss label */}
        <p className="mt-5 text-xs text-[oklch(0.45_0_0)] tracking-wide">
          Tap anywhere to dismiss
        </p>

        {/* Progress bar (4 s auto-dismiss) */}
        <div className="mt-4 h-0.5 w-full rounded-full bg-[oklch(0.25_0_0)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[oklch(0.65_0.16_220)]/70"
            style={{
              animation: "barGrow 4s linear reverse",
              width: "100%",
              transformOrigin: "left",
            }}
          />
        </div>
      </div>
    </div>
  );
}
