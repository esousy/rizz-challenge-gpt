import type { CharacterProfile } from "@/lib/challenges";
import type { ChatResponse, Message, PlayerSkills } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

type Mood =
  | "playful"
  | "curious"
  | "neutral"
  | "testing"
  | "engaged"
  | "flirty"
  | "bored"
  | "cold";

export interface ChallengeContext {
  challengeId: string;
  replyStyle:
    | "warm"
    | "dry"
    | "fluctuating"
    | "cold"
    | "testing"
    | "desperate"
    | "skeptical";
  forgivenessLevel: "high" | "medium" | "low" | "very-low";
  /** Phase 1–5 (maps to Opening → Final Outcome) */
  phase: number;
  difficulty: "easy" | "medium" | "hard" | "extreme";
  /** String name of the current conversation phase (e.g. 'opening', 'build-chemistry') */
  conversation_phase?: string;
  /** Character profile for this challenge */
  character_profile?: CharacterProfile;
}

// ── Mood sets ─────────────────────────────────────────────────────────────────

// Moods that are emotionally positive — align with positive/neutral feedback
const WARM_MOODS = new Set<Mood>([
  "playful",
  "curious",
  "engaged",
  "flirty",
  "testing",
]);
const HOT_MOODS = new Set<Mood>(["engaged", "flirty"]);

// ── Default reply pools (used when no ChallengeContext) ───────────────────────

const REPLIES: Record<Mood, string[]> = {
  playful: [
    "Haha okay confidence 😏",
    "Okay that was smooth",
    "Bold move 😂",
    "Didn't expect that",
    "Nice try though 😏",
    "You're something else",
    "Lmaooo where did that come from",
    "Okay I see what you're doing 👀",
  ],
  curious: [
    "Wait… elaborate",
    "Okay I'm listening 👀",
    "Hmm. Tell me more.",
    "That's actually interesting",
    "Go on then",
    "Not what I expected",
    "Okay you got my attention",
  ],
  neutral: [
    "Mmk",
    "Sure",
    "I mean… okay",
    "That's one way to put it",
    "Right.",
    "Interesting choice of words",
    "I guess",
  ],
  testing: [
    "You're trying too hard 😂",
    "Prove it",
    "That's what they all say",
    "Okay but why though",
    "I've heard that before",
    "Real original 🙄",
    "Bold claim",
  ],
  engaged: [
    "Okay you have my attention",
    "I actually liked that",
    "That was smooth ngl",
    "You're funnier than I thought",
    "Okay okay I see you",
    "Not bad at all",
    "You're not what I expected 😊",
  ],
  flirty: [
    "Okayyy 😏",
    "She liked that",
    "Keep going…",
    "You're dangerous you know that 😏",
    "Smooth. Very smooth 💕",
    "Okay this is fun",
    "You almost got me 💜",
    "Don't stop now",
  ],
  bored: ["Mhm.", "Sure okay", "…", "Next.", "I've heard better"],
  cold: ["Okay.", "Not really my thing.", "Sure", "Right", "Moving on."],
};

// ── Challenge-specific reply pools ────────────────────────────────────────────
// Each replyStyle has per-mood pools. Falls back to default REPLIES when a mood
// key is missing.

const CHALLENGE_REPLIES: Record<
  ChallengeContext["replyStyle"],
  Partial<Record<Mood, string[]>>
