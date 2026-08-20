# Web Push for Health Alerts (v5.14) Design

**Date:** 2026-08-20

**Status:** Approved design

## Overview

Health outage and recovery notifications (Phases 63–64) currently return early on web — web users get no browser notification and (since Phase 65) no history entry. This phase wires health alerts through the established web notification path (`displayWebNotification`), so web users get a browser notification on distributor outages/recoveries and see the event in the in-app notification center, matching native behavior.

## Decisions

1. **Record history on web too.** Web users get both a browser notification and a history entry in the in-app notification center — consistent with native.
2. **Web click focuses the window.** Uses the current `displayWebNotification` behavior (no URL plumbing / navigation).

## Restructure (`lib/notifications.ts`)

Both `scheduleHealthAlert` and `scheduleHealthRecovery` are restructured to compute title/body once, branch on platform, and record history in both paths — following the `scheduleServerEventNotification` web pattern (dynamic `import("./web-notifications")` → `displayWebNotification`).

`scheduleHealthAlert`:

```ts
export async function scheduleHealthAlert(
  distributorName: string,
  status: HealthStatus,
  reason?: string,
): Promise<string | null> {
  const title =
    status === "blocked" ? "🟠 Distributor Blocked" : "🔴 Distributor Down";
  const body = `${distributorName} has been ${status} for ${HEALTH_ALERT_THRESHOLD} consecutive probes${reason ? ` — ${reason}` : ""}`;
  let id: string | null = null;
  if (Platform.OS === "web") {
    try {
      const { displayWebNotification } = await import("./web-notifications");
      displayWebNotification(title, body);
    } catch {
      // web display failures are non-fatal
    }
  } else {
    try {
      id = await Notifications.scheduleNotificationAsync({
        content: { title, body, data: { type: "health_alert", distributorName, status }, sound: "default" },
        trigger: null,
      });
    } catch {
      return null;
    }
  }
  await recordNotificationEvent({
    id: `health-${distributorName}-${Date.now()}`,
    type: "health",
    title,
    body,
    distributorId: distributorName,
    healthStatus: status as "blocked" | "error",
    createdAt: Date.now(),
  });
  return id;
}
```

`scheduleHealthRecovery` follows the same structure with title "🟢 Distributor Recovered", body "<name> is back online after being <status>", and `healthStatus: "recovered"`.

### Behavior matrix

| Platform | Notification | History entry |
| -------- | ------------ | ------------- |
| Web      | Browser notification via `displayWebNotification` | Recorded |
| Native   | OS notification via `scheduleNotificationAsync` | Recorded |
| Native failure | None (returns null) | Not recorded (unchanged) |
| Web click | Focuses window (current `displayWebNotification`) | — |

## Error Handling

- Web display is wrapped in try/catch — failures are non-fatal (matches `scheduleServerEventNotification`).
- Native scheduling failures return `null` before recording (unchanged).
- `recordNotificationEvent` is already try/catch-safe via `enqueue`; recording failures never break scheduling.

## Testing

### `tests/health-notifications.test.ts` (extend)

1. Add a mock for the dynamically-imported web-notifications module:

```ts
vi.mock("../lib/web-notifications", () => ({
  displayWebNotification: vi.fn(),
}));
```

2. Replace the two "does not record on web" tests with web-recording tests:

```ts
  it("displays a web notification and records history on web", async () => {
    state.platform = "web";
    await scheduleHealthAlert("Winncom", "blocked");
    expect(state.recorded).toHaveLength(1);
    expect(state.recorded[0].healthStatus).toBe("blocked");
  });
```

and for `scheduleHealthRecovery`:

```ts
  it("displays a web notification and records history on web", async () => {
    state.platform = "web";
    await scheduleHealthRecovery("Winncom", "error");
    expect(state.recorded).toHaveLength(1);
    expect(state.recorded[0].healthStatus).toBe("recovered");
  });
```

3. Native tests (recording after a successful schedule) stay unchanged.

## Out of Scope

- Web notification click navigation to the health drill-down page (focus-window only).
- Web push (service-worker push) for health alerts — this phase uses the foreground `displayWebNotification` path only.
- Server-side health alert mirroring.