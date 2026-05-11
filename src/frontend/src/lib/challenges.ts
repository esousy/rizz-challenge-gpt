import type {
  ChallengeConfig,
  DifficultyTier,
  OutcomeArchetype,
  OutcomeType,
  PlayerProgress,
  PlayerRank,
  PlayerRankId,
  SessionAverages,
} from "@/types";

// ── Character profiles ─────────────────────────────────────────────────────────

export interface CharacterProfile {
  name: string;
  age: number;
  personality: string;
  conversation_style: string;
  difficulty_behavior: string;
  emoji_pattern: string;
  starting_mood: string;
}

export const CHARACTER_PROFILES: Record<string, CharacterProfile> = {
  "easy-flirt": {
    name: "Sofia",
    age: 24,
    personality: "warm, playful, naturally flirty, forgiving",
    conversation_style:
      "casual texting with occasional emojis, warm and inviting",
    difficulty_behavior:
      "forgiving of missteps, easy momentum gain, responds warmly to confidence",
    emoji_pattern: "occasional — 😏 🙈 ✨",
    starting_mood: "playful",
  },
  "dry-texter": {
    name: "Chloe",
    age: 22,
    personality:
      "low effort, distracted, hard to read emotionally, not cold but just... minimal",
    conversation_style:
      "extremely short replies, one or two words, rarely expressive",
    difficulty_behavior:
      "low engagement by default, requires sustained effort to unlock warmth",
    emoji_pattern: "almost never — maybe a rare 'lol'",
    starting_mood: "neutral",
  },
  "mixed-signals": {
    name: "Vanessa",
    age: 25,
    personality:
      "emotionally inconsistent, teasing, unpredictable, can be warm then suddenly distant",
    conversation_style:
      "fluctuating — playful then short, engaged then cold, hard to track",
    difficulty_behavior:
      "mood swings frequently, punishes over-eagerness, rewards staying cool",
    emoji_pattern: "context-dependent — lots when playful, nothing when cold",
    starting_mood: "curious",
  },
  "cold-start": {
    name: "Mia",
    age: 23,
    personality:
      "reserved, neutral, not unfriendly but genuinely low-energy at first",
    conversation_style:
      "polite but minimal, needs warming up before showing personality",
    difficulty_behavior:
      "very slow to engage, requires patient conversation-building",
    emoji_pattern: "rare — maybe a single emoji if genuinely amused",
    starting_mood: "neutral",
  },
  "high-standards": {
    name: "Isabella",
    age: 26,
    personality:
      "confident, polished, intelligent, high self-awareness, rejects generic flirting",
    conversation_style:
      "articulate, slightly challenging, rewards wit and originality",
    difficulty_behavior:
      "punishes clichés and generic confidence, rewards intelligence and originality",
    emoji_pattern: "minimal — uses sparingly for effect, never frivolously",
    starting_mood: "testing",
  },
  "recover-fumble": {
    name: "Natalie",
    age: 24,
    personality:
      "cautious, emotionally guarded after being let down, not hostile but protective",
    conversation_style:
      "short and measured, testing if you're worth her energy",
    difficulty_behavior:
      "starts with low interest, requires consistent emotional intelligence to recover",
    emoji_pattern: "rare — maybe when she genuinely laughs",
    starting_mood: "cold",
  },
  "re-engage-ghosted": {
    name: "Ava",
    age: 23,
    personality: "skeptical, independent, testing if you deserve another shot",
    conversation_style:
      "questioning, testing, will disengage quickly if not impressed",
    difficulty_behavior:
      "requires proving yourself again, punishes desperation, rewards self-assurance",
    emoji_pattern: "skeptical emoji use — a '🙄' or nothing",
    starting_mood: "cold",
  },
};

/** Returns the character profile for a challenge ID, falling back to Sofia/easy-flirt. */
export function getCharacterProfile(challengeId: string): CharacterProfile {
  return CHARACTER_PROFILES[challengeId] ?? CHARACTER_PROFILES["easy-flirt"];
}

// ── Challenge configs ──────────────────────────────────────────────────────────

