/**
 * openai-chat-proxy/route.ts
 *
 * Server-side handler for the main chat proxy endpoint.
 * Loaded by vite-plugin-ai-proxy.js as Vite server middleware.
 *
 * The OpenAI API key is read server-side only — it never reaches the browser.
 * Key resolution order:
 *   1. process.env.OPENAI_API_KEY (env var takes priority)
 *   2. IC backend getOpenAIKeyPublic() (fallback for dev without env var)
 */

import {
  buildSystemPrompt,
  fallbackResponse,
  parseOpenAIJSON,
} from "../../../lib/server/openai-helpers.js";
import { getOpenAIKey } from "../../server/get-openai-key.js";

export interface ChatProxyBody {
  challenge_type: string;
  difficulty: string;
  conversation_phase: string;
  current_interest: number;
  current_mood: string;
  momentum: string;
  conversation_history: { role: string; content: string }[];
  character_profile: Record<string, unknown>;
  user_message: string;
}

export interface ChatProxyResponse {
  reply: string;
  interest_change: number;
  updated_interest: number;
  mood: string;
  momentum: string;
  coach_hint: string;
  coach_tone: string;
  score: number;
  confidence: number;
  humor: number;
  originality: number;
  engagement_level: string;
  conversation_tension: string;
  feedbackCategory: string;
}

async function callOpenAI(
  apiKey: string,
  messages: { role: string; content: string }[],
): Promise<{ ok: boolean; content: string; error?: string }> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.75,
      top_p: 1,
      max_tokens: 300,
      response_format: { type: "json_object" },
    }),
  });

  const data = (await res.json()) as Record<string, unknown>;

  if (!res.ok) {
    const errData = data?.error as Record<string, unknown> | undefined;
    const msg =
      typeof errData?.message === "string"
        ? errData.message
        : res.status === 401
          ? "Invalid API key"
          : res.status === 429
            ? "Rate limit reached"
            : `OpenAI error (${res.status})`;
    return { ok: false, content: "", error: msg };
  }

  const choices = data?.choices as Array<Record<string, unknown>> | undefined;
  const content = (choices?.[0]?.message as Record<string, unknown> | undefined)
    ?.content;
  const text = typeof content === "string" ? content : "";
  if (!text)
    return { ok: false, content: "", error: "Empty response from OpenAI" };
  return { ok: true, content: text };
}

export async function handleChatProxy(
  body: ChatProxyBody,
): Promise<{ status: number; json: ChatProxyResponse | { error: string } }> {
  const apiKey = await getOpenAIKey();
  if (!apiKey) {
    return {
      status: 503,
      json: {
        error: "Live AI is temporarily unavailable. Please try again later.",
      },
    };
  }

  const systemPrompt = buildSystemPrompt(
    body.character_profile,
    body.conversation_phase,
    body.current_interest,
    body.current_mood,
    body.momentum,
    body.conversation_history,
  );

  const recentHistory = body.conversation_history.slice(-6);
  const messages: { role: string; content: string }[] = [
    { role: "system", content: systemPrompt },
    ...recentHistory.map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    })),
    { role: "user", content: body.user_message },
  ];

  // First attempt
  let result = await callOpenAI(apiKey, messages);
  if (!result.ok) {
    // Retry once
    result = await callOpenAI(apiKey, messages);
  }

  if (!result.ok || !result.content) {
    const fb = fallbackResponse(body.current_interest, body.current_mood);
    return { status: 200, json: fb };
  }

  const parsed = parseOpenAIJSON(
    result.content,
    body.current_interest,
    body.current_mood,
  );
  return { status: 200, json: parsed };
}
