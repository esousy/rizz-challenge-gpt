import { createActor } from "@/backend";
/**
 * Native in-app authentication modal.
 * Two tabs: Sign Up / Log In. Game-like dark UI.
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useActor } from "@caffeineai/core-infrastructure";
import { CheckCircle2, Eye, EyeOff, X, XCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

const BENEFITS = [
  { icon: "⚡", text: "Save XP & Rank" },
  { icon: "🔓", text: "Unlock Harder Challenges" },
  { icon: "🔥", text: "Track Streaks" },
  { icon: "📜", text: "Save Session History" },
  { icon: "📅", text: "Daily Challenges" },
];

interface AuthModalProps {
  isVisible: boolean;
  initialTab?: "signup" | "login";
  onDismiss: () => void;
  onSuccess?: () => void;
}

export function AuthModal({
  isVisible,
  initialTab = "signup",
  onDismiss,
  onSuccess,
}: AuthModalProps) {
  const { login, signup } = useAuth();
  const { actor } = useActor(createActor);
  const [tab, setTab] = useState<"signup" | "login">(initialTab);

  // Sign-up state
  const [suUsername, setSuUsername] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suShowPass, setSuShowPass] = useState(false);
  const [suError, setSuError] = useState("");
  const [suLoading, setSuLoading] = useState(false);
  // Username availability
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
  }, []);

  // Reset on close
  useEffect(() => {
    if (!isVisible) {
      setSuUsername("");
      setSuEmail("");
      setSuPassword("");
      setLiIdentifier("");
      setLiPassword("");
      setSuError("");
      setLiError("");
      setUsernameAvail(null);
      setTab(initialTab);
    }
  }, [isVisible, initialTab]);

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
        if (!actor) {
          setUsernameChecking(false);
          return;
        }
        try {
          const avail = await actor.isUsernameAvailable(trimmed);
          setUsernameAvail(avail);
        } catch {
          setUsernameAvail(null);
        } finally {
          setUsernameChecking(false);
        }
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
      if (result.error) {
        setSuError(result.error);
      } else {
        onSuccess?.();
        onDismiss();
      }
    } finally {
      setSuLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLiError("");
    if (!liIdentifier.trim()) {
      setLiError("Enter your username or email.");
      return;
    }
    if (!liPassword) {
      setLiError("Enter your password.");
      return;
    }
    setLiLoading(true);
    try {
      const result = await login(liIdentifier, liPassword);
      if (result.error) {
        setLiError(result.error);
      } else {
        onSuccess?.();
        onDismiss();
      }
    } finally {
      setLiLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          data-ocid="auth_modal.dialog"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-md"
            onClick={onDismiss}
            onKeyDown={(e) => e.key === "Escape" && onDismiss()}
            role="presentation"
          />

          {/* Panel */}
          <motion.div
            className="relative z-10 w-full sm:max-w-sm bg-card/80 backdrop-blur-xl border border-border rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-[0_0_80px_rgba(139,92,246,0.15)]"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 28,
              delay: 0.05,
            }}
          >
            {/* Drag handle (mobile) */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>

            {/* Close */}
            <button
              type="button"
              onClick={onDismiss}
              className="absolute top-4 right-4 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              aria-label="Close"
              data-ocid="auth_modal.close_button"
            >
              <X size={18} />
            </button>

            <div className="px-6 pt-3 pb-7 flex flex-col gap-4">
              {/* Tabs */}
              <div className="flex bg-muted/60 rounded-xl p-1 gap-1">
                <button
                  type="button"
                  onClick={() => setTab("signup")}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    tab === "signup"
                      ? "bg-card text-foreground shadow-sm border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-ocid="auth_modal.signup_tab"
                >
                  Sign Up
                </button>
                <button
                  type="button"
                  onClick={() => setTab("login")}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    tab === "login"
                      ? "bg-card text-foreground shadow-sm border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-ocid="auth_modal.login_tab"
                >
                  Log In
                </button>
              </div>

              <AnimatePresence mode="wait">
                {tab === "signup" ? (
                  <motion.div
                    key="signup"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.18 }}
                    className="flex flex-col gap-4"
                  >
                    {/* Header */}
                    <div>
                      <h2 className="text-xl font-bold font-display text-foreground leading-tight">
                        Claim Your Identity 👑
                      </h2>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Your progress is worth saving
                      </p>
                    </div>

                    {/* Benefits */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {BENEFITS.map((b) => (
                        <span
                          key={b.text}
                          className="text-xs text-muted-foreground flex items-center gap-1"
                        >
                          <CheckCircle2 size={11} className="text-accent" />
                          {b.text}
                        </span>
                      ))}
                    </div>

                    {/* Signup form */}
                    <form
                      onSubmit={handleSignup}
                      className="flex flex-col gap-3"
                      data-ocid="auth_modal.signup_form"
                    >
                      {/* Username */}
                      <div className="flex flex-col gap-1">
                        <label
                          htmlFor="su-username"
                          className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                        >
                          Username
                        </label>
                        <div className="relative">
                          <Input
                            id="su-username"
                            value={suUsername}
                            onChange={(e) => {
                              setSuUsername(e.target.value);
                              checkUsername(e.target.value);
                            }}
                            placeholder="ShadowBoy"
                            maxLength={20}
                            autoComplete="off"
                            className="h-11 bg-[oklch(0.12_0.01_280)] border-white/15 text-white placeholder:text-white/30 rounded-xl pr-9"
                            data-ocid="auth_modal.username_input"
                          />
                          {/* Availability indicator */}
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            {usernameChecking ? (
                              <span className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground/40 border-t-accent animate-spin inline-block" />
                            ) : usernameAvail === true ? (
                              <CheckCircle2
                                size={14}
                                className="text-green-400"
                              />
                            ) : usernameAvail === false ? (
                              <XCircle size={14} className="text-destructive" />
                            ) : null}
                          </div>
                        </div>
                        {usernameAvail === false && (
                          <p className="text-xs text-destructive">
                            Username taken
                          </p>
                        )}
                        {usernameAvail === true && (
                          <p className="text-xs text-green-400">
                            Username available ✓
                          </p>
                        )}
                      </div>

                      {/* Email */}
                      <div className="flex flex-col gap-1">
                        <label
                          htmlFor="su-email"
                          className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                        >
                          Email
                        </label>
                        <Input
                          id="su-email"
                          type="email"
                          value={suEmail}
                          onChange={(e) => setSuEmail(e.target.value)}
                          placeholder="you@example.com"
                          autoComplete="email"
                          className="h-11 bg-[oklch(0.12_0.01_280)] border-white/15 text-white placeholder:text-white/30 rounded-xl"
                          data-ocid="auth_modal.email_input"
                        />
                      </div>

                      {/* Password */}
                      <div className="flex flex-col gap-1">
                        <label
                          htmlFor="su-password"
                          className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                        >
                          Password
                        </label>
                        <div className="relative">
                          <Input
                            id="su-password"
                            type={suShowPass ? "text" : "password"}
                            value={suPassword}
                            onChange={(e) => setSuPassword(e.target.value)}
                            placeholder="Min. 6 characters"
                            autoComplete="new-password"
                            className="h-11 bg-[oklch(0.12_0.01_280)] border-white/15 text-white placeholder:text-white/30 rounded-xl pr-10"
                            data-ocid="auth_modal.password_input"
                          />
                          <button
                            type="button"
                            onClick={() => setSuShowPass(!suShowPass)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={
                              suShowPass ? "Hide password" : "Show password"
                            }
                          >
                            {suShowPass ? (
                              <EyeOff size={15} />
                            ) : (
                              <Eye size={15} />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Error */}
                      {suError && (
                        <p
                          className="text-sm text-destructive flex items-center gap-1.5"
                          data-ocid="auth_modal.signup_error"
                        >
                          <XCircle size={13} /> {suError}
                        </p>
                      )}

                      <Button
                        type="submit"
                        disabled={suLoading}
                        className="w-full h-12 text-base font-display font-semibold rounded-xl shadow-[0_0_24px_rgba(139,92,246,0.3)] hover:shadow-[0_0_36px_rgba(139,92,246,0.5)] transition-all duration-200 mt-1"
                        data-ocid="auth_modal.signup_submit_button"
                      >
                        {suLoading ? (
                          <span className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin" />
                            Creating account…
                          </span>
                        ) : (
                          "Start My Journey 🚀"
                        )}
                      </Button>
                    </form>
                  </motion.div>
                ) : (
                  <motion.div
                    key="login"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.18 }}
                    className="flex flex-col gap-4"
                  >
                    {/* Header */}
                    <div>
                      <h2 className="text-xl font-bold font-display text-foreground leading-tight">
                        Continue Your Journey 🔥
                      </h2>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Pick up where you left off
                      </p>
                    </div>

                    <form
                      onSubmit={handleLogin}
                      className="flex flex-col gap-3"
                      data-ocid="auth_modal.login_form"
                    >
                      {/* Identifier */}
                      <div className="flex flex-col gap-1">
                        <label
                          htmlFor="li-identifier"
                          className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                        >
                          Username or Email
                        </label>
                        <Input
                          id="li-identifier"
                          value={liIdentifier}
                          onChange={(e) => setLiIdentifier(e.target.value)}
                          placeholder="ShadowBoy or you@example.com"
                          autoComplete="username"
                          className="h-11 bg-[oklch(0.12_0.01_280)] border-white/15 text-white placeholder:text-white/30 rounded-xl"
                          data-ocid="auth_modal.identifier_input"
                        />
                      </div>

                      {/* Password */}
                      <div className="flex flex-col gap-1">
                        <label
                          htmlFor="li-password"
                          className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                        >
                          Password
                        </label>
                        <div className="relative">
                          <Input
                            id="li-password"
                            type={liShowPass ? "text" : "password"}
                            value={liPassword}
                            onChange={(e) => setLiPassword(e.target.value)}
                            placeholder="Your password"
                            autoComplete="current-password"
                            className="h-11 bg-[oklch(0.12_0.01_280)] border-white/15 text-white placeholder:text-white/30 rounded-xl pr-10"
                            data-ocid="auth_modal.login_password_input"
                          />
                          <button
                            type="button"
                            onClick={() => setLiShowPass(!liShowPass)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={
                              liShowPass ? "Hide password" : "Show password"
                            }
                          >
                            {liShowPass ? (
                              <EyeOff size={15} />
                            ) : (
                              <Eye size={15} />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Error */}
                      {liError && (
                        <p
                          className="text-sm text-destructive flex items-center gap-1.5"
                          data-ocid="auth_modal.login_error"
                        >
                          <XCircle size={13} /> {liError}
                        </p>
                      )}

                      <Button
                        type="submit"
                        disabled={liLoading}
                        className="w-full h-12 text-base font-display font-semibold rounded-xl shadow-[0_0_24px_rgba(139,92,246,0.3)] hover:shadow-[0_0_36px_rgba(139,92,246,0.5)] transition-all duration-200 mt-1"
                        data-ocid="auth_modal.login_submit_button"
                      >
                        {liLoading ? (
                          <span className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin" />
                            Logging in…
                          </span>
                        ) : (
                          "Continue 🔥"
                        )}
                      </Button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