> = {
  // 🟢 Easy Flirt — Sofia: warm, playful, emoji-friendly
  warm: {
    playful: [
      "Okay you're cute 😏",
      "Haha stop it 🙈",
      "That actually made me smile",
      "Bold, I like it",
      "Lol okay that was cute",
      "I didn't say stop talking 👀",
    ],
    curious: [
      "Okay wait, tell me more about that",
      "You have my full attention",
      "That's actually kind of adorable",
      "I'm listening 👀",
    ],
    engaged: [
      "Okay you're doing well 😏",
      "I'm genuinely enjoying this",
      "You're different. I like that.",
      "Okay I admit it — you're smooth",
    ],
    flirty: [
      "Now we're talking 😏",
      "Okay I see you",
      "Keep going...",
      "That's more like it ✨",
      "Oh stop it 💕",
    ],
    testing: [
      "Really? That's your move?",
      "You sure about that?",
      "Interesting choice",
      "Bold claim... but I'm here for it",
    ],
    neutral: ["Tell me more", "Go on...", "Hm interesting", "Lol okay"],
    bored: [
      "Hmm that one didn't land",
      "...",
      "Okay.",
      "I was more into it before lol",
    ],
    cold: [
      "I'm not that easy 🙄",
      "Try harder",
      "That was weak",
      "I was rooting for you ngl",
    ],
  },

  // 🟡 Dry Texter — Chloe: minimal, one-liners, low engagement
  dry: {
    playful: ["lol", "ok", "haha", "sure"],
    curious: ["why", "idk", "k", "sure", "????"],
    engaged: ["ok fine", "maybe", "lol ok", "I guess"],
    flirty: ["lol ok", "maybe", "we'll see", "ok fine"],
    testing: ["why", "??", "explain", "literally what"],
    neutral: ["k", "yeah", "ok", "idk"],
    bored: ["k", ".", "ok.", "sure"],
    cold: ["no", "whatever", "bye", "nah"],
  },

  // 🔴 Mixed Signals — Vanessa: fluctuating warm/distant
  fluctuating: {
    playful: [
      "Okay I wasn't expecting that 😏",
      "You're fun actually",
      "Haha keep going",
      "Now I'm curious",
      "okay actually that made me smile",
    ],
    curious: [
      "wait why did I like that",
      "okay elaborating is allowed",
      "...that's not what I expected",
      "hm fine go on",
    ],
    engaged: [
      "okay FINE you're kind of interesting",
      "I hate that I'm laughing",
      "You're exhausting but in a good way lol",
    ],
    flirty: [
      "You're dangerous 😏",
      "I kind of like this",
      "Careful now",
      "Ok you're actually interesting",
    ],
    testing: ["Prove it.", "Bold claim.", "We'll see.", "Everyone says that."],
    neutral: ["hmm", "okay", "sure", "whatever lol"],
    bored: ["ok", "mm", "cool I guess", "sure."],
    cold: [
      "Actually never mind.",
      "Not feeling it.",
      "Nope.",
      "I was wrong about you.",
    ],
  },

  // ⚫ Cold Start — Mia: reserved, warming very slowly
  cold: {
    playful: ["haha ok", "that's actually funny", "okay", "sure lol"],
    curious: ["why?", "what do you mean", "how so", "really?"],
    engaged: [
      "okay that's fair",
      "I'll give you that",
      "haha maybe",
      "okay interesting",
    ],
    flirty: ["haha maybe", "okay interesting", "I mean... maybe", "we'll see"],
    testing: ["why?", "what do you mean", "how so", "really?"],
    neutral: ["oh", "yeah", "ok", "hmm"],
    bored: ["k", "ok", "sure", "mm"],
    cold: ["no", "not really", "k", "I'm good"],
  },

  // 😈 High Standards — Isabella: precise, witty, challenging
  testing: {
    playful: [
      "Surprisingly original.",
      "Now that was clever.",
      "I'll admit that landed.",
      "Okay. Points for that.",
    ],
    curious: [
      "okay you have 30 more seconds of my attention",
      "that's... actually worth exploring",
      "Interesting. Continue.",
    ],
    engaged: [
      "Okay I'll admit that was good.",
      "I didn't think you had that in you.",
      "Not bad. Not great. But not bad.",
      "I respect the effort.",
    ],
    flirty: [
      "You almost had me there.",
      "Clever. Don't let it go to your head.",
      "Better.",
      "You're getting there.",
    ],
    testing: [
      "Generic.",
      "Everyone says that.",
      "Try again.",
      "Is that your best?",
      "I expected more.",
    ],
    neutral: ["Interesting.", "Go on.", "I'm listening.", "Not bad."],
    bored: ["Predictable.", "Next.", "That was safe.", "Expected that."],
    cold: ["No.", "Absolutely not.", "Wrong move.", "That was disappointing."],
  },

  // 💀 Recover From Fumble — Natalie: guarded, cautious
  desperate: {
    playful: [
      "haha okay",
      "fine that was funny",
      "I guess",
      "okay fine",
      "I'll admit that didn't suck",
    ],
    curious: [
      "okay why did you text again",
      "...I'm listening. barely.",
      "that's... actually not the worst",
    ],
    engaged: [
      "okay you're kind of recovering lol",
      "I didn't expect this turnaround",
      "...you're doing better than I thought",
    ],
    flirty: [
      "let's not get ahead of ourselves",
      "okay one step at a time",
      "maybe",
      "we'll see",
    ],
    testing: [
      "why should I believe that?",
      "words are easy",
      "okay and?",
      "is that supposed to help?",
    ],
    neutral: ["yeah", "okay", "I hear you", "right"],
    bored: ["okay", "sure", "right.", "mm"],
    cold: [
      "not really",
      "I'm still not convinced",
      "that's not how this works",
      "no.",
    ],
  },

  // 👻 Re-engage Ghosted — Ava: skeptical, testing
  skeptical: {
    playful: [
      "okay that was actually good",
      "I'll give you that one",
      "fine. you're funny.",
      "ok ok",
    ],
    curious: [
      "okay fine what do you want",
      "I'm listening... I guess",
      "...explain yourself",
      "why should I care",
    ],
    engaged: [
      "okay you're making a comeback lol",
      "I didn't expect to be here but here we are",
      "...you're interesting when you try",
    ],
    flirty: [
      "don't push your luck",
      "okay don't get excited",
      "I mean. fine.",
      "maybe",
    ],
    testing: [
      "why are you back?",
      "why should I care",
      "what do you want",
      "prove it",
    ],
    neutral: ["ok", "yeah", "we'll see", "right"],
    bored: ["k", "ok", "mm", "sure"],
    cold: ["no", "already over this", "nah", "🙄"],
  },
};

