# Tray Click Deep-Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** OS tray notification clicks deep-link into the app on Linux (full route) with focus fallback elsewhere, mirroring mobile's routing table.

**Architecture:** Rust round-trips an opaque route string (direct notify-rust on Linux with blocking action-wait; plugin path elsewhere); TS owns the route table + listener. No new crates (notify-rust direct dep at the locked 4.18), no plugin changes.

**Tech Stack:** Rust (Tauri, notify-rust 4.18, `cargo test`), TypeScript + `@tauri-apps/api/event`, vitest desktop, `pnpm check`, `cargo check`.

---

### Task 1: Rust route payload + activation event

**Files:**
- Modify: `desktop/src-tauri/src/lib.rs` (`send_notification`, poller notify loop ~585-590, new helper + tests ~1497)
- Modify: `desktop/src-tauri/Cargo.toml` (add `notify-rust = "4"` — verify locked version stays 4.18 via Cargo.lock after build)
- Test: `cargo test` (workdir `desktop/src-tauri`)

Verified facts (re-confirm; NEEDS_CONTEXT on mismatch): `send_notification(app, title, body, sound)` is a `#[tauri::command]` (registered :1394); poller builds `notifications: Vec<(String,String)>` + `events` (with productId via `trigger_event_json`) and shows via plugin builder; `app.emit("price-drops-triggered", …)` precedent; `#[cfg(test)]` module at ~1497 with shape tests; `notify_rust::Notification` API (`summary/body/sound_name/show/wait_for_action`, `NotificationResponse::is_default_action` at response.rs:87 — verify exact names against the vendored 4.18.0 source first); main window label for focus (check `tauri.conf.json` windows label — likely `"main"`; verify).

- [ ] **Step 1: Write the failing tests** (append to the existing `#[cfg(test)]` module):

```rust
#[test]
fn notification_route_for_product() {
    assert_eq!(notification_route_for_product("crs804"), "/product/crs804");
}

#[test]
fn notification_activated_payload_shape() {
    let v = activation_payload("/health");
    assert_eq!(v["route"], "/health");
}
```

(Helper names/shapes are proposals — keep them, they structure the implementation.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test notification_route` (workdir: `desktop/src-tauri`)
Expected: FAIL — functions do not exist.

- [ ] **Step 3: Write minimal implementation**

```rust
fn notification_route_for_product(product_id: &str) -> String {
    format!("/product/{product_id}")
}

fn activation_payload(route: &str) -> serde_json::Value {
    serde_json::json!({ "route": route })
}

#[tauri::command]
fn send_notification(
    app: tauri::AppHandle,
    title: String,
    body: String,
    sound: bool,
    route: Option<String>,
) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    if let Some(route) = route {
        let app_handle = app.clone();
        tauri::async_runtime::spawn_blocking(move || {
            let mut n = notify_rust::Notification::new();
            n.summary(&title).body(&body);
            if sound {
                n.sound_name("default");
            }
            match n.show() {
                Ok(handle) => {
                    let _ = handle.wait_for_action(|action| {
                        if action.is_default_action() {
                            let _ = app_handle.emit("notification-activated", activation_payload(&route));
                            if let Some(w) = app_handle.get_webview_window("main") {
                                let _ = w.set_focus();
                            }
                        }
                    });
                }
                Err(e) => eprintln!("[notify] show failed: {e}"),
            }
        });
        return Ok(());
    }
    // existing plugin path (all platforms, no-route):
    use tauri_plugin_notification::NotificationExt;
    ... unchanged builder ...
}
```

Verify EVERY API against vendored sources before writing: `sound_name` existence (notification.rs:215/222 — confirm), `wait_for_action` signature (dbus_rs.rs:88 — takes `impl ResponseHandler`; the `is_default_action` check form from xdg/mod.rs:106 example — copy it), `app.emit` + `get_webview_window` (tauri v2 API — verify against existing lib.rs usage of `app.` window access; grep `get_webview_window|get_window` first), `spawn_blocking` availability (`tauri::async_runtime::spawn_blocking` — verify import path used in repo or add). Poller loop: replace plugin-builder show with route-carrying call:

```rust
for (title, body) in &notifications { ... }
```

The poller's `notifications` vec lacks productIds (only title/body) while `events` has them — restructure minimally: iterate `events` for notification display? That changes existing behavior... Safer: keep the vec but pair routes: build `Vec<(String, String, Option<String>)>` with route from the same `product_id` in scope (the loop at :570 has `product_id` — verify). Then show each via the same helper the command uses (extract `show_notification(app, title, body, sound, route)` shared by command + poller — do NOT duplicate the Linux block).

- [ ] **Step 4: Run tests + check**

Run: `cargo test` (workdir: `desktop/src-tauri`, expect PASS); `cargo check` (same dir, expect 0 errors; warnings pre-existing? compare before/after — no NEW warnings).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src-tauri/src/lib.rs desktop/src-tauri/Cargo.toml desktop/src-tauri/Cargo.lock
git commit -m "Feat: tray notification routes with Linux activation. TypeScript: 0 errors."
```

