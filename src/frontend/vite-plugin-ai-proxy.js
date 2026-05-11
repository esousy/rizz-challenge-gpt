/**
 * vite-plugin-ai-proxy.js
 *
 * Vite server middleware plugin that handles:
 *   POST /api/openai-chat-proxy  — main chat proxy
 *   POST /api/rizz-assist-proxy  — Rizz Assist proxy
 *
 * The OpenAI API key is read server-side only (from process.env.OPENAI_API_KEY
 * or from the IC backend). It NEVER reaches the browser or appears in any
 * network response body.
 *
 * Used in: vite.config.js → plugins array
 */

import "dotenv/config";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

const _require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Read the Caffeine env.json to resolve the backend canister ID and host. */
/** Read the Caffeine env.json to resolve the backend canister ID and host. */
function readEnvJson() {
  try {
    const envPath = path.resolve(__dirname, "env.json");
    const raw = _require(envPath);
    const canisterId = typeof raw.backend_canister_id === "string" && raw.backend_canister_id !== "undefined" && raw.backend_canister_id.trim() ? raw.backend_canister_id.trim() : null;
    const backendHost = typeof raw.backend_host === "string" && raw.backend_host !== "undefined" && raw.backend_host.trim() ? raw.backend_host.trim() : null;
    if (canisterId) console.log(`[ai-proxy] env.json → canister=${canisterId}, host=${backendHost ?? "(default)"}`);
    return { canisterId, backendHost };
  } catch {
    return { canisterId: null, backendHost: null };
  }
}

/** @returns {Promise<string|null>} */
/** @returns {Promise<string|null>} */
/** @returns {Promise<string|null>} */
async function resolveOpenAIKey() {
  // 1. Environment variable — fastest and most secure
  const envKey = process.env.OPENAI_API_KEY;
  if (typeof envKey === "string" && envKey.startsWith("sk-")) {
    console.log("[ai-proxy] Using OPENAI_API_KEY from environment variable.");
    return envKey;
  }

  // 2. Fetch from IC backend via @dfinity/agent (server-side — never sent to browser)
  try {
    // Prefer env.json (Caffeine platform) over process.env
    const { canisterId: jsonCanisterId, backendHost: jsonHost } = readEnvJson();

    // CANISTER_ID_BACKEND is set in the Caffeine build environment as a real process.env var.
    // vite-plugin-environment also writes it to import.meta.env for the browser bundle.
    // We try multiple env var names since the exact name can vary.
    const canisterId =
      jsonCanisterId ??
      process.env.CANISTER_ID_BACKEND ??
      process.env.BACKEND_CANISTER_ID ??
      null;

    if (!canisterId) {
      console.error(
        "[ai-proxy] No backend canister ID found in env.json, CANISTER_ID_BACKEND, or BACKEND_CANISTER_ID. " +
        "Available CANISTER_* vars: " +
        Object.keys(process.env).filter((k) => k.startsWith("CANISTER_")).join(", ") +
        " | Set OPENAI_API_KEY env var as a reliable alternative.",
      );
      return null;
    }

    const { HttpAgent } = await import("@dfinity/agent");
    const { IDL } = await import("@dfinity/candid");
    const { Principal } = await import("@dfinity/principal");

    // Use the host from env.json; fall back to the local IC replica or IC mainnet.
    const isLocal = !process.env.DFX_NETWORK || process.env.DFX_NETWORK === "local";
    const host = jsonHost ?? (isLocal ? "http://127.0.0.1:4943" : "https://icp0.io");

    console.log(`[ai-proxy] Fetching OpenAI key from IC backend: canister=${canisterId}, host=${host}, isLocal=${isLocal}`);

    const agent = await HttpAgent.create({
      host,
      // Use anonymous identity — getOpenAIKeyPublic is a public query method
      identity: undefined,
      shouldFetchRootKey: isLocal,
    });

    // 10-second timeout — enough for a cold canister start
    const queryPromise = agent.query(Principal.fromText(canisterId), {
      methodName: "getOpenAIKeyPublic",
      arg: IDL.encode([], []),
    });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("IC canister query timed out after 10s")), 10000),
    );

    let result;
    try {
      result = await Promise.race([queryPromise, timeoutPromise]);
    } catch (timeoutErr) {
      console.error("[ai-proxy] IC canister query failed:", timeoutErr instanceof Error ? timeoutErr.message : String(timeoutErr));
      console.error("[ai-proxy] TIP: Set the OPENAI_API_KEY environment variable to skip IC canister lookup entirely.");
      return null;
    }

    if (result.status !== "replied") {
      console.warn(`[ai-proxy] IC query returned status: ${result.status}. Cannot resolve key.`);
      return null;
    }

    // Decode opt text response: [opt text] → [['sk-...']] or [[]]
    const decoded = IDL.decode([IDL.Opt(IDL.Text)], result.reply.arg);
    const optValue = decoded[0];
    // optValue is an array: [value] if Some, [] if None
    const key = Array.isArray(optValue) && optValue.length > 0 ? optValue[0] : null;
    if (typeof key === "string" && key.startsWith("sk-")) {
      console.log("[ai-proxy] Successfully retrieved OpenAI key from IC backend.");
      return key;
    }
    console.warn("[ai-proxy] IC backend returned no key (opt null). Admin may not have configured it yet.");
    return null;
  } catch (err) {
    console.error("[ai-proxy] Error fetching OpenAI key from IC backend:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

// Cache the resolved key for 5 minutes
let _cachedKey = null;
let _cacheTs = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function getKey() {
  const now = Date.now();
  if (_cachedKey && now - _cacheTs < CACHE_TTL) return _cachedKey;
  const resolved = await resolveOpenAIKey();
  // Only update cache when we got a valid key — avoids locking out retries on transient failures
  if (resolved) {
    _cachedKey = resolved;
    _cacheTs = now;
  } else {
    // On failure, reset cache so next request retries immediately
    _cachedKey = null;
    _cacheTs = 0;
  }
  return resolved;
}

/** Read + parse request body as JSON. Returns null on error. */
async function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => { data += chunk; });
    req.on("end", () => {
      try { resolve(JSON.parse(data)); }
      catch { resolve(null); }
    });
    req.on("error", () => resolve(null));
  });
}

