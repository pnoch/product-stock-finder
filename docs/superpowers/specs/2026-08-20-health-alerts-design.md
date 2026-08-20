# Health Alerts (v5.11) Design

## Goal

Notify the user when a distributor transitions to `blocked` or `error` for 3 consecutive probes, so they learn about distributor outages without watching the health dashboard. The alert fires once per outage (deduped) and re-arms after the distributor recovers.

## Background

- The health probe task (`HEALTH_PROBE_TASK` in `lib/background-price-check.ts`) calls `testAllDistributors()`, which probes all 25 distributors and records a `HealthSample` per distributor via `recordSample` (chronological order, oldest→newest).
- The health collector (`createHealthCollector`) also records samples via `flush()` on the price-check path.
- Notifications in `lib/notifications.ts` (e.g. `scheduleStockAlert`) are web-guarded (`Platform.OS === "web"` → `null`) and schedule immediately via `Notifications.scheduleNotificationAsync`.
- `AppSettings` has `notificationsEnabled`, `stockAlerts`, `priceAlerts` toggles; `getSettings` merges `DEFAULT_SETTINGS` with stored values, so new fields are backward compatible.

## Decisions (from brainstorming)

1. **Trigger statuses:** both `blocked` and `error` (any outage).
2. **Threshold:** 3 consecutive non-working samples (fixed constant, no UI).
3. **Settings:** a new `healthAlerts` toggle (default `true`) in Settings.
4. **Approach A:** pure `detectHealthAlert` + `checkHealthAlerts()` called from both probe paths.

## Architecture

### Pure detection (modify `lib/scrapers/health.ts`)

```ts
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
```

- Samples are chronological (oldest→newest), so `slice(-threshold)` is the most recent streak and `samples[length - threshold - 1]` is the sample just before it.
- Requires at least `threshold + 1` samples — the streak must be preceded by a working sample (strict transition; a distributor never observed working won't alert, avoiding parser-false-alarm noise).
- The transition check is the dedup: once down, later probes keep the streak ≥ N but the "before" sample is also non-working → no re-fire; recovery to `working` resets the streak so the next outage re-alerts.

### Alert check (modify `lib/background-price-check.ts`)

```ts
export async function checkHealthAlerts() {
  try {
    const settings = await getSettings();
    if (!settings.notificationsEnabled || !settings.healthAlerts) return;
    const history = await healthService.getHealthHistory();
    for (const [distributorId, samples] of Object.entries(history)) {
      if (!detectHealthAlert(samples)) continue;
      const distributor = getDistributorById(distributorId);
      const latest = samples[samples.length - 1];
      await scheduleHealthAlert(
        distributor?.name ?? distributorId,
        latest.status,
        latest.reason,
      );
    }
  } catch {
    // Ignore alert errors
  }
}
```

Called after `testAllDistributors()` in the `HEALTH_PROBE_TASK` body and after `flush()` in the health collector.

### Notification (modify `lib/notifications.ts`)

```ts
export async function scheduleHealthAlert(
  distributorName: string,
  status: HealthStatus,
  reason?: string,
): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title:
          status === "blocked" ? "🟠 Distributor Blocked" : "🔴 Distributor Down",
        body: `${distributorName} has been ${status} for ${HEALTH_ALERT_THRESHOLD} consecutive probes${reason ? ` — ${reason}` : ""}`,
        data: { type: "health_alert", distributorName, status },
        sound: "default",
      },
      trigger: null, // immediate
    });
    return id;
  } catch {
    return null;
  }
}
```

Imports `HEALTH_ALERT_THRESHOLD` from `@/lib/scrapers/health` so the message reflects the actual threshold.

### Settings (modify `lib/types.ts`, `lib/storage.ts`, `app/(tabs)/settings.tsx`)

- `AppSettings` gains `healthAlerts: boolean`.
- `DEFAULT_SETTINGS` gains `healthAlerts: true`.
- A `SettingRow` toggle in the settings screen (mirroring the `priceAlerts` row) calls `updateSetting("healthAlerts", v)`.

## Data Flow

Probe runs (`testAllDistributors` or collector `flush`) → `recordSample` appends samples → `checkHealthAlerts()` → `detectHealthAlert` per distributor → `scheduleHealthAlert` for each trigger (if `notificationsEnabled && healthAlerts`).

## Error Handling

- `checkHealthAlerts` wraps everything in try/catch — alert failures never break the probe task.
- `scheduleHealthAlert` is web-guarded and internally try/catch — never throws.
- `detectHealthAlert` is pure and never throws.

## Testing

- `tests/scrapers/health.test.ts` — `detectHealthAlert`:
  - Fewer than `threshold + 1` samples → `false`.
  - Exactly 3 consecutive non-working after a working sample → `true`.
  - 4+ consecutive non-working (no working before streak) → `false` (dedup).
  - Recovery then re-outage → `true` again.
  - Custom threshold parameter works.
- `tests/price-check.test.ts` — `checkHealthAlerts`:
  - Fires `scheduleHealthAlert` when a distributor's history triggers (mock notifications + storage).
  - No-op when `notificationsEnabled` or `healthAlerts` is `false`.
  - No-op when no distributor triggers.

Verification: `pnpm check`, `pnpm lint`, `pnpm test`.

Browser smoke: seed a triggering history in localStorage, run the probe → notification is web-guarded (no crash); the new toggle renders in Settings.

## Out of Scope

- Configurable threshold UI (fixed constant 3).
- Server-side detection or push delivery (local-first).
- Alert history/audit log in the app.