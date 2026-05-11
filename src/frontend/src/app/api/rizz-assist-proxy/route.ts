/**
 * rizz-assist-proxy/route.ts
 *
 * Server-side handler for the Rizz Assist proxy endpoint.
 * Loaded by vite-plugin-ai-proxy.js as Vite server middleware.
 *
 * Uses a coaching strategist system prompt — completely separate from the
 * character roleplay prompt. The OpenAI key is read server-side only.
 */

import { getOpenAIKey } from "../../server/get-openai-key.js";
import { neon } from "@neondatabase/serverless";

// ── AI Usage Logger (writes directly to Neon DB) ──────────────────────────
const OPENAI_MODEL_PRICING: Record<string, { inputPer1MTokens: number; outputPer1MTokens: number }> = {
  "gpt-4o-mini": { inputPer1MTokens: 0.15, outputPer1MTokens: 0.60 },
  "gpt-4.1-mini": { inputPer1MTokens: 0.40, outputPer1MTokens: 1.60 },
  "gpt-4.1": { inputPer1MTokens: 2.00, outputPer1MTokens: 8.00 },
};

function estimateCostUsd(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = OPENAI_MODEL_PRICING[model] ?? OPENAI_MODEL_PRICING["gpt-4o-mini"];
  const inputCost = (promptTokens / 1_000_000) * pricing.inputPer1MTokens;
  const outputCost = (completionTokens / 1_000_000) * pricing.outputPer1MTokens;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}

function getDbUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.NEON_DATABASE_URL;
}

function logAiUsageFireAndForget(params: {
  requestType: string;
  promptTokens: number;
  completionTokens: number;
  success: boolean;
  errorMessage?: string;
  userCategory?: string;
  model?: string;
}) {
  const dbUrl = getDbUrl();
  if (!dbUrl) return;
  const model = params.model ?? "gpt-4o-mini";
  const totalTokens = params.promptTokens + params.completionTokens;
  const estimatedCostUsd = estimateCostUsd(model, params.promptTokens, params.completionTokens);
  const sql = neon(dbUrl);
  sql`
    INSERT INTO ai_usage_logs (user_category, request_type, model, prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd, success, error_message)
    VALUES (${params.userCategory ?? 'anonymous'}, ${params.requestType}, ${model}, ${params.promptTokens}, ${params.completionTokens}, ${totalTokens}, ${estimatedCostUsd}, ${params.success}, ${params.errorMessage ?? null})
  `.catch((err: unknown) => console.error("[logAiUsage] Failed:", err));
}

export interface RizzAssistProxyBody {
  conversation_history: { role: string; content: string }[];
  last_ai_message: string;
  character_profile: {
    name: string;
    age: number;
    personality: string;
  };
  current_mood: string;
  current_interest: number;
  momentum: string;
  challenge_type: string;
  conversation_phase: string;
}

export interface RizzAssistProxyResponse {
  playful: string;
  bold: string;
  smooth: string;
}

function buildCoachingSystemPrompt(
  characterName: string,
  characterAge: number,
  personality: string,
  currentMood: string,
  currentInterest: number,
  momentum: string,
  conversationPhase: string,
  challengeType: string,
): string {
  const phaseContext: Record<string, string> = {
    opening:
      "Early phase — focus on making a distinct first impression. Avoid generic openers. Create intrigue.",
    "build-chemistry":
      "Chemistry-building phase — maintain playful momentum, add some teasing, show personality.",
    escalation:
      "Escalation phase — increase tension carefully. Reward boldness but stay calibrated.",
    "pressure-moment":
      "Pressure moment — she's testing confidence. Suggestions must be grounded and unshaken, not defensive.",
    "final-outcome":
      "Final phase — the tone is being decided. Suggestions should either secure the vibe or recover momentum.",
  };

  const interestCtx =
    currentInterest >= 70
      ? "Her interest is HIGH. Maintain tension — don't over-invest or act too eager."
      : currentInterest >= 45
        ? "Her interest is MODERATE. A well-placed line here can push chemistry forward."
        : "Her interest is LOW. Need a strong pivot — recovery energy, not desperation.";

  const moodCtx =
    currentMood === "cold" || currentMood === "bored"
      ? "She's cold/disengaged. Suggestions must not chase — be confident, slightly detached."
      : currentMood === "testing" || currentMood === "curious"
        ? "She's testing him. Suggestions should hold frame, not fold under pressure."
        : currentMood === "playful" || currentMood === "flirty"
          ? "She's warm and playful. Perfect moment to escalate with wit and light tension."
          : "She's neutral. A surprising or unexpected angle will break through.";

  return [
    "You are an elite real-time flirting strategist. Your job is to help the player craft contextually perfect replies.",
    "You are NOT the AI character — you are the player's tactical coach watching the conversation unfold.",
    "",
    "YOUR MISSION:",
    "Analyze the conversation so far, the character's last message, their emotional state, and generate exactly 3 DISTINCT tactical reply options.",
    "",
    "EACH SUGGESTION MUST:",
    "- Be situationally specific to THIS exact moment (not generic)",
    "- Move the interaction forward in a clear direction",
    "- Feel human, natural, and authentic (never scripted or pickup-line-y)",
    "- Maintain or enhance the emotional tension/chemistry",
    "- Be SHORT — 1 sentence max, ideally 5-15 words",
    "",
    "THE 3 TYPES:",
    "🎭 PLAYFUL: Witty, light, a bit teasing — makes her react with amusement or curiosity",
    "😏 BOLD: Direct and confident — moves the interaction forward without apology",
    "✨ SMOOTH: Emotionally calibrated — subtle, understated tension that lingers",
    "",
    "CONTEXT:",
    `Character: ${characterName}, ${characterAge}. Personality: ${personality}.`,
    `Current mood: ${currentMood}. Interest level: ${currentInterest}/100. Momentum: ${momentum}.`,
    `Challenge type: ${challengeType}.`,
    phaseContext[conversationPhase] ?? "General conversation phase.",
    interestCtx,
    moodCtx,
    "",
    "CRITICAL RULES:",
    "- NEVER use generic pickup lines or clichés",
    "- NEVER be cringe or try-hard",
    "- Each suggestion must feel DIFFERENT from the others in energy and approach",
    "- Do NOT reference 'rizz', 'chemistry', or meta-concepts in the suggestions themselves",
    "- Write as if you ARE the player, not coaching from outside",
    "",
    "OUTPUT FORMAT:",
    "Return ONLY valid JSON. No markdown. No code blocks. No explanation.",
    '{"playful": "...", "bold": "...", "smooth": "..."}',
  ].join("\n");
}

