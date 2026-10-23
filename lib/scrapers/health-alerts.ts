import type { HealthSample } from "./health-types";

export const HEALTH_ALERT_THRESHOLD = 3;

export function detectHealthAlert(
  samples: HealthSample[],
  threshold = HEALTH_ALERT_THRESHOLD,
): boolean {
  if (samples.length < threshold + 1) return false;
  const lastN = samples.slice(-threshold);
  const before = samples[samples.length - threshold - 1];
  return (
    lastN.every((s) => s.status !== "working") &&
    before.status === "working"
  );
}

export function detectHealthRecovery(
  samples: HealthSample[],
  threshold = HEALTH_ALERT_THRESHOLD,
): boolean {
  if (samples.length < threshold + 1) return false;
  const last = samples[samples.length - 1];
  const prevN = samples.slice(-(threshold + 1), -1);
  return (
    last.status === "working" &&
    prevN.every((s) => s.status !== "working")
  );
}
