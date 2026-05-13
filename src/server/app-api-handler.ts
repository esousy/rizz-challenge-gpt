import { neon } from "@neondatabase/serverless";
import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

type Json = Record<string, unknown>;

const DEFAULT_ADMIN = {
  username: "admin",
  email: "medes608@gmail.com",
  password: "RizzAdmin2024!#",
};

const DEFAULT_FREE_PLAN = {
  rankedSessionsPerDay: 3,
  rizzAssistPerSession: 1,
  hintsPerSession: 3,
};

// ── Tier Limit Defaults ────────────────────────────────────────────────────
const DEFAULT_TIER_LIMITS: Record<string, {
  rankedSessionsPerDay: number | null;
  hintsPerDay: number | null;
  assistsPerDay: number | null;
}> = {
  anonymous: { rankedSessionsPerDay: 1, hintsPerDay: 3, assistsPerDay: 0 },
  free: { rankedSessionsPerDay: 3, hintsPerDay: 10, assistsPerDay: 1 },
  pro: { rankedSessionsPerDay: null, hintsPerDay: null, assistsPerDay: null },
  admin: { rankedSessionsPerDay: null, hintsPerDay: null, assistsPerDay: null },
};

function getUserTier(user: any): string {
  if (!user) return "anonymous";
  if (user.username === DEFAULT_ADMIN.username) return "admin";
  if (user.plan === "pro") return "pro";
  return "free";
}

async function getTierLimits(): Promise<Record<string, { rankedSessionsPerDay: number | null; hintsPerDay: number | null; assistsPerDay: number | null }>> {
  try {
    const rows = await sql`SELECT key, value FROM app_settings WHERE key LIKE 'tierLimits%'`;
    if (rows.length === 0) return DEFAULT_TIER_LIMITS;
    const result: Record<string, any> = {};
    for (const row of rows) {
      const tier = row.key.replace('tierLimits_', '');
      result[tier] = row.value;
    }
    // Merge with defaults for missing tiers
    for (const tier of Object.keys(DEFAULT_TIER_LIMITS)) {
      if (!result[tier]) result[tier] = DEFAULT_TIER_LIMITS[tier];
    }
    return result as Record<string, { rankedSessionsPerDay: number | null; hintsPerDay: number | null; assistsPerDay: number | null }>;
  } catch {
    return DEFAULT_TIER_LIMITS;
  }
}

async function getTodayUsage(userId: string | null, anonymousId: string | null): Promise<{ ranked_sessions_used: number; hints_used: number; assists_used: number }> {
  const today = new Date().toISOString().split('T')[0];
  if (userId) {
    const rows = await sql`SELECT ranked_sessions_used, hints_used, assists_used FROM user_daily_usage WHERE user_id = ${userId} AND usage_date = ${today}`;
    return rows[0] ?? { ranked_sessions_used: 0, hints_used: 0, assists_used:0 };
  }
  if (anonymousId) {
    const rows = await sql`SELECT ranked_sessions_used, hints_used, assists_used FROM user_daily_usage WHERE anonymous_id = ${anonymousId} AND usage_date = ${today}`;
    return rows[0] ?? { ranked_sessions_used: 0, hints_used: 0, assists_used: 0 };
  }
  return { ranked_sessions_used: 0, hints_used: 0, assists_used: 0 };
}

function canUse(feature: 'rankedSessions' | 'hints' | 'assists', usage: { ranked_sessions_used: number; hints_used: number; assists_used: number }, limits: { rankedSessionsPerDay: number | null; hintsPerDay: number | null; assistsPerDay: null }): boolean {
  const limitMap = { rankedSessions: 'rankedSessionsPerDay', hints: 'hintsPerDay', assists: 'assistsPerDay' } as const;
  const usageMap = { rankedSessions: 'ranked_sessions_used', hints: 'hints_used', assists: 'assists_used' } as const;
  const limit = limits[limitMap[feature]];
  if (limit === null) return true; // unlimited
  return usage[usageMap[feature]] < limit;
}

const LIMIT_FEATURE_KEY: Record<string, 'rankedSessions' | 'hints' | 'assists'> = {
  ranked_session: 'rankedSessions',
  hint: 'hints',
  assist: 'assists',
};

const ALL_CHALLENGE_IDS = [
  "easy-flirt",
  "dry-texter",
  "mixed-signals",
  "cold-start",
  "high-standards",
  "recover-fumble",
  "re-engage-ghosted",
];

// ── OpenAI Cost Estimation ───────────────────────────────────────────────────

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

async function logAiUsage(params: {
  userId?: string | null;
  userCategory: string;
  sessionId?: string | null;
  requestType: string;
  challengeId?: string | null;
  challengeName?: string | null;
  characterName?: string | null;
  model: string;
  promptTokens: number;
  completionTokens: number;
  success: boolean;
  errorMessage?: string | null;
}) {
  const totalTokens = params.promptTokens + params.completionTokens;
  const estimatedCostUsd = estimateCostUsd(params.model, params.promptTokens, params.completionTokens);
  try {
    await sql`
      INSERT INTO ai_usage_logs (user_id, user_category, session_id, request_type, challenge_id, challenge_name, character_name, model, prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd, success, error_message)
      VALUES (${params.userId ?? null}, ${params.userCategory}, ${params.sessionId ?? null}, ${params.requestType}, ${params.challengeId ?? null}, ${params.challengeName ?? null}, ${params.characterName ?? null}, ${params.model}, ${params.promptTokens}, ${params.completionTokens}, ${totalTokens}, ${estimatedCostUsd}, ${params.success}, ${params.errorMessage ?? null})
    `;
  } catch (err) {
    console.error("[logAiUsage] Failed to log AI usage:", err);
  }
}

