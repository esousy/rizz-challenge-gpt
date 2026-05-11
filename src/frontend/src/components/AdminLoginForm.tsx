/**
 * Full-screen admin login — separate from game UI.
 * Dark professional dashboard login aesthetic.
 */
import { Button } from "@/components/ui/button";
import type { AdminAuthState } from "@/hooks/use-admin-auth";
import { Eye, EyeOff, Lock, Shield, User } from "lucide-react";
import { useState } from "react";

interface AdminLoginFormProps {
  adminLogin: AdminAuthState["adminLogin"];
  isLoading: boolean;
}

export function AdminLoginForm({ adminLogin, isLoading }: AdminLoginFormProps) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim() || !password) return;
    setError(null);
    const result = await adminLogin(identifier, password);
    if (result.error) setError(result.error);
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-zinc-950 px-4"
      data-ocid="admin.login_page"
    >
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 0%, oklch(0.35 0.12 280 / 0.12) 0%, transparent 60%)",
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Logo / branding */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center shadow-lg">
            <Shield size={24} className="text-violet-400" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-white tracking-tight">
              Admin Panel
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">Rizz Me If You Can</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-7 shadow-2xl">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Identifier */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="admin-identifier"
                className="text-xs font-semibold text-zinc-400 uppercase tracking-widest"
              >
                Username or Email
              </label>
              <div className="relative">
                <User
                  size={14}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500"
                />
                <input
                  id="admin-identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="admin"
                  autoComplete="username"
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40 transition-colors"
                  data-ocid="admin.login_identifier_input"
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="admin-password"
                className="text-xs font-semibold text-zinc-400 uppercase tracking-widest"
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  size={14}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500"
                />
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full h-11 pl-10 pr-11 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40 transition-colors"
                  data-ocid="admin.login_password_input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  data-ocid="admin.login_toggle_password"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                className="flex items-center gap-2 text-sm text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-4 py-3"
                data-ocid="admin.login_error_state"
              >
                <Lock size={13} className="flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              disabled={!identifier.trim() || !password || isLoading}
              className="w-full h-11 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl border-0 transition-colors"
              data-ocid="admin.login_submit_button"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Signing in…
                </span>
              ) : (
                "Sign in to Admin Panel"
              )}
            </Button>
          </form>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-zinc-600 mt-6">
          Admin access only. Unauthorized access is prohibited.
        </p>
      </div>
    </div>
  );
}
