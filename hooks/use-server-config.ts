import { useMemo } from "react";
import { isServerConfigured } from "@/constants/oauth";

export function useServerConfig(): { configured: boolean } {
  const configured = useMemo(() => isServerConfigured(), []);
  return { configured };
}
