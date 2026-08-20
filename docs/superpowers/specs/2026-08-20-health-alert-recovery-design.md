# Health Alert Recovery Notifications (v5.12) Design

**Date:** 2026-08-20

**Status:** Approved design

## Overview

When a distributor recovers after being down for at least 3 consecutive probes (blocked or error), the app sends a "Distributor Recovered" notification. This completes the health-alert loop from Phase 63: users are told when a distributor goes down *and* when it comes back.

## Decisions

1. **Detection: stateless symmetric transition.** Recovery fires when the last sample is `working` AND the previous 3 samples are all non-working. No persisted state — the same `HEALTH_ALERT_THRESHOLD` guarantees the outage was real. Naturally deduped by the transition check.
2. **Settings: shared `healthAlerts` toggle.** Recovery notifications respect the existing `healthAlerts` setting (default on). No new settings UI.
3. **Message: simple.** Title "🟢 Distributor Recovered"; body "<name> is back online after being <status>". No outage-duration computation.

## Detection (`detectHealthRecovery`)

In `lib/scrapers/health.ts`, symmetric to the existing `detectHealthAlert`:

```ts
export function detectHealthRecovery(
  samples: HealthSample[],
  threshold = HEALTH_ALERT_THRESHOLD,
): boolean {
  if (samples.length < threshold + 1) return false;
  const last = samples[samples.length - 1];
  const prevN = samples.slice(-(threshold + 1), -1);
  return last.status === "working" && prevN.every((s) => s.status !== "working");
}
```

### Semantics

- **Fires once per outage:** last sample working + previous 3 all non-working.
- **Deduped naturally:** after recovery, the next probe yields `working, working` — the previous-3 window contains a working sample → no re-fire.
- **Only real outages:** a 1–2 probe blip (`working, error, working`) never reaches 3 non-working → no recovery ping.
- **Long outages:** `working, error×5, working` → fires once when the streak ends.
- **Known edge (accepted):** if history was pruned mid-outage (30-day/720-sample cap), recovery can fire without a prior alert. Rare and harmless.

## Notification (`scheduleHealthRecovery`)

In `lib/notifications.ts`, mirroring `scheduleHealthAlert`:

```ts
// ─── Schedule a distributor recovery notification ────────────────────────────
export async function scheduleHealthRecovery(
  distributorName: string,
  status: HealthStatus,
): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "🟢 Distributor Recovered",
        body: `${distributorName} is back online after being ${status}`,
        data: { type: "health_recovery", distributorName, status },
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

- Web-guarded, immediate, internally try/catch — never throws (same contract as `scheduleHealthAlert`).
- `status` is the distributor's last non-working status (from `samples[length - 2]`), so the body reads "back online after being blocked" or "back online after being error".
- Distinct `data.type: "health_recovery"` distinguishes it from `"health_alert"`.

## Orchestration (extend `checkHealthAlerts`)

In `lib/background-price-check.ts`, extend the existing `checkHealthAlerts` loop (same guard, same call sites — no new wiring):

```ts
for (const [distributorId, samples] of Object.entries(history)) {
  const distributor = getDistributorById(distributorId);
  const name = distributor?.name ?? distributorId;
  if (detectHealthAlert(samples)) {
    const latest = samples[samples.length - 1];
    await scheduleHealthAlert(name, latest.status, latest.reason);
  }
  if (detectHealthRecovery(samples)) {
    const prev = samples[samples.length - 2];
    await scheduleHealthRecovery(name, prev.status);
  }
}
```

- Both checks run per distributor per call; a distributor can't be both alerting and recovering in the same window, so no conflict.
- Both gated by the shared `notificationsEnabled && healthAlerts` guard (unchanged).
- Call sites unchanged: `HEALTH_PROBE_TASK` and the collector `flush()` already call `checkHealthAlerts()`.
- `checkHealthAlerts` keeps its name — it remains the single health-notification entry point.

## Error Handling

- `scheduleHealthRecovery` is web-guarded and internally try/catch — never throws.
- `detectHealthRecovery` is pure and never throws.
- `checkHealthAlerts` wraps everything in try/catch — alert/recovery failures never break the probe task or collector flush.

## Testing

### `tests/scrapers/health.test.ts` — `detectHealthRecovery`

- false with fewer than threshold + 1 samples
- true when last working follows exactly 3 non-working
- true when last working follows a longer streak (4+ non-working)
- false when last sample is non-working
- false when the preceding streak is shorter than threshold (blip)
- no re-fire on consecutive working samples
- custom threshold

### `tests/price-check.test.ts` — extend `checkHealthAlerts`

- Add `scheduleHealthRecovery` to the `../lib/notifications` mock
- Fires `scheduleHealthRecovery` when a distributor recovers (history ends `...error, error, error, working`)
- Does not fire recovery when `notificationsEnabled` or `healthAlerts` is false
- Does not fire recovery when no recovery in history
- Existing outage-alert tests keep passing (both checks coexist)

## Out of Scope

- Outage-duration in the notification body.
- Separate recovery toggle.
- Notification-center history for health notifications.
- Web push for health notifications (all health notifications are web-guarded no-ops).
- Server-side health alert mirroring.
