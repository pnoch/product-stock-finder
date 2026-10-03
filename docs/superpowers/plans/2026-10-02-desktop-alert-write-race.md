# Desktop `price_alerts` Write-Race Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the desktop renderer and Rust poller clobbering each other's `price_alerts` writes and let the UI see poller triggers, via renderer-computed field patches and a Rust per-item apply under a lock.

**Architecture:** The renderer diffs its alert array against the last one it read/wrote and invokes `apply_alert_mutations(upserts, removes)`; Rust applies only the given fields to the on-disk item (so it never guesses between a stale snapshot and a re-arm), serialized by a process-wide mutex shared with the poller's write.

**Tech Stack:** Rust (Tauri v2, serde_json), TypeScript (desktop renderer), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-02-desktop-alert-write-race-design.md`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `desktop/src-tauri/src/lib.rs` | `apply_alert_mutations` command + `AlertUpsert` + `ALERTS_FILE_LOCK` + poller lock + tests |
| `desktop/src/lib/alert-mutations.ts` | pure `computeAlertMutations(last, next)` diff |
| `desktop/src/storage.ts` | read `price_alerts` from file; save via `apply_alert_mutations` |
| `desktop/tests/alert-mutations.test.ts` | diff unit tests |
| `desktop/tests/storage-mirror-merge.test.ts` | adapter routing tests (updated) |

---

## Task 1: Rust `apply_alert_mutations`

**Files:**
- Modify: `desktop/src-tauri/src/lib.rs` (add after `merge_watchlist`, ~line 635; poller block 1132-1145; `invoke_handler` 2136; `mod tests` 2168)
- Test: same file's `#[cfg(test)] mod tests`

- [ ] **Step 1: Write the failing tests**

Add to `mod tests` in `desktop/src-tauri/src/lib.rs`:

```rust
    #[test]
    fn apply_alert_mutations_preserves_a_poller_trigger() {
        let disk = serde_json::json!([
            { "id": "a1", "isActive": false, "targetPrice": 500,
              "triggeredAt": "2026-06-02T00:00:00.000Z", "triggeredPrice": 480 }
        ]);
        let upserts = vec![AlertUpsert {
            id: "a1".into(),
            patch: serde_json::json!({ "targetPrice": 450 }),
        }];
        let merged = apply_alert_mutations_to(disk, &upserts, &[]);
        let a = &merged.as_array().unwrap()[0];
        assert_eq!(a["targetPrice"], serde_json::json!(450));
        // The poller's trigger survives a save that did not touch it.
        assert_eq!(a["triggeredAt"], serde_json::json!("2026-06-02T00:00:00.000Z"));
        assert_eq!(a["triggeredPrice"], serde_json::json!(480));
        assert_eq!(a["isActive"], serde_json::json!(false));
    }

    #[test]
    fn apply_alert_mutations_rearm_clears_the_trigger() {
        let disk = serde_json::json!([
            { "id": "a1", "isActive": false,
              "triggeredAt": "2026-06-02T00:00:00.000Z", "triggeredPrice": 480 }
        ]);
        let upserts = vec![AlertUpsert {
            id: "a1".into(),
            patch: serde_json::json!({
                "isActive": true,
                "triggeredAt": serde_json::Value::Null,
                "triggeredPrice": serde_json::Value::Null,
            }),
        }];
        let merged = apply_alert_mutations_to(disk, &upserts, &[]);
        let a = &merged.as_array().unwrap()[0];
        assert_eq!(a["isActive"], serde_json::json!(true));
        assert!(a.get("triggeredAt").is_none());
        assert!(a.get("triggeredPrice").is_none());
    }

    #[test]
    fn apply_alert_mutations_adds_and_removes() {
        let disk = serde_json::json!([{ "id": "a1" }, { "id": "a2" }]);
        let upserts = vec![AlertUpsert {
            id: "a3".into(),
            patch: serde_json::json!({ "targetPrice": 10 }),
        }];
        let merged = apply_alert_mutations_to(disk, &upserts, &["a1".to_string()]);
        let ids: Vec<&str> = merged
            .as_array()
            .unwrap()
            .iter()
            .map(|a| a["id"].as_str().unwrap())
            .collect();
        assert_eq!(ids, vec!["a2", "a3"]);
    }

    #[test]
    fn apply_alert_mutations_ignores_a_missing_id() {
        let disk = serde_json::json!([{ "id": "a1" }]);
        let merged = apply_alert_mutations_to(disk, &[], &["nope".to_string()]);
        assert_eq!(merged.as_array().unwrap().len(), 1);
    }
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd desktop/src-tauri && cargo test apply_alert_mutations 2>&1 | tail -20`
Expected: FAIL (functions/types not defined).

