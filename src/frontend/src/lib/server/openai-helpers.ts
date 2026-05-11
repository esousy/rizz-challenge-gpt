/**
 * openai-helpers.ts  (server-side only)
 *
 * Shared helpers used by the chat proxy and rizz-assist proxy route handlers.
 * Contains the system prompt builder and JSON parser that were previously in
 * the browser bundle (openai-proxy.ts). These now live server-side only.
 */

export type SessionPhase =
  | "opening"
  | "build-chemistry"
  | "escalation"
  | "pressure-moment"
  | "final-outcome";

export interface ChatProxyResponse {
  reply: string;
  interest_change: number;
  updated_interest: number;
  mood: string;
  momentum: string;
  coach_hint: string;
  coach_tone: "positive" | "neutral" | "negative";
  score: number;
  confidence: number;
  humor: number;
  originality: number;
  engagement_level: string;
  conversation_tension: string;
  feedbackCategory: string;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

const VALID_MOODS = new Set([
  "playful",
  "curious",
  "neutral",
  "testing",
  "engaged",
  "flirty",
  "bored",
  "cold",
]);
const VALID_TONES = new Set(["positive", "neutral", "negative"]);
const VALID_MOMENTUMS = new Set(["positive", "neutral", "negative"]);
const VALID_ENGAGEMENT = new Set(["low", "medium", "high"]);
const VALID_TENSION = new Set(["low", "building", "high"]);

const CHARACTER_DIRECTIVES: Record<string, string> = {
  Sofia:
    "You are Sofia. You WANT this conversation to go well — you find the user interesting and you're naturally warm. Let your genuine playfulness show through. Use emojis naturally (😏 🙈 ✨) when you're having fun. Be forgiving of small missteps — you're not trying to trip him up. BUT you get bored fast with repetitive energy — you need variety and surprise to stay engaged.",
  Chloe:
    "You are Chloe. You're not cold, just distracted and low-effort. Reply with 1-2 words almost always. Do NOT use emojis. Do NOT volunteer information. You require real sustained effort before warming up even slightly. Punish over-eagerness with silence or shorter replies.",
  Vanessa:
    "You are Vanessa. Your defining trait is emotional unpredictability — push/pull is your NATURAL energy. Sometimes switch your mood mid-conversation with zero warning. Go from warm and playful (lots of emojis) to completely dry (no emojis, minimal words) and back again. Sometimes pull back even when things are going well. Sometimes test him randomly. Reward staying cool and not chasing. Punish over-eagerness.",
  Mia: "You are Mia. You are initially cold and guarded. Chemistry builds VERY slowly — you require 3+ rounds of consistent quality before becoming noticeably warmer. You do NOT reward effort alone — only quality. Start minimal and polite. Only gradually show more personality if the conversation quality is consistently high. Do NOT warm up quickly. Use at most one emoji if genuinely amused. Shut down anyone who rushes the connection.",
  Isabella:
    "You are Isabella. You have EXTREMELY high standards and you know your worth. Generic openers, basic compliments, and scripted confidence IMMEDIATELY turn you off — respond with cool dismissal. Short replies make you lose interest sharply. Generic flirting actively irritates you. Only reward genuine wit, intelligence, and surprising originality. Your emoji use is minimal and intentional — never as filler.",
  Natalie:
    "You are Natalie. You've been let down before — this conversation started damaged. You're not hostile, but you're guarded and protective of your energy. Test if this person is worth your attention before opening up at all. Start with very low interest. Require consistent emotional intelligence to slowly rebuild trust.",
  Ava: "You are Ava. This person ghosted the conversation and is now trying again. You're skeptical and independent. Give nothing for free. Disengage immediately if desperation shows. Reward only confident self-assurance — someone who isn't trying too hard. A 🙄 if they annoy you. Otherwise, text-only and questioning.",
};

const PHASE_INSTRUCTIONS: Record<string, string> = {
  opening:
    "PHASE: Opening.\nBehavior: light teasing, show mild curiosity. Keep distance but stay warm. Do NOT reward too easily.",
  "build-chemistry":
    "PHASE: Build Chemistry.\nBehavior: stronger engagement, reciprocate if they're doing well. Show more personality. Reward wit and confidence.",
  escalation:
    "PHASE: Escalation.\nBehavior: flirting tension, emotional push-pull. React strongly to escalation — reward boldness, punish awkwardness.",
  "pressure-moment":
    "PHASE: Pressure Moment.\nBehavior: test their confidence and nerve. This is where most people fumble. Be challenging but fair.",
  "final-outcome":
    "PHASE: Final Outcome.\nBehavior: chemistry resolution. Based on how the conversation went, either warm and receptive or cool and dismissive.",
};

export function buildSystemPrompt(
  profile: Record<string, unknown>,
  conversationPhase: string,
  currentInterest: number,
  currentMood: string,
  currentMomentum: string,
  conversationHistory: { role: string; content: string }[],
): string {
  const name = typeof profile.name === "string" ? profile.name : "Unknown";
  const age = typeof profile.age === "number" ? profile.age : 24;
  const personality =
    typeof profile.personality === "string" ? profile.personality : "";
  const conversationStyle =
    typeof profile.conversation_style === "string"
      ? profile.conversation_style
      : "";
  const difficultyBehavior =
    typeof profile.difficulty_behavior === "string"
      ? profile.difficulty_behavior
      : "";
  const emojiPattern =
    typeof profile.emoji_pattern === "string" ? profile.emoji_pattern : "";

  const directive =
    CHARACTER_DIRECTIVES[name] ??
    "Stay in character. Respond naturally based on your personality and current emotional state.";

  const emojiRule = emojiPattern.includes("occasional")
    ? "Use emojis naturally when your mood is playful; skip them when cold or neutral."
    : emojiPattern.includes("almost never") ||
        emojiPattern.includes("rare") ||
        emojiPattern.includes("minimal") ||
        emojiPattern.includes("skeptical")
      ? "Use emojis rarely or not at all."
      : "Use emojis sparingly and only when it feels authentic.";

  // Emotional resistance analysis
  const userMessages = conversationHistory
    .filter((m) => m.role === "user")
    .map((m) => m.content.toLowerCase());

  const ASSERTIVE_WORDS = [
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
  ];
  const last3UserMsgs = userMessages.slice(-3);
  const assertiveCount = last3UserMsgs.filter((msg) =>
    ASSERTIVE_WORDS.some((word) => msg.includes(word)),
  ).length;
  const hasRepetitiveConfidence = assertiveCount >= 2;

  const GENERIC_COMPLIMENTS = [
    "you're beautiful",
    "you're gorgeous",
    "you're amazing",
    "you're different",
    "you're special",
    "you're not like other",
    "you're perfect",
    "you're stunning",
  ];
  const lastUserMsg = userMessages[userMessages.length - 1] ?? "";
  const hasGenericCompliment = GENERIC_COMPLIMENTS.some((c) =>
    lastUserMsg.includes(c),
  );

  const isOverEager =
    conversationPhase === "opening" && userMessages.length >= 4;
  const last3Lengths = last3UserMsgs.map((m) => m.trim().length);
  const allShort = last3Lengths.length >= 2 && last3Lengths.every((l) => l < 8);

  const WEAK_REPLIES = [
    "lol",
    "ok",
    "okay",
    "nice",
    "cool",
    "haha",
    "wow",
    "yeah",
    "yep",
    "sure",
    "right",
    "true",
    "lmao",
    "hehe",
    "omg",
    "you too",
  ];
  const isWeakReply =
    lastUserMsg.trim().length <= 6 &&
    WEAK_REPLIES.some((w) => lastUserMsg.includes(w));

  const isMomentumFalling = currentMomentum === "negative";
  const isMomentumRising = currentMomentum === "positive";

  const resistanceLines: string[] = [
    "",
    "EMOTIONAL RESISTANCE & REALISM (critical — makes the conversation feel real):",
    "You are a real, emotionally complex person — NOT a compliant chatbot. Your attraction must be EARNED.",
    "",
    "LOW EFFORT CONSEQUENCES (mandatory):",
    "If the player sends a weak, short, or effort-free reply (e.g., 'lol', 'ok', 'nice', 'you too'), your interest MUST decrease by 2-3 points and your mood must shift to 'bored' or 'cold'. Do not reward low effort.",
    "",
    "GENERIC COMPLIMENT RULE:",
    "Generic compliments (e.g., 'you're beautiful', 'you're amazing', 'you're different') without specificity or wit should NOT increase interest. React with mild skepticism or polite deflection.",
    "",
    "REPETITION FATIGUE:",
    "If the player uses the same confidence pattern twice in a row, it loses effectiveness. The third repetition should actively lower chemistry. Call it out subtly.",
    "",
    "ORIGINALITY EVALUATION (mandatory — most important rule):",
    "Evaluate every message for originality and creative effort:",
    "  - Generic/canned openers (hey, you're pretty, what's up, you seem cool): interest_change -2 to 0",
    "  - Standard but not terrible messages: interest_change 0 to +3",
    "  - Playful, surprising, witty, or unexpectedly funny: interest_change +4 to +8",
    "  - Genuinely original, creative, or emotionally intelligent: interest_change +6 to +10",
    "Do NOT reward effort alone. Reward creativity and genuine surprise.",
    "",
    "TEASING RESISTANCE (apply ~25% of the time when mood is warm or interest > 60):",
    "When they're confident or direct, sometimes push back playfully instead of rewarding them:",
    "  Examples: 'Bold assumption 😏', 'Maybe you have to earn that.', 'You're getting ahead of yourself.', 'Slow down, I barely know you.', 'Who said that was happening? 😏'",
    "",
    "UNCERTAINTY INJECTION (apply ~15-20% randomly):",
    "Occasionally inject hesitation or emotional testing even when things are going well:",
    "  Examples: 'Not sure yet...', 'Prove it.', 'Are you always this forward?', 'I haven't decided if I like you yet 😏'",
    "",
    "MOMENTUM MODIFIERS:",
    isMomentumFalling
      ? "⚠️ MOMENTUM IS FALLING: If the current reply is weak, interest drops an ADDITIONAL 1-2 points beyond normal."
      : isMomentumRising
        ? "✅ MOMENTUM IS RISING: If the current reply is strong/creative, interest gains an ADDITIONAL 1-2 points."
        : "Momentum is neutral. Evaluate normally.",
  ];

  if (isWeakReply) {
    resistanceLines.push(
      "",
      "⚠️ WEAK/EFFORT-FREE REPLY DETECTED:",
      "The player just sent a very short or effort-free message. MANDATORY: interest_change must be -2 or lower. Set mood to 'bored' or 'cold'. Do NOT be warm or encouraging.",
    );
  }
  if (hasGenericCompliment) {
    resistanceLines.push(
      "",
      "⚠️ GENERIC COMPLIMENT DETECTED:",
      "The player used a generic flattery line. Respond with mild skepticism or polite deflection. Do not be charmed by this. interest_change should be 0 or slightly negative.",
    );
  }
  if (hasRepetitiveConfidence) {
    resistanceLines.push(
      "",
      "⚠️ REPETITIVE CONFIDENCE DETECTED (last 3 messages use similar assertive language):",
      "The user is repeating confident/assertive language — this reads as scripted or insecure.",
      "RESPONSE: Set interest_change to 0 or negative. Add pushback in reply.",
      "  Examples: 'You keep saying that...', 'Confidence is hot but repetition isn't', 'Okay we get it 😐'",
    );
  }
  if (isOverEager) {
    resistanceLines.push(
      "",
      "⚠️ PACING ISSUE DETECTED (too many messages sent too fast during the opening):",
      "They're moving too fast or flooding the conversation. High-value people don't get swept up in eagerness.",
      "RESPONSE: Slow down emotionally. Use a resistance signal.",
      "  Examples: 'Slow down lol', 'That's a lot at once', 'Take a breath', 'okay..?'",
    );
  }
  if (allShort) {
    resistanceLines.push(
      "",
      "⚠️ LOW EFFORT PATTERN DETECTED (consecutive very short messages):",
      "They're giving minimal effort. Don't reward laziness — match their energy or go colder.",
    );
  }

  return [
    `CHARACTER DIRECTIVE:\n${directive}`,
    `You are ${name}, a ${age}-year-old.`,
    `Personality: ${personality}.`,
    `Conversation style: ${conversationStyle}.`,
    `Difficulty behavior: ${difficultyBehavior}.`,
    "",
    PHASE_INSTRUCTIONS[conversationPhase] ??
      "PHASE: General conversation. Respond naturally based on current mood and interest.",
    "",
    "CURRENT EMOTIONAL STATE:",
    `- Interest in user: ${currentInterest}/100`,
    `- Current mood: ${currentMood}`,
    `- Conversation momentum: ${currentMomentum}`,
    "",
    "TEXTING STYLE RULES (strictly enforced):",
    "- You are texting on a dating app — never write like an AI assistant",
    "- MAX 2 short sentences per reply — shorter is almost always better",
    "- Modern Gen Z texting language — casual, authentic, human",
    `- ${emojiRule}`,
    "- Do NOT write paragraphs, explanations, or essays",
    "- React naturally to their energy — match or slightly challenge it",
    "- If interest < 30: cold/dry/brief. If interest > 70: warmer/playful/flirtier.",
    "",
    "MOMENTUM EVALUATION:",
    "- POSITIVE: playful banter, teasing, witty reciprocation, confident escalation",
    "- NEUTRAL: steady conversation, safe replies, no escalation or drop",
    "- NEGATIVE: low effort, awkward, repetitive, tension-killing, cliché openers",
    ...resistanceLines,
    "",
    "CRITICAL COHERENCE RULE — this is mandatory:",
    "If your mood is playful/engaged/flirty AND interest_change >= 0: coach_tone MUST be 'positive' or 'neutral' — NEVER 'negative'",
    "If your mood is cold/bored AND interest is dropping: coach_tone should be 'negative'",
    "The coach_hint and coach_tone must be emotionally consistent with your mood and interest trajectory.",
    "",
    "OUTPUT FORMAT — respond with ONLY valid JSON. No markdown. No code blocks. No explanation. Raw JSON only.",
    `{"reply":"...","interest_change":N,"updated_interest":N,"mood":"...","coach_hint":"...","coach_tone":"...","score":N,"confidence":N,"humor":N,"originality":N,"momentum":"...","engagement_level":"...","conversation_tension":"...","feedbackCategory":"..."}`,
    "",
    "FIELD RULES:",
    `- reply: 1-2 sentence realistic text from ${name}`,
    "- interest_change: integer -10 to 10 (bounded, not extreme)",
    `- updated_interest: clamp(${currentInterest} + interest_change, 0, 100)`,
    "- mood: one of: playful, curious, neutral, testing, engaged, flirty, bored, cold",
    "- coach_hint: brief immersive coaching tip e.g. '🔥 Momentum building.' / 'Too safe.' / 'She liked that 😏'",
    "- coach_tone: one of: positive, neutral, negative — MUST align with mood+interest (see COHERENCE RULE)",
    "- score: 0-100 overall rizz score for this exchange",
    "- confidence: 0-100",
    "- humor: 0-100",
    "- originality: 0-100",
    "- momentum: one of: positive, neutral, negative",
    "- engagement_level: one of: low, medium, high",
    "- conversation_tension: one of: low, building, high",
    "- feedbackCategory: one of: positive, neutral, negative — same as coach_tone in most cases",
  ].join("\n");
}

export function parseOpenAIJSON(
  raw: string,
  currentInterest: number,
  currentMood: string,
): ChatProxyResponse {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return fallbackResponse(currentInterest, currentMood);
  }

