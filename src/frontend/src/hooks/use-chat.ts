import { createActor } from "@/backend";
import { useMockMode } from "@/hooks/use-mock-mode";
import { CHALLENGES, getCharacterProfile } from "@/lib/challenges";
import type { ChallengeContext } from "@/lib/mock-responses";
import {
  calculateSkillDeltas,
  generateMockResponse,
  getInitialMessage,
  resetMockState,
} from "@/lib/mock-responses";
import { type ProxyRequest, callChatProxy } from "@/lib/openai-proxy";
import type {
  Breakdown,
  ChatResponse,
  Message,
  PlayerSkills,
  SessionAverages,
  SessionPhase,
} from "@/types";
import { useActor } from "@caffeineai/core-infrastructure";
import { useCallback, useEffect, useRef, useState } from "react";

const MAX_ROUNDS = 5;
const TYPING_DELAY_MS = 1000;
const DELTA_RESET_MS = 3000;

/** Initial state override for resume mode — restores a previously completed session */
export interface UseChatInitialState {
  messages: Message[];
  interestLevel: number;
  currentMood: string;
  isResumeMode?: boolean;
  /** When true, skip the initial AI greeting and start with an empty message list */
  skipInitialGreeting?: boolean;
  /** Restored momentum for resume mode */
  momentum?: string;
  /** Restored conversation phase for resume mode */
  conversationPhase?: SessionPhase;
  /** Coaching hints shown in the completed session */
  coachingHistory?: string[];
}

const PHASE_MAP: Record<number, SessionPhase> = {
  1: "opening",
  2: "build-chemistry",
  3: "escalation",
  4: "pressure-moment",
  5: "final-outcome",
};

function getSessionPhase(round: number): SessionPhase {
  return PHASE_MAP[Math.min(round, 5)] ?? "final-outcome";
}

function buildInitialMessage(challengeId: string): Message {
  return {
    id: "initial",
    role: "ai",
    content: getInitialMessage(challengeId) ?? "hey",
  };
}

