/**
 * Native in-app authentication using backend signup/login/logout.
 * No external redirects. No Internet Identity.
 */
import { createActor } from "@/backend";
import type { PublicProfile } from "@/backend";
import { useActor } from "@caffeineai/core-infrastructure";
import { useCallback, useEffect, useRef, useState } from "react";

export type { PublicProfile };

const SESSION_KEY = "rizz_session_token";
const USER_KEY = "rizz_current_user";
const GUEST_PROGRESS_KEY = "rizz-player-progress";
const GUEST_SESSIONS_KEY = "rizz-guest-sessions";
const GUEST_PASSED_WALL_KEY = "rizz-guest-passed-wall";

function loadToken(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function saveToken(token: string): void {
  try {
    localStorage.setItem(SESSION_KEY, token);
  } catch {}
}

function clearToken(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {}
}

function saveUser(user: PublicProfile): void {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {}
}

function loadUser(): PublicProfile | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PublicProfile;
  } catch {
    return null;
  }
}

export function authErrorToMessage(kind: string, detail?: string): string {
  switch (kind) {
    case "blocked":
      return "Your account has been blocked. Contact support.";
    case "suspended":
      return "Your account is suspended. You cannot access gameplay.";
    case "wrongPassword":
      return "Wrong password. Please try again.";
    case "notFound":
      return "Account not found. Check your email or username.";
    case "usernameTaken":
      return "Username already taken. Try another one.";
    case "emailTaken":
      return "Email already registered. Try logging in instead.";
    case "unauthorized":
      return "Not authorized.";
    case "invalidInput":
      return detail ? `Invalid input: ${detail}` : "Invalid input provided.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: PublicProfile | null;
  /** Always false for player sessions — admin status is tracked separately via adminSession. */
  isAdmin: false;
  isSuspended: boolean;
  authError: string | null;
  clearAuthError: () => void;
  login: (identifier: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  signup: (
    username: string,
    email: string,
    password: string,
  ) => Promise<{ error?: string }>;
  refreshUser: () => Promise<void>;
}

export function useAuth(): AuthState {
  const { actor, isFetching } = useActor(createActor);
  const [user, setUser] = useState<PublicProfile | null>(() => loadUser());
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const hasVerifiedRef = useRef(false);

  useEffect(() => {
    if (!actor || isFetching || hasVerifiedRef.current) return;
    const token = loadToken();
    if (!token) return;
    hasVerifiedRef.current = true;
    setIsLoading(true);
    actor
      .getCallerProfile(token)
      .then((profile) => {
        if (profile) {
          setUser(profile);
          saveUser(profile);
        } else {
          clearToken();
          setUser(null);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [actor, isFetching]);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  /** Merge any guest progress into the authenticated account, then clean up. */
  const mergeGuestProgress = useCallback(
    async (token: string) => {
      try {
        const raw = localStorage.getItem(GUEST_PROGRESS_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as {
          totalXP?: number;
          rankId?: string;
          streak?: number;
          unlockedChallenges?: string[];
          sessionHistory?: unknown[];
        };
        const totalXP = parsed.totalXP ?? 0;
        const sessionHistory = parsed.sessionHistory ?? [];
        if (totalXP > 0 || sessionHistory.length > 0) {
          await actor?.saveCallerProgress(
            token,
            parsed.rankId ?? "rookie",
            BigInt(totalXP),
            BigInt(parsed.streak ?? 0),
            parsed.unlockedChallenges ?? [],
          );
        }
        // Clear guest data after merge
        localStorage.removeItem(GUEST_PROGRESS_KEY);
        localStorage.removeItem(GUEST_SESSIONS_KEY);
        localStorage.removeItem(GUEST_PASSED_WALL_KEY);
      } catch {
        // Non-critical — proceed even if merge fails
      }
    },
    [actor],
  );

  const login = useCallback(
    async (
      identifier: string,
      password: string,
    ): Promise<{ error?: string }> => {
      if (!actor) return { error: "Not ready. Please try again." };
      setIsLoading(true);
      setAuthError(null);
      try {
        const result = await actor.login(identifier.trim(), password);
        if (result.__kind__ === "ok") {
          const { token, profile } = result.ok;
          saveToken(token);
          saveUser(profile);
          setUser(profile);
          // Merge any guest progress into the logged-in session
          await mergeGuestProgress(token);
          return {};
        }
        const msg = authErrorToMessage(
          result.err.__kind__,
          result.err.__kind__ === "invalidInput"
            ? result.err.invalidInput
            : undefined,
        );
        setAuthError(msg);
        return { error: msg };
      } catch {
        const msg = "Connection error. Please try again.";
        setAuthError(msg);
        return { error: msg };
      } finally {
        setIsLoading(false);
      }
    },
    [actor, mergeGuestProgress],
  );

  const signup = useCallback(
    async (
      username: string,
      email: string,
      password: string,
    ): Promise<{ error?: string }> => {
      if (!actor) return { error: "Not ready. Please try again." };
      setIsLoading(true);
      setAuthError(null);
      try {
        const result = await actor.signup(
          username.trim(),
          email.trim(),
          password,
        );
        if (result.__kind__ === "ok") {
          // Auto-login after signup to get a session token
          const loginResult = await actor.login(email.trim(), password);
          if (loginResult.__kind__ === "ok") {
            const { token, profile } = loginResult.ok;
            saveToken(token);
            saveUser(profile);
            setUser(profile);
            // Merge any guest progress into the new account
            await mergeGuestProgress(token);
          } else {
            // Signup succeeded but auto-login failed — store profile without token
            saveUser(result.ok);
            setUser(result.ok);
          }
          return {};
        }
        const msg = authErrorToMessage(
          result.err.__kind__,
          result.err.__kind__ === "invalidInput"
            ? result.err.invalidInput
            : undefined,
        );
        setAuthError(msg);
        return { error: msg };
      } catch {
        const msg = "Connection error. Please try again.";
        setAuthError(msg);
        return { error: msg };
      } finally {
        setIsLoading(false);
      }
    },
    [actor, mergeGuestProgress],
  );

  const logout = useCallback(async () => {
    const token = loadToken();
    clearToken();
    setUser(null);
    hasVerifiedRef.current = false;
    if (actor && token) {
      try {
        await actor.logout(token);
      } catch {}
    }
  }, [actor]);

  const refreshUser = useCallback(async () => {
    if (!actor) return;
    try {
      const storedToken = loadToken();
      if (!storedToken) return;
      const profile = await actor.getCallerProfile(storedToken);
      if (profile) {
        setUser(profile);
        saveUser(profile);
      }
    } catch {}
  }, [actor]);

  return {
    isAuthenticated: user !== null,
    isLoading,
    user,
    isAdmin: false as const,
    isSuspended: user?.status === "suspended",
    authError,
    clearAuthError,
    login,
    logout,
    signup,
    refreshUser,
  };
}
