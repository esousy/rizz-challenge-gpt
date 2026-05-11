import type { RizzAssistSuggestions } from "@/lib/rizz-assist";
import { Loader2, X } from "lucide-react";
import { useEffect } from "react";

interface Props {
  characterName: string;
  isOpen: boolean;
  suggestions: RizzAssistSuggestions | null;
  isLoadingAssist: boolean;
  onSelect: (text: string) => void;
  onClose: () => void;
}

const LABEL_META: Record<
  string,
  { color: string; emoji: string; description: string }
> = {
  playful: {
    color:
      "text-[oklch(0.78_0.18_280)] bg-[oklch(0.65_0.22_280)]/15 border-[oklch(0.65_0.22_280)]/30",
    emoji: "\uD83C\uDFAD",
    description: "Witty & teasing",
  },
  bold: {
    color:
      "text-[oklch(0.78_0.18_22)] bg-[oklch(0.65_0.19_22)]/15 border-[oklch(0.65_0.19_22)]/30",
    emoji: "\uD83D\uDE0F",
    description: "Direct & confident",
  },
  smooth: {
    color:
      "text-[oklch(0.78_0.18_142)] bg-[oklch(0.62_0.18_142)]/15 border-[oklch(0.62_0.18_142)]/30",
    emoji: "\u2728",
    description: "Understated tension",
  },
};

const LABEL_DEFAULT = {
  color:
    "text-[oklch(0.7_0_0)] bg-[oklch(0.3_0_0)]/60 border-[oklch(0.35_0_0)]/30",
  emoji: "\uD83D\uDCA1",
  description: "",
};

export function AssistModal({
  characterName,
  isOpen,
  suggestions,
  isLoadingAssist,
  onSelect,
  onClose,
}: Props) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const suggestionEntries: { label: string; text: string }[] = suggestions
    ? [
        { label: "playful", text: suggestions.playful },
        { label: "bold", text: suggestions.bold },
        { label: "smooth", text: suggestions.smooth },
      ]
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      data-ocid="assist_modal.dialog"
      aria-modal="true"
      aria-label="Rizz Assist suggestions"
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
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[oklch(0.35_0_0)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs text-[oklch(0.55_0_0)] uppercase tracking-widest font-semibold">
              \uD83D\uDD25 Rizz Assist
            </p>
            <p className="text-sm text-[oklch(0.85_0_0)] mt-0.5">
              What do you reply to{" "}
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
            aria-label="Close suggestions"
            data-ocid="assist_modal.close_button"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Loading state */}
        {isLoadingAssist && (
          <div
            className="flex flex-col items-center justify-center gap-3 px-4 pb-8 pt-4"
            data-ocid="assist_modal.loading_state"
          >
            <Loader2 className="w-6 h-6 text-[oklch(0.65_0.22_280)] animate-spin" />
            <p className="text-sm text-[oklch(0.55_0_0)] italic">
              Analyzing conversation\u2026
            </p>
          </div>
        )}

        {/* Suggestion cards */}
        {!isLoadingAssist && suggestionEntries.length > 0 && (
          <div className="flex flex-col gap-2.5 px-4 pb-6">
            {suggestionEntries.map((s, i) => {
              const meta = LABEL_META[s.label] ?? LABEL_DEFAULT;
              return (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => {
                    onSelect(s.text);
                    onClose();
                  }}
                  className="w-full text-left rounded-xl bg-[oklch(0.19_0.01_280)] border border-[oklch(0.28_0.03_280)]/60 px-4 py-3.5 active:scale-[0.98] hover:border-[oklch(0.45_0.12_280)]/50 hover:bg-[oklch(0.22_0.02_280)] transition-all duration-200"
                  data-ocid={`assist_modal.item.${i + 1}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        meta.color
                      }`}
                    >
                      {meta.emoji} {s.label}
                    </span>
                    {meta.description && (
                      <span className="text-[9px] text-[oklch(0.42_0_0)] uppercase tracking-wider">
                        {meta.description}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[oklch(0.88_0_0)] leading-relaxed">
                    {s.text}
                  </p>
                </button>
              );
            })}
          </div>
        )}

        {/* Error/empty state */}
        {!isLoadingAssist && suggestionEntries.length === 0 && (
          <div className="px-4 pb-6 pt-2 text-center">
            <p className="text-sm text-[oklch(0.45_0_0)]">
              Couldn't load suggestions. Try again.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
