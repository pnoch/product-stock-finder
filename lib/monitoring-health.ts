export type MonitoringHealth =
  | { status: "off" }
  | { status: "ok"; lastRunAt: number | null }
  | { status: "stale"; lastRunAt: number }
  | { status: "stopped"; lastRunAt: number | null };

export function assessMonitoringHealth(input: {
  enabled: boolean;
  registered: boolean;
  lastRunAt: number | null;
  intervalMs: number;
  now: number;
}): MonitoringHealth {
  const { enabled, registered, lastRunAt, intervalMs, now } = input;
  if (!enabled) return { status: "off" };
  if (!registered) return { status: "stopped", lastRunAt };
  if (lastRunAt === null) return { status: "ok", lastRunAt: null };
  const expectedMs = intervalMs * 2;
  if (now - lastRunAt > expectedMs) return { status: "stale", lastRunAt };
  return { status: "ok", lastRunAt };
}
