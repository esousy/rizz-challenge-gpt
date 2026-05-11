// Shared types for the Rizz Me If You Can app
// ── Auth / User ─────────────────────────────────────────────────────────────

/** Auth state surface exposed via AuthContext — native in-app auth. */
export type { AuthState } from "@/hooks/use-auth";

// Backend types (re-exported for convenience)
export interface Breakdown {
  confidence: number;
  humor: number;
  originality: number;
}

export interface ChatResponse {
  reply: string;
  interest_change: number;
  updated_interest: number;
  mood: string;
  coach_hint: string;
  score: number;
  breakdown: Breakdown;
  momentum: "negative" | "neutral" | "positive";
  engagement_level: "low" | "medium" | "high";
  conversation_tension: "low" | "building" | "high";
  feedbackCategory: "positive" | "neutral" | "negative";
  coach_tone: "positive" | "neutral" | "negative";
}

// Chat message type (used for conversation history)
export interface ChatMessage {
  role: string;
  content: string;
}

// UI message type (extends chat with display metadata)
export interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  score?: number;
  breakdown?: Breakdown;
  interest_change?: number;
  updated_interest?: number;
  mood?: string;
  coach_hint?: string;
  momentum?: "negative" | "neutral" | "positive";
  feedbackCategory?: "positive" | "neutral" | "negative";
  coach_tone?: "positive" | "neutral" | "negative";
}

// Momentum state derived from conversation trajectory
export interface MomentumState {
  momentum: "negative" | "neutral" | "positive";
  engagementLevel: "low" | "medium" | "high";
  conversationTension: "low" | "building" | "high";
}

// Session averages returned by useChat
export interface SessionAverages {
  confidence: number;
  humor: number;
  originality: number;
  overall: number;
  finalInterestLevel: number;
  finalMood: string;
  /** Overall momentum bias across the session: positive | neutral | negative */
  momentumSummary: "positive" | "neutral" | "negative";
}

// ── Challenge & Difficulty ────────────────────────────────────────────────────

export type DifficultyTier = "easy" | "medium" | "hard" | "extreme";

export type PlayerRankId =
  | "rookie"
  | "smooth-talker"
  | "charmer"
  | "heartbreaker"
  | "rizz-lord";

export interface ChallengeConfig {
  id: string;
  name: string;
  emoji: string;
  description: string;
  difficulty: DifficultyTier;
  difficultyLabel: string;
  unlockRank?: PlayerRankId;
  startingInterest: number;
  startingMood: string;
  personalityTraits: string[];
  forgivenessLevel: "high" | "medium" | "low" | "very-low";
  replyStyle:
    | "warm"
    | "dry"
    | "fluctuating"
    | "cold"
    | "testing"
    | "desperate"
    | "skeptical";
  color: string;
  /** true for all modes except easy-flirt — user opens first */
  isUserLedMode?: boolean;
}

// ── Player Progression ────────────────────────────────────────────────────────

export interface PlayerRank {
  id: PlayerRankId;
  name: string;
  emoji: string;
  minXP: number;
  maxXP: number;
}

export interface PlayerSkills {
  confidence: number;
  humor: number;
  originality: number;
  tension: number;
  socialAwareness: number;
}

// ── Session History ──────────────────────────────────────────────────────────

export interface SessionHistoryEntry {
  id: string;
  date: string; // ISO date string
  challengeId: string;
  challengeName: string;
  score: number;
  outcome: string;
  finalMood: string;
  finalInterest: number;
  xpEarned: number;
}

export type BestScores = { [challengeId: string]: number };

export interface PlayerStats {
  totalSessions: number;
  avgScore: number;
  bestScoreEver: number;
  strongestSkill: string;
  weakestSkill: string;
  playstyleLabel: string;
}

export interface FreePlanConfig {
  rankedSessionsPerDay: number;
  rizzAssistPerSession: number;
  hintsPerSession: number;
}

export type UpgradeModalTrigger = "ranked_sessions" | "rizz_assist" | "hints";

export interface PlayerProgress {
  totalXP: number;
  rankId: PlayerRankId;
  skills: PlayerSkills;
  streak: number;
  lastPlayedDate: string | null;
  dailyChallengeCompletedDate: string | null;
  completedChallenges: string[];
  sessionHistory: SessionHistoryEntry[];
  bestScores: BestScores;
  /** Future-proof: premium tier removes/increases assistance limits */
  isPremium?: boolean;
  /** Monetization plan: free or pro */
  plan?: "free" | "pro";
}

// ── Session / Outcome ─────────────────────────────────────────────────────────

export type SessionPhase =
  | "opening"
  | "build-chemistry"
  | "escalation"
  | "pressure-moment"
  | "final-outcome";

export type OutcomeType =
  | "lost-her"
  | "almost-there"
  | "strong-chemistry"
  | "fumbled-the-bag"
  | "rizz-masterclass";

export interface OutcomeArchetype {
  id: OutcomeType;
  emoji: string;
  name: string;
  tagline: string;
  color: string;
}

export interface SessionResult {
  outcomeType: OutcomeType;
  finalInterest: number;
  finalMood: string;
  xpEarned: number;
  isDailyChallengeBonus: boolean;
  skillDeltas: PlayerSkills;
  peakMoment: string;
  weakMoment: string;
  challengeId: string;
  averages: SessionAverages;
}

// ── Tactical Assistance System ────────────────────────────────────────────────

/**
 * Tracks per-session usage and cooldowns for the Openers / Hint / Rizz Assist
 * tactical tools. Premium tier can lift limits via isPremium on PlayerProgress.
 *
 * Limits:
 *   Openers  — max 1 use per session
 *   Hints    — max 3 uses, 30 s cooldown between uses
 *   Assist   — max 3 uses, 45 s cooldown between uses
 */
export interface AssistanceState {
  openersUsed: boolean;
  hintsUsed: number;
  assistUsed: number;
  /** Unix ms timestamp after which another hint may be used, or null if no cooldown */
  hintsCooldownUntil: number | null;
  /** Unix ms timestamp after which another assist may be used, or null if no cooldown */
  assistCooldownUntil: number | null;
}

// ── Resume Mode ───────────────────────────────────────────────────────────────

/**
 * Carries state for post-results freeform continuation.
 * Resume sessions award NO XP, affect NO ranks, and do NOT count toward
 * leaderboard or official scores.
 */
export interface ResumeMode {
  /** true when session was resumed from the Results screen */
  isResumed: boolean;
  /** Optional snapshot of messages carried from the completed session */
  resumeMessages?: Message[];
}

/** Data stored in sessionStorage to hand off to the resume challenge view.
 *  Carries the FULL emotional state so the conversation continues naturally.
 */
export interface ResumeSessionData {
  challengeId: string;
  characterName: string;
  messages: Message[];
  finalInterest: number;
  finalMood: string;
  /** Additional state for full continuity */
  momentum?: string;
  conversationPhase?: SessionPhase;
  coachingHistory?: string[];
  roundNumber?: number;
}
