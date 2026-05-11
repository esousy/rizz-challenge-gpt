/**
 * Separate admin authentication — completely isolated from player auth.
 * Uses localStorage key 'rizz_admin_session_token' (never 'rizz_session_token').
 */
import { createActor } from "@/backend";
import type { PublicAdminProfile } from "@/backend";
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

// Helper: wrap any IC call with a 5-second timeout so a slow/unreachable
// canister never hangs the browser indefinitely.
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

  // On mount: bootstrap admin account (safe to call every time — backend ignores if already exists),
  // then validate any existing session token.
  useEffect(() => {
    const token = loadAdminToken();
    if (!actor && token?.startsWith("standalone-admin:")) {
      setAdminToken(token);
      setAdminProfile(createStandaloneProfile());
      return;
    }

    if (!actor || isFetching || hasBootstrappedRef.current) return;
    hasBootstrappedRef.current = true;

    (async () => {
      // Step 1: ensure the default admin account exists.
      // initAdmin returns #err(#usernameTaken) if it already exists — that's fine, just ignore it.
      try {
        await withTimeout(
          actor.initAdmin("admin", "medes608@gmail.com", "RizzAdmin2024!#"),
        );
      } catch {
        // ignore — admin may already exist, or canister was slow
      }

      // Step 2: validate any existing session token stored in localStorage.
      if (hasVerifiedRef.current) return;
      if (!token) return;
      hasVerifiedRef.current = true;
      setIsLoading(true);
      if (token.startsWith("standalone-admin:") && !actor) {
        setAdminToken(token);
        setAdminProfile(createStandaloneProfile());
        setIsLoading(false);
        return;
      }
      try {
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
      } catch {
        // Timeout or IC error — clear session so user can try again cleanly
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
      const normalized = identifier.trim().toLowerCase();
      if (
        !actor &&
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
      if (!actor) {
        return { error: "Invalid username or password." };
      }
      setIsLoading(true);
      try {
        const result = await withTimeout(
          actor.adminLogin(identifier.trim(), password),
        );
        if (result.__kind__ === "ok") {
          const { token, profile } = result.ok;
          saveAdminToken(token);
          // Update state synchronously so Admin.tsx re-renders immediately
          setAdminToken(token);
          setAdminProfile(profile);
          return {};
        }
        const kind = result.err.__kind__;
        const msgMap: Record<string, string> = {
          wrongPassword: "Invalid username or password.",
          notFound: "Admin account not found. Please contact support.",
          blocked: "This admin account has been blocked.",
          unauthorized: "Not authorized.",
          invalidInput: "Invalid input provided.",
        };
        return { error: msgMap[kind] ?? "Login failed. Please try again." };
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
