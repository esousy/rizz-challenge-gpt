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

const ALL_CHALLENGE_IDS = [
  "easy-flirt",
  "dry-texter",
  "mixed-signals",
  "cold-start",
  "high-standards",
  "recover-fumble",
  "re-engage-ghosted",
];

function getDatabaseUrl(): string {
  const url =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.NEON_DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return url;
}

const sql = neon(getDatabaseUrl());

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
    unlockedChallenges: row.unlocked_challenges ?? [],
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
  await initDb();
  const parts = Array.isArray(req.query.path) ? req.query.path : [];
  const path = `/${parts.join("/")}`;

  if (req.method === "GET" && path === "/health") {
    return res.status(200).json({ ok: true });
  }

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