(Stage Cargo.lock only if the version stayed 4.18.x — verify; commit message keeps the TS trailer by repo convention even for Rust work? Prior Rust commits — check `git log --oneline desktop/src-tauri` for message style and match it instead if different.)

---

### Task 2: Frontend listener + route table

**Files:**
- Modify: `desktop/src/notifications.ts` (route param)
- Create: `desktop/src/lib/notification-routing.ts` (pure table + listener? listener needs @tauri event — put `onNotificationActivated` in notifications.ts next to other listeners, table in lib file for unit testing)
- Modify: `desktop/src/App.tsx` (subscribe once, navigate)
- Test: `desktop/tests/notification-routing.test.tsx` (new)

Verified facts (re-confirm): `sendDesktopNotification` invokes `send_notification {title, body, sound}`; `onPriceDropsTriggered` in `background.ts` is the `listen` pattern to copy; App has `useNavigate`? (App renders HashRouter — the listener must live INSIDE the router (a child component) to use `useNavigate`; check App structure: routes defined in App — add subscription in a small inner component e.g. `NotificationRouter` rendered inside `<HashRouter>`, or use a navigation ref. Read App first and choose the established pattern — if App already has an inner component with useNavigate, follow it.)

- [ ] **Step 1: Write the failing tests**

```tsx
import { describe, expect, it } from "vitest";
import { routeForNotification } from "../src/lib/notification-routing";

describe("routeForNotification", () => {
  it("maps product/digest/health/unknown", () => {
    expect(routeForNotification({ productId: "crs804" })).toBe("/product/crs804");
    expect(routeForNotification({ type: "digest" })).toBe("/stats");
    expect(routeForNotification({ type: "health_blocked" })).toBe("/health");
    expect(routeForNotification({})).toBe("/");
  });
});
```

Input shape mirrors mobile's data (`{productId?, type?, eventId?}` — keep minimal: productId/type only).

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm test notification-routing` (workdir: `desktop/`)
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
// desktop/src/lib/notification-routing.ts
export function routeForNotification(data: { productId?: string; type?: string }): string {
  if (data.productId) return `/product/${data.productId}`;
  if (data.type === "digest") return "/stats";
  if (data.type?.startsWith("health")) return "/health";
  return "/";
}
```

Byte-mirror of mobile's table (`app/_layout.tsx:130-137`).

```ts
// desktop/src/notifications.ts — extend (keep backward compat: route optional):
export async function sendDesktopNotification(title: string, body: string, route?: string): Promise<void> {
  try {
    await invoke("send_notification", { title, body, sound: true, route: route ?? null });
  } catch (e) {
    console.error("Failed to send notification:", e);
  }
}

export function onNotificationActivated(callback: (route: string) => void): Promise<UnlistenFn> {
  return listen("notification-activated", (event) => {
    const route = (event.payload as { route?: unknown }).route;
    callback(typeof route === "string" && route.startsWith("/") ? route : "/");
  });
}
```

Verify `UnlistenFn`/`listen` import form from background.ts. Route validation (`startsWith("/")`) prevents rogue payloads from navigating to schemes — never trust Rust-emitted strings blindly (defense in depth; Rust only emits our own strings, but cheap).

App wiring (inside router): subscribe once, `navigate(route)` on activation. Follow the existing listener-subscription pattern (App:243-293 `onPricesChecked`/`onPriceDropsTriggered` — read and extend in place).

