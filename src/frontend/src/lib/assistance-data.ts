/**
 * assistance-data.ts
 *
 * Pure helper functions for the tactical assistance system.
 * No API calls — all data is context-aware but static/template-driven.
 */
import type { Message } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AssistSuggestion {
  label: string;
  text: string;
}

// ── Opener Suggestions ────────────────────────────────────────────────────────

/**
 * Hardcoded but character-aware opener sets.
 * Each set has exactly 3 suggestions: playful, smooth, confident.
 */
const OPENER_SETS: Record<string, AssistSuggestion[]> = {
  "easy-flirt": [
    {
      label: "playful",
      text: "Okay random question — what's your go-to weekend plan? 😏",
    },
    {
      label: "smooth",
      text: "You seem like you'd have interesting taste in music 🎵",
    },
    {
      label: "confident",
      text: "Hey, how are you settling into things lately?",
    },
  ],
  "dry-texter": [
    {
      label: "playful",
      text: "I feel like you reply in haikus. Prove me wrong.",
    },
    {
      label: "smooth",
      text: "Hey. Been thinking about reaching out for a while, figured why not.",
    },
    {
      label: "confident",
      text: "What's actually been keeping you busy lately?",
    },
  ],
  "mixed-signals": [
    {
      label: "playful",
      text: "Okay I'm officially confused by you and I kind of love it 😏",
    },
    {
      label: "smooth",
      text: "You seem like someone who keeps people guessing on purpose.",
    },
    { label: "confident", text: "I'm curious what actually keeps you busy." },
  ],
  "cold-start": [
    {
      label: "playful",
      text: "So I finally worked up the nerve to text first. You're welcome 😄",
    },
    {
      label: "smooth",
      text: "Hey — figured I'd take a shot. Not my style to wait forever.",
    },
    {
      label: "confident",
      text: "What's something you're actually passionate about? No generic answers.",
    },
  ],
  "high-standards": [
    {
      label: "playful",
      text: "You seem like someone who doesn't text back fast 😏",
    },
    { label: "smooth", text: "I'm curious what actually keeps you busy." },
    {
      label: "confident",
      text: "What's something you're genuinely passionate about?",
    },
  ],
  "recover-fumble": [
    {
      label: "playful",
      text: "Okay, I know I fumbled. Hard to argue with the evidence 😬",
    },
    {
      label: "smooth",
      text: "I've been thinking about what I should've said. Can I try again?",
    },
    {
      label: "confident",
      text: "Still here. Still willing to actually try this time.",
    },
  ],
  "re-engage-ghosted": [
    { label: "playful", text: "Okay I low-key owe you a text 😬" },
    {
      label: "smooth",
      text: "We never finished that conversation. Still thinking about it.",
    },
    {
      label: "confident",
      text: "Hey, life got crazy — but I thought about reaching out for weeks.",
    },
  ],
};

/** Fallback openers for unknown challenge IDs */
const FALLBACK_OPENERS: AssistSuggestion[] = [
  {
    label: "playful",
    text: "Not gonna lie, I've been thinking about what to say for a while 😏",
  },
  { label: "smooth", text: "Hey — figured I'd just go for it." },
  { label: "confident", text: "What's been keeping you busy lately?" },
];

export function getOpenerSuggestions(
  challengeId: string,
  _characterName: string,
): AssistSuggestion[] {
  return OPENER_SETS[challengeId] ?? FALLBACK_OPENERS;
}

// ── Contextual Hints ──────────────────────────────────────────────────────────

type HintPool = readonly string[];

const HINTS_EARLY_LOW_INTEREST: HintPool = [
  "Too direct too early — build curiosity first.",
  "She's barely warmed up. Slow the pace.",
  "Let the conversation breathe before pushing.",
  "Focus on intrigue, not persuasion.",
];

const HINTS_EARLY_NEUTRAL: HintPool = [
  "Tease a little — give her something to react to.",
  "She's neutral. Ask something genuinely interesting.",
  "Don't over-explain. Say less, mean more.",
  "Match her energy, then slowly raise it.",
];

const HINTS_MID_BUILDING: HintPool = [
  "Good momentum — keep it playful, don't get serious yet.",
  "She's responding. Now add some tension.",
  "Don't rush to the next level. Let it simmer.",
  "You've got her attention — don't over-invest now.",
];

const HINTS_MID_COLD: HintPool = [
  "She's testing confidence. Don't chase — stay grounded.",
  "Pull back slightly. Stop working so hard.",
  "Reframe — make her curious about you instead.",
  "Go indirect. Direct pressure isn't landing.",
];