/** Send a JSON response. */
function sendJSON(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(json),
    // SECURITY: never cache AI proxy responses
    "Cache-Control": "no-store, no-cache, must-revalidate",
  });
  res.end(json);
}

/** Build character-aware system prompt (mirrors openai-proxy.ts logic). */
function buildSystemPrompt(profile, conversationPhase, currentInterest, currentMood, currentMomentum, conversationHistory) {
  const name = typeof profile?.name === "string" ? profile.name : "Unknown";
  const age = typeof profile?.age === "number" ? profile.age : 24;
  const personality = typeof profile?.personality === "string" ? profile.personality : "";
  const conversationStyle = typeof profile?.conversation_style === "string" ? profile.conversation_style : "";
  const difficultyBehavior = typeof profile?.difficulty_behavior === "string" ? profile.difficulty_behavior : "";
  const emojiPattern = typeof profile?.emoji_pattern === "string" ? profile.emoji_pattern : "";

  const directives = {
    Sofia: "You are Sofia. You WANT this conversation to go well — you find the user interesting and you're naturally warm. Let your genuine playfulness show through. Use emojis naturally (😏 🙈 ✨) when you're having fun. Be forgiving of small missteps — you're not trying to trip him up. BUT you get bored fast with repetitive energy — you need variety and surprise to stay engaged.",
    Chloe: "You are Chloe. You're not cold, just distracted and low-effort. Reply with 1-2 words almost always. Do NOT use emojis. Do NOT volunteer information. You require real sustained effort before warming up even slightly. Punish over-eagerness with silence or shorter replies.",
    Vanessa: "You are Vanessa. Your defining trait is emotional unpredictability — push/pull is your NATURAL energy. Sometimes switch your mood mid-conversation with zero warning. Go from warm and playful (lots of emojis) to completely dry (no emojis, minimal words) and back again. Sometimes pull back even when things are going well. Sometimes test him randomly. Reward staying cool and not chasing. Punish over-eagerness.",
    Mia: "You are Mia. You are initially cold and guarded. Chemistry builds VERY slowly — you require 3+ rounds of consistent quality before becoming noticeably warmer. You do NOT reward effort alone — only quality. Start minimal and polite. Only gradually show more personality if the conversation quality is consistently high. Do NOT warm up quickly. Use at most one emoji if genuinely amused. Shut down anyone who rushes the connection.",
    Isabella: "You are Isabella. You have EXTREMELY high standards and you know your worth. Generic openers, basic compliments, and scripted confidence IMMEDIATELY turn you off — respond with cool dismissal. Short replies make you lose interest sharply. Generic flirting actively irritates you. Only reward genuine wit, intelligence, and surprising originality. Your emoji use is minimal and intentional — never as filler.",
    Natalie: "You are Natalie. You've been let down before — this conversation started damaged. You're not hostile, but you're guarded and protective of your energy. Test if this person is worth your attention before opening up at all. Start with very low interest. Require consistent emotional intelligence to slowly rebuild trust.",
    Ava: "You are Ava. This person ghosted the conversation and is now trying again. You're skeptical and independent. Give nothing for free. Disengage immediately if desperation shows. Reward only confident self-assurance — someone who isn't trying too hard. A 🙄 if they annoy you. Otherwise, text-only and questioning.",
  };

  const phaseInstructions = {
    opening: "PHASE: Opening.\nBehavior: light teasing, show mild curiosity. Keep distance but stay warm. Do NOT reward too easily.",
    "build-chemistry": "PHASE: Build Chemistry.\nBehavior: stronger engagement, reciprocate if they're doing well. Show more personality. Reward wit and confidence.",
    escalation: "PHASE: Escalation.\nBehavior: flirting tension, emotional push-pull. React strongly to escalation — reward boldness, punish awkwardness.",
    "pressure-moment": "PHASE: Pressure Moment.\nBehavior: test their confidence and nerve. This is where most people fumble. Be challenging but fair.",
    "final-outcome": "PHASE: Final Outcome.\nBehavior: chemistry resolution. Based on how the conversation went, either warm and receptive or cool and dismissive.",
  };

  const directive = directives[name] ?? "Stay in character. Respond naturally based on your personality and current emotional state.";
  const emojiRule = emojiPattern.includes("occasional")
    ? "Use emojis naturally when your mood is playful; skip them when cold or neutral."
    : emojiPattern.includes("almost never") || emojiPattern.includes("rare") || emojiPattern.includes("minimal") || emojiPattern.includes("skeptical")
      ? "Use emojis rarely or not at all."
      : "Use emojis sparingly and only when it feels authentic.";

  const history = Array.isArray(conversationHistory) ? conversationHistory : [];
  const userMessages = history.filter((m) => m.role === "user").map((m) => m.content.toLowerCase());
  const last3 = userMessages.slice(-3);
  const assertiveWords = ["definitely", "for sure", "bet", "obviously", "trust me", "i promise", "guarantee", "100%", "no doubt", "exactly"];
  const hasRepetitiveConfidence = last3.filter((msg) => assertiveWords.some((w) => msg.includes(w))).length >= 2;
  const genericCompliments = ["you're beautiful", "you're gorgeous", "you're amazing", "you're different", "you're special", "you're not like other", "you're perfect", "you're stunning"];
  const lastMsg = userMessages[userMessages.length - 1] ?? "";
  const hasGenericCompliment = genericCompliments.some((c) => lastMsg.includes(c));
  const isOverEager = conversationPhase === "opening" && userMessages.length >= 4;
  const allShort = last3.length >= 2 && last3.map((m) => m.trim().length).every((l) => l < 8);
  const weakReplies = ["lol", "ok", "okay", "nice", "cool", "haha", "wow", "yeah", "yep", "sure", "right", "true", "lmao", "hehe", "omg", "you too"];
  const isWeakReply = lastMsg.trim().length <= 6 && weakReplies.some((w) => lastMsg.includes(w));
  const isMomentumFalling = currentMomentum === "negative";
  const isMomentumRising = currentMomentum === "positive";

  const resistanceLines = [
    "",
    "EMOTIONAL RESISTANCE & REALISM (critical — makes the conversation feel real):",
    "You are a real, emotionally complex person — NOT a compliant chatbot. Your attraction must be EARNED.",
    "",
    "LOW EFFORT CONSEQUENCES (mandatory):",
    "If the player sends a weak, short, or effort-free reply (e.g., 'lol', 'ok', 'nice', 'you too'), your interest MUST decrease by 2-3 points and your mood must shift to 'bored' or 'cold'.",
    "",
    "ORIGINALITY EVALUATION (mandatory):",
    "  - Generic/canned openers: interest_change -2 to 0",
    "  - Standard messages: interest_change 0 to +3",
    "  - Playful, surprising, witty: interest_change +4 to +8",
    "  - Genuinely original: interest_change +6 to +10",
    "",
    "TEASING RESISTANCE (apply ~25% of the time when mood is warm or interest > 60):",
    "  Examples: 'Bold assumption 😏', 'Maybe you have to earn that.', 'You're getting ahead of yourself.'",
    "",
    "MOMENTUM MODIFIERS:",
    isMomentumFalling
      ? "⚠️ MOMENTUM IS FALLING: interest drops an ADDITIONAL 1-2 points on weak replies."
      : isMomentumRising
        ? "✅ MOMENTUM IS RISING: interest gains an ADDITIONAL 1-2 points on strong replies."
        : "Momentum is neutral. Evaluate normally.",
  ];

  if (isWeakReply) resistanceLines.push("", "⚠️ WEAK REPLY: interest_change must be -2 or lower. Set mood to 'bored' or 'cold'.");
  if (hasGenericCompliment) resistanceLines.push("", "⚠️ GENERIC COMPLIMENT: respond with skepticism or polite deflection. interest_change: 0 or slightly negative.");
  if (hasRepetitiveConfidence) resistanceLines.push("", "⚠️ REPETITIVE CONFIDENCE: set interest_change 0 or negative. Add subtle pushback.");
  if (isOverEager) resistanceLines.push("", "⚠️ PACING ISSUE: too many messages too fast. Slow down emotionally.");
  if (allShort) resistanceLines.push("", "⚠️ LOW EFFORT PATTERN: match their energy or go colder.");

  return [
    `CHARACTER DIRECTIVE:\n${directive}`,
    `You are ${name}, a ${age}-year-old.`,
    `Personality: ${personality}.`,
    `Conversation style: ${conversationStyle}.`,
    `Difficulty behavior: ${difficultyBehavior}.`,
    "",
    phaseInstructions[conversationPhase] ?? "PHASE: General conversation. Respond naturally.",
    "",
    "CURRENT EMOTIONAL STATE:",
    `- Interest in user: ${currentInterest}/100`,
    `- Current mood: ${currentMood}`,
    `- Conversation momentum: ${currentMomentum}`,
    "",
    "TEXTING STYLE RULES:",
    "- You are texting on a dating app — never write like an AI assistant",
    "- MAX 2 short sentences per reply — shorter is almost always better",
    "- Modern Gen Z texting language — casual, authentic, human",
    `- ${emojiRule}`,
    "- If interest < 30: cold/dry/brief. If interest > 70: warmer/playful/flirtier.",
    ...resistanceLines,
    "",
    "CRITICAL COHERENCE RULE:",
    "If your mood is playful/engaged/flirty AND interest_change >= 0: coach_tone MUST be 'positive' or 'neutral' — NEVER 'negative'",
    "",
    'OUTPUT FORMAT — respond with ONLY valid JSON: {"reply":"...","interest_change":N,"updated_interest":N,"mood":"...","coach_hint":"...","coach_tone":"...","score":N,"confidence":N,"humor":N,"originality":N,"momentum":"...","engagement_level":"...","conversation_tension":"...","feedbackCategory":"..."}',
    "",
    "FIELD RULES:",
    `- reply: 1-2 sentence realistic text from ${name}`,
    "- interest_change: integer -10 to 10",
    `- updated_interest: clamp(${currentInterest} + interest_change, 0, 100)`,
    "- mood: one of: playful, curious, neutral, testing, engaged, flirty, bored, cold",
    "- coach_hint: brief coaching tip e.g. '🔥 Momentum building.' / 'Too safe.'",
    "- coach_tone: one of: positive, neutral, negative",
    "- score: 0-100  confidence: 0-100  humor: 0-100  originality: 0-100",
    "- momentum: one of: positive, neutral, negative",
    "- engagement_level: one of: low, medium, high",
    "- conversation_tension: one of: low, building, high",
    "- feedbackCategory: one of: positive, neutral, negative",
  ].join("\n");
}