// ── Resistance reply pools (per challenge/replyStyle) ────────────────────────
// Used when the resistance check fires (~25% chance for warm/high-interest states)
// Each character has pushback lines that feel natural to their personality.

const RESISTANCE_REPLIES: Record<ChallengeContext["replyStyle"], string[]> = {
  // Sofia: warm but occasionally teases and keeps you earning it
  warm: [
    "Bold assumption 😏",
    "Who said you get that so easily?",
    "You're getting ahead of yourself lol",
    "Slow down, I barely know you",
    "Don't get too comfortable just yet",
    "You think it's that easy? 🙈",
    "I haven't decided if I like you yet 😏",
    "You almost had me there",
  ],
  // Chloe: dry sarcastic pushback, still minimal
  dry: [
    "ok",
    "sure jan",
    "lol no",
    "bold of you",
    "next",
    "k",
    "that's not how this works",
  ],
  // Vanessa: unpredictable — goes cold mid-warmth
  fluctuating: [
    "And just like that I'm bored again.",
    "You lost me.",
    "Okay never mind actually",
    "I was into this and then... no.",
    "Oh so now you're being predictable",
    "Hot and cold. Mostly cold rn.",
    "I didn't say you had this 🙄",
  ],
  // Mia: reserved cold pushback, shuts things down
  cold: [
    "okay slow down",
    "we're not there yet",
    "that's a bit much",
    "idk about that",
    "I'm not really feeling it",
    "you're moving fast",
  ],
  // Isabella: direct challenge, tests for real quality
  testing: [
    "Is that your best?",
    "Everyone says that.",
    "Underwhelming.",
    "You're still not surprising me.",
    "Try harder.",
    "Generic.",
    "I expected more.",
    "Points for confidence. Minus points for execution.",
  ],
  // Natalie: guarded, protective, emotional check
  desperate: [
    "okay let's not get ahead of ourselves",
    "words are easy",
    "I've heard this before",
    "you're going to have to do better than that",
    "I'm cautiously... still skeptical",
    "that's not how you rebuild trust",
  ],
  // Ava: skeptical, calling out the attempt
  skeptical: [
    "Don't push your luck.",
    "Okay relax.",
    "You think that worked? 🙄",
    "You're trying too hard again.",
    "Not buying it.",
    "I see what you're doing.",
    "...still skeptical",
  ],
};

// ── Assertive/confidence keyword detection ────────────────────────────────────

const ASSERTIVE_KEYWORDS = [
  "definitely",
  "for sure",
  "bet",
  "obviously",
  "trust me",
  "i promise",
  "guarantee",
  "100%",
  "no doubt",
  "exactly",
  "of course",
  "without a doubt",
];

/**
 * Returns true if 2+ of the last 3 user messages contain assertive/confidence keywords.
 * Used to apply the repetition penalty.
 */
function hasRepetitiveConfidence(history: Message[]): boolean {
  const last3 = history
    .filter((m) => m.role === "user")
    .slice(-3)
    .map((m) => m.content.toLowerCase());
  const count = last3.filter((msg) =>
    ASSERTIVE_KEYWORDS.some((kw) => msg.includes(kw)),
  ).length;
  return count >= 2;
}

// ── Easy Mode opener pool (AI opens first — must feel like a real first message) ─

