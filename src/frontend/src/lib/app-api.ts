import type { Status } from "@/backend";
import type {
  FreePlanConfig,
  PlayerProgress,
  SessionHistoryEntry,
} from "@/types";

export interface ApiPublicProfile {
  id: string;
  status: "active" | "suspended" | "blocked";
  streak: number;
  username: string;
  totalXp: number;
  totalXP?: number;
  createdAt: string;
  plan: string;
  rank: string;
  email: string;
  unlockedChallenges: string[];
}

export interface ApiAdminProfile {
  id: string;
  username: string;
  email: string;
  createdAt: string;
  lastLogin: string | null;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/app${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export function toFrontendProfile(profile: ApiPublicProfile) {
  return {
    ...profile,
    status: profile.status as Status,
    totalXp: BigInt(profile.totalXp ?? profile.totalXP ?? 0),
    streak: BigInt(profile.streak ?? 0),
    createdAt: BigInt(new Date(profile.createdAt).getTime() * 1_000_000),
  };
}

export function toFrontendAdmin(profile: ApiAdminProfile) {
  return {
    ...profile,
    createdAt: BigInt(new Date(profile.createdAt).getTime() * 1_000_000),
    lastLogin: BigInt(
      profile.lastLogin ? new Date(profile.lastLogin).getTime() * 1_000_000 : 0,
    ),
  };
}

export const appApi = {
  async signup(username: string, email: string, password: string) {
    return request<{ user: ApiPublicProfile }>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    });
  },
  async login(identifier: string, password: string) {
    return request<{ token: string; user: ApiPublicProfile }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    });
  },
  async logout(token: string) {
    return request<{ ok: true }>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  },
  async me(token: string) {
    return request<{ user: ApiPublicProfile }>(
      `/auth/me?token=${encodeURIComponent(token)}`,
    );
  },
  async adminLogin(identifier: string, password: string) {
    return request<{ token: string; profile: ApiAdminProfile }>(
      "/admin/login",
      {
        method: "POST",
        body: JSON.stringify({ identifier, password }),
      },
    );
  },
  async adminMe(token: string) {
    return request<{ profile: ApiAdminProfile }>(
      `/admin/me?token=${encodeURIComponent(token)}`,
    );
  },
  async adminLogout(token: string) {
    return request<{ ok: true }>("/admin/logout", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  },
  async getUsers(token: string) {
    return request<{ users: ApiPublicProfile[] }>(
      `/admin/users?token=${encodeURIComponent(token)}`,
    );
  },
  async updateUser(
    token: string,
    userId: string,
    updates: { status?: string; plan?: string },
  ) {
    return request<{ ok: true }>(`/admin/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ token, updates }),
    });
  },
  async deleteUser(token: string, userId: string) {
    return request<{ ok: true }>(
      `/admin/users/${userId}?token=${encodeURIComponent(token)}`,
      { method: "DELETE" },
    );
  },
  async getSettings() {
    return request<{
      settings: { freePlanConfig?: FreePlanConfig; mockMode?: boolean };
    }>("/settings");
  },
  async saveSetting(token: string, key: string, value: unknown) {
    return request<{ ok: true }>("/admin/settings", {
      method: "POST",
      body: JSON.stringify({ token, key, value }),
    });
  },
  async getProgress(token: string) {
    return request<{ progress: PlayerProgress | null; user: ApiPublicProfile }>(
      `/progress?token=${encodeURIComponent(token)}`,
    );
  },
  async saveProgress(token: string, progress: PlayerProgress) {
    return request<{ ok: true }>("/progress", {
      method: "POST",
      body: JSON.stringify({ token, progress }),
    });
  },
  async saveSession(
    token: string | null,
    session: SessionHistoryEntry & {
      messages?: unknown[];
      metadata?: Record<string, unknown>;
      characterName?: string;
    },
  ) {
    return request<{ ok: true }>("/sessions", {
      method: "POST",
      body: JSON.stringify({ token, session }),
    });
  },
};