- [ ] **Step 3: Implement the command + helpers + lock**

After `merge_watchlist` (line 635), add:

```rust
/// Process-wide lock serializing the alert file's read-modify-write so the
/// renderer's mutation command and the poller's write cannot interleave.
static ALERTS_FILE_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

#[derive(serde::Deserialize)]
struct AlertUpsert {
    id: String,
    patch: serde_json::Value,
}

/// Applies a field patch to one alert. A `null` patch value removes the field;
/// absent fields are left untouched, so poller-owned fields the renderer did not
/// change survive.
fn apply_alert_patch(mut item: serde_json::Value, patch: &serde_json::Value) -> serde_json::Value {
    if let (Some(obj), Some(patch_obj)) = (item.as_object_mut(), patch.as_object()) {
        for (k, v) in patch_obj {
            if v.is_null() {
                obj.remove(k);
            } else {
                obj.insert(k.clone(), v.clone());
            }
        }
    }
    item
}

fn apply_alert_mutations_to(
    disk: serde_json::Value,
    upserts: &[AlertUpsert],
    removes: &[String],
) -> serde_json::Value {
    let mut list = match disk {
        serde_json::Value::Array(items) => items,
        _ => Vec::new(),
    };
    if !removes.is_empty() {
        list.retain(|a| {
            let id = a.get("id").and_then(|v| v.as_str()).unwrap_or("");
            !removes.iter().any(|r| r == id)
        });
    }
    for up in upserts {
        match list
            .iter()
            .position(|a| a.get("id").and_then(|v| v.as_str()) == Some(up.id.as_str()))
        {
            Some(idx) => list[idx] = apply_alert_patch(list[idx].clone(), &up.patch),
            None => list.push(apply_alert_patch(serde_json::json!({ "id": up.id }), &up.patch)),
        }
    }
    serde_json::Value::Array(list)
}

#[tauri::command]
async fn apply_alert_mutations(
    app: tauri::AppHandle,
    upserts: Vec<AlertUpsert>,
    removes: Vec<String>,
) -> Result<String, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let _guard = ALERTS_FILE_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let disk = read_json_file(&data_dir, "price_alerts")?;
    let merged = apply_alert_mutations_to(disk, &upserts, &removes);
    write_json_file(&data_dir, "price_alerts", &merged)?;
    serde_json::to_string(&merged).map_err(|e| e.to_string())
}
```

- [ ] **Step 4: Lock the poller's write**

In the poller's `if !to_deactivate.is_empty()` block (line 1132), take the same lock at the top of the block:

```rust
        if !to_deactivate.is_empty() {
            let _guard = ALERTS_FILE_LOCK.lock().unwrap_or_else(|e| e.into_inner());
            // Re-read immediately before writing: the file may have changed
            // while this (minutes-long) check ran, and writing the snapshot read
            // at the start silently reverted a concurrent add/snooze/delete.
            let fresh = array_or_empty(read_json_file(data_dir, "price_alerts")?);
            // ... existing body unchanged ...
        }
```

- [ ] **Step 5: Register the command**

In `invoke_handler` (line 2136), add `apply_alert_mutations,` after `merge_watchlist,`.

- [ ] **Step 6: Run tests + lints**

Run: `cd desktop/src-tauri && cargo test 2>&1 | tail -5 && cargo clippy --all-targets 2>&1 | tail -3 && cargo fmt --check`
Expected: all tests pass (76), clippy/fmt clean.

- [ ] **Step 7: Commit**

```bash
git add desktop/src-tauri/src/lib.rs
git commit -m "fix: serialize alert file writes with per-item patches (Rust)"
```

---

## Task 2: Renderer diff + adapter

**Files:**
- Create: `desktop/src/lib/alert-mutations.ts`
- Modify: `desktop/src/storage.ts`
- Test: `desktop/tests/alert-mutations.test.ts` (new), `desktop/tests/storage-mirror-merge.test.ts` (update)

- [ ] **Step 1: Write the failing diff test**