export const EASY_MODE_OPENERS: string[] = [
  "you look like trouble 😂",
  "wait why are you actually cute",
  "okay that last pic was unnecessary 😭",
  "i just know you're a red flag",
  "why do you kinda look like my next mistake",
  "your story made me laugh ngl",
  "not you acting fine for no reason",
  "okay but the confidence??",
  "i almost didn't swipe right 😭",
  "you definitely know you're attractive",
  "why do you look like every girl's problem",
  "your gym pic is insane btw",
  "you seem cocky lol",
  "nah your caption was smooth",
  "i can already tell you're trouble",
  "your playlist is actually good wtf",
  "you look familiar for some reason",
  "you seem like you flirt too much",
  "i blame your last selfie for this match",
  "why are your comments actually funny",
  "okay but why do you look like that 😭",
  "you have main character energy and i don't like it",
  "not me matching with you at 2am",
  "your bio is way too confident lol",
  "i feel like you know you're cute",
  "why does your last pic go so hard",
  "okay you're dangerous i can already tell",
  "i was scrolling past then i saw that selfie 😭",
  "you give off very much 'girls text first' energy",
  "okay your vibe on here is actually annoying me",
  "i saw your mutual and had to check your profile",
  "not your photos being this good 😭",
  "you're giving main character and it's frustrating",
  "why do you look like you laugh at everything",
  "i told my friend about your profile lol",
  "you seem like you never run out of things to say",
  "your energy is loud even through a screen",
  "i don't normally text first but here we are",
  "okay who told you to post that 😂",
];

// ── Challenge initial messages ─────────────────────────────────────────────────

const INITIAL_MESSAGES: Record<string, string> = {
  "dry-texter": "hey",
  "mixed-signals": "Okay you have my attention. For now 😏",
  "cold-start": "Oh hey.",
  "high-standards": "Interesting opener. I've heard better.",
  "recover-fumble": "...so what did you want to say?",
  "re-engage-ghosted": "You again.",
};

/**
 * Returns the challenge-specific opening message.
 * For easy-flirt: picks a random opener from EASY_MODE_OPENERS each call.
 * For user-led challenges: returns null (user opens first).
 */
export function getInitialMessage(challengeId: string): string | null {
  if (challengeId === "easy-flirt") {
    return EASY_MODE_OPENERS[
      Math.floor(Math.random() * EASY_MODE_OPENERS.length)
    ];
  }
  return INITIAL_MESSAGES[challengeId] ?? null;
}

// ── Feedback pools ────────────────────────────────────────────────────────────

const FEEDBACK_POOLS = {
  positive: [
    "🔥 Momentum building.",
    "Smooth recovery.",
    "Confident energy.",
    "Okay that worked 😏",
    "She's engaging now.",
    "💜 Good tension.",
    "She liked that.",
    "Bold but it landed.",
  ],
  neutral: [
    "Safe response.",
    "Conversation holding steady.",
    "Could push further.",
    "Holding ground.",
    "Playing it safe.",
  ],
  negative: [
    "Too safe.",
    "Momentum dropped.",
    "She lost interest there.",
    "That felt forced.",
    "Low energy.",
  ],
};

// ── Mood transition matrix ─────────────────────────────────────────────────────

type Transition = [Mood, number][];

const MOOD_TRANSITIONS: Record<Mood, Transition> = {
  playful: [
    ["playful", 35],
    ["curious", 60],
    ["flirty", 80],
    ["testing", 100],
  ],
  curious: [
    ["playful", 30],
    ["engaged", 55],
    ["neutral", 80],
    ["testing", 100],
  ],
  neutral: [
    ["curious", 30],
    ["playful", 55],
    ["testing", 80],
    ["bored", 100],
  ],
  testing: [
    ["curious", 30],
    ["playful", 55],
    ["neutral", 80],
    ["cold", 100],
  ],
  engaged: [
    ["engaged", 35],
    ["flirty", 65],
    ["playful", 90],
    ["curious", 100],
  ],
  flirty: [
    ["flirty", 40],
    ["engaged", 70],
    ["playful", 90],
    ["testing", 100],
  ],
  bored: [
    ["cold", 30],
    ["neutral", 60],
    ["testing", 85],
    ["curious", 100],
  ],
  cold: [
    ["neutral", 40],
    ["bored", 65],
    ["testing", 85],
    ["curious", 100],
  ],
};

const MOOD_CONSTRAINTS: Record<
  "positive" | "neutral" | "negative",
  Set<Mood>
> = {
  positive: new Set(["playful", "curious", "engaged", "flirty", "testing"]),
  neutral: new Set(["playful", "curious", "neutral", "testing"]),
  negative: new Set(["neutral", "testing", "bored", "cold"]),
};

// ── Module-level persistent state ─────────────────────────────────────────────

interface InternalState {
  positiveMomentumStreak: number;
  negativeMomentumStreak: number;
  negFeedbackCooldown: number;
}

let _state: InternalState = {
  positiveMomentumStreak: 0,
  negativeMomentumStreak: 0,
  negFeedbackCooldown: 0,
};

