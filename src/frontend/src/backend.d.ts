import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface SkillsDelta {
    socialAwareness: bigint;
    humor: bigint;
    originality: bigint;
    confidence: bigint;
    tension: bigint;
}
export interface SessionResult {
    rizzScore: bigint;
    isRanked: boolean;
    characterName: string;
    createdAt: bigint;
    bestMoment: string;
    outcomeType: string;
    finalMood: string;
    challengeType: string;
    areaToImprove: string;
    sessionId: string;
    xpEarned: bigint;
    skillsDelta: SkillsDelta;
    finalInterest: bigint;
}
export interface PublicProfile {
    id: string;
    status: Status;
    streak: bigint;
    username: string;
    totalXp: bigint;
    createdAt: bigint;
    plan: string;
    rank: string;
    email: string;
    unlockedChallenges: Array<string>;
}
export interface ChatResponse {
    coach_hint: string;
    coach_tone: string;
    feedbackCategory: string;
    breakdown: Breakdown;
    mood: string;
    interest_change: bigint;
    momentum: string;
    score: bigint;
    engagement_level: string;
    conversation_tension: string;
    updated_interest: bigint;
    reply: string;
}
export type AuthError = {
    __kind__: "emailTaken";
    emailTaken: null;
} | {
    __kind__: "wrongPassword";
    wrongPassword: null;
} | {
    __kind__: "blocked";
    blocked: null;
} | {
    __kind__: "invalidInput";
    invalidInput: string;
} | {
    __kind__: "notFound";
    notFound: null;
} | {
    __kind__: "unauthorized";
    unauthorized: null;
} | {
    __kind__: "suspended";
    suspended: null;
} | {
    __kind__: "usernameTaken";
    usernameTaken: null;
};
export interface FreePlanConfig {
    rankedSessionsPerDay: bigint;
    hintsPerSession: bigint;
    rizzAssistPerSession: bigint;
}
export interface ChatMessage {
    content: string;
    role: string;
}
export interface Breakdown {
    humor: bigint;
    originality: bigint;
    confidence: bigint;
}
export interface SessionHistoryEntry {
    isRanked: boolean;
    playedAt: bigint;
    score: bigint;
    challengeId: string;
    finalMood: string;
    outcome: string;
}
export interface PlayerStats {
    skillTension: bigint;
    totalXP: bigint;
    skillSocialAwareness: bigint;
    skillHumor: bigint;
    sessionHistory: Array<SessionHistoryEntry>;
    rankId: string;
    skillConfidence: bigint;
    bestScores: Array<[string, bigint]>;
    skillOriginality: bigint;
    streakCount: bigint;
}
export interface PublicAdminProfile {
    id: string;
    username: string;
    createdAt: bigint;
    email: string;
    lastLogin: bigint;
}
export enum Status {
    active = "active",
    blocked = "blocked",
    suspended = "suspended"
}
export interface backendInterface {
    adminLogin(identifier: string, password: string): Promise<{
        __kind__: "ok";
        ok: {
            token: string;
            profile: PublicAdminProfile;
        };
    } | {
        __kind__: "err";
        err: AuthError;
    }>;
    /**
     * / Admin: store the OpenAI API key (requires admin session token)
     */
    adminLogout(token: string): Promise<void>;
    chat(userMessage: string, history: Array<ChatMessage>, conversation_phase: string, character_profile_id: string): Promise<ChatResponse>;
    deleteUser(token: string, targetId: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: AuthError;
    }>;
    getAdminProfile(token: string): Promise<PublicAdminProfile | null>;
    getAllUsers(token: string): Promise<{
        __kind__: "ok";
        ok: Array<PublicProfile>;
    } | {
        __kind__: "err";
        err: AuthError;
    }>;
    getCallerProfile(token: string): Promise<PublicProfile | null>;
    getCallerSessions(token: string): Promise<Array<SessionResult>>;
    getCallerStats(token: string): Promise<PlayerStats | null>;
    getCharacterState(): Promise<{
        age: bigint;
        personality: string;
        interest: bigint;
        conversation_style: string;
        mood: string;
        name: string;
        momentum: string;
        engagement_level: string;
        conversation_tension: string;
    }>;
    getFreePlanConfig(): Promise<FreePlanConfig>;
    /**
     * / Frontend: query current mock mode setting
     */
    getMockMode(): Promise<boolean>;
    /**
     * / Authenticated query: returns the raw OpenAI API key so the frontend can
     * / call OpenAI directly (bypassing IC consensus). Requires a valid player or
     * / admin session token — unauthenticated callers get null.
     */
    getOpenAIKey(token: string): Promise<string | null>;
    /**
     * / Public query: returns the raw OpenAI API key without auth.
     * / The key is the single global admin-configured key — not user-specific.
     * / This allows anonymous/guest users to use Live Mode with the admin key.
     * / Intentionally public: the key is already used client-side for all players.
     */
    getOpenAIKeyPublic(): Promise<string | null>;
    /**
     * / Public query: returns true if an OpenAI API key has been configured, false otherwise.
     * / No auth required — knowing whether a key exists is not sensitive.
     */
    getOpenAIKeyStatus(): Promise<boolean>;
    getTodayRankedSessionCount(token: string): Promise<bigint>;
    initAdmin(username: string, email: string, password: string): Promise<{
        __kind__: "ok";
        ok: PublicAdminProfile;
    } | {
        __kind__: "err";
        err: AuthError;
    }>;
    isAdminToken(token: string): Promise<boolean>;
    isUsernameAvailable(username: string): Promise<boolean>;
    login(identifier: string, password: string): Promise<{
        __kind__: "ok";
        ok: {
            token: string;
            profile: PublicProfile;
        };
    } | {
        __kind__: "err";
        err: AuthError;
    }>;
    logout(token: string): Promise<void>;
    reset(): Promise<void>;
    saveCallerProgress(token: string, rank: string, totalXp: bigint, streak: bigint, unlockedChallenges: Array<string>): Promise<{
        __kind__: "ok";
        ok: PublicProfile;
    } | {
        __kind__: "err";
        err: AuthError;
    }>;
    saveCallerSession(token: string, session: SessionResult): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: AuthError;
    }>;
    saveCallerStats(token: string, newStats: PlayerStats): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: AuthError;
    }>;
    setFreePlanConfig(token: string, config: FreePlanConfig): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: AuthError;
    }>;
    /**
     * / Admin: set global mock/live mode (requires admin session token)
     */
    setMockMode(token: string, enabled: boolean): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: AuthError;
    }>;
    /**
     * / Admin: store the OpenAI API key (requires admin session token)
     */
    setOpenAIKey(token: string, key: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: AuthError;
    }>;
    setUserPlan(adminToken: string, userId: string, plan: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: AuthError;
    }>;
    signup(username: string, email: string, password: string): Promise<{
        __kind__: "ok";
        ok: PublicProfile;
    } | {
        __kind__: "err";
        err: AuthError;
    }>;
    transform(raw: {
        context: Uint8Array;
        response: {
            status: bigint;
            body: Uint8Array;
            headers: Array<{
                value: string;
                name: string;
            }>;
        };
    }): Promise<{
        status: bigint;
        body: Uint8Array;
        headers: Array<{
            value: string;
            name: string;
        }>;
    }>;
    updateUserStatus(token: string, targetId: string, newStatus: Status): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: AuthError;
    }>;
}