- [ ] **Step 4: Run to verify**

Run: `pnpm test notification-routing` (desktop, PASS); `pnpm check` (root, 0 errors); `pnpm build` (desktop, exit 0).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/notifications.ts desktop/src/lib/notification-routing.ts desktop/src/App.tsx desktop/tests/notification-routing.test.tsx
git commit -m "Feat: route tray notification clicks in-app. TypeScript: 0 errors."
```

---

### Task 3: Call-site routes

**Files:**
- Modify: `desktop/src/lib/health-probe.ts` (alert/recovery notifies)
- Modify: `desktop/src/server-notifications.ts` (pulled-event notifies)
- Modify: `desktop/src/pages/Settings.tsx` (test notification — route `/settings`? or none? Decide: test toast is local-only, route `/settings` keeps user in place... actually a click taking you to /settings from Settings is harmless; alternatively leave routeless. DECISION: pass `/settings` — explicit and testable. Hmm, YAGNI? The toggle spec... keep `/settings`.)
- Modify: `desktop/src-tauri/src/lib.rs` (poller uses helper — if Task 1 didn't already wire it; verify)
- Test: extend `desktop/tests/health-probe.test.tsx` (route assertions) + sync tests (route assertions)

Verified facts (re-confirm per site): probe `sendDesktopNotification(title, body)` calls (2: alert + recovery) — pass `"/health"`; sync reconcile `sendDesktopNotification(event.title, event.body)` — resolve route from event: alertId→productId via the alerts list in scope? (read the reconcile block: `activeAlerts`/`activeAlertIds` built for upload — find productId by alertId; watchId→watches list productId; reminderId→reminders list productId; fallback `routeForNotification({type: event.type})`); test notification → `/settings`.

- [ ] **Step 1: Extend tests FIRST**

health-probe.test.tsx: assert alert notify called with route `/health` (mock sendDesktopNotification — check current mock form; assert 3rd arg). Sync test file (health-probe-upload? or server-notifications test — find where reconcile/sendDesktopNotification is covered): assert price_drop event with known alertId notifies with `/product/<id>`.

- [ ] **Step 2: Run to verify they fail**

Run: the two suites (workdir: `desktop/`)
Expected: FAIL — route arg missing.

- [ ] **Step 3: Implement**

Probe: `sendDesktopNotification(title, body, "/health")` × 2. Sync: build route via lookup + `routeForNotification` fallback:

```tsx
const route = resolveEventRoute(event, activeAlerts, stockWatches, dateReminders);
await sendDesktopNotification(event.title, event.body, route);
```

Where `resolveEventRoute` is a tiny local (or in notification-routing.ts — prefer the lib file for testability: `resolveEventRoute(event, alerts, watches, reminders)`; unit-test it in notification-routing.test.tsx). Shape: alertId → alerts.find → productId → `/product/x`; watchId → watches.find → productId; reminderId → reminders.find → productId; else `routeForNotification({type})`.

Rust poller: verify Task 1 wired routes there; if it shows via plugin builder still, switch to the shared helper with `notification_route_for_product(product_id)`.

- [ ] **Step 4: Run to verify**

Run: affected suites (desktop); `pnpm check` (root, 0 errors); `pnpm build` (desktop, exit 0); `cargo check` (src-tauri, 0 new errors if Rust touched).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add <exact touched files> (verify via git status)
git commit -m "Feat: routes on all notification sends. TypeScript: 0 errors."
```

---

### Final verification (all tasks)

```bash
pnpm check          # expect: 0 errors
pnpm lint           # expect: 0 errors
pnpm test           # expect: 0 failures (root)
pnpm test           # workdir desktop/ — expect: 0 failures
pnpm build          # workdir desktop/ — expect: exit 0
cargo check         # workdir desktop/src-tauri — expect: 0 errors
cargo test          # workdir desktop/src-tauri — expect: 0 failures
```

Do NOT push. Report DONE (per-task outcome + verification counts) or BLOCKED/NEEDS_CONTEXT.

**Manual QA note (cannot run headless — document in report):** tray click behavior needs a Linux desktop session (dbus notifications): click → app focuses + route navigates; macOS/Windows: toast shows, click focuses (no route). No CI coverage possible for the OS interaction; pure mapping covered by cargo/vitest tests.
