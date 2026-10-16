import { classifyFetchStatus } from "./scrapers/resilient";
import type { HealthStatus } from "./scrapers/health";

export interface HealthStatusColors {
  success: string;
  warning: string;
  error: string;
}

// A probe can report status "error" while its reason names a block (403,
// captcha, …). The dashboard already renders those amber; share the rule so the
// drill-down agrees instead of showing the same distributor red.
export function healthStatusColor(
  status: HealthStatus,
  reason: string | null | undefined,
  colors: HealthStatusColors,
): string {
  if (status === "blocked") return colors.warning;
  if (reason && classifyFetchStatus(reason) === "blocked") return colors.warning;
  return status === "working" ? colors.success : colors.error;
}
