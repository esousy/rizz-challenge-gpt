import { getOpenerSuggestions } from "@/lib/assistance-data";
import { X } from "lucide-react";
import { useEffect } from "react";

interface Props {
  characterName: string;
  challengeId: string;
  isOpen: boolean;
  onSelect: (text: string) => void;
  onClose: () => void;
}

const LABEL_COLORS: Record<string, string> = {
  playful:
    "text-[oklch(0.78_0.18_280)] bg-[oklch(0.65_0.22_280)]/15 border-[oklch(0.65_0.22_280)]/30",
  smooth:
    "text-[oklch(0.78_0.18_142)] bg-[oklch(0.62_0.18_142)]/15 border-[oklch(0.62_0.18_142)]/30",
  confident:
    "text-[oklch(0.82_0.19_84)] bg-[oklch(0.75_0.18_84)]/15 border-[oklch(0.75_0.18_84)]/30",
};

const LABEL_DEFAULT =
  "text-[oklch(0.7_0_0)] bg-[oklch(0.3_0_0)]/60 border-[oklch(0.35_0_0)]/30";

export function OpenerModal({
  characterName,
  challengeId,
  isOpen,
  onSelect,
  onClose,
}: Props) {
  const suggestions = getOpenerSuggestions(challengeId, characterName);

  // Dismiss on Escape
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
      className="fixed inset-0 z-50 flex items-end justify-center"
      data-ocid="opener_modal.dialog"
      aria-modal="true"
      aria-label="Choose an opener"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        style={{ backdropFilter: "blur(4px)" }}
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div className="relative w-full max-w-lg bg-[oklch(0.14_0_0)] rounded-t-2xl border border-[oklch(0.25_0.02_280)]/60 shadow-2xl pb-safe animate-[slideUp_0.28s_cubic-bezier(0.34,1.56,0.64,1)]">
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[oklch(0.35_0_0)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs text-[oklch(0.55_0_0)] uppercase tracking-widest font-semibold">
              ✨ Openers
            </p>
            <p className="text-sm text-[oklch(0.85_0_0)] mt-0.5">
              How do you start with{" "}
              <span className="text-[oklch(0.78_0.18_280)] font-semibold">
                {characterName}
              </span>
              ?
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[oklch(0.5_0_0)] hover:text-[oklch(0.75_0_0)] hover:bg-[oklch(0.22_0_0)] transition-colors"
            aria-label="Close openers"
            data-ocid="opener_modal.close_button"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Opener cards */}
        <div className="flex flex-col gap-2.5 px-4 pb-6">
          {suggestions.map((s, i) => (
            <button
              key={s.label}
              type="button"
              onClick={() => {
                onSelect(s.text);
                onClose();
              }}
              className="w-full text-left rounded-xl bg-[oklch(0.19_0.01_280)] border border-[oklch(0.28_0.03_280)]/60 px-4 py-3.5 active:scale-[0.98] hover:border-[oklch(0.45_0.12_280)]/50 hover:bg-[oklch(0.22_0.02_280)] transition-all duration-200"
              data-ocid={`opener_modal.item.${i + 1}`}
            >
              <span
                className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border mb-2 ${LABEL_COLORS[s.label] ?? LABEL_DEFAULT}`}
              >
                {s.label}
              </span>
              <p className="text-sm text-[oklch(0.88_0_0)] leading-relaxed">
                {s.text}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