export function useChat(
  challengeId = "easy-flirt",
  initialState?: UseChatInitialState,
) {
  const { actor, isFetching } = useActor(createActor);
  const { isMockMode } = useMockMode();

  const challengeConfig =
    CHALLENGES.find((c) => c.id === challengeId) ?? CHALLENGES[0];

  // Resume mode: skip AI greeting, no session completion, no XP/skills
  // isResumeMode can be toggled at runtime via enterResumeMode()
  const [isResumeMode, setIsResumeMode] = useState(
    initialState?.isResumeMode ?? false,
  );

  const [messages, setMessages] = useState<Message[]>(() => {
    if (initialState?.messages?.length) return initialState.messages;
    if (initialState?.skipInitialGreeting) return [];
    return [buildInitialMessage(challengeId)];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(1);
  const [interestLevel, setInterestLevel] = useState(
    initialState?.interestLevel ?? challengeConfig.startingInterest,
  );
  const [lastInterestDelta, setLastInterestDelta] = useState<number | null>(
    null,
  );
  const [currentMood, setCurrentMood] = useState<string>(
    initialState?.currentMood ?? challengeConfig.startingMood,
  );
  const [lastCoachHint, setLastCoachHint] = useState<string | null>(null);
  const [lastCoachTone, setLastCoachTone] = useState<
    "positive" | "neutral" | "negative"
  >("neutral");
  const [sessionComplete, setSessionComplete] = useState(false);
  const [sessionAverages, setSessionAverages] =
    useState<SessionAverages | null>(null);
  const [accumulatedSkillDeltas, setAccumulatedSkillDeltas] =
    useState<PlayerSkills>({
      confidence: 0,
      humor: 0,
      originality: 0,
      tension: 0,
      socialAwareness: 0,
    });
  // Coaching hints collected during the session — used by Rizz Assist for context
  const [coachingHistory, setCoachingHistory] = useState<string[]>(
    initialState?.coachingHistory ?? [],
  );
  // Restored momentum from resume data
  const [currentMomentum, setCurrentMomentum] = useState<string>(
    initialState?.momentum ?? "neutral",
  );
  // Whether the backend has a live OpenAI key configured
  const [liveKeyActive, setLiveKeyActive] = useState(false);

  const deltaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scoredRef = useRef<
    {
      score: number;
      breakdown: Breakdown;
      interest: number;
      mood: string;
      momentum: string;
    }[]
  >([]);

  // Expose mock mode so consumers can display the indicator
  const mockMode = isMockMode;

  // Live key is active when not in mock mode — the OpenAI key is configured
  // server-side via Vercel env var (OPENAI_API_KEY), never exposed to the browser.
  useEffect(() => {
    setLiveKeyActive(!isMockMode);
  }, [isMockMode]);

  // No fetchApiKey — the OpenAI key is handled server-side only by the proxy route.

  // Clear delta timer on unmount
  useEffect(() => {
    return () => {
      if (deltaTimerRef.current) clearTimeout(deltaTimerRef.current);
    };
  }, []);

  /**
   * Enter resume/continue mode in-place — no navigation needed.
   * Clears sessionComplete and marks the session as a practice continuation.
   * No XP or rank changes will be applied.
   */
  const enterResumeMode = useCallback(() => {
    setSessionComplete(false);
    setIsResumeMode(true);
  }, []);

  const sendMessage = useCallback(
    async (userText: string) => {
      // In mock mode we don't need actor; in live mode we do
      if (!userText.trim() || sessionComplete) return;

      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: userText.trim(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setIsTyping(true);
      setError(null);

      try {
        // Capture current messages before state update settles
        const historySnapshot = await new Promise<Message[]>((resolve) => {
          setMessages((prev) => {
            resolve(prev);
            return prev;
          });
        });

        let response: ChatResponse;

        if (isMockMode) {
          // Mock path: generate locally with a simulated delay
          await new Promise((res) => setTimeout(res, TYPING_DELAY_MS));
          const challengeCtx: ChallengeContext = {
            challengeId,
            replyStyle: challengeConfig.replyStyle,
            forgivenessLevel: challengeConfig.forgivenessLevel,
            difficulty: challengeConfig.difficulty,
            phase: round,
            conversation_phase: getSessionPhase(round),
            character_profile: getCharacterProfile(challengeId),
          };
          response = generateMockResponse(
            userText.trim(),
            historySnapshot,
            interestLevel,
            currentMood,
            challengeCtx,
          );
        } else {
          // Live path: call the server-side proxy (key is never exposed to the browser)
          const conversationPhase = getSessionPhase(round);

          const proxyReq: ProxyRequest = {
            challengeId,
            difficulty: challengeConfig.difficulty,
            conversation_phase: conversationPhase,
            current_interest: interestLevel,
            current_mood: currentMood,
            momentum: currentMomentum,
            conversation_history: historySnapshot.slice(-10).map((m) => ({
              role: m.role === "user" ? "user" : "assistant",
              content: m.content,
            })),
            character_profile: getCharacterProfile(challengeId),
          };

          const { response: proxyResponse, error: proxyError } =
            await callChatProxy(
              userText.trim(),
              historySnapshot,
              proxyReq,
              actor,
            );

          // Simulate realistic typing delay
          await new Promise((res) => setTimeout(res, TYPING_DELAY_MS));

          // Show any proxy error in the chat UI — never silently display the fallback response
          if (proxyError) {
            setIsTyping(false);
            const displayErr = proxyError.startsWith("⚠️")
              ? proxyError
              : `⚠️ ${proxyError}`;
            setError(displayErr);
            setIsLoading(false);
            return;
          }

          response = proxyResponse;
        }

        const aiMsg: Message = {
          id: `ai-${Date.now()}`,
          role: "ai",
          content: response.reply,
          score: response.score,
          breakdown: response.breakdown,
          interest_change: response.interest_change,
          updated_interest: response.updated_interest,
          mood: response.mood,
          coach_hint: response.coach_hint,
          momentum: response.momentum,
          feedbackCategory: response.feedbackCategory,
          coach_tone: response.coach_tone,
        };

        setIsTyping(false);
        setMessages((prev) => [...prev, aiMsg]);

        // Use updated_interest directly from response
        setInterestLevel(Math.min(100, Math.max(0, response.updated_interest)));
        setCurrentMood(response.mood);
        setLastCoachHint(response.coach_hint);
        setLastCoachTone(response.coach_tone);
        setCurrentMomentum(response.momentum ?? "neutral");

        // Accumulate coaching history for Rizz Assist context
        if (response.coach_hint) {
          setCoachingHistory((prev) => [
            ...prev.slice(-9),
            response.coach_hint,
          ]);
        }

        // Show interest delta for 3 seconds then clear
        setLastInterestDelta(response.interest_change);
        if (deltaTimerRef.current) clearTimeout(deltaTimerRef.current);
        deltaTimerRef.current = setTimeout(() => {
          setLastInterestDelta(null);
        }, DELTA_RESET_MS);

        if (!isResumeMode) {
          // Accumulate skill deltas (not in resume mode)
          const challengeCtxForSkills: ChallengeContext = {
            challengeId,
            replyStyle: challengeConfig.replyStyle,
            forgivenessLevel: challengeConfig.forgivenessLevel,
            difficulty: challengeConfig.difficulty,
            phase: round,
            conversation_phase: getSessionPhase(round),
            character_profile: getCharacterProfile(challengeId),
          };
          const skillDeltas = calculateSkillDeltas(
            response,
            challengeCtxForSkills,
          );
          setAccumulatedSkillDeltas((prev) => ({
            confidence: prev.confidence + skillDeltas.confidence,
            humor: prev.humor + skillDeltas.humor,
            originality: prev.originality + skillDeltas.originality,
            tension: prev.tension + skillDeltas.tension,
            socialAwareness: prev.socialAwareness + skillDeltas.socialAwareness,
          }));

          // Track scored rounds
          scoredRef.current.push({
            score: response.score,
            breakdown: response.breakdown,
            interest: response.updated_interest,
            mood: response.mood,
            momentum: response.momentum ?? "neutral",
          });
        }

        // Advance round and check session completion (never complete in resume mode)
        const nextRound = round + 1;
        if (!isResumeMode) setRound(nextRound);

        if (!isResumeMode && nextRound > MAX_ROUNDS) {
          const entries = scoredRef.current;
          const n = entries.length || 1;
          const totals = entries.reduce(
            (acc, e) => ({
              confidence: acc.confidence + e.breakdown.confidence,
              humor: acc.humor + e.breakdown.humor,
              originality: acc.originality + e.breakdown.originality,
              score: acc.score + e.score,
            }),
            { confidence: 0, humor: 0, originality: 0, score: 0 },
          );
          const lastEntry = entries[entries.length - 1];
          // Compute overall momentum bias
          const posCount = entries.filter(
            (e) => e.momentum === "positive",
          ).length;
          const negCount = entries.filter(
            (e) => e.momentum === "negative",
          ).length;
          const momentumSummary: SessionAverages["momentumSummary"] =
            posCount > negCount + 1
              ? "positive"
              : negCount > posCount + 1
                ? "negative"
                : "neutral";
          const avgs: SessionAverages = {
            confidence: Math.round(totals.confidence / n),
            humor: Math.round(totals.humor / n),
            originality: Math.round(totals.originality / n),
            overall: Math.round(totals.score / n),
            finalInterestLevel:
              lastEntry?.interest ?? response.updated_interest,
            finalMood: lastEntry?.mood ?? response.mood,
            momentumSummary,
          };
          setSessionAverages(avgs);
          setSessionComplete(true);

          // Save full session state to sessionStorage for Resume Conversation
          const RESUME_KEY = "rizz-resume-session";
          try {
            const completedMessages = [...historySnapshot, aiMsg];
            const resumePayload = {
              challengeId,
              characterName: getCharacterProfile(challengeId).name,
              messages: completedMessages,
              finalInterest: lastEntry?.interest ?? response.updated_interest,
              finalMood: lastEntry?.mood ?? response.mood,
              momentum: response.momentum ?? "neutral",
              conversationPhase: getSessionPhase(MAX_ROUNDS),
              coachingHistory: [...coachingHistory, response.coach_hint].filter(
                Boolean,
              ),
              roundNumber: MAX_ROUNDS,
            };
            sessionStorage.setItem(RESUME_KEY, JSON.stringify(resumePayload));
          } catch {
            // Non-critical — resume just won't have full context
          }
        }
      } catch (err) {
        setIsTyping(false);
        const rawMsg =
          err instanceof Error ? err.message : String(err ?? "unknown error");
        console.error(
          `[useChat] Live backend call failed for challenge=${challengeId} round=${round}:\n`,
          err,
        );
        // Show the actual error reason if it's meaningful, otherwise a friendly fallback
        const isNetworkLike =
          rawMsg.includes("fetch") ||
          rawMsg.includes("network") ||
          rawMsg.includes("NetworkError") ||
          rawMsg.includes("Failed to fetch");
        setError(
          isNetworkLike
            ? "Connection error. Check your internet connection and try again."
            : `Error: ${rawMsg}`,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [
      actor,
      isFetching,
      isMockMode,
      round,
      sessionComplete,
      interestLevel,
      currentMood,
      currentMomentum,
      challengeId,
      challengeConfig,
      isResumeMode,
      coachingHistory,
    ],
  );

  const resetSession = useCallback(() => {
    setMessages([buildInitialMessage(challengeId)]);
    setError(null);
    setIsLoading(false);
    setIsTyping(false);
    setRound(1);
    setInterestLevel(challengeConfig.startingInterest);
    setLastInterestDelta(null);
    setCurrentMood(challengeConfig.startingMood);
    setCurrentMomentum("neutral");
    setLastCoachHint(null);
    setSessionComplete(false);
    setSessionAverages(null);
    setCoachingHistory([]);
    setAccumulatedSkillDeltas({
      confidence: 0,
      humor: 0,
      originality: 0,
      tension: 0,
      socialAwareness: 0,
    });
    scoredRef.current = [];
    resetMockState();
    if (deltaTimerRef.current) clearTimeout(deltaTimerRef.current);
  }, [
    challengeId,
    challengeConfig.startingInterest,
    challengeConfig.startingMood,
  ]);

  const sessionPhase = getSessionPhase(round);

  return {
    messages,
    isLoading,
    isTyping,
    error,
    round,
    interestLevel,
    lastInterestDelta,
    currentMood,
    currentMomentum,
    lastCoachHint,
    lastCoachTone,
    sessionComplete,
    actorReady: true, // Always ready — live mode uses server-side proxy, mock mode is local
    mockMode,
    liveKeyActive,
    sendMessage,
    resetSession,
    sessionAverages,
    sessionPhase,
    challengeId,
    skillDeltas: accumulatedSkillDeltas,
    isResumeMode,
    enterResumeMode,
    coachingHistory,
  };
}
