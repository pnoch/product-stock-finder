# Error Paths + Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate six verified silent-failure / unsafe-delete gaps by mirroring tested mobile patterns, with a guard test per fix.

**Architecture:** No new infra or UX language. Desktop call sites gain `showToast` + dev `console.error` + existing-function Retry; deletes gain `window.confirm` (same as desktop Watchlist); discovery gains the shared `DiscoveryAuthError`/`DiscoveryError` taxonomy; Settings gains a Verified/Resend row fed by the server's existing `emailVerified` field.

**Tech Stack:** React (desktop), Testing Library + jsdom (desktop/tests, run via `desktop/ pnpm test`), vitest string-guards (root `tests/`, run via root `pnpm test`), tsc (`pnpm check`), eslint (`pnpm lint`).

**File map:**
- Modify: `desktop/src/pages/Alerts.tsx` (Tasks 1, 4), `desktop/src/pages/Watchlist.tsx` (Task 2), `desktop/src/App.tsx` (Task 2), `server/db.ts` (Task 3), `desktop/src/pages/Search.tsx` + `desktop/src/components/SearchModal.tsx` (Task 5), `desktop/src/hooks/use-auth.ts` + `desktop/src/pages/Settings.tsx` (Task 6)
- Tests: `desktop/tests/error-paths-safety.test.tsx` (Tasks 1, 2, 4, 5, 6 behavioral), `tests/delete-user-cleanup.test.ts` (Task 3), extend `tests/desktop-email-auth.test.ts` (Task 6 string-guard)

---

### Task 1: Alerts silent catches → toast + retry

**Files:**
- Modify: `desktop/src/pages/Alerts.tsx:129-138` (history/unread load), `:208-219` (mark-all, mark-one)
- Test: `desktop/tests/error-paths-safety.test.tsx` (new file; follow `desktop/tests/pages.test.tsx` mock-storage pattern)

The page already has `showToast` (verify import) and a `loadNotifications`-style reload — read the file first; if the loader is inline in the `useEffect`, extract it to a `useCallback` named `loadNotifications` so Retry can call it.

- [ ] **Step 1: Write the failing test** — history-load failure shows toast + Retry button; clicking Retry re-calls the loader:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";

const mockStorage = vi.hoisted(() => ({
  getWatchlist: vi.fn().mockResolvedValue([]),
  getAlerts: vi.fn().mockResolvedValue([]),
  getSettings: vi.fn().mockResolvedValue({ displayCurrency: "USD" }),
  getBackOrderReminders: vi.fn().mockResolvedValue([]),
  getStockWatches: vi.fn().mockResolvedValue([]),
  getNotificationHistory: vi.fn(),
  getUnreadNotificationCount: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
}));

vi.mock("../src/storage", () => ({ storage: mockStorage }));

import { Alerts } from "../src/pages/Alerts";

beforeEach(() => {
  vi.clearAllMocks();
  mockStorage.getNotificationHistory.mockRejectedValue(new Error("boom"));
  mockStorage.getUnreadNotificationCount.mockResolvedValue(0);
});