/** Call on session reset to wipe internal momentum tracking. */
export function resetMockState(): void {
  _state = {
    positiveMomentumStreak: 0,
    negativeMomentumStreak: 0,
    negFeedbackCooldown: 0,
  };
}

// ── Utilities ────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function transitionMood(
  current: string,
  category: "positive" | "neutral" | "negative",
  ctx?: ChallengeContext,
): Mood {
  // For cold/dry/skeptical/desperate styles, restrict upward mobility on negative
  const transitions =
    MOOD_TRANSITIONS[current as Mood] ?? MOOD_TRANSITIONS.neutral;
  const roll = Math.random() * 100;
  let candidate: Mood = "neutral";
  for (const [mood, threshold] of transitions) {
    if (roll < threshold) {
      candidate = mood;
      break;
    }
  }

  // Challenge-specific mood ceiling — harder challenges cap how warm AI gets
  if (ctx) {
    const { difficulty, replyStyle } = ctx;
    const restrictedStyles = new Set(["cold", "dry", "skeptical", "desperate"]);
    if (
      restrictedStyles.has(replyStyle) &&
      candidate === "flirty" &&
      difficulty !== "easy"
    ) {
      candidate = "engaged";
    }
    if (
      difficulty === "extreme" &&
      (candidate === "flirty" || candidate === "engaged")
    ) {
      // Extreme difficulty: cap at playful unless already engaged
      if (current !== "engaged" && current !== "flirty") {
        candidate = "playful";
      }
    }
  }

  const allowed = MOOD_CONSTRAINTS[category];
  if (allowed.has(candidate)) return candidate;

  for (const [mood] of transitions) {
    if (allowed.has(mood)) return mood;
  }

  if (category === "positive") return "playful";
  if (category === "negative") return "neutral";
  return "neutral";
}

function detectRepetition(userMessage: string, history: Message[]): boolean {
  const userMsgs = history.filter((m) => m.role === "user").slice(-3);
  const norm = userMessage.trim().toLowerCase();
  return userMsgs.some((m) => m.content.trim().toLowerCase() === norm);
}

// ── User effort analysis ──────────────────────────────────────────────────────

function analyzeUserEffort(history: Message[]): "strong" | "moderate" | "weak" {
  const recent = history.filter((m) => m.role === "user").slice(-3);
  if (recent.length === 0) return "moderate";
  const avgLen =
    recent.reduce((s, m) => s + m.content.trim().length, 0) / recent.length;
  if (avgLen < 6) return "weak";
  if (avgLen < 15) return "moderate";
  return "strong";
}

// ── Momentum computation ───────────────────────────────────────────────────────

function computeMomentum(
  _userMessage: string,
  history: Message[],
  currentInterest: number,
  currentMood: string,
  isRepeat: boolean,
  ctx?: ChallengeContext,
): "positive" | "neutral" | "negative" {
  const effort = analyzeUserEffort(history);

  const recentAiMsgs = history
    .filter((m) => m.role === "ai" && m.interest_change !== undefined)
    .slice(-3) as Array<Message & { interest_change: number }>;

  const recentInterestTrend =
    recentAiMsgs.length > 0
      ? recentAiMsgs.reduce((s, m) => s + (m.interest_change ?? 0), 0)
      : 0;

  const moodIsWarm = WARM_MOODS.has(currentMood as Mood);
  const moodIsHot = HOT_MOODS.has(currentMood as Mood);

  // Phase-based modifier: phase 4 (Pressure Moment) punishes harder on hard/extreme
  if (ctx) {
    const { phase, difficulty } = ctx;
    const isLateStage = phase >= 4;
    if (isLateStage && (difficulty === "hard" || difficulty === "extreme")) {
      if (effort === "weak" || isRepeat) return "negative";
    }
    // Phase 1 forgiveness bonus — opening round is forgiving
    if (phase === 1 && effort !== "weak") {
      return moodIsWarm ? "positive" : "neutral";
    }
  }

  // GOLDEN RULE: warm/hot mood + non-falling interest → never negative
  if ((moodIsWarm || moodIsHot) && recentInterestTrend >= -3 && !isRepeat) {
    if (moodIsHot || effort === "strong" || recentInterestTrend > 0) {
      return "positive";
    }
    return "neutral";
  }

  if (isRepeat || effort === "weak") return "negative";

  if (effort === "strong" && currentInterest >= 45) return "positive";
  if (recentInterestTrend > 4 && currentInterest >= 50) return "positive";
  if (recentInterestTrend < -6 || currentInterest < 30) return "negative";

  return "neutral";
}

// ── Feedback category selection ───────────────────────────────────────────────