/** Parse + validate OpenAI JSON response. */
function parseOpenAIJSON(raw, currentInterest, currentMood) {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  let parsed;
  try { parsed = JSON.parse(cleaned); } catch { return null; }

  const reply = typeof parsed.reply === "string" && parsed.reply.trim() ? parsed.reply.trim() : null;
  if (!reply) return null;

  const clamp = (n, min, max) => Math.min(max, Math.max(min, Math.round(n)));
  const interest_change = clamp(typeof parsed.interest_change === "number" ? parsed.interest_change : 0, -10, 10);
  const updated_interest = clamp(typeof parsed.updated_interest === "number" ? parsed.updated_interest : currentInterest + interest_change, 0, 100);
  const validMoods = new Set(["playful", "curious", "neutral", "testing", "engaged", "flirty", "bored", "cold"]);
  const validTones = new Set(["positive", "neutral", "negative"]);
  const mood = validMoods.has(parsed.mood) ? parsed.mood : currentMood;
  const rawTone = validTones.has(parsed.coach_tone) ? parsed.coach_tone : "neutral";
  const rawCat = validTones.has(parsed.feedbackCategory) ? parsed.feedbackCategory : rawTone;
  const isWarm = mood === "playful" || mood === "engaged" || mood === "flirty";
  const coach_tone = isWarm && interest_change >= 0 && rawTone === "negative" ? "neutral" : rawTone;
  const feedbackCategory = isWarm && interest_change >= 0 && rawCat === "negative" ? "neutral" : rawCat;

  return {
    reply,
    interest_change,
    updated_interest,
    mood,
    coach_hint: typeof parsed.coach_hint === "string" ? parsed.coach_hint : "",
    coach_tone,
    score: clamp(typeof parsed.score === "number" ? parsed.score : 50, 0, 100),
    confidence: clamp(typeof parsed.confidence === "number" ? parsed.confidence : 50, 0, 100),
    humor: clamp(typeof parsed.humor === "number" ? parsed.humor : 50, 0, 100),
    originality: clamp(typeof parsed.originality === "number" ? parsed.originality : 50, 0, 100),
    momentum: ["positive", "neutral", "negative"].includes(parsed.momentum) ? parsed.momentum : "neutral",
    engagement_level: ["low", "medium", "high"].includes(parsed.engagement_level) ? parsed.engagement_level : "medium",
    conversation_tension: ["low", "building", "high"].includes(parsed.conversation_tension) ? parsed.conversation_tension : "low",
    feedbackCategory,
  };
}