function getDatabaseUrl(): string {
  const url = getOptionalDatabaseUrl();
  if (!url) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return url;
}

function getOptionalDatabaseUrl(): string | undefined {
  const url =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.NEON_DATABASE_URL;
  return url;
}

let sqlClient: ReturnType<typeof neon> | null = null;

function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  if (!sqlClient) sqlClient = neon(getDatabaseUrl());
  return (sqlClient as any)(strings, ...values);
}

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = hashPassword(password, salt).split(":")[1];
  return timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(hash, "hex"));
}

function makeToken(prefix: string) {
  return `${prefix}_${randomBytes(32).toString("hex")}`;
}

function error(res: any, status: number, message: string) {
  return res.status(status).json({ error: message });
}

function publicUser(row: any) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    status: row.status,
    plan: row.plan,
    rank: row.rank_id,
    totalXp: Number(row.total_xp ?? 0),
    streak: Number(row.streak ?? 0),
    createdAt: row.created_at,
    lastActiveAt: row.last_active_at,
    unlockedChallenges: row.unlocked_challenges ?? [],
    subscriptionStatus: row.subscription_status ?? 'inactive',
    monthlyRevenueUsd: Number(row.monthly_revenue_usd ?? 0),
    lifetimeRevenueUsd: Number(row.lifetime_revenue_usd ?? 0),
  };
}

function publicAdmin(row: any) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    createdAt: row.created_at,
    lastLogin: row.last_login,
  };
}

async function initDb() {
  await sql`create extension if not exists pgcrypto`;
  await sql`
    create table if not exists users (
      id uuid primary key default gen_random_uuid(),
      username text not null unique,
      email text not null unique,
      password_hash text not null,
      status text not null default 'active',
      plan text not null default 'free',
      rank_id text not null default 'rookie',
      total_xp integer not null default 0,
      streak integer not null default 0,
      unlocked_challenges text[] not null default array[]::text[],
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists admins (
      id uuid primary key default gen_random_uuid(),
      username text not null unique,
      email text not null unique,
      password_hash text not null,
      created_at timestamptz not null default now(),
      last_login timestamptz
    )
  `;
  await sql`
    create table if not exists sessions (
      token text primary key,
      user_id uuid references users(id) on delete cascade,
      admin_id uuid references admins(id) on delete cascade,
      created_at timestamptz not null default now(),
      expires_at timestamptz not null default now() + interval '30 days'
    )
  `;
  await sql`
    create table if not exists player_progress (
      user_id uuid primary key references users(id) on delete cascade,
      progress jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists chat_sessions (
      id uuid primary key default gen_random_uuid(),
      user_id uuid references users(id) on delete set null,
      challenge_id text not null,
      character_name text,
      score integer,
      final_interest integer,
      final_mood text,
      outcome text,
      xp_earned integer,
      messages jsonb not null default '[]'::jsonb,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists app_settings (
      key text primary key,
      value jsonb not null,
      updated_at timestamptz not null default now()
    )
  `;
  await sql`
    insert into app_settings (key, value)
    values ('freePlanConfig', ${JSON.stringify(DEFAULT_FREE_PLAN)}::jsonb)
    on conflict (key) do nothing
  `;
  await sql`
    insert into app_settings (key, value)
    values ('mockMode', 'false'::jsonb)
    on conflict (key) do nothing
  `;
  await sql`
    insert into admins (username, email, password_hash)
    values (${DEFAULT_ADMIN.username}, ${DEFAULT_ADMIN.email}, ${hashPassword(DEFAULT_ADMIN.password)})
    on conflict (username) do nothing
  `;

  // ── AI Usage Logs table ──────────────────────────────────────────────────
  await sql`
    create table if not exists ai_usage_logs (
      id uuid primary key default gen_random_uuid(),
      user_id uuid references users(id) on delete set null,
      user_category text not null default 'anonymous',
      session_id uuid,
      request_type text not null,
      challenge_id text,
      challenge_name text,
      character_name text,
      model text not null default 'gpt-4o-mini',
      prompt_tokens integer not null default 0,
      completion_tokens integer not null default 0,
      total_tokens integer not null default 0,
      estimated_cost_usd numeric(10,6) not null default 0,
      success boolean not null default true,
      error_message text,
      created_at timestamptz not null default now()
    )
  `;
  await sql`create index if not exists idx_ai_usage_logs_user_id on ai_usage_logs(user_id)`;
  await sql`create index if not exists idx_ai_usage_logs_created_at on ai_usage_logs(created_at)`;
  await sql`create index if not exists idx_ai_usage_logs_request_type on ai_usage_logs(request_type)`;
  await sql`create index if not exists idx_ai_usage_logs_user_category on ai_usage_logs(user_category)`;

  // ── Add subscription/revenue columns to users ───────────────────────────
  await sql`alter table users add column if not exists subscription_status text default 'inactive'`;
  await sql`alter table users add column if not exists current_period_start timestamptz`;
  await sql`alter table users add column if not exists current_period_end timestamptz`;
  await sql`alter table users add column if not exists monthly_revenue_usd numeric(10,2) default 0`;
  await sql`alter table users add column if not exists lifetime_revenue_usd numeric(10,2) default 0`;
  await sql`alter table users add column if not exists last_active_at timestamptz`;

  // ── Daily usage tracking table ─────────────────────────────────────────
  await sql`
    create table if not exists user_daily_usage (
      id uuid primary key default gen_random_uuid(),
      identity_key text,
      user_id uuid references users(id) on delete cascade,
      anonymous_id text,
      user_tier text not null default 'anonymous',
      usage_date date not null default current_date,
      ranked_sessions_used integer not null default 0,
      hints_used integer not null default 0,
      assists_used integer not null default 0,
      normal_chat_calls integer not null default 0,
      ai_calls integer not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  // Add identity_key column for simple unique constraint
  await sql`ALTER TABLE user_daily_usage ADD COLUMN IF NOT EXISTS identity_key TEXT`;
  try { await sql`UPDATE user_daily_usage SET identity_key = CASE WHEN user_id IS NOT NULL THEN 'u:' || user_id::text WHEN anonymous_id IS NOT NULL THEN 'a:' || anonymous_id ELSE 'unknown' END WHERE identity_key IS NULL`; } catch {}
  try { await sql`DROP INDEX IF EXISTS idx_daily_usage_identity`; } catch {}
  try { await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_usage_identity ON user_daily_usage (identity_key, usage_date)`; } catch {}

  // ── Seed tier limit settings ────────────────────────────────────────────
  for (const [tier, limits] of Object.entries(DEFAULT_TIER_LIMITS)) {
    const key = `tierLimits_${tier}`;
    await sql`
      insert into app_settings (key, value)
      values (${key}, ${JSON.stringify(limits)}::jsonb)
      on conflict (key) do nothing
    `;
  }
}