Create `desktop/tests/alert-mutations.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeAlertMutations } from "../src/lib/alert-mutations";

describe("computeAlertMutations", () => {
  it("patches only the changed fields", () => {
    const last = [{ id: "a1", targetPrice: 500, isActive: true, snoozedUntil: null }];
    const next = [{ id: "a1", targetPrice: 450, isActive: true, snoozedUntil: null }];
    expect(computeAlertMutations(last, next)).toEqual({
      upserts: [{ id: "a1", patch: { targetPrice: 450 } }],
      removes: [],
    });
  });

  it("sends null to clear a removed field (re-arm)", () => {
    const last = [{ id: "a1", isActive: false, triggeredAt: "2026-06-02T00:00:00.000Z" }];
    const next = [{ id: "a1", isActive: true }];
    expect(computeAlertMutations(last, next)).toEqual({
      upserts: [{ id: "a1", patch: { isActive: true, triggeredAt: null } }],
      removes: [],
    });
  });

  it("sends a full item for an add and lists removals", () => {
    const last = [{ id: "gone", targetPrice: 1 }];
    const next = [{ id: "new", targetPrice: 2, currency: "USD" }];
    expect(computeAlertMutations(last, next)).toEqual({
      upserts: [{ id: "new", patch: { targetPrice: 2, currency: "USD" } }],
      removes: ["gone"],
    });
  });

  it("is a no-op when nothing changed", () => {
    const same = [{ id: "a1", targetPrice: 500 }];
    expect(computeAlertMutations(same, structuredClone(same))).toEqual({
      upserts: [],
      removes: [],
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --dir desktop test alert-mutations`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `computeAlertMutations`**

Create `desktop/src/lib/alert-mutations.ts`:

```ts
export type AlertPatch = Record<string, unknown>;

export interface AlertMutations {
  upserts: { id: string; patch: AlertPatch }[];
  removes: string[];
}

/**
 * Diffs the renderer's previous and next alert arrays into per-item field
 * patches. Only changed fields are sent, so the Rust side never has to guess
 * between a stale snapshot and a deliberate re-arm; a field removed in `next`
 * becomes `null` (Rust removes it).
 */
export function computeAlertMutations(
  last: Record<string, unknown>[],
  next: Record<string, unknown>[],
): AlertMutations {
  const lastById = new Map(last.map((a) => [String(a.id), a]));
  const nextIds = new Set(next.map((a) => String(a.id)));
  const removes = [...lastById.keys()].filter((id) => !nextIds.has(id));
  const upserts: { id: string; patch: AlertPatch }[] = [];
  for (const item of next) {
    const id = String(item.id);
    const prev = lastById.get(id);
    if (!prev) {
      const { id: _omit, ...rest } = item;
      upserts.push({ id, patch: rest });
      continue;
    }
    const patch: AlertPatch = {};
    const keys = new Set([...Object.keys(prev), ...Object.keys(item)]);
    for (const key of keys) {
      if (key === "id") continue;
      const before = prev[key];
      const after = item[key];
      if (JSON.stringify(before) === JSON.stringify(after)) continue;
      patch[key] = after === undefined ? null : after;
    }
    if (Object.keys(patch).length > 0) upserts.push({ id, patch });
  }
  return { upserts, removes };
}
```

- [ ] **Step 4: Run the diff test**

Run: `pnpm --dir desktop test alert-mutations`
Expected: PASS.

- [ ] **Step 5: Wire the adapter (`desktop/src/storage.ts`)**

Add module state and an alerts branch. At the top (after `const isTauri = detectTauri();`):

```ts
let lastMirroredAlerts: Record<string, unknown>[] = [];
let alertsMirrorSeeded = false;
```

In `mirrorToFile`, after the `watchlist_products` branch, add:

```ts
    if (key === "price_alerts") {
      const { invoke } = await import("@tauri-apps/api/core");
      const { computeAlertMutations } = await import("./lib/alert-mutations");
      const next = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
      if (!alertsMirrorSeeded) {
        // Seed from disk so a deletion made before the first save is detected.
        const current = await invoke<unknown>("read_value_for_key", { key: "price_alerts" });
        lastMirroredAlerts = Array.isArray(current)
          ? (current as Record<string, unknown>[])
          : [];
        alertsMirrorSeeded = true;
      }
      const { upserts, removes } = computeAlertMutations(lastMirroredAlerts, next);
      if (upserts.length === 0 && removes.length === 0) return;
      const merged = await invoke<string>("apply_alert_mutations", { upserts, removes });
      lastMirroredAlerts = JSON.parse(merged) as Record<string, unknown>[];
      try {
        localStorage.setItem(key, merged);
      } catch {
        // storage disabled/full — the file store is authoritative
      }
      return;
    }
```

