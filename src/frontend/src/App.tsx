import { useAuth } from "@/hooks/use-auth";
import type { AuthState } from "@/hooks/use-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { Outlet, createRootRoute, createRoute } from "@tanstack/react-router";
import { Suspense, createContext, lazy, useContext } from "react";

const HomePage = lazy(() => import("@/pages/Home"));
const ChallengePage = lazy(() => import("@/pages/Challenge"));
const ResultsPage = lazy(() => import("@/pages/Results"));
const SettingsPage = lazy(() => import("@/pages/Settings"));
const ChallengeSelect = lazy(() => import("@/pages/ChallengeSelect"));
const StatsPage = lazy(() => import("@/pages/Stats"));
const AdminPage = lazy(() => import("@/pages/Admin"));

// ── Auth Context ───────────────────────────────────────────────────────────────────────

// Uninitialized sentinel — throws if consumed outside <AuthProvider>
const AUTH_CONTEXT_UNSET = {} as AuthState;
export const AuthContext = createContext<AuthState>(AUTH_CONTEXT_UNSET);

/**
 * Reads the real auth state and provides it to all routes via AuthContext.
 * Must be rendered inside <InternetIdentityProvider>.
 */
function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

/** Convenience hook — import in any component instead of useAuth() directly. */
export function useAuthContext(): AuthState {
  return useContext(AuthContext);
}

// ── Router ─────────────────────────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000 } },
});

const rootRoute = createRootRoute({
  component: () => (
    <AuthProvider>
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen bg-background" />
        }
      >
        <Outlet />
      </Suspense>
    </AuthProvider>
  ),
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

const challengeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/challenge",
  validateSearch: (search: Record<string, unknown>) => ({
    challengeId:
      typeof search.challengeId === "string" ? search.challengeId : undefined,
    resumeMode:
      search.resumeMode === true || search.resumeMode === "true"
        ? true
        : undefined,
  }),
  component: ChallengePage,
});

const resultsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/results",
  validateSearch: (search: Record<string, unknown>) => ({
    confidence:
      typeof search.confidence === "number" ? search.confidence : undefined,
    humor: typeof search.humor === "number" ? search.humor : undefined,
    originality:
      typeof search.originality === "number" ? search.originality : undefined,
    overallScore:
      typeof search.overallScore === "number" ? search.overallScore : undefined,
    finalInterestLevel:
      typeof search.finalInterestLevel === "number"
        ? search.finalInterestLevel
        : undefined,
    finalMood:
      typeof search.finalMood === "string" ? search.finalMood : undefined,
    momentumSummary:
      search.momentumSummary === "positive" ||
      search.momentumSummary === "neutral" ||
      search.momentumSummary === "negative"
        ? (search.momentumSummary as "positive" | "neutral" | "negative")
        : undefined,
    challengeId:
      typeof search.challengeId === "string" ? search.challengeId : undefined,
  }),
  component: ResultsPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});

const challengeSelectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/challenges",
  component: ChallengeSelect,
});

const statsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/stats",
  component: StatsPage,
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: AdminPage,
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  challengeRoute,
  challengeSelectRoute,
  resultsRoute,
  settingsRoute,
  statsRoute,
  adminRoute,
]);

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