const HINTS_LATE_HIGH: HintPool = [
  "High interest — keep the playful tension alive.",
  "Don't over-explain now. One strong line > three okay ones.",
  "She wants to feel the pull. Hold steady.",
  "Stay present. Don't get ahead of yourself.",
];

const HINTS_LATE_TESTING: HintPool = [
  "She's still testing. Don't flinch.",
  "Slow down and tease more — don't chase approval.",
  "Build tension first before going direct.",
  "Calibrate: she wants challenge, not conversation.",
];

const HINTS_RECOVERY: HintPool = [
  "Recover with humor, not over-explaining.",
  "Acknowledge the awkward — then pivot cleanly.",
  "Less apologizing, more redirecting.",
  "One smooth line is worth five explanations.",
];

function pickHint(pool: HintPool, seed: number): string {
  return pool[Math.abs(seed) % pool.length];
}

export function getContextualHint(
  interestLevel: number,
  currentMood: string,
  roundNumber: number,
  messageCount: number,
): string {
  const seed = roundNumber * 7 + messageCount * 3;
  const isEarly = roundNumber <= 2;
  const isLate = roundNumber >= 4;
  const isCold =
    currentMood === "cold" || currentMood === "distant" || interestLevel < 25;
  const isHigh = interestLevel >= 65;
  const isTesting = currentMood === "testing" || currentMood === "skeptical";
  const isRecovering = interestLevel < 20;

  if (isRecovering) return pickHint(HINTS_RECOVERY, seed);
  if (isLate && isHigh) return pickHint(HINTS_LATE_HIGH, seed);
  if (isLate && isTesting) return pickHint(HINTS_LATE_TESTING, seed);
  if (!isEarly && isCold) return pickHint(HINTS_MID_COLD, seed);
  if (!isEarly) return pickHint(HINTS_MID_BUILDING, seed);
  if (isEarly && isCold) return pickHint(HINTS_EARLY_LOW_INTEREST, seed);
  return pickHint(HINTS_EARLY_NEUTRAL, seed);
}

// ── Assist Suggestions ────────────────────────────────────────────────────────

function getAssistWarm(history: Message[]): AssistSuggestion[] {
  const lastAi = [...history].reverse().find((m) => m.role === "ai");
  const refText = lastAi ? ` after "${lastAi.content.slice(0, 40)}…"` : "";
  void refText; // used for future personalisation
  return [
    { label: "playful", text: "You're way more fun than I expected 😏" },
    {
      label: "bold",
      text: "Honestly, I think we both know where this is heading.",
    },
    { label: "smooth", text: "I'd be lying if I said I wasn't enjoying this." },
  ];
}

function getAssistNeutral(): AssistSuggestion[] {
  return [
    {
      label: "playful",
      text: "Okay you're making this way more interesting than I planned 😄",
    },
    {
      label: "bold",
      text: "I'll be direct — this conversation has my full attention.",
    },
    {
      label: "smooth",
      text: "There's something about the way you reply that keeps me curious.",
    },
  ];
}

function getAssistColdTesting(): AssistSuggestion[] {
  return [
    {
      label: "playful",
      text: "Are you always this mysterious or is this just for me? 😏",
    },
    { label: "bold", text: "I can handle whatever you throw at me." },
    { label: "smooth", text: "I get it — I'd make you work for it too." },
  ];
}

function getAssistRecovery(): AssistSuggestion[] {
  return [
    {
      label: "playful",
      text: "Okay fresh start — pretend I said something brilliant 😅",
    },
    {
      label: "bold",
      text: "I'm better than my last message. Let me prove it.",
    },
    {
      label: "smooth",
      text: "Sometimes the conversation needs a reset. I'll take that.",
    },
  ];
}

function getAssistHighTension(): AssistSuggestion[] {
  return [
    {
      label: "playful",
      text: "We've got something going here and you know it 😏",
    },
    { label: "bold", text: "Stop pretending you're not enjoying this." },
    { label: "smooth", text: "This kind of chemistry doesn't happen often." },
  ];
}

export function getAssistSuggestions(
  currentMood: string,
  interestLevel: number,
  conversationHistory: Message[],
): AssistSuggestion[] {
  if (interestLevel < 20) return getAssistRecovery();
  if (interestLevel >= 70) return getAssistHighTension();

  const mood = currentMood.toLowerCase();
  const isCold =
    mood === "cold" ||
    mood === "distant" ||
    mood === "skeptical" ||
    mood === "testing";
  const isWarm =
    mood === "warm" ||
    mood === "playful" ||
    mood === "flirty" ||
    mood === "excited";

  if (isWarm || interestLevel >= 55) return getAssistWarm(conversationHistory);
  if (isCold) return getAssistColdTesting();
  return getAssistNeutral();
}
