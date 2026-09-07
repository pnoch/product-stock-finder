# Desktop Account Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Signed-in desktop users can permanently delete their server account plus local data from Danger Zone.

**Architecture:** Second confirm-gated button in Danger Zone calling public `POST /api/auth/delete-account` with Bearer token, then existing `logout()` + `clearAllData()` + reload. Strict order: server first (abort on failure), logout (tolerated), wipe last. No server or mobile changes.

**Tech Stack:** React, vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-desktop-account-deletion-design.md`

---

### Task 1: Guard tests for account deletion

**Files:**
- Create: `tests/desktop-account-deletion.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop account deletion", () => {
  it("offers server account deletion with confirm payload", async () => {
    const text = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    expect(text).toContain("Delete account");
    expect(text).toContain("/api/auth/delete-account");
    expect(text).toContain('"DELETE"');
  });

  it("wipes local data only after server confirms", async () => {
    const text = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    const deleteIdx = text.indexOf("/api/auth/delete-account");
    const wipeIdx = text.indexOf("clearAllData", deleteIdx);
    expect(deleteIdx).toBeGreaterThanOrEqual(0);
    expect(wipeIdx).toBeGreaterThan(deleteIdx);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/desktop-account-deletion.test.ts 2>&1 | tail -4`
Expected: FAIL (2 failed — verify neither string already exists; if one passes, report instead of committing).

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/desktop-account-deletion.test.ts
git commit -m "test: guard desktop account deletion"
```

---

### Task 2: Delete-account button in Danger Zone

**Files:**
- Modify: `desktop/src/pages/Settings.tsx`

- [ ] **Step 1: Read the Danger Zone block first**

Current block (~lines 631-665): "Danger Zone" h2, `clearConfirm` two-step for Clear All Data via `handleClearAllData` (`await storage.clearAllData(); setClearConfirm(false); window.location.reload();`), `logout` and `getSessionToken` available from `../hooks/use-auth` (logout already used for sign-out — verify import includes both; `getApiBaseUrl` imported line 34).

- [ ] **Step 2: Add delete state + handler**

```tsx
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteAccount = useCallback(async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const token = getSessionToken();
      const res = await fetch(`${getApiBaseUrl()}/api/auth/delete-account`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ confirm: "DELETE" }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Server account deletion failed");
      }
      try {
        logout();
      } catch {
        // token is removed by the wipe below regardless
      }
      await storage.clearAllData();
      window.location.reload();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Server account deletion failed");
    } finally {
      setDeleting(false);
    }
  }, [deleting]);
```
Check `useCallback` in react import; add if missing. Verify `logout` and `getSessionToken` are imported from `../hooks/use-auth` (logout is used by sign-out; getSessionToken is exported — add to the import if absent). Also add `disabled={deleting}` to the three existing Clear All Data buttons (initial, Yes, Cancel) so both Danger-Zone actions lock while a delete is in flight (per spec).

- [ ] **Step 3: Render button (signed-in Danger Zone only)**

Danger Zone renders unconditionally? Read first: if the Danger Zone card shows for signed-out users too, gate ONLY the new button on `isAuthenticated && user` (verify those names — used by Account branch). Insert after the Clear All Data confirm block:
```tsx
          {isAuthenticated && user && (
            <div className="mt-4">
              {!deleteConfirm ? (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-800 text-white rounded-lg hover:bg-red-900 transition-colors text-sm font-medium"
                  aria-label="Delete account and data"
                >
                  <Trash2 className="w-4 h-4" /> Delete account & data
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    This permanently deletes your server account and all local data. This cannot be undone.
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleting}
                      className="px-4 py-2 bg-red-800 text-white rounded-lg hover:bg-red-900 transition-colors text-sm font-medium disabled:opacity-50"
                      aria-label="Confirm delete account and data"
                    >
                      {deleting ? "Deleting" : "Yes, delete everything"}
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(false)}
                      className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                      aria-label="Cancel delete account and data"
                    >
                      Cancel
                    </button>
                  </div>
                  {deleteError && (
                    <p className="text-sm text-red-600 dark:text-red-400" role="alert">{deleteError}</p>
                  )}
                </div>
              )}
            </div>
          )}
```
Verify `Trash2` icon import exists (used by Clear All Data — yes). Match danger styling (deeper red `bg-red-800` distinguishes from local-only clear; if the file has no red-800 precedent, reuse `bg-red-600` — read first, match file).

- [ ] **Step 4: Verify**

Run: `pnpm vitest run tests/desktop-account-deletion.test.ts` (both pass) and `pnpm check` (clean).

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/Settings.tsx
git commit -m "Feat: desktop Danger Zone server account deletion. TypeScript: 0 errors."
```

---

### Task 3: Full verification + push

**Files:** none (verification only)

- [ ] **Step 1: Lint + full suite**

`pnpm lint` (0 errors, no new warnings in Settings.tsx), `pnpm test` (all pass, 0 failures).

- [ ] **Step 2: Desktop build**

Workdir `desktop/`: `pnpm build` (exit 0).

- [ ] **Step 3: Push**

`git push origin main` (`main -> main`), `git status --short` empty.