function selectFeedbackCategory(
  momentum: "positive" | "neutral" | "negative",
  currentInterest: number,
  currentMood: string,
): "positive" | "neutral" | "negative" {
  const moodIsWarm = WARM_MOODS.has(currentMood as Mood);

  // GOLDEN RULE enforcement: warm mood + non-low interest → never negative
  if (moodIsWarm && currentInterest >= 40) {
    if (momentum === "negative") return "neutral";
    return momentum;
  }

  if (momentum === "negative") {
    if (_state.negFeedbackCooldown > 0) return "neutral";
    return "negative";
  }

  return momentum;
}

// ── Interest delta with challenge difficulty ───────────────────────────────────

/**
 * Adjusts the raw momentum-derived interest delta according to challenge
 * difficulty and forgiveness level.
 *
 * Easy:    gains amplified (+2 to +14), losses capped at -2
 * Medium:  standard range  (-5 to +8)
 * Hard:    gains reduced   (+1 to +6), losses amplified (-3 to -10)
 * Extreme: volatile        (-5 to +5), unpredictable swings
 */
export function getInterestDelta(
  baseDelta: number,
  difficulty: string,
  forgivenessLevel: string,
): number {
  switch (difficulty) {
    case "easy": {
      // Amplify gains, soften losses
      if (baseDelta >= 0)
        return clamp(Math.round(baseDelta * 1.5 + Math.random() * 2), 2, 14);
      return clamp(Math.round(baseDelta * 0.3), -2, 0);
    }
    case "hard": {
      if (baseDelta >= 0) return clamp(Math.round(baseDelta * 0.6), 1, 6);
      return clamp(Math.round(baseDelta * 1.4 - Math.random() * 3), -10, -3);
    }
    case "extreme": {
      // Volatile swings regardless of direction
      const jitter = (Math.random() - 0.5) * 6;
      const adjusted = Math.round(baseDelta * 0.7 + jitter);
      return clamp(adjusted, -5, 5);
    }
    default: {
      // medium
      // Standard — apply forgiveness modifier for high-forgiveness challenges
      if (forgivenessLevel === "high" && baseDelta < 0) {
        return clamp(Math.round(baseDelta * 0.5), -3, 0);
      }
      if (forgivenessLevel === "very-low" && baseDelta > 0) {
        return clamp(Math.round(baseDelta * 0.7), 0, 6);
      }
      return clamp(baseDelta, -5, 8);
    }
  }
}

function calcInterestChange(
  momentum: "positive" | "neutral" | "negative",
  ctx?: ChallengeContext,
): number {
  let base: number;
  switch (momentum) {
    case "positive":
      base = clamp(Math.round(4 + Math.random() * 8), 4, 12);
      break;
    case "neutral":
      base = clamp(Math.round(-2 + Math.random() * 6), -2, 4);
      break;
    case "negative":
      base = clamp(Math.round(-8 + Math.random() * 6), -8, -2);
      break;
  }
  if (ctx) {
    return getInterestDelta(base, ctx.difficulty, ctx.forgivenessLevel);
  }
  return base;
}

// ── Phase amplification ────────────────────────────────────────────────────────

/**
 * Phase 3 (Escalation) amplifies interest changes ±20%.
 * Phase 4 (Pressure Moment) — hard/extreme already handled in momentum.
 * Phase 5 (Final Outcome) — clamp effect applied in main function.
 */
function applyPhaseAmplification(
  delta: number,
  ctx?: ChallengeContext,
): number {
  if (!ctx) return delta;
  const { phase } = ctx;
  if (phase === 3) {
    return Math.round(delta * (delta >= 0 ? 1.2 : 1.2));
  }
  return delta;
}

// ── Derived state helpers ──────────────────────────────────────────────────────

function deriveEngagementLevel(interest: number): "low" | "medium" | "high" {
  if (interest > 70) return "high";
  if (interest >= 40) return "medium";
  return "low";
}

function deriveConversationTension(
  interest: number,
  posStreak: number,
): "low" | "building" | "high" {
  if (interest > 70) return "high";
  if (interest > 55 && posStreak >= 2) return "building";
  return "low";
}

// ── Reply picker ───────────────────────────────────────────────────────────────

function pickReply(mood: Mood, ctx?: ChallengeContext): string {
  if (!ctx) return pick(REPLIES[mood] ?? REPLIES.neutral);

  const stylePool = CHALLENGE_REPLIES[ctx.replyStyle];
  const moodPool = stylePool?.[mood];
  // Fall back to default pool if no challenge-specific replies for this mood
  return pick(moodPool ?? REPLIES[mood] ?? REPLIES.neutral);
}

