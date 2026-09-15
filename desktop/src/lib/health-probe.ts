import { invoke } from "@tauri-apps/api/core";
import { getDistributorById } from "@shared/distributors";
import {
  createHealthService,
  detectHealthAlert,
  detectHealthRecovery,
  type DistributorHealth,
  type HealthSample,
} from "../../../lib/scrapers/health";
import type { StorageAdapter } from "../../../lib/storage/adapter";
import type { PendingHealthEvent } from "../../../lib/storage/notifications";
import { isInQuietHours } from "../../../lib/quiet-hours";
import { MAX_UPLOAD_HEALTH_EVENTS } from "../../../shared/const";
import { storage } from "../storage";
import { createTRPCClient } from "./trpc";
import { sendDesktopNotification } from "../notifications";

const LAST_PROBE_KEY = "last_health_probe_at";
const CADENCE_MS = { hourly: 3600_000, daily: 86_400_000 } as const;

const localAdapter: StorageAdapter = {
  getItem: async (k: string) => localStorage.getItem(k),
  setItem: async (k: string, v: string) => localStorage.setItem(k, v),
  removeItem: async (k: string) => localStorage.removeItem(k),
  multiRemove: async (keys: string[]) => keys.forEach((k) => localStorage.removeItem(k)),
};

async function probeDistributors(): Promise<DistributorHealth[]> {
  try {
    return await invoke<DistributorHealth[]>("check_distributor_health");
  } catch {
    // Web/PWA: Tauri unavailable — run checks server-side instead.
    const client = createTRPCClient();
    return (await client.health.check.query()) as unknown as DistributorHealth[];
  }
}

function latestOf(samples: HealthSample[]): HealthSample {
  return samples[samples.length - 1] as HealthSample;
}

async function emitHealthEvent(
  kind: "alert" | "recovery",
  distributorId: string,
  name: string,
  status: "blocked" | "error",
  title: string,
  body: string,
  createdAt: number,
  pending: PendingHealthEvent[],
): Promise<void> {
  const eventId = `health-${distributorId.toLowerCase()}-${status}-${createdAt}`;
  await sendDesktopNotification(title, body, "/health");
  await storage.recordNotificationEvent({
    id: eventId,
    type: "health",
    title,
    body,
    distributorId,
    healthStatus: kind === "recovery" ? "recovered" : status,
    createdAt,
  });
  pending.push({ distributorId, distributorName: name, status, title, body, createdAt });
}

export async function runHealthProbeIfDue(now = Date.now()): Promise<void> {
  try {
    const settings = await storage.getSettings();
    if (!settings.notificationsEnabled || !settings.healthAlerts) return;
    if (settings.checkInterval === "manual") return;
    const cadence = CADENCE_MS[settings.checkInterval] ?? CADENCE_MS.hourly;
    const last = Number(localStorage.getItem(LAST_PROBE_KEY) ?? 0);
    if (now - last < cadence) return;
    const results = await probeDistributors();
    const svc = createHealthService(localAdapter);
    await svc.saveDistributorHealth(results);
    for (const r of results) {
      await svc.recordSample(r.distributorId, r.status, r.reason, r.responseTimeMs);
    }
    localStorage.setItem(LAST_PROBE_KEY, String(now));
    if (isInQuietHours(settings)) return;
    const history = await svc.getHealthHistory();
    const pending: PendingHealthEvent[] = [];
    for (const [distributorId, samples] of Object.entries(history)) {
      const name = getDistributorById(distributorId)?.name ?? distributorId;
      if (detectHealthAlert(samples)) {
        const latest = latestOf(samples);
        const title =
          latest.status === "blocked" ? "🟠 Distributor Blocked" : "🔴 Distributor Down";
        const body = `${name} has been ${latest.status} for 3 consecutive probes${latest.reason ? ` — ${latest.reason}` : ""}`;
        const createdAt = Date.now();
        await emitHealthEvent(
          "alert",
          distributorId,
          name,
          latest.status as "blocked" | "error",
          title,
          body,
          createdAt,
          pending,
        );
      }
      if (detectHealthRecovery(samples)) {
        const prev = samples[samples.length - 2] as HealthSample;
        const title = "🟢 Distributor Recovered";
        const body = `${name} is back online after being ${prev.status}`;
        const createdAt = Date.now();
        await emitHealthEvent(
          "recovery",
          distributorId,
          name,
          prev.status as "blocked" | "error",
          title,
          body,
          createdAt,
          pending,
        );
      }
    }
    if (pending.length > 0) {
      const existing = await storage.getPendingHealthEvents();
      const merged = [...existing, ...pending];
      // Bound the persisted buffer at the upload cap (keep newest): the server
      // rejects an oversized upload, so an uncapped buffer would grow forever
      // and then never upload.
      await storage.savePendingHealthEvents(
        merged.length > MAX_UPLOAD_HEALTH_EVENTS
          ? merged.slice(merged.length - MAX_UPLOAD_HEALTH_EVENTS)
          : merged,
      );
    }
    // Pending events upload on the next syncDesktopNotifications tick —
    // no direct call here to avoid coupling.
  } catch (e) {
    console.error("[health-probe] probe failed", e);
  }
}
