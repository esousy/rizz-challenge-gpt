/**
 * Mock mode is now controlled globally by the admin via the backend.
 * This hook reads the mock mode setting from the /api/app/settings endpoint.
 * Defaults to true (safe) if backend is unavailable.
 */
import { appApi } from "@/lib/app-api";
import { useEffect, useState } from "react";

export function useMockMode() {
  const [isMockMode, setIsMockMode] = useState<boolean>(true);

  useEffect(() => {
    appApi
      .getSettings()
      .then((result) => {
        const mode = result.settings.mockMode ?? true;
        if (!mode) {
          console.log(
            "[useMockMode] Switched to LIVE AI mode (backend mockMode = false)",
          );
        }
        setIsMockMode(mode);
      })
      .catch(() => {
        console.warn(
          "[useMockMode] Failed to fetch mock mode from backend; defaulting to mock=true",
        );
        setIsMockMode(true);
      });
  }, []);

  return { isMockMode };
}
