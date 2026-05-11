import { AuthModal } from "@/components/AuthModal";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, LogOut, User } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

export default function Settings() {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState<"signup" | "login">("login");
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      navigate({ to: "/" });
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <main
      className="relative min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center overflow-hidden"
      data-ocid="settings.page"
    >
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[360px] h-[360px] rounded-full bg-accent/15 blur-[100px]" />
      </div>

      {/* Back button */}
      <motion.button
        type="button"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        onClick={() => navigate({ to: "/" })}
        className="absolute top-6 left-5 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 z-10"
        data-ocid="settings.back_button"
      >
        <ArrowLeft size={16} />
        Back
      </motion.button>

      <div className="relative z-10 max-w-sm w-full flex flex-col items-start gap-6 text-left">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="flex flex-col gap-1.5 w-full"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-accent/15 border border-accent/30">
              <User size={16} className="text-accent" />
            </div>
            <h1 className="text-2xl font-bold font-display text-foreground tracking-tight">
              Settings
            </h1>
          </div>
        </motion.div>

        {isAuthenticated && user ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.18 }}
            className="w-full flex flex-col gap-4"
          >
            {/* Account info */}
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Account
              </p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center text-sm font-bold text-accent">
                  {user.username[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground text-sm">
                    {user.username}
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      • {user.rank}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t border-border/50">
                <span>🔥 {Number(user.streak)} streak</span>
                <span>•</span>
                <span>{Number(user.totalXp)} XP</span>
              </div>
            </div>

            {/* Admin panel link — only shown when navigating via /admin route directly */}

            <Button
              type="button"
              variant="outline"
              className="w-full h-11 rounded-xl font-semibold text-sm border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/50 transition-smooth"
              onClick={handleLogout}
              disabled={loggingOut}
              data-ocid="settings.logout_button"
            >
              <LogOut size={14} className="mr-2" />
              {loggingOut ? "Logging out…" : "Log Out"}
            </Button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.18 }}
            className="w-full flex flex-col gap-4"
          >
            <p className="text-sm text-muted-foreground">
              Sign up or log in to save your progress, track streaks, and unlock
              harder challenges.
            </p>
            <Button
              type="button"
              className="w-full h-12 rounded-xl font-semibold"
              onClick={() => {
                setAuthTab("signup");
                setShowAuthModal(true);
              }}
              data-ocid="settings.signup_button"
            >
              Create Account
            </Button>
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
              onClick={() => {
                setAuthTab("login");
                setShowAuthModal(true);
              }}
              data-ocid="settings.login_button"
            >
              Already have an account? Log in
            </button>
          </motion.div>
        )}
      </div>

      <button
        type="button"
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground/25 select-none cursor-default focus:outline-none"
        aria-hidden="true"
        tabIndex={-1}
        data-ocid="settings.version_label"
      >
        v1.0.0
      </button>

      <AuthModal
        isVisible={showAuthModal}
        initialTab={authTab}
        onDismiss={() => setShowAuthModal(false)}
      />
    </main>
  );
}