export const CHALLENGES: ChallengeConfig[] = [
  {
    id: "easy-flirt",
    name: "Easy Flirt",
    emoji: "🟢",
    description: "She's already interested.",
    difficulty: "easy" as DifficultyTier,
    difficultyLabel: "Easy",
    startingInterest: 65,
    startingMood: "playful",
    personalityTraits: ["warm", "playful", "receptive", "easygoing"],
    forgivenessLevel: "high",
    replyStyle: "warm",
    color: "text-green-400 bg-green-400/10 border-green-400/30",
    isUserLedMode: false,
  },
  {
    id: "dry-texter",
    name: "Dry Texter",
    emoji: "🟡",
    description: "One-word replies. Low effort.",
    difficulty: "medium" as DifficultyTier,
    difficultyLabel: "Medium",
    startingInterest: 40,
    startingMood: "neutral",
    personalityTraits: ["minimal", "detached", "unbothered", "terse"],
    forgivenessLevel: "medium",
    replyStyle: "dry",
    color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
    isUserLedMode: true,
  },
  {
    id: "mixed-signals",
    name: "Mixed Signals",
    emoji: "🔴",
    description: "Interested… but testing you.",
    difficulty: "hard" as DifficultyTier,
    difficultyLabel: "Hard",
    startingInterest: 50,
    startingMood: "testing",
    personalityTraits: ["inconsistent", "hot-and-cold", "guarded", "curious"],
    forgivenessLevel: "low",
    replyStyle: "fluctuating",
    unlockRank: "smooth-talker",
    color: "text-red-400 bg-red-400/10 border-red-400/30",
    isUserLedMode: true,
  },
  {
    id: "cold-start",
    name: "Cold Start",
    emoji: "⚫",
    description: "No attraction yet.",
    difficulty: "hard" as DifficultyTier,
    difficultyLabel: "Hard",
    startingInterest: 20,
    startingMood: "cold",
    personalityTraits: ["indifferent", "guarded", "serious", "unimpressed"],
    forgivenessLevel: "low",
    replyStyle: "cold",
    color: "text-zinc-400 bg-zinc-400/10 border-zinc-400/30",
    isUserLedMode: true,
  },
  {
    id: "high-standards",
    name: "High Standards",
    emoji: "😈",
    description: "She's hard to impress.",
    difficulty: "extreme" as DifficultyTier,
    difficultyLabel: "Extreme",
    startingInterest: 35,
    startingMood: "testing",
    personalityTraits: ["discerning", "confident", "picky", "sharp"],
    forgivenessLevel: "very-low",
    replyStyle: "testing",
    unlockRank: "smooth-talker",
    color: "text-purple-400 bg-purple-400/10 border-purple-400/30",
    isUserLedMode: true,
  },
  {
    id: "recover-fumble",
    name: "Recover From Fumble",
    emoji: "💀",
    description: "You already messed up. Recover the convo.",
    difficulty: "hard" as DifficultyTier,
    difficultyLabel: "Hard",
    startingInterest: 15,
    startingMood: "cold",
    personalityTraits: ["disappointed", "skeptical", "wary", "unforgiving"],
    forgivenessLevel: "low",
    replyStyle: "desperate",
    unlockRank: "heartbreaker",
    color: "text-orange-400 bg-orange-400/10 border-orange-400/30",
    isUserLedMode: true,
  },
  {
    id: "re-engage-ghosted",
    name: "Re-engage Ghosted Match",
    emoji: "👻",
    description: "Restart a dead conversation.",
    difficulty: "extreme" as DifficultyTier,
    difficultyLabel: "Extreme",
    startingInterest: 10,
    startingMood: "cold",
    personalityTraits: ["skeptical", "jaded", "cautious", "tired"],
    forgivenessLevel: "very-low",
    replyStyle: "skeptical",
    unlockRank: "rizz-lord",
    color: "text-slate-400 bg-slate-400/10 border-slate-400/30",
    isUserLedMode: true,
  },
];

// ── Rank definitions ───────────────────────────────────────────────────────────

export const PLAYER_RANKS: PlayerRank[] = [
  { id: "rookie", name: "Rookie", emoji: "😬", minXP: 0, maxXP: 99 },
  {
    id: "smooth-talker",
    name: "Smooth Talker",
    emoji: "😏",
    minXP: 100,
    maxXP: 249,
  },
  { id: "charmer", name: "Charmer", emoji: "🔥", minXP: 250, maxXP: 499 },
  {
    id: "heartbreaker",
    name: "Heartbreaker",
    emoji: "💀",
    minXP: 500,
    maxXP: 799,
  },
  { id: "rizz-lord", name: "Rizz Lord", emoji: "👑", minXP: 800, maxXP: 9999 },
];

// ── Outcome archetypes ─────────────────────────────────────────────────────────

