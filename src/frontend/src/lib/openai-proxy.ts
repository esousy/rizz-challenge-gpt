/**
 * openai-proxy.ts
 *
 * Secure chat proxy client — calls the server-side /api/openai-chat-proxy endpoint.
 * The OpenAI API key is NEVER fetched, stored, or accessed by this module.
 * All key resolution happens exclusively on the server (vite-plugin-ai-proxy.js).
 *
 * Architecture:
 *   Frontend → POST /api/openai-chat-proxy → server reads key → OpenAI → JSON → frontend
 *
 * The browser never sees the raw API key. The key does not appear in:
 *   • network responses
 *   • localStorage
 *   • frontend state
 *   • browser memory (after this module)
 */

import type { CharacterProfile } from "@/lib/challenges";
import type { ChatResponse, Message, SessionPhase } from "@/types";

// ── Types ───────────────────────────────────────────────────────────────────────

export interface OpenAIKeyActor {
  getOpenAIKeyPublic(): Promise<string | null>;
}

export interface ProxyRequest {
  challengeId: string;
  difficulty: string;
  conversation_phase: SessionPhase;
  current_interest: number;
  current_mood: string;
  momentum: string;
  conversation_history: { role: string; content: string }[];
  character_profile: CharacterProfile;
}

// ── Fallback (used when proxy is unreachable) ────────────────────────────────

function fallbackResponse(
  currentInterest: number,
  currentMood: string,
): ChatResponse {
  return {
    reply: "Hmm, didn't quite catch that. Try again?",
    interest_change: 0,
    updated_interest: currentInterest,
    mood: currentMood,
    coach_hint: "Response unclear. Try again.",
    coach_tone: "neutral",
    score: 50,
    breakdown: { confidence: 50, humor: 50, originality: 50 },
    momentum: "neutral",
    engagement_level: "medium",
    conversation_tension: "low",
    feedbackCategory: "neutral",
  };
}

function mapProxyResponse(
  data: Record<string, unknown>,
  currentInterest: number,
  currentMood: string,
): ChatResponse {
  const reply =
    typeof data.reply === "string" && data.reply.trim()
      ? data.reply.trim()
      : null;
  if (!reply) return fallbackResponse(currentInterest, currentMood);

  const validTones = ["positive", "neutral", "negative"] as const;
  const validMomentums = ["positive", "neutral", "negative"] as const;
  const validEngagements = ["low", "medium", "high"] as const;
  const validTensions = ["low", "building", "high"] as const;

  return {
    reply,
    interest_change:
      typeof data.interest_change === "number"
        ? Math.round(data.interest_change)
        : 0,
    updated_interest:
      typeof data.updated_interest === "number"
        ? Math.round(data.updated_interest)
        : currentInterest,
    mood: typeof data.mood === "string" ? data.mood : currentMood,
    coach_hint: typeof data.coach_hint === "string" ? data.coach_hint : "",
    coach_tone: (validTones.includes(
      data.coach_tone as (typeof validTones)[number],
    )
      ? data.coach_tone
      : "neutral") as ChatResponse["coach_tone"],
    score: typeof data.score === "number" ? Math.round(data.score) : 50,
    breakdown: {
      confidence:
        typeof data.confidence === "number" ? Math.round(data.confidence) : 50,
      humor: typeof data.humor === "number" ? Math.round(data.humor) : 50,
      originality:
        typeof data.originality === "number"
          ? Math.round(data.originality)
          : 50,
    },
    momentum: (validMomentums.includes(
      data.momentum as (typeof validMomentums)[number],
    )
      ? data.momentum
      : "neutral") as ChatResponse["momentum"],
    engagement_level: (validEngagements.includes(
      data.engagement_level as (typeof validEngagements)[number],
    )
      ? data.engagement_level
      : "medium") as ChatResponse["engagement_level"],
    conversation_tension: (validTensions.includes(
      data.conversation_tension as (typeof validTensions)[number],
    )
      ? data.conversation_tension
      : "low") as ChatResponse["conversation_tension"],
    feedbackCategory: (validTones.includes(
      data.feedbackCategory as (typeof validTones)[number],
    )
      ? data.feedbackCategory
      : "neutral") as ChatResponse["feedbackCategory"],
  };
}

async function tryServerProxy(
  payload: Record<string, unknown>,
): Promise<
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string; status?: number }
> {
  try {
    const res = await fetch("/api/openai-chat-proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let data: Record<string, unknown> = {};
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      data = (await res.json()) as Record<string, unknown>;
    } else {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        status: res.status,
        error: text || `Proxy returned non-JSON response (${res.status})`,
      };
    }

    if (!res.ok) {
      const rawErr =
        typeof data?.error === "string" && data.error
          ? data.error
          : res.status === 503
            ? "Live AI is temporarily unavailable. Please try again later."
            : res.status === 502
              ? "Could not parse AI response. Please try again."
              : `Server error (${res.status})`;
      return { ok: false, status: res.status, error: rawErr };
    }

    if (typeof data?.error === "string" && data.error) {
      return { ok: false, status: res.status, error: data.error };
    }

    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Call the server-side chat proxy.
 *
 * The OpenAI key is resolved exclusively on the server.
 * No key parameter is accepted — the browser cannot access it.
 *
 * @param userMessage  Latest message from the player
 * @param history  Recent conversation history (last 10 messages)
 * @param req  Full game state context
 */
/**
 * Call the server-side chat proxy.
 *
 * The OpenAI key is resolved exclusively on the server.
 * No key parameter is accepted — the browser cannot access it.
 *
 * @param userMessage  Latest message from the player
 * @param history  Recent conversation history (last 10 messages)
 * @param req  Full game state context
 */
export async function callChatProxy(
  userMessage: string,
  history: Message[],
  req: ProxyRequest,
  _actor?: OpenAIKeyActor | null,
): Promise<{ response: ChatResponse; error?: string }> {
  const payload = {
    challenge_type: req.challengeId,
    difficulty: req.difficulty,
    conversation_phase: req.conversation_phase,
    current_interest: req.current_interest,
    current_mood: req.current_mood,
    momentum: req.momentum,
    conversation_history: history.slice(-10).map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    })),
    character_profile: req.character_profile,
    user_message: userMessage,
    user_category: req.userCategory ?? "anonymous",
    user_id: req.userId ?? null,
  };

  try {
    const proxyResult = await tryServerProxy(payload);
    if (proxyResult.ok) {
      return {
        response: mapProxyResponse(
          proxyResult.data,
          req.current_interest,
          req.current_mood,
        ),
      };
    }

    return {
      response: fallbackResponse(req.current_interest, req.current_mood),
      error:
        proxyResult.error ||
        "Live AI proxy is unavailable. Check the deployment API route and OPENAI_API_KEY.",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isNetwork =
      msg.includes("fetch") ||
      msg.includes("network") ||
      msg.includes("Failed to fetch");
    return {
      response: fallbackResponse(req.current_interest, req.current_mood),
      error: isNetwork
        ? "⚠️ Network error. Check your connection and try again."
        : `⚠️ ${msg || "Live AI is temporarily unavailable. Please try again later."}`,
    };
  }
}