async function requireUser(token?: string) {
  if (!token) return null;
  const rows = await sql`
    select u.*
    from sessions s
    join users u on u.id = s.user_id
    where s.token = ${token}
      and s.expires_at > now()
      and s.user_id is not null
    limit 1
  `;
  return rows[0] ?? null;
}

async function requireAdmin(token?: string) {
  if (!token) return null;
  const rows = await sql`
    select a.*
    from sessions s
    join admins a on a.id = s.admin_id
    where s.token = ${token}
      and s.expires_at > now()
      and s.admin_id is not null
    limit 1
  `;
  return rows[0] ?? null;
}

async function route(req: any, res: any) {
  const requestUrl = new URL(req.url ?? "/", "https://rizz.local");
  const path = requestUrl.pathname.replace(/^\/api\/app/, "") || "/";

  if (req.method === "GET" && path === "/health") {
    return res.status(200).json({
      ok: true,
      databaseConfigured: Boolean(getOptionalDatabaseUrl()),
    });
  }

  await initDb();

  if (req.method === "POST" && path === "/auth/signup") {
    const { username, email, password } = req.body ?? {};
    if (!username || !email || !password) return error(res, 400, "Missing fields.");
    if (String(password).length < 6) return error(res, 400, "Password too short.");
    try {
      const rows = await sql`
        insert into users (username, email, password_hash, unlocked_challenges)
        values (${String(username).trim().toLowerCase()}, ${String(email).trim().toLowerCase()}, ${hashPassword(String(password))}, ${ALL_CHALLENGE_IDS})
        returning *
      `;
      return res.status(200).json({ user: publicUser(rows[0]) });
    } catch {
      return error(res, 409, "Username or email already exists.");
    }
  }

  if (req.method === "POST" && path === "/auth/login") {
    const { identifier, password } = req.body ?? {};
    const ident = String(identifier ?? "").trim().toLowerCase();
    const rows = await sql`
      select * from users
      where lower(username) = ${ident} or lower(email) = ${ident}
      limit 1
    `;
    const user = rows[0];
    if (!user || !verifyPassword(String(password ?? ""), user.password_hash)) {
      return error(res, 401, "Invalid username or password.");
    }
    if (user.status === "blocked") return error(res, 403, "Account blocked.");
    const token = makeToken("usr");
    await sql`insert into sessions (token, user_id) values (${token}, ${user.id})`;
    return res.status(200).json({ token, user: publicUser(user) });
  }

  if (req.method === "POST" && path === "/auth/logout") {
    await sql`delete from sessions where token = ${String(req.body?.token ?? "")}`;
    return res.status(200).json({ ok: true });
  }

  if (req.method === "GET" && path === "/auth/me") {
    const user = await requireUser(String(req.query.token ?? ""));
    if (!user) return error(res, 401, "Unauthorized.");
    return res.status(200).json({ user: publicUser(user) });
  }

  if (req.method === "POST" && path === "/admin/login") {
    const { identifier, password } = req.body ?? {};
    const ident = String(identifier ?? "").trim().toLowerCase();
    const rows = await sql`
      select * from admins
      where lower(username) = ${ident} or lower(email) = ${ident}
      limit 1
    `;
    const admin = rows[0];
    if (!admin || !verifyPassword(String(password ?? ""), admin.password_hash)) {
      return error(res, 401, "Invalid username or password.");
    }
    const token = makeToken("adm");
    await sql`insert into sessions (token, admin_id) values (${token}, ${admin.id})`;
    await sql`update admins set last_login = now() where id = ${admin.id}`;
    return res.status(200).json({ token, profile: publicAdmin(admin) });
  }

  if (req.method === "POST" && path === "/admin/logout") {
    await sql`delete from sessions where token = ${String(req.body?.token ?? "")}`;
    return res.status(200).json({ ok: true });
  }

  if (req.method === "GET" && path === "/admin/me") {
    const admin = await requireAdmin(String(req.query.token ?? ""));
    if (!admin) return error(res, 401, "Unauthorized.");
    return res.status(200).json({ profile: publicAdmin(admin) });
  }

  if (req.method === "GET" && path === "/admin/users") {
    const admin = await requireAdmin(String(req.query.token ?? ""));
    if (!admin) return error(res, 401, "Unauthorized.");
    const rows = await sql`select * from users order by created_at desc`;
    return res.status(200).json({ users: rows.map(publicUser) });
  }

  if (req.method === "PATCH" && path.startsWith("/admin/users/")) {
    const admin = await requireAdmin(String(req.body?.token ?? ""));
    if (!admin) return error(res, 401, "Unauthorized.");
    const userId = path.split("/")[3];
    const updates: Json = req.body?.updates ?? {};
    if (typeof updates.status === "string") {
      await sql`update users set status = ${updates.status}, updated_at = now() where id = ${userId}`;
    }
    if (typeof updates.plan === "string") {
      await sql`update users set plan = ${updates.plan}, updated_at = now() where id = ${userId}`;
    }
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE" && path.startsWith("/admin/users/")) {
    const admin = await requireAdmin(String(req.query.token ?? ""));
    if (!admin) return error(res, 401, "Unauthorized.");
    const userId = path.split("/")[3];
    await sql`delete from users where id = ${userId}`;
    return res.status(200).json({ ok: true });
  }

  if (req.method === "GET" && path === "/settings") {
    const rows = await sql`select key, value from app_settings`;
    return res.status(200).json({
      settings: Object.fromEntries(rows.map((row: any) => [row.key, row.value])),
    });
  }

  if (req.method === "POST" && path === "/admin/settings") {
    const admin = await requireAdmin(String(req.body?.token ?? ""));
    if (!admin) return error(res, 401, "Unauthorized.");
    const { key, value } = req.body ?? {};
    if (!key) return error(res, 400, "Missing key.");
    await sql`
      insert into app_settings (key, value, updated_at)
      values (${String(key)}, ${JSON.stringify(value)}::jsonb, now())
      on conflict (key) do update set value = excluded.value, updated_at = now()
    `;
    return res.status(200).json({ ok: true });
  }

  if (req.method === "GET" && path === "/progress") {
    const user = await requireUser(String(req.query.token ?? ""));
    if (!user) return error(res, 401, "Unauthorized.");
    const rows = await sql`select progress from player_progress where user_id = ${user.id}`;
    return res.status(200).json({ progress: rows[0]?.progress ?? null, user: publicUser(user) });
  }

  if (req.method === "POST" && path === "/progress") {
    const user = await requireUser(String(req.body?.token ?? ""));
    if (!user) return error(res, 401, "Unauthorized.");
    const progress = req.body?.progress ?? {};
    await sql`
      insert into player_progress (user_id, progress, updated_at)
      values (${user.id}, ${JSON.stringify(progress)}::jsonb, now())
      on conflict (user_id) do update set progress = excluded.progress, updated_at = now()
    `;
    await sql`
      update users
      set total_xp = ${Number(progress.totalXP ?? user.total_xp ?? 0)},
          rank_id = ${String(progress.rankId ?? user.rank_id ?? "rookie")},
          streak = ${Number(progress.streak ?? user.streak ?? 0)},
          updated_at = now()
      where id = ${user.id}
    `;
    return res.status(200).json({ ok: true });
  }

  if (req.method === "GET" && path === "/sessions/today") {
    const user = await requireUser(String(req.query.token ?? ""));
    if (!user) return error(res, 401, "Unauthorized.");
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const rows = await sql`
      select count(*)::int as count
      from chat_sessions
      where user_id = ${user.id}
        and created_at >= ${todayStart.toISOString()}
    `;
    return res.status(200).json({ rankedSessionsUsed: rows[0]?.count ?? 0, user: publicUser(user) });
  }

  if (req.method === "POST" && path === "/sessions") {
    const token = String(req.body?.token ?? "");
    const user = token ? await requireUser(token) : null;
    const session = req.body?.session ?? {};
    await sql`
      insert into chat_sessions (
        user_id, challenge_id, character_name, score, final_interest,
        final_mood, outcome, xp_earned, messages, metadata
      )
      values (
        ${user?.id ?? null}, ${String(session.challengeId ?? "unknown")},
        ${session.characterName ?? null}, ${session.score ?? null},
        ${session.finalInterest ?? null}, ${session.finalMood ?? null},
        ${session.outcome ?? null}, ${session.xpEarned ?? null},
        ${JSON.stringify(session.messages ?? [])}::jsonb,
        ${JSON.stringify(session.metadata ?? {})}::jsonb
      )
    `;
    return res.status(200).json({ ok: true });
  }

  // ── Admin: Dashboard Analytics ────────────────────────────────────────────
  if (req.method === "GET" && path === "/admin/dashboard") {
    const admin = await requireAdmin(String(req.query.token ?? ""));
    if (!admin) return error(res, 401, "Unauthorized.");

    const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);
    const weekAgo = new Date(todayStart); weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(todayStart); monthAgo.setDate(monthAgo.getDate() - 30);

    async function getMetrics(since: Date) {
      const sinceISO = since.toISOString();
      const [newUsers, activeUsers, rankedSessions, aiStats, categoryStats, featureStats, proRevenue] = await Promise.all([
        sql`SELECT count(*)::int as count FROM users WHERE created_at >= ${sinceISO}`,
        sql`SELECT count(DISTINCT user_id)::int as count FROM ai_usage_logs WHERE created_at >= ${sinceISO} AND user_id IS NOT NULL`,
        sql`SELECT count(*)::int as count FROM chat_sessions WHERE created_at >= ${sinceISO}`,
        sql`SELECT count(*)::int as calls, coalesce(sum(total_tokens),0)::bigint as tokens, coalesce(sum(estimated_cost_usd),0)::numeric as cost FROM ai_usage_logs WHERE created_at >= ${sinceISO} AND request_type != 'hint'`,
        sql`SELECT user_category, count(*)::int as calls, coalesce(sum(total_tokens),0)::bigint as tokens, coalesce(sum(estimated_cost_usd),0)::numeric as cost FROM ai_usage_logs WHERE created_at >= ${sinceISO} AND request_type != 'hint' GROUP BY user_category`,
        sql`SELECT request_type, count(*)::int as calls, coalesce(sum(estimated_cost_usd),0)::numeric as cost FROM ai_usage_logs WHERE created_at >= ${sinceISO} AND request_type != 'hint' GROUP BY request_type`,
        sql`SELECT coalesce(sum(monthly_revenue_usd),0)::numeric as revenue FROM users WHERE plan = 'pro'`,
      ]);
      const totalCost = Number(aiStats[0]?.cost ?? 0);
      const totalRevenue = Number(proRevenue[0]?.revenue ?? 0);
      return {
        newUsers: newUsers[0]?.count ?? 0,
        activeUsers: activeUsers[0]?.count ?? 0,
        rankedSessions: rankedSessions[0]?.count ?? 0,
        aiCalls: aiStats[0]?.calls ?? 0,
        hintsUsed: (await sql`SELECT count(*)::int as count FROM ai_usage_logs WHERE created_at >= ${sinceISO} AND request_type = 'hint'`)[0]?.count ?? 0,
        totalTokens: Number(aiStats[0]?.tokens ?? 0),
        estimatedCost: totalCost,
        estimatedRevenue: totalRevenue,
        estimatedProfit: Math.round((totalRevenue - totalCost) * 100) / 100,
        byCategory: Object.fromEntries(categoryStats.map((r: any) => [r.user_category, { calls: r.calls, tokens: Number(r.tokens), cost: Number(r.cost) }])),
        byFeature: Object.fromEntries(featureStats.map((r: any) => [r.request_type, { calls: r.calls, cost: Number(r.cost) }])),
      };
    }

    return res.status(200).json({
      today: await getMetrics(todayStart),
      last7Days: await getMetrics(weekAgo),
      last30Days: await getMetrics(monthAgo),
    });
  }

  // ── Admin: User Detail Usage ──────────────────────────────────────────────
  if (req.method === "GET" && path.startsWith("/admin/users/") && path.endsWith("/usage")) {
    const admin = await requireAdmin(String(req.query.token ?? ""));
    if (!admin) return error(res, 401, "Unauthorized.");
    const userId = path.split("/")[3];
    const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);

    const [user, sessions, aiUsage, todaySessions, todayHints, todayAssists, todayChat, sessionHistory, recentAi] = await Promise.all([
      sql`SELECT * FROM users WHERE id = ${userId}`,
      sql`SELECT count(*)::int as count FROM chat_sessions WHERE user_id = ${userId}`,
      sql`SELECT count(*)::int as calls, coalesce(sum(total_tokens),0)::bigint as tokens, coalesce(sum(estimated_cost_usd),0)::numeric as cost FROM ai_usage_logs WHERE user_id = ${userId}`,
      sql`SELECT count(*)::int as count FROM chat_sessions WHERE user_id = ${userId} AND created_at >= ${todayStart.toISOString()}`,
      sql`SELECT count(*)::int as count FROM ai_usage_logs WHERE user_id = ${userId} AND request_type = 'hint' AND created_at >= ${todayStart.toISOString()}`,
      sql`SELECT count(*)::int as count FROM ai_usage_logs WHERE user_id = ${userId} AND request_type = 'assist' AND created_at >= ${todayStart.toISOString()}`,
      sql`SELECT count(*)::int as count FROM ai_usage_logs WHERE user_id = ${userId} AND request_type = 'normal_chat' AND created_at >= ${todayStart.toISOString()}`,
      sql`SELECT id, challenge_id, character_name, score, final_interest, final_mood, outcome, xp_earned, created_at FROM chat_sessions WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 50`,
      sql`SELECT request_type, model, prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd, success, error_message, created_at FROM ai_usage_logs WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 50`,
    ]);

    if (!user[0]) return error(res, 404, "User not found.");

    const totalHints = (await sql`SELECT count(*)::int as count FROM ai_usage_logs WHERE user_id = ${userId} AND request_type = 'hint'`)[0]?.count ?? 0;
    const totalAssists = (await sql`SELECT count(*)::int as count FROM ai_usage_logs WHERE user_id = ${userId} AND request_type = 'assist'`)[0]?.count ?? 0;
    const estCost = Number(aiUsage[0]?.cost ?? 0);
    const estRevenue = Number(user[0].monthly_revenue_usd ?? 0);

    return res.status(200).json({
      user: publicUser(user[0]),
      usage: {
        totalRankedSessions: sessions[0]?.count ?? 0,
        rankedSessionsToday: todaySessions[0]?.count ?? 0,
        hintsToday: todayHints[0]?.count ?? 0,
        totalHints,
        assistsToday: todayAssists[0]?.count ?? 0,
        totalAssists,
        chatCallsToday: todayChat[0]?.count ?? 0,
        totalChatCalls: (await sql`SELECT count(*)::int as count FROM ai_usage_logs WHERE user_id = ${userId} AND request_type = 'normal_chat'`)[0]?.count ?? 0,
        totalAiCalls: aiUsage[0]?.calls ?? 0,
        totalTokens: Number(aiUsage[0]?.tokens ?? 0),
        estimatedCost: estCost,
        estimatedRevenue: estRevenue,
        estimatedProfit: Math.round((estRevenue - estCost) * 100) / 100,
      },
      sessionHistory,
      recentAi,
    });
  }

  // ── Admin: AI Errors ──────────────────────────────────────────────────────
  if (req.method === "GET" && path === "/admin/ai-errors") {
    const admin = await requireAdmin(String(req.query.token ?? ""));
    if (!admin) return error(res, 401, "Unauthorized.");
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const errors = await sql`
      SELECT l.id, l.user_id, l.request_type, l.model, l.error_message, l.created_at, u.username
      FROM ai_usage_logs l
      LEFT JOIN users u ON u.id = l.user_id
      WHERE l.success = false
      ORDER BY l.created_at DESC
      LIMIT ${limit}
    `;
    return res.status(200).json({ errors });
  }

  // ── Check Limit ──────────────────────────────────────────────────────────
  if (req.method === "POST" && path === "/check-limit") {
    const { feature, anonymousId } = req.body ?? {};
    const validFeatures = ["ranked_session", "hint", "assist"];
    if (!validFeatures.includes(feature)) return error(res, 400, "Invalid feature.");

    const user = await requireUser(String(req.body?.token ?? ""));
    const tier = getUserTier(user);
    const allLimits = await getTierLimits();
    const limits = allLimits[tier] ?? allLimits.free;
    const usage = await getTodayUsage(user?.id ?? null, !user ? String(anonymousId ?? "") : null);
    const feat = LIMIT_FEATURE_KEY[feature];
    const limitKey = { rankedSessions: "rankedSessionsPerDay", hints: "hintsPerDay", assists: "assistsPerDay" }[feat];
    const limit = limits[limitKey as keyof typeof limits];
    const usageKey = { rankedSessions: "ranked_sessions_used", hints: "hints_used", assists: "assists_used" }[feat];
    const used = usage[usageKey as keyof typeof usage];
    const allowed = limit === null ? true : used < limit;
    const tomorrow = new Date(); tomorrow.setUTCHours(24, 0, 0, 0);

    return res.status(200).json({
      allowed,
      reason: allowed ? null : "limit_reached",
      feature,
      tier,
      used,
      limit,
      resetAt: tomorrow.toISOString(),
      upgradeRecommended: tier === "anonymous" || tier === "free",
    });
  }

  // ── Increment Usage ───────────────────────────────────────────────────────
  if (req.method === "POST" && path === "/increment-usage") {
    const { feature, anonymousId } = req.body ?? {};
    const validFeatures = ["ranked_session", "hint", "assist", "normal_chat", "ai_call"];
    if (!validFeatures.includes(feature)) return error(res, 400, "Invalid feature.");

    const user = await requireUser(String(req.body?.token ?? ""));
    const tier = getUserTier(user);
    const today = new Date().toISOString().split("T")[0];

    // Explicit SQL for each feature x identity type combination
    // (Neon tagged-template sql\`...\` doesn't support dynamic column names)
    if (user) {
      if (feature === "ranked_session") {
        await sql`INSERT INTO user_daily_usage (identity_key, user_id, user_tier, usage_date, ranked_sessions_used) VALUES (${'u:' + user.id}, ${user.id}, ${tier}, ${today}, 1) ON CONFLICT (identity_key, usage_date) DO UPDATE SET ranked_sessions_used = user_daily_usage.ranked_sessions_used + 1, updated_at = now()`;
      } else if (feature === "hint") {
        await sql`INSERT INTO user_daily_usage (identity_key, user_id, user_tier, usage_date, hints_used) VALUES (${'u:' + user.id}, ${user.id}, ${tier}, ${today}, 1) ON CONFLICT (identity_key, usage_date) DO UPDATE SET hints_used = user_daily_usage.hints_used + 1, updated_at = now()`;
      } else if (feature === "assist") {
        await sql`INSERT INTO user_daily_usage (identity_key, user_id, user_tier, usage_date, assists_used) VALUES (${'u:' + user.id}, ${user.id}, ${tier}, ${today}, 1) ON CONFLICT (identity_key, usage_date) DO UPDATE SET assists_used = user_daily_usage.assists_used + 1, updated_at = now()`;
      } else if (feature === "normal_chat") {
        await sql`INSERT INTO user_daily_usage (identity_key, user_id, user_tier, usage_date, normal_chat_calls) VALUES (${'u:' + user.id}, ${user.id}, ${tier}, ${today}, 1) ON CONFLICT (identity_key, usage_date) DO UPDATE SET normal_chat_calls = user_daily_usage.normal_chat_calls + 1, updated_at = now()`;
      } else if (feature === "ai_call") {
        await sql`INSERT INTO user_daily_usage (identity_key, user_id, user_tier, usage_date, ai_calls) VALUES (${'u:' + user.id}, ${user.id}, ${tier}, ${today}, 1) ON CONFLICT (identity_key, usage_date) DO UPDATE SET ai_calls = user_daily_usage.ai_calls + 1, updated_at = now()`;
      }
    } else {
      const anonId = String(anonymousId ?? "");
      if (!anonId) return error(res, 400, "anonymousId required for anonymous users.");
      if (feature === "ranked_session") {
        await sql`INSERT INTO user_daily_usage (identity_key, anonymous_id, user_tier, usage_date, ranked_sessions_used) VALUES (${'a:' + anonId}, ${anonId}, 'anonymous', ${today}, 1) ON CONFLICT (identity_key, usage_date) DO UPDATE SET ranked_sessions_used = user_daily_usage.ranked_sessions_used + 1, updated_at = now()`;
      } else if (feature === "hint") {
        await sql`INSERT INTO user_daily_usage (identity_key, anonymous_id, user_tier, usage_date, hints_used) VALUES (${'a:' + anonId}, ${anonId}, 'anonymous', ${today}, 1) ON CONFLICT (identity_key, usage_date) DO UPDATE SET hints_used = user_daily_usage.hints_used + 1, updated_at = now()`;
      } else if (feature === "assist") {
        await sql`INSERT INTO user_daily_usage (identity_key, anonymous_id, user_tier, usage_date, assists_used) VALUES (${'a:' + anonId}, ${anonId}, 'anonymous', ${today}, 1) ON CONFLICT (identity_key, usage_date) DO UPDATE SET assists_used = user_daily_usage.assists_used + 1, updated_at = now()`;
      } else if (feature === "normal_chat") {
        await sql`INSERT INTO user_daily_usage (identity_key, anonymous_id, user_tier, usage_date, normal_chat_calls) VALUES (${'a:' + anonId}, ${anonId}, 'anonymous', ${today}, 1) ON CONFLICT (identity_key, usage_date) DO UPDATE SET normal_chat_calls = user_daily_usage.normal_chat_calls + 1, updated_at = now()`;
      } else if (feature === "ai_call") {
        await sql`INSERT INTO user_daily_usage (identity_key, anonymous_id, user_tier, usage_date, ai_calls) VALUES (${'a:' + anonId}, ${anonId}, 'anonymous', ${today}, 1) ON CONFLICT (identity_key, usage_date) DO UPDATE SET ai_calls = user_daily_usage.ai_calls + 1, updated_at = now()`;
      }
    }

    // Also log to ai_usage_logs for dashboard cost tracking
    // Hints are local (0 tokens, 0 cost), assists/chat use OpenAI (logged separately by proxy)
    if (feature === 'hint') {
      await sql`INSERT INTO ai_usage_logs (user_id, user_category, request_type, model, prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd, success)
        VALUES (${user?.id ?? null}, ${tier}, 'hint', 'local', 0, 0, 0, 0, true)`.catch(() => {});
    }

    const usage = await getTodayUsage(user?.id ?? null, !user ? String(anonymousId ?? "") : null);
    const allLimits = await getTierLimits();
    const limits = allLimits[tier] ?? allLimits.free;
    return res.status(200).json({ ok: true, usage, tier, limits });
  }

  // ── Get Usage & Limits ────────────────────────────────────────────────────
  if (req.method === "GET" && path === "/usage") {
    const user = await requireUser(String(req.query.token ?? ""));
    const anonymousId = String(req.query.anonymousId ?? "");
    const tier = getUserTier(user);
    const usage = await getTodayUsage(user?.id ?? null, !user ? anonymousId : null);
    const allLimits = await getTierLimits();
    const limits = allLimits[tier] ?? allLimits.free;
    const tomorrow = new Date(); tomorrow.setUTCHours(24, 0, 0, 0);
    return res.status(200).json({
      tier,
      usage: { rankedSessions: usage.ranked_sessions_used, hints: usage.hints_used, assists: usage.assists_used },
      limits: { rankedSessionsPerDay: limits.rankedSessionsPerDay, hintsPerDay: limits.hintsPerDay, assistsPerDay: limits.assistsPerDay },
      resetAt: tomorrow.toISOString(),
      user: user ? publicUser(user) : null,
    });
  }

  // ── Log AI Usage (internal) ───────────────────────────────────────────────
  if (req.method === "POST" && path === "/admin/log-ai-usage") {
    const body = req.body ?? {};
    await logAiUsage({
      userId: body.userId ?? null,
      userCategory: body.userCategory ?? 'anonymous',
      sessionId: body.sessionId ?? null,
      requestType: body.requestType ?? 'other',
      challengeId: body.challengeId ?? null,
      challengeName: body.challengeName ?? null,
      characterName: body.characterName ?? null,
      model: body.model ?? 'gpt-4o-mini',
      promptTokens: body.promptTokens ?? 0,
      completionTokens: body.completionTokens ?? 0,
      success: body.success ?? true,
      errorMessage: body.errorMessage ?? null,
    });
    if (body.userId) {
      await sql`UPDATE users SET last_active_at = now() WHERE id = ${body.userId}`.catch(() => {});
    }
    return res.status(200).json({ ok: true });
  }

  // ── Whop Checkout ──────────────────────────────────────────────────────
  if (path === "/whop-checkout") {
    if (req.method === "GET") return res.status(200).json({ ok: true, msg: "whop-checkout endpoint" });
    const body = req.body ?? {};
    const { userId, email } = body;
    if (!userId || !email) return error(res, 400, "userId and email required");

    const whopKey = process.env.WHOP_API_KEY ?? "";
    const planId = process.env.WHOP_PRO_PLAN_ID ?? "plan_Dxtf7y0t3JZUA";
    if (!whopKey) return error(res, 500, "Whop not configured");

    try {
      const whopRes = await fetch("https://api.whop.com/api/v2/checkouts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${whopKey}` },
        body: JSON.stringify({ plan_id: planId, metadata: { user_id: userId, email } }),
      });
      const whopData = await whopRes.json() as any;
      if (!whopRes.ok) {
        console.error("[whop-checkout] Error:", whopData);
        return error(res, 500, "Failed to create checkout");
      }
      return res.status(200).json({ url: whopData.checkout_url ?? whopData.url });
    } catch (err) {
      console.error("[whop-checkout] Error:", err);
      return error(res, 500, "Checkout failed");
    }
  }

  // ── Whop Webhook ─────────────────────────────────────────────────────────
  if (req.method === "POST" && path === "/whop-webhook") {
    const body = req.body ?? {};
    const eventType = body?.event ?? body?.type;
    const data = body?.data ?? body;
    console.log(`[whop-webhook] Received: ${eventType}`);

    const planId = process.env.WHOP_PRO_PLAN_ID ?? "plan_Dxtf7y0t3JZUA";

    if (eventType === "membership.activated") {
      const userId = data?.metadata?.user_id ?? null;
      const email = data?.user?.email ?? null;
      const whopPlanId = data?.plan_id ?? null;

      if (whopPlanId !== planId) {
        console.log(`[whop-webhook] Ignoring non-Pro plan: ${whopPlanId}`);
        return res.status(200).json({ received: true, ignored: true });
      }

      if (userId) {
        await sql`UPDATE users SET plan = 'pro' WHERE id = ${userId}`;
        console.log(`[whop-webhook] Upgraded user ${userId} to pro`);
      } else if (email) {
        const rows = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
        if (rows[0]) {
          await sql`UPDATE users SET plan = 'pro' WHERE id = ${rows[0].id}`;
          console.log(`[whop-webhook] Upgraded user ${rows[0].id} to pro (matched by email)`);
        }
      }
    } else if (eventType === "membership.deactivated") {
      const userId = data?.metadata?.user_id ?? null;
      const email = data?.user?.email ?? null;

      if (userId) {
        await sql`UPDATE users SET plan = 'free', monthly_revenue_usd = 0 WHERE id = ${userId}`;
      } else if (email) {
        const rows = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
        if (rows[0]) await sql`UPDATE users SET plan = 'free', monthly_revenue_usd = 0 WHERE id = ${rows[0].id}`;
      }
    }

    return res.status(200).json({ received: true });
  }

  return error(res, 404, "Not found.");
}

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  try {
    return await route(req, res);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error.";
    return error(res, 500, message);
  }
}