In `getItem`, add a `price_alerts` branch (alongside the watchlist one):

```ts
    if (isTauri && key === "price_alerts") {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const val = await invoke<unknown>("read_value_for_key", { key: "price_alerts" });
        if (Array.isArray(val)) {
          lastMirroredAlerts = val as Record<string, unknown>[];
          alertsMirrorSeeded = true;
          return JSON.stringify(val);
        }
      } catch {
        // fall through to localStorage
      }
    }
```

- [ ] **Step 6: Update the adapter tests**

In `desktop/tests/storage-mirror-merge.test.ts`:
- Change the "still uses the plain setter for the other mirrored keys" test to use reminders instead of alerts:
```ts
  it("still uses the plain setter for the other mirrored keys", async () => {
    const { storage } = await loadStorage();
    await storage.saveBackOrderReminders([] as never);
    expect(invokeMock).toHaveBeenCalledWith("set_value_for_key", {
      key: "back_order_reminders",
      value: [],
    });
  });
```
- Add alerts-specific tests:
```ts
  it("sends per-item alert mutations instead of overwriting the array", async () => {
    const { storage } = await loadStorage();
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === "read_value_for_key") return [{ id: "a1", targetPrice: 500 }];
      if (cmd === "apply_alert_mutations") return JSON.stringify([{ id: "a1", targetPrice: 450 }]);
      return "[]";
    });
    await storage.saveAlerts([{ id: "a1", targetPrice: 450 }] as never);
    expect(invokeMock).toHaveBeenCalledWith("apply_alert_mutations", {
      upserts: [{ id: "a1", patch: { targetPrice: 450 } }],
      removes: [],
    });
    expect(invokeMock).not.toHaveBeenCalledWith(
      "set_value_for_key",
      expect.objectContaining({ key: "price_alerts" }),
    );
  });

  it("reads alerts from the file store", async () => {
    const { storage } = await loadStorage();
    invokeMock.mockImplementation(async (cmd: string) =>
      cmd === "read_value_for_key" ? [{ id: "a1" }] : "[]",
    );
    const alerts = await storage.getAlerts();
    expect(invokeMock).toHaveBeenCalledWith("read_value_for_key", { key: "price_alerts" });
    expect(alerts).toEqual([{ id: "a1" }]);
  });
```

- [ ] **Step 7: Verify + commit**

Run: `pnpm --dir desktop test` (all pass), `pnpm check:desktop` (0 errors).

```bash
git add desktop/src/lib/alert-mutations.ts desktop/src/storage.ts desktop/tests/alert-mutations.test.ts desktop/tests/storage-mirror-merge.test.ts
git commit -m "fix: desktop alert writes go through per-item field patches"
```

---

## Task 3: Full verification + docs

- [ ] **Step 1: Run everything**

Run: `pnpm check && pnpm lint && pnpm test && pnpm check:desktop && pnpm --dir desktop test && (cd desktop/src-tauri && cargo test && cargo clippy --all-targets && cargo fmt --check)`
Expected: all green.

- [ ] **Step 2: Append the phase entry to `todo.md`**

```md
## Phase 1045: Desktop price_alerts write-race (per-item patches)

- [x] The renderer overwrote `price_alerts` wholesale while the Rust poller read-modify-wrote it, so a stale snapshot could un-fire an alert (and the UI never saw poller triggers). Alerts now read from the file store and save through `apply_alert_mutations` with renderer-computed field patches (`desktop/src/lib/alert-mutations.ts`).
- [x] Rust `apply_alert_mutations(upserts, removes)` applies only the patched fields (null removes; absent fields untouched), so poller-owned `triggeredAt`/`triggeredPrice` survive an unrelated save and a re-arm patch reliably clears them. Serialized with the poller's write by `ALERTS_FILE_LOCK`.
- [x] Tests: Rust `apply_alert_mutations_*` (trigger preserved, re-arm clears, add/remove, missing id); renderer `computeAlertMutations` diff cases; adapter routing test. `tsc 0` (root + desktop), lint 0 errors, root + desktop + cargo suites green.
```

- [ ] **Step 3: Commit**

```bash
git add todo.md
git commit -m "Docs: desktop alert write-race phase entry (Phase 1045)"
```
