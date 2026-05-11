/**
 * Mock mode is now controlled globally by the admin via the backend.
 * This hook reads the backend mock mode setting.
 * Defaults to true (safe) if backend is unavailable.
 */
import { createActor } from "@/backend";
import { useActor } from "@caffeineai/core-infrastructure";
import { useEffect, useState } from "react";

export function useMockMode() {
  const { actor, isFetching } = useActor(createActor);
  const [isMockMode, setIsMockMode] = useState<boolean>(true);

  useEffect(() => {
    if (!actor || isFetching) return;
    actor
      .getMockMode()
      .then((mode) => {
        if (!mode) {
          console.log(
            "[useMockMode] Switched to LIVE AI mode (backend getMockMode = false)",
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
  }, [actor, isFetching]);

  return { isMockMode };
}