// ── Skill delta calculation ────────────────────────────────────────────────────

/**
 * Calculate per-skill deltas (0–3 per skill) from message quality.
 * Returns additive deltas — caller applies these to stored skill totals.
 */
export function calculateSkillDeltas(
  response: ChatResponse,
  ctx?: ChallengeContext,
): PlayerSkills {
  const { breakdown, momentum, feedbackCategory } = response;
  const posBonus = feedbackCategory === "positive" ? 1 : 0;

  const confidence = clamp(
    Math.round((breakdown.confidence - 50) / 20) + posBonus,
    0,
    3,
  );
  const humor = clamp(Math.round((breakdown.humor - 50) / 20) + posBonus, 0, 3);
  const originality = clamp(
    Math.round((breakdown.originality - 50) / 20) + posBonus,
    0,
    3,
  );

  // Tension: builds with escalation phase and high interest
  const tensionBonus = ctx?.phase === 3 ? 1 : 0;
  const tension = clamp(
    (momentum === "positive" ? 2 : momentum === "neutral" ? 1 : 0) +
      tensionBonus,
    0,
    3,
  );

  // Social awareness: rewarded for understanding context (hard/extreme challenges)
  const diffBonus =
    ctx?.difficulty === "hard" || ctx?.difficulty === "extreme" ? 1 : 0;
  const socialAwareness = clamp(
    (feedbackCategory === "positive"
      ? 2
      : feedbackCategory === "neutral"
        ? 1
        : 0) + diffBonus,
    0,
    3,
  );

  return { confidence, humor, originality, tension, socialAwareness };
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Generate a mock AI response.
 *
 * Backward compatible: the first four params match the original signature.
 * Pass an optional fifth `ChallengeContext` to enable challenge-specific behavior.
 */
export function generateMockResponse(
  userMessage: string,
  history: Message[],
  currentInterest: number,
  currentMood: string,
  ctx?: ChallengeContext,
): ChatResponse {
  const isRepeat = detectRepetition(userMessage, history);

  // ── Resistance check ───────────────────────────────────────────────────────
  // Fire resistance when the conversation is going well but the user is being
  // too confident, repetitive, or eager. Creates realistic push-pull tension.
  const isWarmMoodNow = WARM_MOODS.has(currentMood as Mood);
  const isHighInterest = currentInterest > 60;
  const repetitiveConfidence = hasRepetitiveConfidence(history);

  // Base resistance probability: 25% when warm/high-interest, 40% when repetitive
  const resistanceRoll = Math.random();
  const resistanceThreshold = repetitiveConfidence
    ? 0.4
    : isWarmMoodNow || isHighInterest
      ? 0.25
      : 0;

  const fireResistance =
    ctx != null && resistanceRoll < resistanceThreshold && !isRepeat; // already handled by existing repetition logic

  if (fireResistance) {
    const resistancePool =
      RESISTANCE_REPLIES[ctx!.replyStyle] ?? RESISTANCE_REPLIES.warm;
    const resistReply = pick(resistancePool);

    // Repetitive confidence gets a stronger penalty
    const interestPenalty = repetitiveConfidence
      ? clamp(Math.round(-3 - Math.random() * 5), -8, -2)
      : clamp(Math.round(-1 + Math.random() * 3 - 2), -4, 0);

    const updated_interest = clamp(currentInterest + interestPenalty, 0, 100);

    // Keep mood in a neutral-to-testing range during resistance
    const _resistMoods: Mood[] = ["testing", "neutral", "playful"];
    const resistMood: Mood = isHighInterest
      ? pick(["testing", "playful", "neutral"])
      : pick(["testing", "neutral", "bored"]);

    // Coaching hints that reflect the pushback
    const resistHints = [
      "She's testing you. Don't chase.",
      "Hold your ground — don't over-explain.",
      "She wants to see how you handle resistance.",
      "Stay cool. Don't try harder.",
      "This is the challenge. Don't fold.",
      repetitiveConfidence
        ? "Repetition lost its effect. Switch it up."
        : "Don't get too comfortable.",
    ];

    const score = clamp(
      Math.round(
        35 + Math.random() * 25 + (ctx?.difficulty === "easy" ? 10 : 0),
      ),
      20,
      75,
    );
    const breakdown = {
      confidence: clamp(Math.round(40 + Math.random() * 30), 20, 80),
      humor: clamp(Math.round(35 + Math.random() * 30), 20, 75),
      originality: clamp(Math.round(30 + Math.random() * 35), 20, 80),
    };

    return {
      reply: resistReply,
      interest_change: interestPenalty,
      updated_interest,
      mood: resistMood,
      coach_hint: pick(resistHints),
      coach_tone: interestPenalty < -2 ? "negative" : "neutral",
      score,
      breakdown,
      momentum: interestPenalty < -2 ? "negative" : "neutral",
      engagement_level: deriveEngagementLevel(updated_interest),
      conversation_tension: isHighInterest
        ? "building"
        : deriveConversationTension(
            updated_interest,
            _state.positiveMomentumStreak,
          ),
      feedbackCategory: interestPenalty < -2 ? "negative" : "neutral",
    };
  }

  // ── Repetition penalty on interest delta (even without full resistance) ───
  const applyRepetitionPenalty = repetitiveConfidence && !fireResistance;

  // 1. Compute conversational momentum (phase & difficulty aware)
  const momentum = computeMomentum(
    userMessage,
    history,
    currentInterest,
    currentMood,
    isRepeat,
    ctx,
  );

  // 2. Update internal streak counters
  if (momentum === "positive") {
    _state.positiveMomentumStreak++;
    _state.negativeMomentumStreak = 0;
    if (_state.negFeedbackCooldown > 0) _state.negFeedbackCooldown--;
  } else if (momentum === "negative") {
    _state.negativeMomentumStreak++;
    _state.positiveMomentumStreak = 0;
  } else {
    _state.positiveMomentumStreak = Math.max(
      0,
      _state.positiveMomentumStreak - 1,
    );
    _state.negativeMomentumStreak = 0;
    if (_state.negFeedbackCooldown > 0) _state.negFeedbackCooldown--;
  }

  // 3. Feedback category (respects golden rule + cooldown)
  const feedbackCategory = selectFeedbackCategory(
    momentum,
    currentInterest,
    currentMood,
  );

  if (feedbackCategory === "negative") {
    _state.negFeedbackCooldown = 3;
  }

  // 4. Interest change — difficulty + phase aware
  let interest_change = calcInterestChange(momentum, ctx);
  interest_change = applyPhaseAmplification(interest_change, ctx);

  // Apply repetition penalty: reduce interest by 5-10 without full resistance
  if (applyRepetitionPenalty) {
    const penalty = clamp(Math.round(5 + Math.random() * 5), 5, 10);
    interest_change = clamp(interest_change - penalty, -10, 0);
  }

  // Phase 5 (Final Outcome): clamp interest to meaningful bands
  let updated_interest = clamp(currentInterest + interest_change, 0, 100);
  if (ctx?.phase === 5) {
    if (momentum === "positive")
      updated_interest = Math.max(updated_interest, 55);
    if (momentum === "negative")
      updated_interest = Math.min(updated_interest, 45);
  }
  // Recompute actual delta after clamping
  interest_change = updated_interest - currentInterest;

  // 5. Mood transition (challenge style + difficulty constrained)
  const mood = transitionMood(currentMood, feedbackCategory, ctx);

  // 6. Derived state
  const engagement_level = deriveEngagementLevel(updated_interest);
  const conversation_tension = deriveConversationTension(
    updated_interest,
    _state.positiveMomentumStreak,
  );

  // 7. Pick challenge-specific reply and coach hint
  const reply = pickReply(mood, ctx);
  const coach_hint = pick(FEEDBACK_POOLS[feedbackCategory]);

  // 8. Scoring calibrated to conversation quality + difficulty
  const baseMod =
    momentum === "positive" ? 15 : momentum === "neutral" ? 0 : -15;
  // Hard/extreme challenges score lower — harder to impress
  const diffPenalty =
    ctx?.difficulty === "hard" ? -8 : ctx?.difficulty === "extreme" ? -15 : 0;

  const confidence = clamp(
    Math.round(50 + baseMod + diffPenalty + Math.random() * 30),
    20,
    95,
  );
  const humor = clamp(
    Math.round(45 + baseMod + diffPenalty + Math.random() * 30),
    20,
    95,
  );
  const originality = clamp(
    Math.round(45 + baseMod + diffPenalty + Math.random() * 30),
    20,
    95,
  );
  const score = clamp(
    Math.round(
      confidence * 0.4 +
        humor * 0.3 +
        originality * 0.3 +
        (Math.random() * 8 - 4),
    ),
    20,
    100,
  );

  return {
    reply,
    interest_change,
    updated_interest,
    mood,
    coach_hint,
    score,
    breakdown: { confidence, humor, originality },
    momentum,
    engagement_level,
    conversation_tension,
    feedbackCategory,
    // coach_tone maps directly from feedbackCategory — same semantic, typed field
    coach_tone: feedbackCategory,
  };
}
