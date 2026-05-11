/**
 * Separate admin authentication, isolated from player auth.
 * Uses localStorage key 'rizz_admin_session_token'.
 */
import { createActor } from "@/backend";
import type { PublicAdminProfile } from "@/backend";
import { appApi, toFrontendAdmin } from "@/lib/app-api";
import { useActor } from "@caffeineai/core-infrastructure";
import { useCallback, useEffect, useRef, useState } from "react";

export type { PublicAdminProfile };

const ADMIN_TOKEN_KEY = "rizz_admin_session_token";
const STANDALONE_ADMIN = {
  username: "admin",
  email: "medes608@gmail.com",
  password: "RizzAdmin2024!#",
};

function loadAdminToken(): string | null {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

function saveAdminToken(token: string): void {
  try {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
  } catch {}
}

function clearAdminToken(): void {
  try {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {}
}

function withTimeout<T>(promise: Promise<T>, ms = 5000): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`IC canister call timed out after ${ms}ms`)),
      ms,
    ),
  );
  return Promise.race([promise, timeout]);
}

function createStandaloneProfile(): PublicAdminProfile {
  return {
    id: "standalone-admin",
    username: STANDALONE_ADMIN.username,
    email: STANDALONE_ADMIN.email,
    createdAt: BigInt(0),
    lastLogin: BigInt(Date.now()) * BigInt(1_000_000),
  };
}

export interface AdminAuthState {
  adminToken: string | null;
  adminProfile: PublicAdminProfile | null;
  isAdminAuthenticated: boolean;
  isLoading: boolean;
  adminLogin: (
    identifier: string,
    password: string,
  ) => Promise<{ error?: string }>;
  adminLogout: () => Promise<void>;
}

export function useAdminAuth(): AdminAuthState {
  const { actor, isFetching } = useActor(createActor);
  const [adminToken, setAdminToken] = useState<string | null>(() =>
    loadAdminToken(),
  );
  const [adminProfile, setAdminProfile] = useState<PublicAdminProfile | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const hasBootstrappedRef = useRef(false);
  const hasVerifiedRef = useRef(false);

  useEffect(() => {
    if (isFetching || hasBootstrappedRef.current) return;
    hasBootstrappedRef.current = true;

    (async () => {
      if (actor) {
        try {
          await withTimeout(
            actor.initAdmin(
              STANDALONE_ADMIN.username,
              STANDALONE_ADMIN.email,
              STANDALONE_ADMIN.password,
            ),
          );
        } catch {}
      }

      if (hasVerifiedRef.current) return;
      const token = loadAdminToken();
      if (!token) return;
      hasVerifiedRef.current = true;
      setIsLoading(true);

      try {
        if (!actor) {
          if (token.startsWith("standalone-admin:")) {
            const health = await appApi.health().catch(() => null);
            if (health?.databaseConfigured) {
              clearAdminToken();
              setAdminToken(null);
              setAdminProfile(null);
            } else {
              setAdminToken(token);
              setAdminProfile(createStandaloneProfile());
            }
          } else {
            const result = await appApi.adminMe(token);
            setAdminToken(token);
            setAdminProfile(toFrontendAdmin(result.profile));
          }
        } else {
          const valid = await withTimeout(actor.isAdminToken(token));
          if (!valid) {
            clearAdminToken();
            setAdminToken(null);
            setAdminProfile(null);
            return;
          }
          const profile = await withTimeout(actor.getAdminProfile(token));
          if (profile) {
            setAdminToken(token);
            setAdminProfile(profile);
          } else {
            clearAdminToken();
            setAdminToken(null);
            setAdminProfile(null);
          }
        }
      } catch {
        clearAdminToken();
        setAdminToken(null);
        setAdminProfile(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [actor, isFetching]);

  const adminLogin = useCallback(
    async (
      identifier: string,
      password: string,
    ): Promise<{ error?: string }> => {
      setIsLoading(true);
      const normalized = identifier.trim().toLowerCase();
      try {
        if (!actor) {
          try {
            const result = await appApi.adminLogin(identifier.trim(), password);
            const profile = toFrontendAdmin(result.profile);
            saveAdminToken(result.token);
            setAdminToken(result.token);
            setAdminProfile(profile);
            return {};
          } catch (err) {
            const health = await appApi.health().catch(() => null);
            if (health?.databaseConfigured) {
              return {
                error:
                  err instanceof Error
                    ? err.message
                    : "Invalid username or password.",
              };
            }
            if (
              (normalized === STANDALONE_ADMIN.username ||
                normalized === STANDALONE_ADMIN.email) &&
              password === STANDALONE_ADMIN.password
            ) {
              const token = `standalone-admin:${Date.now()}`;
              const profile = createStandaloneProfile();
              saveAdminToken(token);
              setAdminToken(token);
              setAdminProfile(profile);
              return {};
            }
            return { error: "Invalid username or password." };
          }
        }

        const result = await withTimeout(
          actor.adminLogin(identifier.trim(), password),
        );
        if (result.__kind__ === "ok") {
          const { token, profile } = result.ok;
          saveAdminToken(token);
          setAdminToken(token);
          setAdminProfile(profile);
          return {};
        }
        const msgMap: Record<string, string> = {
          wrongPassword: "Invalid username or password.",
          notFound: "Admin account not found. Please contact support.",
          blocked: "This admin account has been blocked.",
          unauthorized: "Not authorized.",
          invalidInput: "Invalid input provided.",
        };
        return {
          error:
            msgMap[result.err.__kind__] ?? "Login failed. Please try again.",
        };
      } catch {
        return { error: "Connection error. Please try again." };
      } finally {
        setIsLoading(false);
      }
    },
    [actor],
  );

  const adminLogout = useCallback(async () => {
    const token = loadAdminToken();
    clearAdminToken();
    setAdminToken(null);
    setAdminProfile(null);
    hasVerifiedRef.current = false;
    if (actor && token) {
      try {
        await withTimeout(actor.adminLogout(token));
      } catch {}
    } else if (token && !token.startsWith("standalone-admin:")) {
      try {
        await appApi.adminLogout(token);
      } catch {}
    }
  }, [actor]);

  return {
    adminToken,
    adminProfile,
    isAdminAuthenticated: adminProfile !== null && adminToken !== null,
    isLoading,
    adminLogin,
    adminLogout,
  };
}
