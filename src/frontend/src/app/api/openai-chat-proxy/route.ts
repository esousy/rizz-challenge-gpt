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
  challengeId?: string;
  userCategory?: string;
  userId?: string | null;
  model?: string;
}) {
  const dbUrl = getDbUrl();
  if (!dbUrl) return; // Silently skip if no DB configured
  const model = params.model ?? "gpt-4o-mini";
  const totalTokens = params.promptTokens + params.completionTokens;
  const estimatedCostUsd = estimateCostUsd(model, params.promptTokens, params.completionTokens);
  const sql = neon(dbUrl);
  sql`
    INSERT INTO ai_usage_logs (user_id, user_category, request_type, model, prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd, success, error_message)
    VALUES (${params.userId ?? null}, ${params.userCategory ?? 'anonymous'}, ${params.requestType}, ${model}, ${params.promptTokens}, ${params.completionTokens}, ${totalTokens}, ${estimatedCostUsd}, ${params.success}, ${params.errorMessage ?? null})
  `.catch((err: unknown) => console.error("[logAiUsage] Failed:", err));
}

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
  user_category?: string;
  user_id?: string;
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
  userCategory?: string,
  userId?: string | null,
): Promise<{ ok: boolean; content: string; error?: string; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } }> {
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
    // Log failed call
    logAiUsageFireAndForget({ requestType: "normal_chat", promptTokens: 0, completionTokens: 0, success: false, errorMessage: msg, userCategory, userId });
    return { ok: false, content: "", error: msg };
  }

  const choices = data?.choices as Array<Record<string, unknown>> | undefined;
  const content = (choices?.[0]?.message as Record<string, unknown> | undefined)?.content;
  const text = typeof content === "string" ? content : "";
  const usage = data?.usage as { prompt_tokens: number; completion_tokens: number; total_tokens: number } | undefined;
  if (!text) {
    logAiUsageFireAndForget({ requestType: "normal_chat", promptTokens: usage?.prompt_tokens ?? 0, completionTokens: usage?.completion_tokens ?? 0, success: false, errorMessage: "Empty response from OpenAI", userCategory, userId });
    return { ok: false, content: "", error: "Empty response from OpenAI" };
  }
  // Log successful call
  logAiUsageFireAndForget({ requestType: "normal_chat", promptTokens: usage?.prompt_tokens ?? 0, completionTokens: usage?.completion_tokens ?? 0, success: true, userCategory, userId });
  return { ok: true, content: text, usage };
}

export async function handleChatProxy(
  body: ChatProxyBody,
): Promise<{ status: number; json: ChatProxyResponse | { error: string } }> {
  const apiKey = process.env.OPENAI_API_KEY || await getOpenAIKey();
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
  let result = await callOpenAI(apiKey, messages, body.user_category, body.user_id);
  if (!result.ok) {
    // Retry once
    result = await callOpenAI(apiKey, messages, body.user_category, body.user_id);
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