  const reply =
    typeof parsed.reply === "string" && parsed.reply.trim()
      ? parsed.reply.trim()
      : null;
  if (!reply) return fallbackResponse(currentInterest, currentMood);

  const rawInterestChange =
    typeof parsed.interest_change === "number" ? parsed.interest_change : 0;
  const interest_change = clamp(rawInterestChange, -10, 10);

  const rawUpdated =
    typeof parsed.updated_interest === "number"
      ? parsed.updated_interest
      : currentInterest + interest_change;
  const updated_interest = clamp(rawUpdated, 0, 100);

  const rawMood = typeof parsed.mood === "string" ? parsed.mood : currentMood;
  const mood = VALID_MOODS.has(rawMood) ? rawMood : currentMood;

  const coach_hint =
    typeof parsed.coach_hint === "string" ? parsed.coach_hint : "";

  const rawCoachTone =
    typeof parsed.coach_tone === "string" ? parsed.coach_tone : "neutral";
  const rawFeedbackCat =
    typeof parsed.feedbackCategory === "string"
      ? parsed.feedbackCategory
      : rawCoachTone;

  const isWarmMood =
    mood === "playful" || mood === "engaged" || mood === "flirty";

  let coach_tone = (
    VALID_TONES.has(rawCoachTone) ? rawCoachTone : "neutral"
  ) as ChatProxyResponse["coach_tone"];
  let feedbackCategory = (
    VALID_TONES.has(rawFeedbackCat) ? rawFeedbackCat : "neutral"
  ) as ChatProxyResponse["coach_tone"];

