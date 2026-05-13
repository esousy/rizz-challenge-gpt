import { createActor } from "@/backend";
/**
 * UnlockFeaturesModal — shown to anonymous users in the chat page
 * when they hit hint/assist limits or want to upgrade.
 * Pitch: "Unlock More Features" → Sign Up / Log In.
 * NOT the upgrade modal — this is for non-authenticated users.
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useActor } from "@caffeineai/core-infrastructure";
import { CheckCircle2, Eye, EyeOff, Flame, X, XCircle, Zap } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const UNLOCK_FEATURES = [
  { icon: "🔥", text: "Unlimited Rizz Assist" },
  { icon: "💡", text: "More hints per session" },
  { icon: "⚡", text: "More ranked sessions" },
  { icon: "👑", text: "Save your XP & rank" },
  { icon: "🛡️", text: "Progress never lost" },
];

export function UnlockFeaturesModal({ isOpen, onClose }: Props) {
  const { login, signup } = useAuth();
  const { actor } = useActor(createActor);
  const [tab, setTab] = useState<"signup" | "login">("signup");

  // Sign-up state
  const [suUsername, setSuUsername] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suShowPass, setSuShowPass] = useState(false);
  const [suError, setSuError] = useState("");
  const [suLoading, setSuLoading] = useState(false);
  const [usernameAvail, setUsernameAvail] = useState<boolean | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const usernameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Log-in state
  const [liIdentifier, setLiIdentifier] = useState("");
  const [liPassword, setLiPassword] = useState("");
  const [liShowPass, setLiShowPass] = useState(false);
  const [liError, setLiError] = useState("");
  const [liLoading, setLiLoading] = useState(false);

  // Reset on tab switch
  useEffect(() => {
    setSuError("");
    setLiError("");
    setUsernameAvail(null);
  }, [tab]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setSuUsername("");
      setSuEmail("");
      setSuPassword("");
      setLiIdentifier("");
      setLiPassword("");
      setSuError("");
      setLiError("");
      setUsernameAvail(null);
      setTab("signup");
    }
  }, [isOpen]);

  // Debounced username availability check
  const checkUsername = useCallback(
    (value: string) => {
      if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
      const trimmed = value.trim();
      if (!trimmed || !/^[a-zA-Z0-9_]{3,20}$/.test(trimmed)) {
        setUsernameAvail(null);
        return;
      }
      setUsernameChecking(true);
      usernameTimerRef.current = setTimeout(async () => {
        if (!actor) { setUsernameChecking(false); return; }
        try {
          const avail = await actor.isUsernameAvailable(trimmed);
          setUsernameAvail(avail);
        } catch { setUsernameAvail(null); }
        finally { setUsernameChecking(false); }
      }, 500);
    },
    [actor],
  );

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setSuError("");
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(suUsername.trim())) {
      setSuError("Username: 3–20 chars, letters, numbers, underscores only.");
      return;
    }
    if (!suEmail.trim() || !suEmail.includes("@")) {
      setSuError("Please enter a valid email address.");
      return;
    }
    if (suPassword.length < 6) {
      setSuError("Password must be at least 6 characters.");
      return;
    }
    if (usernameAvail === false) {
      setSuError("That username is already taken.");
      return;
    }
    setSuLoading(true);
    try {
      const result = await signup(suUsername, suEmail, suPassword);
      if (result.error) { setSuError(result.error); }
      else { onClose(); }
    } finally { setSuLoading(false); }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLiError("");
    if (!liIdentifier.trim()) { setLiError("Enter your username or email."); return; }
    if (!liPassword) { setLiError("Enter your password."); return; }
    setLiLoading(true);
    try {
      const result = await login(liIdentifier, liPassword);
      if (result.error) { setLiError(result.error); }
      else { onClose(); }
    } finally { setLiLoading(false); }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5" data-ocid="unlock_modal.dialog">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Card */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 8 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="relative z-10 w-full max-w-sm rounded-3xl overflow-hidden"
          >
            {/* Gradient accent */}
            <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" />

            <div className="bg-[oklch(0.14_0.02_280)] border border-[oklch(0.25_0.05_280)]/60 rounded-b-3xl px-6 pt-5 pb-6 flex flex-col gap-4">
              {/* Close */}
              <button
                type="button"
                onClick={onClose}
                className="absolute top-4 right-4 p-1.5 rounded-full text-zinc-500 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>

              {/* Header */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">⚡</span>
                  <span className="text-lg font-display font-bold text-white">Unlock More Features</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Create a free account to save your progress and get more hints, assists, and sessions.
                </p>
              </div>

              {/* Features */}
              <div className="flex flex-col gap-1.5">
                {UNLOCK_FEATURES.map((f) => (
                  <div key={f.text} className="flex items-center gap-2 text-xs text-zinc-300">
                    <span className="text-sm">{f.icon}</span>
                    <span>{f.text}</span>
                  </div>
                ))}
              </div>

              {/* Tabs */}
              <div className="flex bg-zinc-800/60 rounded-xl p-1 gap-1">
                <button
                  type="button"
                  onClick={() => setTab("signup")}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    tab === "signup"
                      ? "bg-zinc-700 text-white shadow-sm border border-zinc-600"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  Sign Up
                </button>
                <button
                  type="button"
                  onClick={() => setTab("login")}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    tab === "login"
                      ? "bg-zinc-700 text-white shadow-sm border border-zinc-600"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  Log In
                </button>
              </div>

              <AnimatePresence mode="wait">
                {tab === "signup" ? (
                  <motion.form
                    key="signup"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.18 }}
                    onSubmit={handleSignup}
                    className="flex flex-col gap-3"
                  >
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Username</label>
                      <div className="relative">
                        <Input
                          value={suUsername}
                          onChange={(e) => { setSuUsername(e.target.value); checkUsername(e.target.value); }}
                          placeholder="YourPlayerName"
                          maxLength={20}
                          autoComplete="off"
                          className="h-10 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 rounded-xl pr-9"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {usernameChecking ? <span className="w-3 h-3 rounded-full border-2 border-zinc-500/40 border-t-amber-400 animate-spin inline-block" />
                            : usernameAvail === true ? <CheckCircle2 size={13} className="text-green-400" />
                            : usernameAvail === false ? <XCircle size={13} className="text-red-400" /> : null}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Email</label>
                      <Input
                        type="email"
                        value={suEmail}
                        onChange={(e) => setSuEmail(e.target.value)}
                        placeholder="you@example.com"
                        autoComplete="email"
                        className="h-10 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 rounded-xl"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Password</label>
                      <div className="relative">
                        <Input
                          type={suShowPass ? "text" : "password"}
                          value={suPassword}
                          onChange={(e) => setSuPassword(e.target.value)}
                          placeholder="6+ characters"
                          className="h-10 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 rounded-xl pr-10"
                        />
                        <button type="button" onClick={() => setSuShowPass(!suShowPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                          {suShowPass ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                    {suError && <p className="text-xs text-red-400">{suError}</p>}
                    <Button
                      type="submit"
                      disabled={suLoading || usernameAvail === false}
                      className="h-11 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm hover:opacity-90 transition-opacity"
                    >
                      {suLoading ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : "Create Free Account"}
                    </Button>
                  </motion.form>
                ) : (
                  <motion.form
                    key="login"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.18 }}
                    onSubmit={handleLogin}
                    className="flex flex-col gap-3"
                  >
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Username or Email</label>
                      <Input
                        value={liIdentifier}
                        onChange={(e) => setLiIdentifier(e.target.value)}
                        placeholder="YourPlayerName"
                        autoComplete="username"
                        className="h-10 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 rounded-xl"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Password</label>
                      <div className="relative">
                        <Input
                          type={liShowPass ? "text" : "password"}
                          value={liPassword}
                          onChange={(e) => setLiPassword(e.target.value)}
                          placeholder="Your password"
                          autoComplete="current-password"
                          className="h-10 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 rounded-xl pr-10"
                        />
                        <button type="button" onClick={() => setLiShowPass(!liShowPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                          {liShowPass ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                    {liError && <p className="text-xs text-red-400">{liError}</p>}
                    <Button
                      type="submit"
                      disabled={liLoading}
                      className="h-11 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm hover:opacity-90 transition-opacity"
                    >
                      {liLoading ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : "Log In"}
                    </Button>
                  </motion.form>
                )}
              </AnimatePresence>

              <button
                type="button"
                onClick={onClose}
                className="w-full h-9 rounded-xl text-zinc-500 text-xs font-medium hover:text-zinc-300 transition-colors"
              >
                Not now
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