describe("alerts error paths", () => {
  it("toasts and offers Retry when notification history fails to load", async () => {
    render(<MemoryRouter><Alerts /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/couldn't load notifications/i)).toBeInTheDocument());
    mockStorage.getNotificationHistory.mockResolvedValue([]);
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => expect(mockStorage.getNotificationHistory).toHaveBeenCalledTimes(2));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test error-paths-safety` (workdir: `desktop/`)
Expected: FAIL — no "couldn't load notifications" text (current `catch {}` swallows).

- [ ] **Step 3: Write minimal implementation** — replace the three bare catches:

```tsx
} catch {
  console.error("[Alerts] Failed to load notifications");
  setNotifError("Couldn't load notifications.");
}
```

`handleMarkAllRead` / `handleNotificationOpen` catches become:

```tsx
} catch {
  console.error("[Alerts] Failed to update notification read state");
  showToast("Couldn't update notification. Try again.");
}
```

Render (near the notifications list; reuse the page's existing red error-box classes from RestockWatches if present, else plain text + button):

```tsx
{notifError && (
  <div>
    <span>{notifError}</span>
    <button onClick={() => void loadNotifications()} aria-label="Retry loading notifications">Retry</button>
  </div>
)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test error-paths-safety` (workdir: `desktop/`)
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/Alerts.tsx desktop/tests/error-paths-safety.test.tsx
git commit -m "Fix: surface Alerts notification load/update failures with retry. TypeScript: 0 errors."
```

---

### Task 2: Bulk-tag catch + Cmd+E shortcut guard

**Files:**
- Modify: `desktop/src/pages/Watchlist.tsx:671-681` (`openBulkTagSheet`), `desktop/src/App.tsx:178-180` (Cmd+E)
- Test: `desktop/tests/error-paths-safety.test.tsx` (append; string-guard for App.tsx via root `tests/` — see Step 1)

- [ ] **Step 1: Write the failing tests** — (a) behavioral: bulk-tag load failure toasts; (b) string-guard asserting the shortcut no longer floats:

```tsx
// append to desktop/tests/error-paths-safety.test.tsx (mock storage.getTagDefinitions to reject,
// render Watchlist, open bulk-tag sheet, expect "Couldn't load tags" toast text)
```

```ts
// tests/desktop-shortcut-guard.test.ts (root; follow tests/desktop-email-auth.test.ts pattern)
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop export shortcut", () => {
  it("handles export failure with feedback", async () => {
    const text = await readFile("desktop/src/App.tsx", "utf8");
    expect(text).toContain("exportWatchlistAsJson().catch");
    expect(text).toContain("Export failed");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test error-paths-safety` (workdir `desktop/`); `pnpm vitest run tests/desktop-shortcut-guard.test.ts` (repo root)
Expected: both FAIL.

- [ ] **Step 3: Write minimal implementation**

```tsx
// Watchlist.tsx openBulkTagSheet
} catch {
  console.error("[Watchlist] Failed to load tag definitions");
  showToast("Couldn't load tags");
}
```

```tsx
// App.tsx Cmd+E — App already has showToast? verify; if not, use the same toast hook the file uses
exportWatchlistAsJson().catch(() => showToast("Export failed"));
```

If `exportWatchlistAsJson` is sync (verify signature in `desktop/src/import-export.ts`), wrap: `try { exportWatchlistAsJson(); } catch { showToast("Export failed"); }` and adjust the guard test string accordingly.

- [ ] **Step 4: Run tests to verify they pass**

Run: same two commands. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/Watchlist.tsx desktop/src/App.tsx desktop/tests/error-paths-safety.test.tsx tests/desktop-shortcut-guard.test.ts
git commit -m "Fix: guard bulk-tag load and export shortcut failures. TypeScript: 0 errors."
```

---

### Task 3: Log deleteUserById cleanup failure

**Files:**
- Modify: `server/db.ts:152-157`
- Test: `tests/delete-user-cleanup.test.ts` (new; mock pattern from `tests/sync-router.test.ts`)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const deletes: string[] = [];
vi.mock("../server/db", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../server/db")>();
  return {
    ...mod,
    getDb: vi.fn(async () => ({
      delete: vi.fn((table: unknown) => {
        const name = (table as { [key: string]: unknown })._.name as string;
        deletes.push(name);
        if (name === "revoked_devices") return Promise.reject(new Error("boom"));
        return Promise.resolve();
      }),
    })),
  };
});

import { deleteUserById } from "../server/db";

beforeEach(() => { deletes.length = 0; });

describe("deleteUserById", () => {
  it("logs revocation cleanup failure and still deletes the user", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await deleteUserById(1);
    expect(err).toHaveBeenCalledWith(expect.stringContaining("[Database]"), expect.anything());
    expect(deletes).toContain("users");
    err.mockRestore();
  });
});
```

Note: drizzle table name access — verify `(table as any)._.name` yields `"revoked_devices"`/`"users"` at implementation time; if the mock shape is wrong, assert on call order instead (first delete rejects, second still attempted). If the dynamic `import("../drizzle/schema")` breaks under mock, fall back to a string-guard (assert `console.error("[Database]` + `await db.delete(users)` both present) and note why in the commit message.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/delete-user-cleanup.test.ts` (repo root)
Expected: FAIL — `console.error` never called (current nested `catch {}`).

- [ ] **Step 3: Write minimal implementation**

```ts
try {
  const { revokedDevices } = await import("../drizzle/schema");
  try {
    await db.delete(revokedDevices).where(eq(revokedDevices.userId, id));
  } catch (e) {
    console.error("[Database] Failed to clean up revoked devices for user", id, e);
  }
} catch (e) {
  console.error("[Database] Failed to load revoked devices schema", e);
}
await db.delete(users).where(eq(users.id, id));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/delete-user-cleanup.test.ts` (repo root)
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/db.ts tests/delete-user-cleanup.test.ts
git commit -m "Fix: log revoked-device cleanup failure in deleteUserById. TypeScript: 0 errors."
```

---

### Task 4: Confirm before alert/reminder/watch deletes

**Files:**
- Modify: `desktop/src/pages/Alerts.tsx:150-154` (`handleDeleteAlert`), `:222-230` (`handleDeleteReminder`, `handleDeleteWatch`), `desktop/src/pages/RestockWatches.tsx:35-42` (`handleRemove`)
- Test: `desktop/tests/error-paths-safety.test.tsx` (append)

Copy (mirror mobile `hooks/use-alerts-data.ts`, `app/restock-watches.tsx`): `"Delete this alert? This cannot be undone."`, `"Delete this reminder? This cannot be undone."`, `"Stop watching for this restock? This cannot be undone."` — read mobile files first and match exact wording.

- [ ] **Step 1: Write the failing tests**

```tsx
it("does not delete an alert when the confirm is dismissed", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  // render Alerts with one alert in mockStorage.getAlerts, click its Delete button
  expect(mockStorage.removeAlert).not.toHaveBeenCalled();
  confirm.mockRestore();
});

it("deletes an alert when the confirm is accepted", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
  // click Delete
  await waitFor(() => expect(mockStorage.removeAlert).toHaveBeenCalled());
  expect(confirm).toHaveBeenCalledWith(expect.stringContaining("cannot be undone"));
  confirm.mockRestore();
});
```

Repeat the pair for reminder delete; single accepted/dismissed pair for RestockWatches `handleRemove` (mock `removeStockWatch`). If rendering full pages is heavy, render the same way `pages.test.tsx` does with MemoryRouter.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test error-paths-safety` (workdir: `desktop/`)
Expected: FAIL — `removeAlert` called without confirm (or confirm never called).

- [ ] **Step 3: Write minimal implementation**

```tsx
const handleDeleteAlert = async (id: string) => {
  if (!window.confirm("Delete this alert? This cannot be undone.")) return;
  await storage.removeAlert(id);
  showToast("Alert deleted");
  refreshAlerts();
};
```

Same shape for `handleDeleteReminder`, `handleDeleteWatch`, and RestockWatches `handleRemove` (keep its existing try/catch + toast).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test error-paths-safety` (workdir: `desktop/`)
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/Alerts.tsx desktop/src/pages/RestockWatches.tsx desktop/tests/error-paths-safety.test.tsx
git commit -m "Fix: confirm before deleting alerts, reminders, and stock watches. TypeScript: 0 errors."
```

---

### Task 5: Discovery errors → auth guidance + retry

**Files:**
- Modify: `desktop/src/pages/Search.tsx:202-213`, `desktop/src/components/SearchModal.tsx:202-223`
- Test: `desktop/tests/error-paths-safety.test.tsx` (append)

Desktop already imports `discoverProduct` from `../../../lib/llm-discovery`; import `DiscoveryAuthError, DiscoveryError` from the same module (verified to export both). Desktop has no `showAlert` dialog — use inline error state + `showToast`, matching each file's existing conventions.

- [ ] **Step 1: Write the failing tests**

```tsx
// mock discoverProduct per-test via vi.mock("../../../lib/llm-discovery") — note the relative
// path from desktop/tests/ is "../../lib/llm-discovery"; verify at implementation time.
it("shows sign-in guidance on DiscoveryAuthError", async () => {
  mockedDiscover.mockRejectedValue(new DiscoveryAuthError(401));
  // render Search, submit query, expect "Sign-in Required" text
});
it("offers Retry on DiscoveryError timeout", async () => {
  mockedDiscover.mockRejectedValue(new DiscoveryError("timeout", "timed out"));
  // expect timeout copy + Retry button; click Retry → discover called twice
});
```

Cover both Search.tsx and SearchModal.tsx (auth case in one, retry case in the other at minimum; all four combos ideal).

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test error-paths-safety` (workdir: `desktop/`)
Expected: FAIL — spinner clears with zero feedback (current `try/finally`, no catch).

- [ ] **Step 2b (SearchModal only): break the total-coupling if needed** — if `handleDiscover` closes the modal on success via `onClose`, keep that; on failure the modal must STAY open showing the error (do not call `onClose` in the catch path).

- [ ] **Step 3: Write minimal implementation** (mirror mobile `app/search.tsx:196-221`):

```tsx
} catch (e) {
  if (e instanceof DiscoveryAuthError) {
    setDiscoverError({ title: "Sign-in Required", message: "Please sign in to use AI discovery.", retry: false });
  } else if (e instanceof DiscoveryError) {
    const message =
      e.kind === "timeout" ? "Discovery timed out. Check your connection and try again."
      : e.kind === "network" ? `Network error: ${e.message}`
      : e.kind === "server" ? (e.status ? `Server error (${e.status}). Try again in a moment.` : e.message)
      : "We couldn't parse the discovery response. Try again.";
    setDiscoverError({ title: "Discovery Failed", message, retry: true });
  } else {
    setDiscoverError({ title: "Discovery Failed", message: "We couldn't find that product. Try again.", retry: true });
  }
  showToast(discoverErrorTitle);
} finally {
  setDiscovering(false);
}
```

Render the error near the Discover button with a Retry button calling `void handleDiscover()` when `retry` is true. Keep it as local `useState` (no new components — YAGNI).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test error-paths-safety` (workdir: `desktop/`)
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/Search.tsx desktop/src/components/SearchModal.tsx desktop/tests/error-paths-safety.test.tsx
git commit -m "Fix: surface AI discovery errors with auth guidance and retry. TypeScript: 0 errors."
```

---

### Task 6: Email-verification badge + resend in Settings

**Files:**
- Modify: `desktop/src/hooks/use-auth.ts:8-17` (User type), `:71-88` (mapUser + decoded shape), `desktop/src/pages/Settings.tsx` Account section (~691-760)
- Test: `desktop/tests/error-paths-safety.test.tsx` (append behavioral) + extend `tests/desktop-email-auth.test.ts` (string-guard)

Server already sends `emailVerified` (`server/_core/oauth.ts:208-217`); desktop `mapUser` drops it — that is the whole data gap.

- [ ] **Step 1: Write the failing tests**

```tsx
// behavioral: Settings with email user, emailVerified false → Resend button present;
// click → resendVerification called → success toast. Mock use-auth module.
```

```ts
// tests/desktop-email-auth.test.ts — append:
it("surfaces email verification state and resend in Account UI", async () => {
  const hooks = await readFile("desktop/src/hooks/use-auth.ts", "utf8");
  const settings = await readFile("desktop/src/pages/Settings.tsx", "utf8");
  expect(hooks).toContain("emailVerified");
  expect(settings).toContain("emailVerified");
  expect(settings).toContain("resendVerification");
  expect(settings).toContain("Resend");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test error-paths-safety` (workdir `desktop/`); `pnpm vitest run tests/desktop-email-auth.test.ts` (root)
Expected: FAIL — `emailVerified` appears in neither hooks nor Settings.

- [ ] **Step 3: Write minimal implementation**

```ts
// use-auth.ts
export type User = {
  ...
  emailVerified?: boolean | null;
};
```

```ts
// mapUser decoded shape + return: add `emailVerified?: number | boolean | null;`
// return: `emailVerified: data.emailVerified == null ? null : Boolean(data.emailVerified),`
```

Also add `emailVerified` to the OAuth `decoded` cast shape (~line 231) the same way. Verify `setUserInfo`/`getUserInfo` round-trip (localStorage JSON — no change needed).

```tsx
// Settings.tsx Account section, under the email line (condensed from mobile account-section.tsx):
{user.email != null && user.emailVerified === true && (
  <span aria-label="Email verified">Verified</span>
)}
{user.email != null && user.emailVerified === false && (
  <div>
    <span>Check your email to verify your address.</span>
    <button onClick={handleResend} disabled={resending} aria-label="Resend verification email">
      {resending ? "Sending" : "Resend"}
    </button>
  </div>
)}
```

```tsx
const handleResend = async () => {
  setResending(true);
  try {
    await resendVerification();
    showToast("Verification email sent — check your inbox.");
  } catch (e) {
    showToast(e instanceof Error ? e.message : "Resend failed");
  } finally {
    setResending(false);
  }
};
```

`user.emailVerified !== true` vs `=== false`: use explicit `=== false` for the prompt so unknown (null, e.g. Google OAuth without the field) shows nothing rather than nagging — matches mobile `needsVerification` which requires `isAuthenticated && user?.email && !emailVerified`... mobile nags on falsy. Decision: mirror mobile — show prompt when `user.email != null && !user.emailVerified`. (Mobile parity wins; OAuth users with verified emails get one ignorable row only if the server omits the field, and the server DOES send it.)

- [ ] **Step 4: Run tests to verify they pass**

Run: same two commands. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/hooks/use-auth.ts desktop/src/pages/Settings.tsx desktop/tests/error-paths-safety.test.tsx tests/desktop-email-auth.test.ts
git commit -m "Feat: email verification badge and resend in desktop Settings. TypeScript: 0 errors."
```

---

### Final verification (all tasks)

```bash
pnpm check          # expect: 0 errors
pnpm lint           # expect: 0 errors
pnpm test           # expect: 0 failures (root)
pnpm test           # workdir desktop/ — expect: 0 failures
pnpm build          # workdir desktop/ — expect: exit 0
```

Do NOT push. Report DONE (per-task outcome + verification counts) or BLOCKED/NEEDS_CONTEXT.
