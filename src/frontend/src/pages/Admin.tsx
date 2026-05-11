/**
 * Admin dashboard — fully separate from player auth.
 * Uses useAdminAuth (rizz_admin_session_token) — never touches player session.
 */
import { type backendInterface, createActor } from "@/backend";
import type { PublicProfile, Status } from "@/backend";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import { Button } from "@/components/ui/button";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { useActor } from "@caffeineai/core-infrastructure";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Cpu,
  CreditCard,
  Crown,
  Layers,
  LogOut,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Sliders,
  Trash2,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; classes: string }> = {
  active: {
    label: "Active",
    classes: "bg-emerald-400/15 text-emerald-400 border-emerald-400/30",
  },
  suspended: {
    label: "Suspended",
    classes: "bg-amber-400/15 text-amber-400 border-amber-400/30",
  },
  blocked: {
    label: "Blocked",
    classes: "bg-red-400/15 text-red-400 border-red-400/30",
  },
};

const STATUS_FILTERS = ["all", "active", "suspended", "blocked"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

type AdminTab =
  | "users"
  | "ai-settings"
  | "challenges"
  | "characters"
  | "payments"
  | "app-settings";

const NAV_ITEMS: {
  id: AdminTab;
  label: string;
  icon: React.ReactNode;
  active: boolean;
}[] = [
  { id: "users", label: "Users", icon: <Users size={16} />, active: true },
  {
    id: "ai-settings",
    label: "AI Settings",
    icon: <Cpu size={16} />,
    active: true,
  },
  {
    id: "challenges",
    label: "Challenges",
    icon: <Zap size={16} />,
    active: false,
  },
  {
    id: "characters",
    label: "Characters",
    icon: <Layers size={16} />,
    active: false,
  },
  {
    id: "payments",
    label: "Payments",
    icon: <CreditCard size={16} />,
    active: false,
  },
  {
    id: "app-settings",
    label: "App Settings",
    icon: <Settings size={16} />,
    active: true,
  },
];

// ── Confirm Dialog ─────────────────────────────────────────────────────────────

function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      data-ocid="admin.confirm_dialog"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
        role="presentation"
      />
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative z-10 w-full max-w-xs bg-zinc-900 border border-zinc-700 rounded-2xl p-6 flex flex-col gap-4"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle
            size={18}
            className="text-red-400 flex-shrink-0 mt-0.5"
          />
          <p className="text-sm text-zinc-200">{message}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 h-9 rounded-xl text-sm font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors border border-zinc-700"
            onClick={onCancel}
            data-ocid="admin.cancel_button"
          >
            Cancel
          </button>
          <button
            type="button"
            className="flex-1 h-9 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors"
            onClick={onConfirm}
            data-ocid="admin.confirm_button"
          >
            Confirm
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Users Tab ──────────────────────────────────────────────────────────────────

type ActorType = backendInterface | null;

function UsersTab({
  adminToken,
  actor,
  isFetching,
}: {
  adminToken: string;
  actor: ActorType;
  isFetching: boolean;
}) {
  const [users, setUsers] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    msg: string;
    fn: () => void;
  } | null>(null);

  const load = useCallback(async () => {
    if (!actor || isFetching) return;
    setLoading(true);
    setError("");
    try {
      const result = await actor.getAllUsers(adminToken);
      if (result.__kind__ === "ok") setUsers(result.ok);
      else setError("Failed to load users.");
    } catch {
      setError("Connection error.");
    } finally {
      setLoading(false);
    }
  }, [actor, isFetching, adminToken]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStatusChange(userId: string, newStatus: Status) {
    if (!actor) return;
    setActionLoading(userId);
    try {
      await actor.updateUserStatus(adminToken, userId, newStatus);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u)),
      );
    } catch {
    } finally {
      setActionLoading(null);
    }
  }

  async function handlePlanChange(userId: string, newPlan: string) {
    if (!actor) return;
    setPlanLoading(userId);
    try {
      const result = await actor.setUserPlan(adminToken, userId, newPlan);
      if (result.__kind__ === "ok") {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, plan: newPlan } : u)),
        );
      }
    } catch {
    } finally {
      setPlanLoading(null);
    }
  }

  async function handleDelete(userId: string) {
    if (!actor) return;
    setConfirm(null);
    setActionLoading(userId);
    try {
      await actor.deleteUser(adminToken, userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch {
    } finally {
      setActionLoading(null);
    }
  }

  const filtered = users
    .filter((u) => {
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          u.username.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => Number(b.createdAt) - Number(a.createdAt));

  function formatDate(ns: bigint) {
    return new Date(Number(ns) / 1_000_000).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "2-digit",
    });
  }

  const stats = [
    { label: "Total", value: users.length },
    {
      label: "Active",
      value: users.filter((u) => u.status === "active").length,
    },
    {
      label: "Suspended",
      value: users.filter((u) => u.status === "suspended").length,
    },
    {
      label: "Blocked",
      value: users.filter((u) => u.status === "blocked").length,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-4 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-2 flex flex-col items-center gap-0.5"
          >
            <span className="text-xl font-bold text-white">{s.value}</span>
            <span className="text-[10px] text-zinc-500 text-center">
              {s.label}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search username or email…"
            className="w-full h-10 pl-9 pr-4 rounded-xl bg-zinc-900 border border-zinc-700 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-colors"
            data-ocid="admin.user_search_input"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUS_FILTERS.map((f) => (
            <button
              type="button"
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-colors ${
                statusFilter === f
                  ? "bg-violet-600 text-white"
                  : "bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white"
              }`}
              data-ocid={`admin.filter.${f}`}
            >
              {f === "all" ? "All Users" : f}
            </button>
          ))}
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white bg-zinc-800 border border-zinc-700 transition-colors"
            data-ocid="admin.reload_button"
          >
            <RefreshCw size={11} className={loading ? "animate-spin" : ""} />{" "}
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400" data-ocid="admin.users_error_state">
          {error}
        </p>
      )}

      {loading ? (
        <div
          className="flex items-center justify-center py-16"
          data-ocid="admin.users_loading_state"
        >
          <span className="w-7 h-7 rounded-full border-2 border-violet-400/30 border-t-violet-400 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="bg-zinc-900 border border-zinc-800 rounded-2xl p-10 flex flex-col items-center gap-3"
          data-ocid="admin.users_empty_state"
        >
          <Users size={32} className="text-zinc-600" />
          <p className="text-sm text-zinc-500">No users found</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2" data-ocid="admin.users_list">
          {filtered.map((u, i) => {
            const badge =
              STATUS_BADGE[u.status as string] ?? STATUS_BADGE.active;
            const isActing = actionLoading === u.id;
            return (
              <motion.div
                key={u.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: i * 0.025 }}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-3"
                data-ocid={`admin.user_item.${i + 1}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-violet-900/50 border border-violet-700/40 flex items-center justify-center text-sm font-bold text-violet-300 flex-shrink-0">
                    {u.username[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">
                        {u.username}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.classes}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 truncate">
                      {u.email}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-xs font-semibold text-violet-400">
                      {u.rank}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {Number(u.totalXp)} XP
                    </span>
                    {/* Plan badge + switcher */}
                    <div className="flex items-center gap-1 mt-0.5">
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${
                          u.plan === "pro"
                            ? "bg-amber-400/15 border-amber-400/40 text-amber-400"
                            : "bg-zinc-700/40 border-zinc-600/40 text-zinc-500"
                        }`}
                      >
                        {u.plan === "pro" ? (
                          <span className="flex items-center gap-0.5">
                            <Crown size={8} className="inline" /> Pro
                          </span>
                        ) : (
                          "Free"
                        )}
                      </span>
                      <button
                        type="button"
                        disabled={planLoading === u.id}
                        onClick={() =>
                          handlePlanChange(
                            u.id,
                            u.plan === "pro" ? "free" : "pro",
                          )
                        }
                        className="text-[9px] px-1.5 py-0.5 rounded-full border border-violet-700/50 text-violet-400 hover:bg-violet-900/30 transition-colors disabled:opacity-40"
                        data-ocid={`admin.plan_toggle.${i + 1}`}
                        aria-label={
                          u.plan === "pro"
                            ? "Downgrade to Free"
                            : "Upgrade to Pro"
                        }
                      >
                        {planLoading === u.id
                          ? "…"
                          : u.plan === "pro"
                            ? "→ Free"
                            : "→ Pro"}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                  <span>🔥 {Number(u.streak)} streak</span>
                  <span>•</span>
                  <span>Joined {formatDate(u.createdAt)}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(u.status as string) !== "active" && (
                    <button
                      type="button"
                      disabled={isActing}
                      onClick={() =>
                        handleStatusChange(u.id, "active" as Status)
                      }
                      className="text-[11px] px-3 py-1.5 rounded-lg border border-emerald-500/40 text-emerald-400 hover:bg-emerald-900/30 transition-colors disabled:opacity-40"
                      data-ocid={`admin.activate_button.${i + 1}`}
                    >
                      Activate
                    </button>
                  )}
                  {(u.status as string) !== "suspended" && (
                    <button
                      type="button"
                      disabled={isActing}
                      onClick={() =>
                        handleStatusChange(u.id, "suspended" as Status)
                      }
                      className="text-[11px] px-3 py-1.5 rounded-lg border border-amber-500/40 text-amber-400 hover:bg-amber-900/30 transition-colors disabled:opacity-40"
                      data-ocid={`admin.suspend_button.${i + 1}`}
                    >
                      Suspend
                    </button>
                  )}
                  {(u.status as string) !== "blocked" && (
                    <button
                      type="button"
                      disabled={isActing}
                      onClick={() =>
                        setConfirm({
                          msg: `Block ${u.username}? They won't be able to log in.`,
                          fn: () =>
                            handleStatusChange(u.id, "blocked" as Status),
                        })
                      }
                      className="text-[11px] px-3 py-1.5 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-900/30 transition-colors disabled:opacity-40"
                      data-ocid={`admin.block_button.${i + 1}`}
                    >
                      Block
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={() =>
                      setConfirm({
                        msg: `Delete ${u.username}? This cannot be undone.`,
                        fn: () => handleDelete(u.id),
                      })
                    }
                    className="text-[11px] px-3 py-1.5 rounded-lg border border-red-700/40 text-red-500 hover:bg-red-950/30 transition-colors disabled:opacity-40 ml-auto"
                    data-ocid={`admin.delete_button.${i + 1}`}
                  >
                    <Trash2 size={10} className="inline mr-1" />
                    Delete
                  </button>
                  {isActing && (
                    <span className="w-4 h-4 rounded-full border-2 border-violet-400/40 border-t-violet-400 animate-spin inline-block self-center" />
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          message={confirm.msg}
          onConfirm={confirm.fn}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

// ── AI Settings Tab ────────────────────────────────────────────────────────────

function AISettingsTab({
  adminToken,
  actor,
  isFetching,
}: {
  adminToken: string;
  actor: ActorType;
  isFetching: boolean;
}) {
  const [mockMode, setMockModeState] = useState<boolean | null>(null);
  const [mockLoading, setMockLoading] = useState(false);
  const [keyValue, setKeyValue] = useState("");
  const [keyStatus, setKeyStatus] = useState<boolean | null>(null);
  const [keyLoading, setKeyLoading] = useState(false);
  const [keyFeedback, setKeyFeedback] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);
  const keyRef = useRef<HTMLInputElement>(null);

  const loadSettings = useCallback(async () => {
    if (!actor || isFetching) return;
    try {
      const [mock, keyResult] = await Promise.all([
        actor.getMockMode(),
        actor.getOpenAIKeyStatus(),
      ]);
      setMockModeState(mock);
      setKeyStatus(keyResult);
    } catch {}
  }, [actor, isFetching]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function handleToggleMock() {
    if (!actor || mockMode === null) return;
    setMockLoading(true);
    try {
      const next = !mockMode;
      await actor.setMockMode(adminToken, next);
      setMockModeState(next);
    } catch {
    } finally {
      setMockLoading(false);
    }
  }

  async function handleSaveKey(e: React.FormEvent) {
    e.preventDefault();
    if (!actor || !keyValue.trim()) return;
    setKeyLoading(true);
    setKeyFeedback(null);
    try {
      const result = await actor.setOpenAIKey(adminToken, keyValue.trim());
      if (result.__kind__ === "ok") {
        // Re-verify that the key is now active
        const statusResult = await actor.getOpenAIKeyStatus();
        if (statusResult) {
          setKeyStatus(true);
          setKeyValue("");
          setKeyFeedback({
            type: "success",
            msg: "API key saved successfully.",
          });
        } else {
          setKeyFeedback({
            type: "error",
            msg: "Key saved but could not be verified. Please try again.",
          });
        }
      } else {
        // Map AuthError variants to human-readable messages
        const errKind = result.err.__kind__;
        let errMsg: string;
        if (errKind === "unauthorized") {
          errMsg = "Session expired. Please log out and log back in.";
        } else if (errKind === "invalidInput") {
          const detail = (
            result.err as { __kind__: "invalidInput"; invalidInput: string }
          ).invalidInput;
          errMsg = `Invalid API key format: ${detail}. Key must start with sk-`;
        } else {
          errMsg = "Failed to save API key. Please try again.";
        }
        setKeyFeedback({ type: "error", msg: errMsg });
      }
    } catch {
      setKeyFeedback({
        type: "error",
        msg: "Failed to save key. Check your connection and try again.",
      });
    } finally {
      setKeyLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 max-w-lg">
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-950/40 border border-violet-800/40">
        <Shield size={13} className="text-violet-400 flex-shrink-0" />
        <p className="text-xs text-violet-300">
          Only visible to admins. Never exposed to players.
        </p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
            AI Mode
          </span>
          {mockMode !== null && (
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                mockMode
                  ? "bg-amber-400/10 border-amber-400/30 text-amber-400"
                  : "bg-emerald-400/10 border-emerald-400/30 text-emerald-400"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full animate-pulse ${mockMode ? "bg-amber-400" : "bg-emerald-400"}`}
              />
              {mockMode ? "MOCK" : "LIVE"}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">Mock Mode</p>
            <p className="text-xs text-zinc-500">
              Simulated AI responses — no API key needed
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={mockMode === true}
            disabled={mockLoading || mockMode === null}
            onClick={handleToggleMock}
            className={`relative flex-shrink-0 w-12 h-6 rounded-full transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50 disabled:opacity-40 ${
              mockMode ? "bg-violet-600" : "bg-zinc-600"
            }`}
            data-ocid="admin.mock_mode_toggle"
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${mockMode ? "translate-x-6" : "translate-x-0"}`}
            />
          </button>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
          OpenAI API Key
        </p>
        <div
          className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium ${
            keyStatus === true
              ? "bg-emerald-900/20 border-emerald-700/40 text-emerald-400"
              : keyStatus === false
                ? "bg-red-950/20 border-red-700/40 text-red-400"
                : "bg-zinc-800 border-zinc-700 text-zinc-500"
          }`}
          data-ocid="admin.key_status"
        >
          {keyStatus === true ? (
            <>
              <CheckCircle2 size={14} /> API key active
            </>
          ) : keyStatus === false ? (
            <>
              <XCircle size={14} /> No API key configured
            </>
          ) : (
            <span>Checking…</span>
          )}
        </div>
        <form onSubmit={handleSaveKey} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="admin-api-key"
              className="text-xs font-semibold text-zinc-400 uppercase tracking-wide"
            >
              New API Key
            </label>
            <input
              ref={keyRef}
              id="admin-api-key"
              type="password"
              value={keyValue}
              onChange={(e) => setKeyValue(e.target.value)}
              placeholder="sk-…"
              autoComplete="off"
              spellCheck={false}
              className="w-full h-10 rounded-xl bg-zinc-800 border border-zinc-700 px-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-colors"
              data-ocid="admin.api_key_input"
            />
          </div>
          {keyFeedback && (
            <p
              className={`text-sm flex items-center gap-1.5 ${
                keyFeedback.type === "success"
                  ? "text-emerald-400"
                  : "text-red-400"
              }`}
              data-ocid={
                keyFeedback.type === "success"
                  ? "admin.key_success_state"
                  : "admin.key_error_state"
              }
            >
              {keyFeedback.type === "success" ? (
                <CheckCircle2 size={13} />
              ) : (
                <XCircle size={13} />
              )}
              {keyFeedback.msg}
            </p>
          )}
          <Button
            type="submit"
            disabled={!keyValue.trim() || keyLoading}
            className="bg-violet-600 hover:bg-violet-500 text-white border-0"
            data-ocid="admin.save_key_button"
          >
            {keyLoading ? "Saving…" : "Save API Key"}
          </Button>
        </form>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
          Model
        </p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">gpt-4o-mini</p>
            <p className="text-xs text-zinc-500">
              Default character conversation model
            </p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400">
            Active
          </span>
        </div>
      </div>
    </div>
  );
}

// ── App Settings Tab (Free Plan Config) ─────────────────────────────────────────

function AppSettingsTab({
  adminToken,
  actor,
  isFetching,
}: {
  adminToken: string;
  actor: ActorType;
  isFetching: boolean;
}) {
  const [_config, setConfig] = useState<{
    rankedSessionsPerDay: number;
    rizzAssistPerSession: number;
    hintsPerSession: number;
  } | null>(null);
  const [draft, setDraft] = useState<{
    rankedSessionsPerDay: number;
    rizzAssistPerSession: number;
    hintsPerSession: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!actor || isFetching) return;
    setLoading(true);
    try {
      const cfg = await actor.getFreePlanConfig();
      const parsed = {
        rankedSessionsPerDay: Number(cfg.rankedSessionsPerDay),
        rizzAssistPerSession: Number(cfg.rizzAssistPerSession),
        hintsPerSession: Number(cfg.hintsPerSession),
      };
      setConfig(parsed);
      setDraft({ ...parsed });
    } catch {
      setFeedback({ type: "error", msg: "Failed to load config." });
    } finally {
      setLoading(false);
    }
  }, [actor, isFetching]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!actor || !draft) return;
    setSaving(true);
    setFeedback(null);
    try {
      const result = await actor.setFreePlanConfig(adminToken, {
        rankedSessionsPerDay: BigInt(draft.rankedSessionsPerDay),
        rizzAssistPerSession: BigInt(draft.rizzAssistPerSession),
        hintsPerSession: BigInt(draft.hintsPerSession),
      });
      if (result.__kind__ === "ok") {
        setConfig({ ...draft });
        setFeedback({ type: "success", msg: "Free Plan settings saved." });
      } else {
        setFeedback({
          type: "error",
          msg: "Failed to save. Check admin session.",
        });
      }
    } catch {
      setFeedback({ type: "error", msg: "Connection error." });
    } finally {
      setSaving(false);
    }
  }

  type DraftConfig = NonNullable<typeof draft>;
  function setField(key: keyof DraftConfig, val: number) {
    setDraft((prev) => (prev ? { ...prev, [key]: val } : prev));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="w-7 h-7 rounded-full border-2 border-violet-400/30 border-t-violet-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-950/40 border border-violet-800/40">
        <Shield size={13} className="text-violet-400 flex-shrink-0" />
        <p className="text-xs text-violet-300">
          These limits apply globally to all Free plan users.
        </p>
      </div>

      {/* Free Plan Settings */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <Sliders size={14} className="text-violet-400" />
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Free Plan Limits
          </p>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="aset-ranked"
              className="text-xs font-semibold text-zinc-400 uppercase tracking-wide"
            >
              Ranked sessions per day
            </label>
            <input
              id="aset-ranked"
              type="number"
              min={1}
              max={99}
              value={draft?.rankedSessionsPerDay ?? ""}
              onChange={(e) =>
                setField("rankedSessionsPerDay", Number(e.target.value))
              }
              className="w-full h-10 rounded-xl bg-zinc-800 border border-zinc-700 px-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-colors"
              data-ocid="admin.free_plan_ranked_input"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="aset-assist"
              className="text-xs font-semibold text-zinc-400 uppercase tracking-wide"
            >
              Rizz Assist uses per session
            </label>
            <input
              id="aset-assist"
              type="number"
              min={1}
              max={99}
              value={draft?.rizzAssistPerSession ?? ""}
              onChange={(e) =>
                setField("rizzAssistPerSession", Number(e.target.value))
              }
              className="w-full h-10 rounded-xl bg-zinc-800 border border-zinc-700 px-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-colors"
              data-ocid="admin.free_plan_assist_input"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="aset-hints"
              className="text-xs font-semibold text-zinc-400 uppercase tracking-wide"
            >
              Hint uses per session
            </label>
            <input
              id="aset-hints"
              type="number"
              min={1}
              max={99}
              value={draft?.hintsPerSession ?? ""}
              onChange={(e) =>
                setField("hintsPerSession", Number(e.target.value))
              }
              className="w-full h-10 rounded-xl bg-zinc-800 border border-zinc-700 px-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-colors"
              data-ocid="admin.free_plan_hints_input"
            />
          </div>

          {feedback && (
            <p
              className={`text-sm flex items-center gap-1.5 ${
                feedback.type === "success"
                  ? "text-emerald-400"
                  : "text-red-400"
              }`}
              data-ocid={
                feedback.type === "success"
                  ? "admin.free_plan_success_state"
                  : "admin.free_plan_error_state"
              }
            >
              {feedback.type === "success" ? (
                <CheckCircle2 size={13} />
              ) : (
                <XCircle size={13} />
              )}
              {feedback.msg}
            </p>
          )}

          <Button
            type="submit"
            disabled={saving || !draft}
            className="bg-violet-600 hover:bg-violet-500 text-white border-0"
            data-ocid="admin.free_plan_save_button"
          >
            {saving ? "Saving…" : "Save Free Plan Settings"}
          </Button>
        </form>
      </div>

      {/* Rizz Pro plan info (read-only placeholder) */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Crown size={14} className="text-amber-400" />
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Rizz Pro Plan
          </p>
          <span className="ml-auto text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-400">
            Coming Soon
          </span>
        </div>
        <p className="text-sm font-semibold text-white">$9.99 / month</p>
        <ul className="flex flex-col gap-1 text-xs text-zinc-500">
          {[
            "Unlimited ranked sessions",
            "Unlimited Rizz Assist",
            "Unlimited hints",
            "Harder challenge modes",
            "Realistic mode",
            "Future elite characters",
            "Faster progression",
          ].map((b) => (
            <li key={b} className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400 text-[8px]">
                ✓
              </span>
              {b}
            </li>
          ))}
        </ul>
        <p className="text-xs text-zinc-600 mt-1">
          Billing not yet active. User plan can be set manually in Users tab.
        </p>
      </div>
    </div>
  );
}

// ── Coming Soon Tab ────────────────────────────────────────────────────────────

function ComingSoonTab({
  label,
  icon,
}: { label: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
        {icon}
      </div>
      <div>
        <p className="text-base font-semibold text-zinc-300">{label}</p>
        <p className="text-sm text-zinc-600 mt-1">Coming soon</p>
      </div>
      <span className="px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
        In development
      </span>
    </div>
  );
}

// ── Main Admin Page ────────────────────────────────────────────────────────────

function StandaloneBackendNotice({ tab }: { tab: AdminTab }) {
  const copy =
    tab === "ai-settings"
      ? {
          title: "AI settings are configured in Vercel",
          body: "This standalone deployment does not have a Caffeine/ICP backend canister, so the admin panel cannot store an API key in-app. Add OPENAI_API_KEY in Vercel Project Settings -> Environment Variables, then redeploy.",
        }
      : tab === "app-settings"
        ? {
            title: "Free plan limits are using app defaults",
            body: "Ranked session, hint, and assist limits are enforced client-side with the current defaults. In-app editing requires a deployed backend canister.",
          }
        : {
            title: "No backend datastore connected",
            body: "User management requires the Caffeine/ICP backend canister. The Vercel-only deployment can run the game and Live AI proxy, but it cannot list or manage backend users.",
          };

  return (
    <div className="max-w-xl bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <AlertTriangle
          size={18}
          className="text-amber-400 flex-shrink-0 mt-0.5"
        />
        <div>
          <p className="text-sm font-semibold text-white">{copy.title}</p>
          <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
            {copy.body}
          </p>
        </div>
      </div>
      <div className="rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Required production env
        </p>
        <code className="block mt-2 text-sm text-emerald-400">
          OPENAI_API_KEY
        </code>
      </div>
    </div>
  );
}

export default function Admin() {
  const { actor, isFetching } = useActor(createActor);
  const {
    adminToken,
    adminProfile,
    isAdminAuthenticated,
    isLoading,
    adminLogin,
    adminLogout,
  } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>("users");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!isAdminAuthenticated) {
    return <AdminLoginForm adminLogin={adminLogin} isLoading={isLoading} />;
  }

  async function handleLogout() {
    await adminLogout();
  }

  return (
    <div
      className="min-h-screen bg-zinc-950 text-white flex"
      data-ocid="admin.page"
    >
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-56 bg-zinc-900 border-r border-zinc-800 flex-shrink-0 sticky top-0 h-screen">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-zinc-800">
          <div className="w-8 h-8 rounded-lg bg-violet-900/50 border border-violet-700/50 flex items-center justify-center flex-shrink-0">
            <Shield size={14} className="text-violet-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white leading-tight">
              Admin Panel
            </p>
            <p className="text-[10px] text-zinc-500 truncate">
              Rizz Me If You Can
            </p>
          </div>
        </div>
        <nav className="flex-1 py-4 flex flex-col gap-1 px-2">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium w-full text-left transition-colors ${
                activeTab === item.id
                  ? "bg-violet-600 text-white"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
              data-ocid={`admin.nav_${item.id.replace("-", "_")}_tab`}
            >
              {item.icon}
              {item.label}
              {!item.active && (
                <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-zinc-600">
                  Soon
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="border-t border-zinc-800 px-4 py-4">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 rounded-lg bg-violet-900/50 flex items-center justify-center text-xs font-bold text-violet-300 flex-shrink-0">
              {adminProfile?.username[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {adminProfile?.username}
              </p>
              <p className="text-[10px] text-zinc-500">Administrator</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-red-400 hover:bg-red-950/20 border border-zinc-800 hover:border-red-800/40 transition-colors"
            data-ocid="admin.logout_button"
          >
            <LogOut size={13} /> Logout
          </button>
        </div>
      </aside>

      {/* Mobile overlay sidebar */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setSidebarOpen(false)}
            onKeyDown={(e) => e.key === "Escape" && setSidebarOpen(false)}
            role="presentation"
          />
          <div className="relative w-60 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full">
            <div className="flex items-center gap-2.5 px-5 py-5 border-b border-zinc-800">
              <Shield size={16} className="text-violet-400" />
              <span className="text-sm font-bold">Admin Panel</span>
            </div>
            <nav className="flex-1 py-4 flex flex-col gap-1 px-2 overflow-y-auto">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium w-full text-left transition-colors ${
                    activeTab === item.id
                      ? "bg-violet-600 text-white"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                  }`}
                  data-ocid={`admin.mobile_nav_${item.id.replace("-", "_")}_tab`}
                >
                  {item.icon}
                  {item.label}
                  {!item.active && (
                    <span className="ml-auto text-[9px] text-zinc-600 font-bold uppercase">
                      Soon
                    </span>
                  )}
                </button>
              ))}
            </nav>
            <div className="border-t border-zinc-800 px-4 py-4">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-red-400 border border-zinc-800 transition-colors"
                data-ocid="admin.mobile_logout_button"
              >
                <LogOut size={13} /> Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 px-5 py-3.5 flex items-center gap-3">
          <button
            type="button"
            className="md:hidden flex flex-col gap-1 p-2 rounded-lg hover:bg-zinc-800 transition-colors"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
            data-ocid="admin.mobile_menu_button"
          >
            <span className="w-5 h-0.5 bg-zinc-400 rounded" />
            <span className="w-5 h-0.5 bg-zinc-400 rounded" />
            <span className="w-5 h-0.5 bg-zinc-400 rounded" />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <BarChart3 size={15} className="text-zinc-500 flex-shrink-0" />
            <h1 className="text-sm font-bold text-white truncate">
              {NAV_ITEMS.find((n) => n.id === activeTab)?.label ?? "Dashboard"}
            </h1>
            <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-red-900/30 border border-red-700/40 text-red-400">
              RESTRICTED
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="hidden sm:inline text-xs text-zinc-500">
              {adminProfile?.username}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-red-400 px-3 py-1.5 rounded-xl hover:bg-red-950/20 border border-zinc-800 hover:border-red-800/40 transition-colors"
              data-ocid="admin.topbar_logout_button"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        <main className="flex-1 px-5 py-6 overflow-y-auto">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "users" && actor && (
              <UsersTab
                adminToken={adminToken!}
                actor={actor}
                isFetching={isFetching}
              />
            )}
            {activeTab === "ai-settings" && actor && (
              <AISettingsTab
                adminToken={adminToken!}
                actor={actor}
                isFetching={isFetching}
              />
            )}
            {activeTab === "challenges" && (
              <ComingSoonTab label="Challenges" icon={<Zap size={22} />} />
            )}
            {activeTab === "characters" && (
              <ComingSoonTab label="Characters" icon={<Layers size={22} />} />
            )}
            {activeTab === "payments" && (
              <ComingSoonTab label="Payments" icon={<CreditCard size={22} />} />
            )}
            {activeTab === "app-settings" && actor && (
              <AppSettingsTab
                adminToken={adminToken!}
                actor={actor}
                isFetching={isFetching}
              />
            )}
            {(activeTab === "users" ||
              activeTab === "ai-settings" ||
              activeTab === "app-settings") &&
              !actor && <StandaloneBackendNotice tab={activeTab} />}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