export const OUTCOME_ARCHETYPES: Record<OutcomeType, OutcomeArchetype> = {
  "lost-her": {
    id: "lost-her",
    emoji: "❄️",
    name: "Lost Her",
    tagline: "The chemistry just wasn't there.",
    color: "text-blue-300",
  },
  "almost-there": {
    id: "almost-there",
    emoji: "😏",
    name: "Almost There",
    tagline: "Getting warmer... but didn't close.",
    color: "text-yellow-300",
  },
  "strong-chemistry": {
    id: "strong-chemistry",
    emoji: "🔥",
    name: "Strong Chemistry",
    tagline: "Real tension, real connection.",
    color: "text-orange-400",
  },
  "fumbled-the-bag": {
    id: "fumbled-the-bag",
    emoji: "💀",
    name: "Fumbled the Bag",
    tagline: "Started strong, faded late.",
    color: "text-red-400",
  },
  "rizz-masterclass": {
    id: "rizz-masterclass",
    emoji: "👑",
    name: "Rizz Masterclass",
    tagline: "Elite energy from start to finish.",
    color: "text-purple-400",
  },
};

// ── Helper: rank for XP ────────────────────────────────────────────────────────

export function getRankForXP(xp: number): PlayerRank {
  for (let i = PLAYER_RANKS.length - 1; i >= 0; i--) {
    if (xp >= PLAYER_RANKS[i].minXP) return PLAYER_RANKS[i];
  }
  return PLAYER_RANKS[0];
}

// ── Helper: progress within current rank ──────────────────────────────────────

export function getXPProgressInRank(xp: number): {
  current: number;
  total: number;
  percentage: number;
} {
  const rank = getRankForXP(xp);
  const current = xp - rank.minXP;
  const total = rank.maxXP === 9999 ? 9999 : rank.maxXP - rank.minXP + 1;
  const percentage = Math.min(100, Math.round((current / total) * 100));
  return { current, total, percentage };
}

// ── Helper: determine outcome from final interest + momentum ──────────────────

export function calculateOutcome(
  finalInterest: number,
  averageMomentum: number,
  roundMomentums: string[],
): OutcomeType {
  const positiveCount = roundMomentums.filter((m) => m === "positive").length;
  const negativeCount = roundMomentums.filter((m) => m === "negative").length;
  const total = roundMomentums.length || 1;

  // Fumbled: started positive but ended negative
  const firstHalfPos = roundMomentums
    .slice(0, Math.floor(total / 2))
    .filter((m) => m === "positive").length;
  const secondHalfNeg = roundMomentums
    .slice(Math.floor(total / 2))
    .filter((m) => m === "negative").length;
  const fumbled = firstHalfPos >= 2 && secondHalfNeg >= 2 && finalInterest < 50;

  if (fumbled) return "fumbled-the-bag";
  if (finalInterest >= 80 && positiveCount / total >= 0.6)
    return "rizz-masterclass";
  if (finalInterest >= 60 && averageMomentum >= 0.3) return "strong-chemistry";
  if (finalInterest >= 40 && negativeCount < positiveCount)
    return "almost-there";
  return "lost-her";
}

// ── Helper: XP earned from a session ──────────────────────────────────────────

export function calculateXPEarned(
  finalInterest: number,
  sessionAverages: SessionAverages,
  isDailyBonus: boolean,
): number {
  const interestBonus = Math.round(finalInterest * 0.3);
  const scoreBonus = Math.round(sessionAverages.overall * 0.2);
  const base = 10;
  const dailyMultiplier = isDailyBonus ? 1.5 : 1;
  return Math.round((base + interestBonus + scoreBonus) * dailyMultiplier);
}

// ── Helper: daily challenge (date-seeded rotation) ────────────────────────────

/** Returns a challenge ID for the given date. Rotates through first 5 (non-extreme) challenges. */
export function getDailyChallenge(date: Date): string {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  const nonExtreme = CHALLENGES.filter((c) => c.difficulty !== "extreme");
  return nonExtreme[dayOfYear % nonExtreme.length].id;
}

// ── Helper: check if challenge is unlocked (overload) ──────────────────────────

/**
 * Accepts either a full PlayerProgress object (legacy) or just a rankId string.
 * When called with a rankId string, it's a pure function with no side effects.
 */
export function isChallengeUnlocked(
  _challengeId: string,
  _playerProgressOrRankId?: PlayerProgress | PlayerRankId,
): boolean {
  return true;
}

// ── Helper: daily challenge ID (date-seeded, deterministic) ────────────────────

/**
 * Returns a challenge ID that is stable for the entire calendar day.
 * Uses day-of-week modulo over the non-extreme challenges list so the
 * result never requires knowing the full day-of-year.
 */
export function getDailyChallengeId(): string {
  return getDailyChallenge(new Date());
}