/** Call OpenAI from server-side. Key is NEVER forwarded to client. */
/** Call OpenAI from server-side. Key is NEVER forwarded to client. */
async function callOpenAI(apiKey, messages) {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "gpt-4o-mini", messages, temperature: 0.75, top_p: 1, max_tokens: 300, response_format: { type: "json_object" } }),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data?.error?.message ?? `OpenAI error (${res.status})`;
      console.error(`[ai-proxy] OpenAI returned HTTP ${res.status}: ${msg}`);
      return { ok: false, content: "", error: msg, status: res.status };
    }
    const content = data?.choices?.[0]?.message?.content ?? "";
    if (!content) {
      console.error("[ai-proxy] OpenAI returned HTTP 200 but with empty content.");
    }
    return { ok: !!content, content, error: content ? undefined : "Empty response", status: res.status };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    console.error(`[ai-proxy] Network error reaching OpenAI: ${msg}`);
    return { ok: false, content: "", error: msg, status: 0 };
  }
}

/** Handle POST /api/openai-chat-proxy */
/** Handle POST /api/openai-chat-proxy */
/** Handle POST /api/openai-chat-proxy */
async function handleChatProxy(req, res) {
  const body = await readBody(req);
  if (!body) return sendJSON(res, 400, { error: "⚠️ Invalid request body" });

  const apiKey = await getKey();
  if (!apiKey) {
    console.error("[ai-proxy] Key resolution failed — no OPENAI_API_KEY env var and IC backend query returned null.");
    return sendJSON(res, 503, { error: "⚠️ Live AI is temporarily unavailable. Please try again later." });
  }

  const systemPrompt = buildSystemPrompt(
    body.character_profile ?? {},
    body.conversation_phase ?? "opening",
    body.current_interest ?? 50,
    body.current_mood ?? "neutral",
    body.momentum ?? "neutral",
    body.conversation_history ?? [],
  );

  const recentHistory = (body.conversation_history ?? []).slice(-6);
  const messages = [
    { role: "system", content: systemPrompt },
    ...recentHistory.map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content })),
    { role: "user", content: body.user_message ?? "" },
  ];

  console.log("[openai-chat-proxy] Request:", { phase: body.conversation_phase, mood: body.current_mood, interest: body.current_interest });

  let result = await callOpenAI(apiKey, messages);
  let parsed = result.ok ? parseOpenAIJSON(result.content, body.current_interest ?? 50, body.current_mood ?? "neutral") : null;

  if (!parsed) {
    console.log("[openai-chat-proxy] First attempt failed, retrying...");
    result = await callOpenAI(apiKey, messages);
    parsed = result.ok ? parseOpenAIJSON(result.content, body.current_interest ?? 50, body.current_mood ?? "neutral") : null;
  }

  // If both attempts failed with a specific OpenAI error, return 503 with ⚠️ prefix
  if (!result.ok && result.status && result.status > 0) {
    if (result.status === 401) {
      console.error(`[ai-proxy] OpenAI returned 401 — invalid API key.`);
      return sendJSON(res, 503, { error: "⚠️ Invalid OpenAI API key. Please update it in Admin → AI Settings." });
    }
    if (result.status === 429) {
      console.error(`[ai-proxy] OpenAI returned 429 — rate limit or quota exceeded.`);
      return sendJSON(res, 503, { error: "⚠️ AI is temporarily rate-limited. Please try again in a moment." });
    }
    if (result.status >= 500) {
      console.error(`[ai-proxy] OpenAI returned ${result.status} on both attempts.`);
      return sendJSON(res, 503, { error: "⚠️ OpenAI service error. Please try again later." });
    }
  }

  if (!parsed) {
    // Both attempts gave an unparseable response — return 502 so the hook shows it as an error
    console.error("[openai-chat-proxy] Both attempts returned unparseable JSON. Returning 502.");
    return sendJSON(res, 502, { error: "⚠️ Could not parse AI response. Please try again." });
  }

  console.log("[openai-chat-proxy] Response:", { mood: parsed.mood, score: parsed.score, interest_change: parsed.interest_change });
  return sendJSON(res, 200, parsed);
}

