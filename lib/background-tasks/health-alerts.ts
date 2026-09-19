import { getSettings } from "../storage";
import {
  type HealthService,
  detectHealthAlert,
  detectHealthRecovery,
} from "../scrapers/health";
import { getDistributorById } from "@shared/distributors";
import {
  scheduleHealthAlert,
  scheduleHealthRecovery,
} from "../notifications";
import { isInQuietHours } from "../quiet-hours";
import { healthService } from "./instances";

export async function checkHealthAlerts(
  service: HealthService = healthService,
) {
  try {
    const settings = await getSettings();
    if (!settings.notificationsEnabled || !settings.healthAlerts) return;
    if (isInQuietHours(settings)) return;
    const history = await service.getHealthHistory();
    for (const [distributorId, samples] of Object.entries(history)) {
      const distributor = getDistributorById(distributorId);
      const name = distributor?.name ?? distributorId;
      if (detectHealthAlert(samples)) {
        const latest = samples[samples.length - 1];
        const scheduled = await scheduleHealthAlert(
          distributorId,
          latest.status,
          latest.reason,
        );
        const { uploadHealthEventToServer } = await import("../server-notifications");
        void uploadHealthEventToServer({
          // Reuse the local event id so the server event dedupes against it.
          id: scheduled?.eventId,
          distributorId,
          distributorName: name,
          status: latest.status as "blocked" | "error",
          kind: "alert",
          title:
            latest.status === "blocked"
              ? "🟠 Distributor Blocked"
              : "🔴 Distributor Down",
          body: `${name} has been ${latest.status} for 3 consecutive probes${latest.reason ? ` — ${latest.reason}` : ""}`,
          createdAt: Date.now(),
        });
      }
      if (detectHealthRecovery(samples)) {
        const prev = samples[samples.length - 2];
        const scheduled = await scheduleHealthRecovery(distributorId, prev.status);
        const { uploadHealthEventToServer } = await import("../server-notifications");
        void uploadHealthEventToServer({
          id: scheduled?.eventId,
          distributorId,
          distributorName: name,
          status: prev.status as "blocked" | "error",
          kind: "recovery",
          title: "🟢 Distributor Recovered",
          body: `${name} is back online after being ${prev.status}`,
          createdAt: Date.now(),
        });
      }
    }
  } catch {
    // Ignore alert errors
  }
}
