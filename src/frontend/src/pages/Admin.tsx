/**
 * Admin dashboard — fully separate from player auth.
 * Uses useAdminAuth (rizz_admin_session_token) — never touches player session.
 */
import { type backendInterface, createActor } from "@/backend";
import type { PublicProfile, Status } from "@/backend";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import { Button } from "@/components/ui/button";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { appApi, toFrontendProfile } from "@/lib/app-api";
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
  BarChart2,
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
  | "dashboard"
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
  { id: "dashboard", label: "Dashboard", icon: <BarChart2 size={16} />, active: true },
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

// ── Dashboard Tab ──────────────────────────────────────────────────────────
function DashboardTab({ adminToken }: { adminToken: string }) {
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [errors, setErrors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      appApi.adminDashboard(adminToken),
      appApi.adminAiErrors(adminToken, 20),
    ])
      .then(([dash, errs]) => {
        setData(dash as Record<string, any>);
        setErrors(errs.errors ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [adminToken]);

  if (loading) return <div className="text-zinc-500 text-sm p-4">Loading dashboard...</div>;
  if (!data) return <div className="text-zinc-500 text-sm p-4">Failed to load dashboard data.</div>;

  function MetricCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
    return (
      <div className={`bg-zinc-900 border rounded-2xl p-4 flex flex-col gap-1 ${accent ? 'border-violet-700/50' : 'border-zinc-800'}`}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</p>
        <p className={`text-xl font-bold font-display ${accent ? 'text-violet-400' : 'text-white'}`}>{value}</p>
        {sub && <p className="text-xs text-zinc-500">{sub}</p>}
      </div>
    );
  }

  function Section({ period, metrics }: { period: string; metrics: any }) {
    const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
    const fmtUsd = (n: number) => n < 0 ? `-$${Math.abs(n).toFixed(2)}` : `$${n.toFixed(2)}`;
    return (
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">{period}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard label="New Users" value={fmt(metrics.newUsers)} />
          <MetricCard label="Active Users" value={fmt(metrics.activeUsers)} />
          <MetricCard label="Ranked Sessions" value={fmt(metrics.rankedSessions)} />
          <MetricCard label="AI Calls" value={fmt(metrics.aiCalls)} />
          <MetricCard label="Hints" value={fmt(metrics.hintsUsed)} />
          <MetricCard label="Total Tokens" value={fmt(metrics.totalTokens)} />
          <MetricCard label="AI Cost" value={fmtUsd(metrics.estimatedCost)} />
          <MetricCard label="Revenue" value={fmtUsd(metrics.estimatedRevenue)} />
          <MetricCard label="Profit" value={fmtUsd(metrics.estimatedProfit)} accent />
        </div>
      </div>
    );
  }

  const today = data.today ?? {};
  const last7 = data.last7Days ?? {};
  const last30 = data.last30Days ?? {};
  const features = Object.entries(last30.byFeature ?? {}) as [string, any][];
  const categories = Object.entries(last30.byCategory ?? {}) as [string, any][];
  const fmtUsd = (n: number) => `$${n.toFixed(2)}`;

  return (
    <div className="flex flex-col gap-8 max-w-5xl">
      <Section period="Today" metrics={today} />
      <Section period="Last 7 Days" metrics={last7} />
      <Section period="Last 30 Days" metrics={last30} />

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Usage by Category (30 days)</h3>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase">
              <th className="px-4 py-3 text-left">Category</th><th className="px-4 py-3 text-right">Calls</th><th className="px-4 py-3 text-right">Tokens</th><th className="px-4 py-3 text-right">Cost</th>
            </tr></thead>
            <tbody>
              {categories.map(([cat, v]: [string, any]) => (
                <tr key={cat} className="border-b border-zinc-800/50">
                  <td className="px-4 py-2 text-white font-medium capitalize">{cat}</td>
                  <td className="px-4 py-2 text-right text-zinc-300">{v.calls}</td>
                  <td className="px-4 py-2 text-right text-zinc-300">{v.tokens}</td>
                  <td className="px-4 py-2 text-right text-zinc-300">{fmtUsd(v.cost)}</td>
                </tr>
              ))}
              {categories.length === 0 && <tr><td colSpan={4} className="px-4 py-4 text-zinc-600 text-center">No data yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Cost by Feature (30 days)</h3>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase">
              <th className="px-4 py-3 text-left">Feature</th><th className="px-4 py-3 text-right">Calls</th><th className="px-4 py-3 text-right">Cost</th>
            </tr></thead>
            <tbody>
              {features.map(([feat, v]: [string, any]) => (
                <tr key={feat} className="border-b border-zinc-800/50">
                  <td className="px-4 py-2 text-white font-medium">{feat.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-2 text-right text-zinc-300">{v.calls}</td>
                  <td className="px-4 py-2 text-right text-zinc-300">{fmtUsd(v.cost)}</td>
                </tr>
              ))}
              {features.length === 0 && <tr><td colSpan={3} className="px-4 py-4 text-zinc-600 text-center">No data yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Recent AI Errors</h3>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase">
              <th className="px-4 py-3 text-left">Time</th><th className="px-4 py-3 text-left">Type</th><th className="px-4 py-3 text-left">Model</th><th className="px-4 py-3 text-left">User</th><th className="px-4 py-3 text-left">Error</th>
            </tr></thead>
            <tbody>
              {errors.map((e: any, i: number) => (
                <tr key={i} className="border-b border-zinc-800/50">
                  <td className="px-4 py-2 text-zinc-500 whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2 text-zinc-300">{e.request_type}</td>
                  <td className="px-4 py-2 text-zinc-300">{e.model}</td>
                  <td className="px-4 py-2 text-zinc-300">{e.username ?? 'anon'}</td>
                  <td className="px-4 py-2 text-red-400 max-w-xs truncate">{e.error_message}</td>
                </tr>
              ))}
              {errors.length === 0 && <tr><td colSpan={5} className="px-4 py-4 text-zinc-600 text-center">No errors 🎉</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

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

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<Record<string, any> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  function handleViewUser(userId: string) {
    setSelectedUserId(userId);
    setDetailLoading(true);
    appApi.adminUserUsage(adminToken, userId)
      .then((data) => setUserDetail(data as Record<string, any>))
      .catch(() => setUserDetail(null))
      .finally(() => setDetailLoading(false));
  }

  function closeUserDetail() {
    setSelectedUserId(null);
    setUserDetail(null);
  }

  const fmtUsd = (n: number) => n < 0 ? `-$${Math.abs(n).toFixed(2)}` : `$${n.toFixed(2)}`;

  const load = useCallback(async () => {
    if (isFetching) return;
    setLoading(true);
    setError("");
    try {
      if (actor) {
        const result = await actor.getAllUsers(adminToken);
        if (result.__kind__ === "ok") setUsers(result.ok);
        else setError("Failed to load users.");
      } else {
        const result = await appApi.getUsers(adminToken);
        setUsers(result.users.map(toFrontendProfile));
      }
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
    setActionLoading(userId);
    try {
      if (actor) {
        await actor.updateUserStatus(adminToken, userId, newStatus);
      } else {
        await appApi.updateUser(adminToken, userId, { status: newStatus });
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u)),
      );
    } catch {
    } finally {
      setActionLoading(null);
    }
  }

  async function handlePlanChange(userId: string, newPlan: string) {
    setPlanLoading(userId);
    try {
      if (actor) {
        const result = await actor.setUserPlan(adminToken, userId, newPlan);
        if (result.__kind__ !== "ok") return;
      } else {
        await appApi.updateUser(adminToken, userId, { plan: newPlan });
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, plan: newPlan } : u)),
      );
    } catch {
    } finally {
      setPlanLoading(null);
    }
  }

  async function handleDelete(userId: string) {
    setConfirm(null);
    setActionLoading(userId);
    try {
      if (actor) {
        await actor.deleteUser(adminToken, userId);
      } else {
        await appApi.deleteUser(adminToken, userId);
      }
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
                    onClick={() => handleViewUser(u.id)}
                    className="text-[11px] px-3 py-1.5 rounded-lg border border-violet-500/40 text-violet-400 hover:bg-violet-900/30 transition-colors"
                    data-ocid={`admin.view_user_button.${i + 1}`}
                  >
                    📊 Details
                  </button>
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

      {/* User Detail Modal */}
      {selectedUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md" onClick={closeUserDetail}>
          <div className="relative z-10 w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-card border border-border rounded-2xl" onClick={(e) => e.stopPropagation()}>
            {detailLoading ? (
              <div className="p-8 text-center text-zinc-500">Loading user details...</div>
            ) : !userDetail ? (
              <div className="p-8 text-center text-zinc-500">Failed to load user details.</div>
            ) : (
              <>
                <div className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold font-display text-foreground">{userDetail.user?.username ?? 'Unknown'}</h3>
                    <p className="text-xs text-muted-foreground">{userDetail.user?.email ?? ''}</p>
                  </div>
                  <button type="button" onClick={closeUserDetail} className="text-zinc-500 hover:text-white">✕</button>
                </div>
                <div className="px-6 py-4 flex flex-col gap-5">
                  {/* Profile Info */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Plan</p>
                      <p className="text-sm font-semibold text-white capitalize">{userDetail.user?.plan ?? 'free'}</p>
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Rank</p>
                      <p className="text-sm font-semibold text-white capitalize">{userDetail.user?.rank ?? 'rookie'}</p>
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Streak</p>
                      <p className="text-sm font-semibold text-white">{userDetail.user?.streak ?? 0} 🔥</p>
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Joined</p>
                      <p className="text-xs text-zinc-300">{userDetail.user?.createdAt ? new Date(userDetail.user.createdAt).toLocaleDateString() : 'N/A'}</p>
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Last Active</p>
                      <p className="text-xs text-zinc-300">{userDetail.user?.lastActiveAt ? new Date(userDetail.user.lastActiveAt).toLocaleDateString() : 'N/A'}</p>
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Total XP</p>
                      <p className="text-sm font-semibold text-white">{userDetail.user?.totalXp ?? 0}</p>
                    </div>
                  </div>

                  {/* Usage Stats */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">Usage</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Sessions Today</p>
                        <p className="text-sm font-semibold text-white">{userDetail.usage?.rankedSessionsToday ?? 0}/{userDetail.usage?.totalRankedSessions ?? 0}</p>
                      </div>
                      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Hints Today/Total</p>
                        <p className="text-sm font-semibold text-white">{userDetail.usage?.hintsToday ?? 0}/{userDetail.usage?.totalHints ?? 0}</p>
                      </div>
                      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Assists Today/Total</p>
                        <p className="text-sm font-semibold text-white">{userDetail.usage?.assistsToday ?? 0}/{userDetail.usage?.totalAssists ?? 0}</p>
                      </div>
                      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Chat Calls Today</p>
                        <p className="text-sm font-semibold text-white">{userDetail.usage?.chatCallsToday ?? 0}</p>
                      </div>
                    </div>
                  </div>

                  {/* AI Cost Breakdown */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">AI Cost</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">AI Calls</p>
                        <p className="text-sm font-semibold text-white">{userDetail.usage?.totalAiCalls ?? 0}</p>
                      </div>
                      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Tokens</p>
                        <p className="text-sm font-semibold text-white">{(userDetail.usage?.totalTokens ?? 0).toLocaleString()}</p>
                      </div>
                      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">AI Cost</p>
                        <p className="text-sm font-semibold text-red-400">{fmtUsd(userDetail.usage?.estimatedCost ?? 0)}</p>
                      </div>
                      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Profit</p>
                        <p className={`text-sm font-semibold ${userDetail.usage?.estimatedProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtUsd(userDetail.usage?.estimatedProfit ?? 0)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Session History */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">Session History (last 50)</h4>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-zinc-900"><tr className="border-b border-zinc-800 text-zinc-500 uppercase">
                          <th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Challenge</th><th className="px-3 py-2 text-right">Score</th><th className="px-3 py-2 text-right">Interest</th><th className="px-3 py-2 text-right">XP</th>
                        </tr></thead>
                        <tbody>
                          {(userDetail.sessionHistory ?? []).map((s: any, i: number) => (
                            <tr key={i} className="border-b border-zinc-800/50">
                              <td className="px-3 py-1.5 text-zinc-400 whitespace-nowrap">{new Date(s.created_at).toLocaleDateString()}</td>
                              <td className="px-3 py-1.5 text-zinc-300">{s.challenge_id}</td>
                              <td className="px-3 py-1.5 text-right text-zinc-300">{s.score ?? '-'}</td>
                              <td className="px-3 py-1.5 text-right text-zinc-300">{s.final_interest ?? '-'}%</td>
                              <td className="px-3 py-1.5 text-right text-[oklch(0.78_0.18_60)]">+{s.xp_earned ?? 0}</td>
                            </tr>
                          ))}
                          {(userDetail.sessionHistory ?? []).length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-center text-zinc-600">No sessions yet</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Recent AI Requests */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">Recent AI Requests (last 50)</h4>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-zinc-900"><tr className="border-b border-zinc-800 text-zinc-500 uppercase">
                          <th className="px-3 py-2 text-left">Time</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-left">Model</th><th className="px-3 py-2 text-right">Tokens</th><th className="px-3 py-2 text-right">Cost</th><th className="px-3 py-2 text-center">OK?</th>
                        </tr></thead>
                        <tbody>
                          {(userDetail.recentAi ?? []).map((r: any, i: number) => (
                            <tr key={i} className="border-b border-zinc-800/50">
                              <td className="px-3 py-1.5 text-zinc-400 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                              <td className="px-3 py-1.5 text-zinc-300">{r.request_type}</td>
                              <td className="px-3 py-1.5 text-zinc-300">{r.model}</td>
                              <td className="px-3 py-1.5 text-right text-zinc-300">{r.total_tokens}</td>
                              <td className="px-3 py-1.5 text-right text-zinc-300">{fmtUsd(Number(r.estimated_cost_usd))}</td>
                              <td className="px-3 py-1.5 text-center">{r.success ? '✅' : '❌'}</td>
                            </tr>
                          ))}
                          {(userDetail.recentAi ?? []).length === 0 && <tr><td colSpan={6} className="px-3 py-4 text-center text-zinc-600">No AI calls yet</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── AI Settings Tab ────────────────────────────────────────────────────────────

function AISettingsTab({
  adminToken,
}: {
  adminToken: string;
  actor: ActorType;
  isFetching: boolean;
}) {
  const [mockMode, setMockModeState] = useState<boolean | null>(null);
  const [mockLoading, setMockLoading] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const result = await appApi.getSettings();
      setMockModeState(result.settings.mockMode ?? true);
    } catch {
      setMockModeState(true);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function handleToggleMock() {
    if (mockMode === null) return;
    setMockLoading(true);
    try {
      const next = !mockMode;
      await appApi.saveSetting(adminToken, "mockMode", next);
      setMockModeState(next);
    } catch {
    } finally {
      setMockLoading(false);
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
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium bg-emerald-900/20 border-emerald-700/40 text-emerald-400">
          <CheckCircle2 size={14} /> API key configured via Vercel environment variable
        </div>
        <p className="text-xs text-zinc-500">
          The OPENAI_API_KEY is set in your Vercel project settings (Environment Variables). No need to manage it here.
        </p>
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
}: {
  adminToken: string;
  actor: ActorType;
  isFetching: boolean;
}) {
  const [tierLimits, setTierLimits] = useState<Record<string, any> | null>(null);
  const [draft, setDraft] = useState<Record<string, any> | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await appApi.getSettings();
      const limits: Record<string, any> = {};
      // Read tier limits from settings
      for (const tier of ["anonymous", "free", "pro", "admin"]) {
        const key = `tierLimits_${tier}`;
        limits[tier] = result.settings[key as keyof typeof result.settings] ?? { rankedSessionsPerDay: tier === "pro" || tier === "admin" ? null : 3, hintsPerDay: tier === "pro" || tier === "admin" ? null : 10, assistsPerDay: tier === "pro" || tier === "admin" ? null : 1 };
      }
      setTierLimits(limits);
      setDraft(JSON.parse(JSON.stringify(limits)));
    } catch {
      setFeedback({ type: "error", msg: "Failed to load tier limits." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    setFeedback(null);
    try {
      for (const [tier, limits] of Object.entries(draft)) {
        await appApi.saveSetting(adminToken, `tierLimits_${tier}`, limits);
      }
      setTierLimits(JSON.parse(JSON.stringify(draft)));
      setFeedback({ type: "success", msg: "Tier limits saved." });
    } catch {
      setFeedback({ type: "error", msg: "Failed to save." });
    } finally {
      setSaving(false);
    }
  }

  function updateField(tier: string, field: string, value: number | null) {
    setDraft((prev: any) => {
      if (!prev) return prev;
      const updated = JSON.parse(JSON.stringify(prev));
      updated[tier][field] = value;
      return updated;
    });
  }

  if (loading) {
    return <div className="flex items-center justify-center py-16"><span className="w-7 h-7 rounded-full border-2 border-violet-400/30 border-t-violet-400 animate-spin" /></div>;
  }

  const TIERS = [
    { key: "anonymous", label: "Anonymous", emoji: "👤", desc: "Not logged in — browser-based identity" },
    { key: "free", label: "Free", emoji: "🆓", desc: "Logged in, no subscription" },
    { key: "pro", label: "Pro", emoji: "👑", desc: "Paid subscription" },
    { key: "admin", label: "Admin", emoji: "🛡️", desc: "Admin users" },
  ];

  const FIELDS = [
    { key: "rankedSessionsPerDay", label: "Ranked Sessions / day" },
    { key: "hintsPerDay", label: "Hints / day" },
    { key: "assistsPerDay", label: "Assists / day" },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-950/40 border border-violet-800/40">
        <Shield size={13} className="text-violet-400 flex-shrink-0" />
        <p className="text-xs text-violet-300">
          Limits are enforced server-side in Neon DB. Leave blank for unlimited.
        </p>
      </div>

      {TIERS.map((tier) => (
        <div key={tier.key} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">{tier.emoji}</span>
            <p className="text-sm font-bold text-white">{tier.label}</p>
            <p className="text-xs text-zinc-500 ml-2">{tier.desc}</p>
          </div>

          {FIELDS.map((field) => {
            const val = draft?.[tier.key]?.[field.key];
            const isUnlimited = val === null;
            return (
              <div key={field.key} className="flex items-center gap-3">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide w-40 flex-shrink-0">{field.label}</label>
                <input
                  type="number"
                  min={0}
                  max={999}
                  value={isUnlimited ? "" : (val ?? "")}
                  disabled={isUnlimited}
                  onChange={(e) => updateField(tier.key, field.key, Number(e.target.value))}
                  className="w-24 h-9 rounded-lg bg-zinc-800 border border-zinc-700 px-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500 disabled:opacity-40"
                />
                <button
                  type="button"
                  onClick={() => updateField(tier.key, field.key, isUnlimited ? 0 : null)}
                  className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border transition-colors ${isUnlimited ? "bg-emerald-900/20 border-emerald-700/40 text-emerald-400" : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300"}`}
                >
                  ∞ Unlimited
                </button>
              </div>
            );
          })}
        </div>
      ))}

      {feedback && (
        <p className={`text-sm flex items-center gap-1.5 ${feedback.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
          {feedback.type === "success" ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
          {feedback.msg}
        </p>
      )}

      <Button
        type="button"
        disabled={saving || !draft}
        onClick={handleSave}
        className="bg-violet-600 hover:bg-violet-500 text-white border-0"
        data-ocid="admin.tier_limits_save_button"
      >
        {saving ? "Saving…" : "Save All Tier Limits"}
      </Button>
    </div>
  );
}

// ── Coming Soon Tab ────────────────────────────────────────────────────────────

function PaymentsTab({ adminToken }: { adminToken: string }) {
  const [data, setData] = useState<{ payments: any[]; stats: { total: number; revenue: number; paymentCount: number } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    appApi.adminPayments(adminToken)
      .then((d) => setData(d as any))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [adminToken]);

  if (loading) return <div className="text-zinc-500 text-sm p-4">Loading payments...</div>;
  if (!data) return <div className="text-zinc-500 text-sm p-4">Failed to load payments.</div>;

  const fmtUsd = (n: number) => n < 0 ? `-$${Math.abs(n).toFixed(2)}` : `$${n.toFixed(2)}`;
  const filtered = search.trim()
    ? data.payments.filter((p: any) =>
        (p.username ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (p.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (p.whopPaymentId ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : data.payments;

  return (
    <div className="flex flex-col gap-5 max-w-5xl">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-2 flex flex-col items-center gap-0.5">
          <span className="text-xl font-bold text-white">{data.stats.total}</span>
          <span className="text-[10px] text-zinc-500">Total Events</span>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-2 flex flex-col items-center gap-0.5">
          <span className="text-xl font-bold text-emerald-400">{data.stats.paymentCount}</span>
          <span className="text-[10px] text-zinc-500">Payments</span>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-2 flex flex-col items-center gap-0.5">
          <span className="text-xl font-bold text-emerald-400">{fmtUsd(data.stats.revenue)}</span>
          <span className="text-[10px] text-zinc-500">Revenue</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search username, email, or payment ID..."
          className="w-full h-10 pl-9 pr-4 rounded-xl bg-zinc-900 border border-zinc-700 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500 transition-colors"
        />
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase">
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Event</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Card</th>
              <th className="px-4 py-3 text-left">Method</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p: any, i: number) => (
              <tr key={i} className="border-b border-zinc-800/50">
                <td className="px-4 py-2.5 text-zinc-400 whitespace-nowrap">{new Date(p.createdAt).toLocaleString()}</td>
                <td className="px-4 py-2.5 text-white font-medium">{p.username ?? <span className="text-zinc-600">anon</span>}</td>
                <td className="px-4 py-2.5 text-zinc-400">{p.email ?? "-"}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    p.eventType === "payment.succeeded" ? "bg-emerald-400/15 border-emerald-400/30 text-emerald-400" :
                    p.eventType === "membership.activated" ? "bg-violet-400/15 border-violet-400/30 text-violet-400" :
                    p.eventType === "membership.deactivated" ? "bg-red-400/15 border-red-400/30 text-red-400" :
                    "bg-zinc-700/40 border-zinc-600/40 text-zinc-400"
                  }`}>
                    {p.eventType.replace(/\./g, " ")}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-semibold text-emerald-400">{p.amount > 0 ? fmtUsd(p.amount) : "-"}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-[10px] font-semibold uppercase ${
                    p.status === "paid" || p.status === "trialing" ? "text-emerald-400" :
                    p.status === "active" ? "text-violet-400" :
                    "text-zinc-400"
                  }`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-zinc-400">{p.cardBrand ? `${p.cardBrand} ••${p.cardLast4}` : "-"}</td>
                <td className="px-4 py-2.5 text-zinc-400 capitalize">{p.paymentMethod ?? "-"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-zinc-600 text-center">No payments yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

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
            {activeTab === "dashboard" && (
              <DashboardTab adminToken={adminToken!} />
            )}
            {activeTab === "users" && (
              <UsersTab
                adminToken={adminToken!}
                actor={actor}
                isFetching={isFetching}
              />
            )}
            {activeTab === "ai-settings" && (
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
              <PaymentsTab adminToken={adminToken!} />
            )}}
            {activeTab === "app-settings" && (
              <AppSettingsTab
                adminToken={adminToken!}
                actor={actor}
                isFetching={isFetching}
              />
            )}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