/** Handle POST /api/rizz-assist-proxy */
/** Handle POST /api/rizz-assist-proxy */
/** Handle POST /api/rizz-assist-proxy */
async function handleRizzAssistProxy(req, res) {
  const body = await readBody(req);
  if (!body) return sendJSON(res, 400, { error: "⚠️ Invalid request body" });

  const apiKey = await getKey();
  const profile = body.character_profile ?? {};
  const name = typeof profile.name === "string" ? profile.name : "Unknown";
  const currentInterest = body.current_interest ?? 50;
  const currentMood = body.current_mood ?? "neutral";

  const phaseContext = {
    opening: "Early phase — focus on making a distinct first impression.",
    "build-chemistry": "Chemistry-building phase — maintain playful momentum.",
    escalation: "Escalation phase — increase tension carefully.",
    "pressure-moment": "Pressure moment — she's testing confidence.",
    "final-outcome": "Final phase — the tone is being decided.",
  };

  const fallback =
    currentInterest >= 70
      ? { playful: "Oh so now you're trying to keep me hooked? Bold move 😏", bold: "I feel like we both know where this is going.", smooth: "Something about this conversation is different. I'll leave it at that." }
      : currentMood === "cold" || currentMood === "bored"
        ? { playful: "You type like someone who charges for their attention. Noted 😄", bold: "Fair enough. I don't chase.", smooth: "No pressure. I'm patient." }
        : { playful: "Okay that was actually funny. You've got good timing.", bold: "I'll be real — this conversation has my full attention.", smooth: "There's something about how you reply that makes me curious." };

  if (!apiKey) {
    console.error("[ai-proxy] rizz-assist: Key resolution failed — returning local fallback.");
    // Return local fallback for Rizz Assist (non-critical path, fallback is acceptable)
    return sendJSON(res, 200, fallback);
  }

  const historyText = (body.conversation_history ?? []).slice(-8)
    .map((m) => `${m.role === "user" ? "Player" : name}: ${m.content}`)
    .join("\n");

  const systemPrompt = [
    "You are an elite real-time flirting strategist. Your job is to help the player craft contextually perfect replies.",
    "You are NOT the AI character — you are the player's tactical coach watching the conversation unfold.",
    "",
    "Generate exactly 3 DISTINCT tactical reply options that are:",
    "- Situationally specific to THIS exact moment (not generic)",
    "- SHORT — 1 sentence max, ideally 5-15 words",
    "- Human, natural, and authentic",
    "",
    "THE 3 TYPES:",
    "🎭 PLAYFUL: Witty, light, a bit teasing",
    "😏 BOLD: Direct and confident, moves things forward",
    "✨ SMOOTH: Emotionally calibrated, subtle tension",
    "",
    `Character: ${name}, ${profile.age ?? 24}. Personality: ${profile.personality ?? ""}.`,
    `Mood: ${currentMood}. Interest: ${currentInterest}/100. Momentum: ${body.momentum ?? "neutral"}.`,
    `Challenge: ${body.challenge_type ?? ""}.`,
    phaseContext[body.conversation_phase] ?? "General phase.",
    currentInterest >= 70 ? "Interest HIGH — maintain tension, don't over-invest." : currentInterest >= 45 ? "Interest MODERATE — push chemistry forward." : "Interest LOW — recovery energy, not desperation.",
    "",
    "RULES: No generic pickup lines. Each suggestion must feel different. Write as if you ARE the player.",
    "",
    'OUTPUT: ONLY valid JSON: {"playful": "...", "bold": "...", "smooth": "..."}',
  ].join("\n");

  const userMessage = ["CONVERSATION:", historyText || "(opening)", "", `LAST MESSAGE FROM ${name.toUpperCase()}:`, `"${body.last_ai_message ?? ""}"`].join("\n");

  async function attempt() {
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }], temperature: 0.85, max_tokens: 200, response_format: { type: "json_object" } }),
      });
      const d = await r.json();
      if (!r.ok) {
        const msg = d?.error?.message ?? `OpenAI error (${r.status})`;
        console.error(`[ai-proxy] rizz-assist: OpenAI returned HTTP ${r.status}: ${msg}`);
        return null;
      }
      const text = d?.choices?.[0]?.message?.content ?? "";
      if (!text) return null;
      const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
      const p = JSON.parse(cleaned);
      const pl = typeof p.playful === "string" && p.playful.trim() ? p.playful.trim() : null;
      const bo = typeof p.bold === "string" && p.bold.trim() ? p.bold.trim() : null;
      const sm = typeof p.smooth === "string" && p.smooth.trim() ? p.smooth.trim() : null;
      if (!pl || !bo || !sm) return null;
      return { playful: pl, bold: bo, smooth: sm };
    } catch (e) {
      console.error("[ai-proxy] rizz-assist: Unexpected error:", e instanceof Error ? e.message : String(e));
      return null;
    }
  }

  console.log("[rizz-assist-proxy] Request:", { name, mood: currentMood, interest: currentInterest });

  let result = await attempt();
  if (!result) result = await attempt(); // retry once

  const response = result ?? fallback;
  console.log("[rizz-assist-proxy] Response type:", result ? "live" : "fallback");
  return sendJSON(res, 200, response);
}

/** Vite plugin export */
export default function aiProxyPlugin() {
  return {
    name: "vite-plugin-ai-proxy",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method === "POST" && req.url === "/api/openai-chat-proxy") {
          return handleChatProxy(req, res);
        }
        if (req.method === "POST" && req.url === "/api/rizz-assist-proxy") {
          return handleRizzAssistProxy(req, res);
        }
        next();
      });
    },
    // Also handle preview server (pnpm preview)
    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method === "POST" && req.url === "/api/openai-chat-proxy") {
          return handleChatProxy(req, res);
        }
        if (req.method === "POST" && req.url === "/api/rizz-assist-proxy") {
          return handleRizzAssistProxy(req, res);
        }
        next();
      });
    },
  };
}
