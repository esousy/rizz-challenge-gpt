/**
 * rizz-assist.ts
 *
 * Rizz Assist client — calls the server-side /api/rizz-assist-proxy endpoint.
 * The OpenAI API key is NEVER fetched, stored, or accessed by this module.
 * All key resolution happens exclusively on the server (vite-plugin-ai-proxy.js).
 *
 * Returns { playful, bold, smooth } — three distinct, situationally specific
 * reply suggestions generated server-side using the full conversation context.
 */

import type { CharacterProfile } from "@/lib/challenges";
import type { Message, SessionPhase } from "@/types";

// ── Types ──────────────────────────────────────────────────────────────────

export interface RizzAssistSuggestions {
  playful: string;
  bold: string;
  smooth: string;
}

export interface RizzAssistParams {
  conversationHistory: Message[];
  lastAIMessage: string;
  characterProfile: CharacterProfile;
  currentMood: string;
  currentInterest: number;
  momentum: string;
  challengeType: string;
  conversationPhase: SessionPhase;
  userCategory?: string;
  userId?: string | null;
  /** @deprecated Key is no longer needed — proxy handles auth server-side */
  apiKey?: string;
}

// ── Context-aware local fallback (when proxy is unreachable) ──────────────────

export function buildLocalFallback(
  currentMood: string,
  currentInterest: number,
  conversationPhase: SessionPhase,
  lastAIMessage: string,
): RizzAssistSuggestions {
  const lastSnippet = lastAIMessage.slice(0, 50).trim();
  const isHighInterest = currentInterest >= 65;
  const isCold =
    currentMood === "cold" ||
    currentMood === "bored" ||
    currentMood === "distant";
  const isTesting = currentMood === "testing" || currentMood === "curious";

  if (isHighInterest) {
    return {
      playful: "Oh so now you're trying to keep me hooked? Bold move 😏",
      bold: "I feel like we both know where this is going.",
      smooth:
        "Something about this conversation is different. I'll leave it at that.",
    };
  }

  if (isCold) {
    return {
      playful:
        conversationPhase === "opening"
          ? "You type like someone who charges for their attention. Noted 😄"
          : "I see you. Still here though.",
      bold: "Fair enough. I don't chase.",
      smooth: "No pressure. I'm patient.",
    };
  }

  if (isTesting) {
    return {
      playful: `"${lastSnippet.split(" ").slice(0, 4).join(" ")}..." — okay, I'll take that challenge.`,
      bold: "I never break under pressure. Keep going.",
      smooth: "You're testing me. I respect it.",
    };
  }

  // Default neutral
  return {
    playful: "Okay that was actually funny. You've got good timing.",
    bold: "I'll be real — this conversation has my full attention.",
    smooth: "There's something about how you reply that makes me curious.",
  };
}

// ── Proxy call ─────────────────────────────────────────────────────────────────

async function callRizzAssistProxy(
  params: RizzAssistParams,
): Promise<RizzAssistSuggestions | null> {
  const payload = {
    conversation_history: params.conversationHistory.slice(-8).map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    })),
    last_ai_message: params.lastAIMessage,
    character_profile: {
      name: params.characterProfile.name,
      age: params.characterProfile.age,
      personality: params.characterProfile.personality,
    },
    current_mood: params.currentMood,
    current_interest: params.currentInterest,
    momentum: params.momentum,
    challenge_type: params.challengeType,
    conversation_phase: params.conversationPhase,
    user_category: params.userCategory ?? "anonymous",
    user_id: params.userId ?? null,
  };

  try {
    const res = await fetch("/api/rizz-assist-proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    const playful =
      typeof data.playful === "string" && data.playful.trim()
        ? data.playful.trim()
        : null;
    const bold =
      typeof data.bold === "string" && data.bold.trim()
        ? data.bold.trim()
        : null;
    const smooth =
      typeof data.smooth === "string" && data.smooth.trim()
        ? data.smooth.trim()
        : null;
    if (!playful && !bold && !smooth) return null;
    return { playful: playful || bold || smooth || '', bold: bold || playful || smooth || '', smooth: smooth || bold || playful || '' };
  } catch (err) {
    console.error("[callRizzAssistProxy] Error:", err);
    return null;
  }
}

/**
 * Fetch live AI-generated Rizz Assist suggestions via the secure server proxy.
 * The OpenAI API key is handled server-side — never exposed to the browser.
 *
 * Falls back to context-aware local suggestions if the proxy call fails.
 */
export async function fetchRizzAssistSuggestions(
  params: RizzAssistParams,
): Promise<RizzAssistSuggestions> {
  const result = await callRizzAssistProxy(params);
  if (result) return result;

  // Context-aware local fallback
  return buildLocalFallback(
    params.currentMood,
    params.currentInterest,
    params.conversationPhase,
    params.lastAIMessage,
  );
}