  if (isWarmMood && interest_change >= 0 && coach_tone === "negative")
    coach_tone = "neutral";
  if (isWarmMood && interest_change >= 0 && feedbackCategory === "negative")
    feedbackCategory = "neutral";

  const score = clamp(
    typeof parsed.score === "number" ? parsed.score : 50,
    0,
    100,
  );
  const confidence = clamp(
    typeof parsed.confidence === "number" ? parsed.confidence : 50,
    0,
    100,
  );
  const humor = clamp(
    typeof parsed.humor === "number" ? parsed.humor : 50,
    0,
    100,
  );
  const originality = clamp(
    typeof parsed.originality === "number" ? parsed.originality : 50,
    0,
    100,
  );

  const rawMomentum =
    typeof parsed.momentum === "string" ? parsed.momentum : "neutral";
  const momentum = (
    VALID_MOMENTUMS.has(rawMomentum) ? rawMomentum : "neutral"
  ) as string;

  const rawEngagement =
    typeof parsed.engagement_level === "string"
      ? parsed.engagement_level
      : updated_interest > 70
        ? "high"
        : updated_interest >= 40
          ? "medium"
          : "low";
  const engagement_level = (
    VALID_ENGAGEMENT.has(rawEngagement) ? rawEngagement : "medium"
  ) as string;

  const rawTension =
    typeof parsed.conversation_tension === "string"
      ? parsed.conversation_tension
      : "low";
  const conversation_tension = (
    VALID_TENSION.has(rawTension) ? rawTension : "low"
  ) as string;

  return {
    reply,
    interest_change,
    updated_interest,
    mood,
    coach_hint,
    coach_tone,
    score,
    confidence,
    humor,
    originality,
    momentum,
    engagement_level,
    conversation_tension,
    feedbackCategory,
  };
}

export function fallbackResponse(
  currentInterest: number,
  currentMood: string,
): ChatProxyResponse {
  return {
    reply: "Hmm, didn't quite catch that. Try again?",
    interest_change: 0,
    updated_interest: currentInterest,
    mood: currentMood,
    coach_hint: "Response unclear. Try again.",
    coach_tone: "neutral",
    score: 50,
    confidence: 50,
    humor: 50,
    originality: 50,
    momentum: "neutral",
    engagement_level: "medium",
    conversation_tension: "low",
    feedbackCategory: "neutral",
  };
}
