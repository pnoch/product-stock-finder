import { createHealthService, DistributorHealth } from "../scrapers/health";
import { healthService as defaultHealthService } from "./instances";
import { checkHealthAlerts } from "./health-alerts";

export function createHealthCollector(
  service: ReturnType<typeof createHealthService> = defaultHealthService,
) {
  const updates = new Map<string, DistributorHealth>();
  return {
    record(
      parserId: string,
      status: "working" | "blocked" | "error",
      reason?: string,
    ) {
      updates.set(parserId, {
        distributorId: parserId,
        status,
        reason,
        lastChecked: new Date().toISOString(),
      });
    },
    async flush() {
      if (updates.size === 0) return;
      try {
        const current = await service.getDistributorHealth();
        const merged = current.map((h) => updates.get(h.distributorId) ?? h);
        for (const [id, entry] of updates) {
          if (!current.some((h) => h.distributorId === id)) {
            merged.push(entry);
          }
        }
        await service.saveDistributorHealth(merged);
        for (const [id, entry] of updates) {
          await service.recordSample(id, entry.status, entry.reason);
        }
        await checkHealthAlerts(service);
      } catch {
        // Ignore health update errors
      }
    },
  };
}