function parseAssistResponse(raw: string): RizzAssistProxyResponse | null {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const playful =
      typeof parsed.playful === "string" && parsed.playful.trim()
        ? parsed.playful.trim()
        : null;
    const bold =
      typeof parsed.bold === "string" && parsed.bold.trim()
        ? parsed.bold.trim()
        : null;
    const smooth =
      typeof parsed.smooth === "string" && parsed.smooth.trim()
        ? parsed.smooth.trim()
        : null;
    if (!playful || !bold || !smooth) return null;
    return { playful, bold, smooth };
  } catch {
    return null;
  }
}

const FALLBACKS = {
  high: {
    playful: "Oh so now you're trying to keep me hooked? Bold move 😏",
    bold: "I feel like we both know where this is going.",
    smooth:
      "Something about this conversation is different. I'll leave it at that.",
  },
  cold: {
    playful: "You type like someone who charges for their attention. Noted 😄",
    bold: "Fair enough. I don't chase.",
    smooth: "No pressure. I'm patient.",
  },
  default: {
    playful: "Okay that was actually funny. You've got good timing.",
    bold: "I'll be real — this conversation has my full attention.",
    smooth: "There's something about how you reply that makes me curious.",
  },
};

export async function handleRizzAssistProxy(
  body: RizzAssistProxyBody,
): Promise<{
  status: number;
  json: RizzAssistProxyResponse | { error: string };
}> {
  const apiKey = await getOpenAIKey();
  if (!apiKey) {
    // Return context-aware fallback rather than error
    const fb =
      body.current_interest >= 70
        ? FALLBACKS.high
        : body.current_mood === "cold" || body.current_mood === "bored"
          ? FALLBACKS.cold
          : FALLBACKS.default;
    return { status: 200, json: fb };
  }

  const systemPrompt = buildCoachingSystemPrompt(
    body.character_profile.name,
    body.character_profile.age,
    body.character_profile.personality,
    body.current_mood,
    body.current_interest,
    body.momentum,
    body.conversation_phase,
    body.challenge_type,
  );

  const historyText = body.conversation_history
    .slice(-8)
    .map(
      (m) =>
        `${m.role === "user" ? "Player" : body.character_profile.name}: ${m.content}`,
    )
    .join("\n");

  const userMessage = [
    "CONVERSATION SO FAR:",
    historyText || "(No messages yet — this is the opening)",
    "",
    `LAST MESSAGE FROM ${body.character_profile.name.toUpperCase()}:`,
    `"${body.last_ai_message}"`,
    "",
    "Generate 3 reply suggestions for the player now.",
  ].join("\n");

  const fetchBody = JSON.stringify({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    temperature: 0.85,
    top_p: 1,
    max_tokens: 200,
    response_format: { type: "json_object" },
  });

  async function attempt(): Promise<{ ok: boolean; content: string; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } }> {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: fetchBody,
      });
      const data = (await res.json()) as Record<string, unknown>;
      const usage = data?.usage as { prompt_tokens: number; completion_tokens: number; total_tokens: number } | undefined;
      if (!res.ok) {
        logAiUsageFireAndForget({ requestType: "assist", promptTokens: 0, completionTokens: 0, success: false, errorMessage: `OpenAI error (${res.status})` });
        return { ok: false, content: "" };
      }
      const choices = data?.choices as
        | Array<Record<string, unknown>>
        | undefined;
      const content = (
        choices?.[0]?.message as Record<string, unknown> | undefined
      )?.content;
      const text = typeof content === "string" ? content : "";
      if (text) logAiUsageFireAndForget({ requestType: "assist", promptTokens: usage?.prompt_tokens ?? 0, completionTokens: usage?.completion_tokens ?? 0, success: true });
      return { ok: !!text, content: text, usage };
    } catch {
      logAiUsageFireAndForget({ requestType: "assist", promptTokens: 0, completionTokens: 0, success: false, errorMessage: "Network error" });
      return { ok: false, content: "" };
    }
  }

  let result = await attempt();
  let parsed = result.ok ? parseAssistResponse(result.content) : null;

  if (!parsed) {
    // Retry once
    result = await attempt();
    parsed = result.ok ? parseAssistResponse(result.content) : null;
  }

  if (!parsed) {
    const fb =
      body.current_interest >= 70
        ? FALLBACKS.high
        : body.current_mood === "cold" || body.current_mood === "bored"
          ? FALLBACKS.cold
          : FALLBACKS.default;
    return { status: 200, json: fb };
  }

  return { status: 200, json: parsed };
}
