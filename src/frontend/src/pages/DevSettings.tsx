// Dev settings has been removed.
// Admin controls (Mock/Live mode, OpenAI key) are now only accessible at /admin.
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export default function DevSettings() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/" });
  }, [navigate]);
  return null;
}
